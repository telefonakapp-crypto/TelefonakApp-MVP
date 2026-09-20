import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../config/apiConfig';
import { resolveStoredSession } from './authSession';
import { resolvePostMaintenanceRoute } from './sessionRestore';

export const MAINTENANCE_MESSAGE =
  'Telefonak is currently undergoing scheduled maintenance.';

/** @type {import('@react-navigation/native').NavigationContainerRef<any>|null} */
let navigationRef = null;
let maintenanceActive = false;
let navigatingToMaintenance = false;
/** @type {AbortController} */
let pendingRequestController = new AbortController();
let consoleFilterInstalled = false;
let alertFilterInstalled = false;
/** @type {((message: string, options?: object) => void)|null} */
let dismissToastsImpl = null;

export function setMaintenanceNavigationRef(ref) {
  navigationRef = ref;
}

const AUTH_ENTRY_ROUTES = {
  AuthChoice: true,
  Login: true,
  SignUpPhone: true,
  OTP: true,
  Register: true,
  Onboarding: true,
};

/**
 * After the client confirms the session is gone, leave authenticated screens.
 * No-op on auth entry routes and before the navigator is ready.
 */
export function resetToAuthChoice() {
  if (!navigationRef?.isReady?.()) return;
  const current = navigationRef.getCurrentRoute?.()?.name;
  if (AUTH_ENTRY_ROUTES[current]) return;
  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'AuthChoice' }],
    })
  );
}

export function setMaintenanceToastDismisser(fn) {
  dismissToastsImpl = typeof fn === 'function' ? fn : null;
}

export function isMaintenanceActive() {
  return maintenanceActive;
}

export function isMaintenanceResponse(errorOrData) {
  const data = errorOrData?.response?.data ?? errorOrData;
  const status = errorOrData?.response?.status;
  return status === 503 && data?.maintenance === true;
}

/**
 * True for 503 maintenance responses, our marked silent errors, and
 * in-flight requests aborted because maintenance was entered.
 */
export function isMaintenanceError(error) {
  if (!error) return false;
  if (error.isMaintenance === true || error.name === 'MaintenanceError') {
    return true;
  }
  if (error.code === 'ERR_MAINTENANCE') {
    return true;
  }
  if (isMaintenanceResponse(error)) {
    return true;
  }
  if (
    maintenanceActive &&
    (error.code === 'ERR_CANCELED' ||
      error.name === 'CanceledError' ||
      error.name === 'AbortError')
  ) {
    return true;
  }
  return false;
}

/** Catch-block helper — return true to skip logging / toasts / alerts. */
export function ignoreIfMaintenance(error) {
  return isMaintenanceError(error);
}

export function createMaintenanceError(source) {
  const err = new Error('MAINTENANCE');
  err.name = 'MaintenanceError';
  err.isMaintenance = true;
  err.code = 'ERR_MAINTENANCE';
  // Avoid looking like a raw AxiosError in LogBox dumps.
  err.isAxiosError = false;
  if (source?.response) err.response = source.response;
  if (source?.config) err.config = source.config;
  return err;
}

/** Paths that must still reach the network while the gate is active. */
export function isMaintenanceExemptRequestUrl(url) {
  const value = String(url || '');
  return (
    value.includes('/status') ||
    value.includes('/settings/public') ||
    value.includes('/health') ||
    value.includes('/auth/refresh')
  );
}

/** AbortSignal attached to each apiClient request so we can cancel the flock. */
export function getMaintenanceAbortSignal() {
  return pendingRequestController.signal;
}

function cancelPendingRequests() {
  try {
    pendingRequestController.abort();
  } catch {
    // ignore
  }
  pendingRequestController = new AbortController();
}

/**
 * Always-on filter: swallow maintenance AxiosErrors even before the gate flips,
 * so bare-axios catch blocks cannot LogBox a 503 race.
 */
function installConsoleFilter() {
  if (consoleFilterInstalled) return;
  consoleFilterInstalled = true;
  const originalError = console.error;
  console.error = (...args) => {
    const silent = args.some((arg) => {
      if (isMaintenanceError(arg)) return true;
      if (typeof arg === 'string') {
        if (
          maintenanceActive &&
          /maintenance|status code 503|axioserror|error fetching|error loading|error registering|request failed/i.test(
            arg
          )
        ) {
          return true;
        }
        // Profile / listings noise paired with a maintenance AxiosError arg.
        if (/error fetching|error loading|error registering/i.test(arg)) {
          return args.some((other) => isMaintenanceError(other) || isMaintenanceResponse(other));
        }
      }
      if (arg && typeof arg === 'object') {
        if (isMaintenanceResponse(arg)) return true;
        const msg = String(arg.message || '');
        if (/status code 503|maintenance|ERR_MAINTENANCE/i.test(msg) && (maintenanceActive || arg.response?.data?.maintenance)) {
          return true;
        }
        if (arg.response?.status === 503 && arg.response?.data?.maintenance) return true;
      }
      return false;
    });
    if (silent) return;
    return originalError.apply(console, args);
  };
}

function installAlertFilter() {
  if (alertFilterInstalled) return;
  alertFilterInstalled = true;
  const originalAlert = Alert.alert.bind(Alert);
  Alert.alert = (...args) => {
    if (maintenanceActive) return;
    return originalAlert(...args);
  };
}

// Install log silence as soon as this module loads (before any screen catch).
installConsoleFilter();

/**
 * Mark maintenance active and install silence filters without navigating.
 * Used for cold-start when the Maintenance screen is already the initial route.
 */
export function markMaintenanceActive() {
  installConsoleFilter();
  installAlertFilter();
  maintenanceActive = true;
}

/**
 * Flip global maintenance state, cancel in-flight API work, silence noise, navigate.
 */
export function activateMaintenanceMode(sourceError) {
  const alreadyActive = maintenanceActive;
  markMaintenanceActive();

  if (!alreadyActive) {
    cancelPendingRequests();
    if (typeof dismissToastsImpl === 'function') {
      try {
        dismissToastsImpl();
      } catch {
        // ignore
      }
    }
  }

  enterMaintenanceMode();
  return createMaintenanceError(sourceError);
}

export function clearMaintenanceModeFlag() {
  maintenanceActive = false;
  navigatingToMaintenance = false;
  // Fresh controller for the restored session.
  if (pendingRequestController.signal.aborted) {
    pendingRequestController = new AbortController();
  }
}

/**
 * Probe the always-available status endpoint (bare axios — not apiClient).
 * @returns {Promise<{ maintenance: boolean, message?: string }>}
 */
export async function fetchMaintenanceStatus() {
  const { data } = await axios.get(`${API_BASE_URL}/status`, {
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });
  return {
    maintenance: data?.maintenance === true,
    message: data?.message || MAINTENANCE_MESSAGE,
  };
}

export function enterMaintenanceMode() {
  if (navigatingToMaintenance) return;
  if (!navigationRef?.isReady?.()) return;

  const current = navigationRef.getCurrentRoute?.()?.name;
  if (current === 'Maintenance') return;

  navigatingToMaintenance = true;
  try {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Maintenance' }],
      })
    );
  } finally {
    setTimeout(() => {
      navigatingToMaintenance = false;
    }, 500);
  }
}

/**
 * After maintenance ends, restore the normal cold-start route.
 * Uses the same session resolver as App boot so an expired access JWT
 * with a live refresh token still returns the user Home — never AuthChoice.
 */
export async function exitMaintenanceMode() {
  clearMaintenanceModeFlag();

  if (!navigationRef?.isReady?.()) return;

  const onboarding = await AsyncStorage.getItem('hasSeenOnboarding');
  const session = await resolveStoredSession();
  const routeName = resolvePostMaintenanceRoute({
    hasSeenOnboarding: onboarding === 'true',
    sessionKind: session.kind,
    refreshToken: session.refreshToken,
  });

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: routeName }],
    })
  );
}
