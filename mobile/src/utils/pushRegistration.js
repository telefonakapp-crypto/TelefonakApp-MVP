import { Platform, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import apiClient from './api';
import { getAuthToken } from './authSession';

const LOCAL_PREFERENCE_KEY = 'pushNotificationsEnabled';
const LAST_TOKEN_KEY = 'expoPushToken';

export function getLocalPreferenceKey() {
  return LOCAL_PREFERENCE_KEY;
}

function logPushSkip(reason, extra) {
  if (!__DEV__) return;
  const detail = extra?.message || extra;
  if (detail != null && detail !== '') {
    console.log(`[push] skipped (${reason})`, detail);
    return;
  }
  console.log(`[push] skipped (${reason})`);
}

function isIosSimulator() {
  if (Platform.OS !== 'ios') return false;
  try {
    const flag = Settings.get('telefonak_is_simulator');
    return flag === true || flag === 1 || flag === '1' || flag === 'true';
  } catch {
    return false;
  }
}

/**
 * expo-notifications throws at import time via requireNativeModule('ExpoPushTokenManager')
 * when the native module is not compiled into the current binary. Check first.
 */
function isNativePushModuleAvailable() {
  try {
    return requireOptionalNativeModule('ExpoPushTokenManager') != null;
  } catch (error) {
    logPushSkip('native_module_check_failed', error);
    return false;
  }
}

function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    null
  );
}

async function loadNotificationsModule() {
  if (!isNativePushModuleAvailable()) {
    logPushSkip('native_module_unavailable');
    return null;
  }
  try {
    // Isolated so Metro does not evaluate expo-notifications while this file loads.
    const { importExpoNotifications } = require('./expoNotificationsModule');
    return await importExpoNotifications();
  } catch (error) {
    logPushSkip('module_import_failed', error);
    return null;
  }
}

export async function fetchPushPreference() {
  const response = await apiClient.get('/notifications/preferences');
  return response.data.push_notifications_enabled === true;
}

export async function updatePushPreference(enabled) {
  const response = await apiClient.patch('/notifications/preferences', {
    push_notifications_enabled: enabled,
  });
  return response.data.push_notifications_enabled === true;
}

/**
 * One-time: if this device previously stored a local OFF, honor it on the
 * server once, then drop the local key so the backend is the source of truth.
 */
export async function migrateLocalPushPreference(serverEnabled) {
  const stored = await AsyncStorage.getItem(LOCAL_PREFERENCE_KEY);
  if (stored === 'false' && serverEnabled === true) {
    const next = await updatePushPreference(false);
    await AsyncStorage.removeItem(LOCAL_PREFERENCE_KEY);
    return next;
  }
  if (stored != null) {
    await AsyncStorage.removeItem(LOCAL_PREFERENCE_KEY);
  }
  return serverEnabled;
}

export async function rememberDevicePushToken(token) {
  if (!token) return;
  await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
}

export async function getRememberedDevicePushToken() {
  return AsyncStorage.getItem(LAST_TOKEN_KEY);
}

export async function clearRememberedDevicePushToken() {
  await AsyncStorage.removeItem(LAST_TOKEN_KEY);
}

export async function registerDevicePushToken(expoPushToken) {
  if (!expoPushToken) return null;
  const response = await apiClient.put('/notifications/push-token', {
    expo_push_token: expoPushToken,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : undefined,
  });
  await rememberDevicePushToken(expoPushToken);
  return response.data.token;
}

export async function deactivateDevicePushToken() {
  const token = await getRememberedDevicePushToken();
  if (!token) return;
  try {
    await apiClient.delete('/notifications/push-token', {
      data: { expo_push_token: token },
    });
  } catch (error) {
    console.warn('Failed to deactivate push token', error?.message || error);
  } finally {
    await clearRememberedDevicePushToken();
  }
}

/**
 * Register an Expo token when the user wants push AND iOS/Android has granted
 * permission. Does not open system Settings. requestPermission=false never
 * prompts (used on app start / login).
 *
 * Never throws. Never PUTs a token unless Expo actually issued one.
 */
export async function syncDevicePushRegistration({ requestPermission = false } = {}) {
  try {
    const authToken = await getAuthToken();
    if (!authToken) return { registered: false, reason: 'unauthenticated' };

    if (!isNativePushModuleAvailable()) {
      return { registered: false, reason: 'native_module_unavailable' };
    }

    if (isIosSimulator()) {
      logPushSkip('simulator');
      return { registered: false, reason: 'simulator' };
    }

    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return { registered: false, reason: 'native_module_unavailable' };
    }

    let status;
    try {
      status = (await Notifications.getPermissionsAsync()).status;
      if (status !== 'granted' && requestPermission) {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
    } catch (error) {
      logPushSkip('permission_unavailable', error);
      return { registered: false, reason: 'permission_unavailable' };
    }

    if (status !== 'granted') {
      logPushSkip('permission_denied');
      return { registered: false, reason: 'permission_denied', status };
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      logPushSkip('no_project_id');
      return { registered: false, reason: 'no_project_id' };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = tokenResponse?.data;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      logPushSkip('no_token');
      return { registered: false, reason: 'no_token' };
    }

    await registerDevicePushToken(expoPushToken);
    return { registered: true, token: expoPushToken };
  } catch (error) {
    logPushSkip('token_unavailable', error);
    return { registered: false, reason: 'token_unavailable' };
  }
}
