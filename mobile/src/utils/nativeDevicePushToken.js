/**
 * Native device-token acquisition for expo-notifications.
 * Android data is an FCM token. iOS data is an APNs device token.
 * Registration goes through the injected callback. This module does not
 * persist tokens or choose an HTTP client.
 */

export function logLineForNativePushToken(type) {
  if (type !== 'ios' && type !== 'android') return null;
  return `Native push token acquired: ${type}`;
}

export function normalizeNativeDevicePushToken(response) {
  if (!response || typeof response !== 'object') return null;
  const type = response.type;
  const data = response.data;
  if (type !== 'ios' && type !== 'android') return null;
  if (typeof data !== 'string' || data.trim() === '') return null;
  return { type, data };
}

function nativeRegistrationBody(token) {
  if (token.type === 'android') {
    return { device_token: token.data, provider: 'fcm', platform: 'android' };
  }
  if (token.type === 'ios') {
    return { device_token: token.data, provider: 'apns', platform: 'ios' };
  }
  return null;
}

/**
 * Acquire a native device push token and register it.
 * requestPermission false never prompts.
 * Never throws. Never logs the token value.
 */
export async function acquireNativePushRegistration(
  { requestPermission = false } = {},
  deps
) {
  try {
    const authToken = await deps.getAuthToken();
    if (!authToken) return { registered: false, reason: 'unauthenticated' };

    if (!deps.isNativePushModuleAvailable()) {
      return { registered: false, reason: 'native_module_unavailable' };
    }

    if (deps.isIosSimulator()) {
      deps.logPushSkip('simulator');
      return { registered: false, reason: 'simulator' };
    }

    const Notifications = await deps.loadNotificationsModule();
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
      deps.logPushSkip('permission_unavailable', error);
      return { registered: false, reason: 'permission_unavailable' };
    }

    if (status !== 'granted') {
      deps.logPushSkip('permission_denied');
      return { registered: false, reason: 'permission_denied', status };
    }

    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = normalizeNativeDevicePushToken(tokenResponse);
    if (!token) {
      deps.logPushSkip('no_token');
      return { registered: false, reason: 'no_token' };
    }

    if (deps.isDev) {
      const line = logLineForNativePushToken(token.type);
      if (line) deps.log(line);
    }

    const body = nativeRegistrationBody(token);
    if (!body || typeof deps.registerNativePushToken !== 'function') {
      deps.logPushSkip('registration_failed');
      return { registered: false, reason: 'registration_failed' };
    }

    try {
      await deps.registerNativePushToken(body);
    } catch (_error) {
      deps.logPushSkip('registration_failed');
      return { registered: false, reason: 'registration_failed' };
    }

    return { registered: true };
  } catch (error) {
    deps.logPushSkip('token_unavailable', error);
    return { registered: false, reason: 'token_unavailable' };
  }
}
