import { Platform, Settings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import apiClient from './api';
import { getAuthToken } from './authSession';
import { acquireNativePushRegistration } from './nativeDevicePushToken';

const LOCAL_PREFERENCE_KEY = 'pushNotificationsEnabled';
const LAST_TOKEN_KEY = 'expoPushToken';
const NATIVE_REGISTRATION_KEY = 'nativePushRegistration';

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

async function readNativePushRegistration() {
  const raw = await AsyncStorage.getItem(NATIVE_REGISTRATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.device_token === 'string' &&
      parsed.device_token &&
      (parsed.provider === 'fcm' || parsed.provider === 'apns') &&
      (parsed.platform === 'android' || parsed.platform === 'ios')
    ) {
      return parsed;
    }
  } catch {
    // Ignore a corrupt local registration and clear it below.
  }
  await AsyncStorage.removeItem(NATIVE_REGISTRATION_KEY);
  return null;
}

export async function deactivateDevicePushToken() {
  const native = await readNativePushRegistration();
  if (native) {
    try {
      await apiClient.delete('/notifications/push-token', {
        data: {
          device_token: native.device_token,
          provider: native.provider,
          platform: native.platform,
        },
      });
    } catch (error) {
      console.warn('Failed to deactivate push token', error?.message || 'failed');
    } finally {
      await AsyncStorage.removeItem(NATIVE_REGISTRATION_KEY);
    }
  }

  const token = await getRememberedDevicePushToken();
  if (!token) return;
  try {
    await apiClient.delete('/notifications/push-token', {
      data: { expo_push_token: token },
    });
  } catch (error) {
    console.warn('Failed to deactivate push token', error?.message || 'failed');
  } finally {
    await clearRememberedDevicePushToken();
  }
}

async function registerNativePushToken(body) {
  await apiClient.put('/notifications/push-token', {
    device_token: body.device_token,
    provider: body.provider,
    platform: body.platform,
  });
  await AsyncStorage.setItem(
    NATIVE_REGISTRATION_KEY,
    JSON.stringify({
      device_token: body.device_token,
      provider: body.provider,
      platform: body.platform,
    })
  );
}

/**
 * Register the native token only when the saved Telefonak preference is on.
 * Never throws.
 */
export async function syncEnabledPushRegistration({ requestPermission = false } = {}) {
  try {
    const enabled = await fetchPushPreference();
    if (!enabled) return { registered: false, reason: 'preference_disabled' };
    return await syncDevicePushRegistration({ requestPermission });
  } catch {
    return { registered: false, reason: 'registration_failed' };
  }
}

/**
 * Acquire a native device push token when the user wants push and permission
 * is granted, then register it with the existing push-token endpoint.
 * Does not open system Settings. requestPermission false never prompts.
 *
 * Android registers provider fcm. iOS registers provider apns for storage only.
 * Expo token registration stays on registerDevicePushToken. The native
 * registration is kept locally only so logout can deactivate that row.
 * The token value is not logged.
 *
 * Never throws.
 */
export async function syncDevicePushRegistration({ requestPermission = false } = {}) {
  return acquireNativePushRegistration(
    { requestPermission },
    {
      getAuthToken,
      isNativePushModuleAvailable,
      isIosSimulator,
      loadNotificationsModule,
      logPushSkip,
      registerNativePushToken,
      isDev: typeof __DEV__ !== 'undefined' && __DEV__,
      log(line) {
        console.log(line);
      },
    }
  );
}
