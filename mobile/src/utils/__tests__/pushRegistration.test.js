'use strict';

/**
 * Run: node --test src/utils/__tests__/pushRegistration.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REGISTRATION_PATH = path.join(__dirname, '..', 'pushRegistration.js');
const ACQUIRE_PATH = path.join(__dirname, '..', 'nativeDevicePushToken.js');

const IOS_TOKEN = 'apns-hex-token-do-not-log-9f3c';
const ANDROID_TOKEN = 'fcm-token-do-not-log-77ab';

function loadAcquire() {
  const source = fs.readFileSync(ACQUIRE_PATH, 'utf8');
  const wrapped = source
    .replace(/export async function /g, 'async function ')
    .replace(/export function /g, 'function ')
    .concat(
      '\nmodule.exports = { acquireNativePushRegistration, normalizeNativeDevicePushToken, logLineForNativePushToken };\n'
    );
  return vm.runInNewContext(wrapped, {
    module: { exports: {} },
    exports: {},
  });
}

function createDeps(overrides = {}) {
  const calls = {
    requestPermissions: 0,
    deviceToken: 0,
    logs: [],
    skips: [],
    registrations: [],
  };
  const notifications = {
    permission: 'granted',
    nextPermission: null,
    token: { type: 'ios', data: IOS_TOKEN },
    async getPermissionsAsync() {
      return { status: this.permission };
    },
    async requestPermissionsAsync() {
      calls.requestPermissions += 1;
      this.permission = this.nextPermission || 'granted';
      return { status: this.permission };
    },
    async getDevicePushTokenAsync() {
      calls.deviceToken += 1;
      return this.token;
    },
    getExpoPushTokenAsync() {
      throw new Error('getExpoPushTokenAsync must not be called');
    },
  };
  const deps = {
    notifications,
    calls,
    async getAuthToken() {
      return 'session';
    },
    isNativePushModuleAvailable() {
      return true;
    },
    isIosSimulator() {
      return false;
    },
    async loadNotificationsModule() {
      return notifications;
    },
    logPushSkip(reason, extra) {
      calls.skips.push({ reason, extra });
    },
    isDev: true,
    log(line) {
      calls.logs.push(line);
    },
    async registerNativePushToken(body) {
      calls.registrations.push(body);
    },
    ...overrides,
  };
  return deps;
}

function assertTokenAbsentFromLogs(calls, token) {
  const rendered = JSON.stringify({ logs: calls.logs, skips: calls.skips });
  assert.equal(rendered.includes(token), false);
}

describe('native device push token acquisition', () => {
  const { acquireNativePushRegistration, normalizeNativeDevicePushToken, logLineForNativePushToken } =
    loadAcquire();

  it('uses getDevicePushTokenAsync and keeps the ios token type without an EAS project id', async () => {
    const deps = createDeps();
    const result = await acquireNativePushRegistration({ requestPermission: false }, deps);

    assert.equal(deps.calls.deviceToken, 1);
    assert.equal(typeof deps.notifications.getExpoPushTokenAsync, 'function');
    assert.equal(result.registered, true);
    assert.equal(result.reason, undefined);
    assert.equal(deps.calls.registrations.length, 1);
    assert.equal(deps.calls.registrations[0].device_token, IOS_TOKEN);
    assert.equal(deps.calls.registrations[0].provider, 'apns');
    assert.equal(deps.calls.registrations[0].platform, 'ios');
    assert.deepEqual(deps.calls.logs, ['Native push token acquired: ios']);
    assertTokenAbsentFromLogs(deps.calls, IOS_TOKEN);
  });

  it('keeps the android token type', async () => {
    const deps = createDeps();
    deps.notifications.token = { type: 'android', data: ANDROID_TOKEN };
    const result = await acquireNativePushRegistration({ requestPermission: false }, deps);

    assert.equal(result.registered, true);
    assert.notEqual(result.reason, 'backend_not_migrated');
    assert.equal(deps.calls.registrations.length, 1);
    assert.equal(deps.calls.registrations[0].provider, 'fcm');
    assert.equal(deps.calls.registrations[0].platform, 'android');
    assert.equal(deps.calls.registrations[0].device_token, ANDROID_TOKEN);
    assert.deepEqual(deps.calls.logs, ['Native push token acquired: android']);
    assertTokenAbsentFromLogs(deps.calls, ANDROID_TOKEN);
  });

  it('does not log or prompt when development diagnostics are off', async () => {
    const deps = createDeps({ isDev: false });
    const result = await acquireNativePushRegistration({ requestPermission: false }, deps);

    assert.equal(result.registered, true);
    assert.equal(deps.calls.registrations[0].provider, 'apns');
    assert.deepEqual(deps.calls.logs, []);
    assert.equal(deps.calls.requestPermissions, 0);
    assertTokenAbsentFromLogs(deps.calls, IOS_TOKEN);
  });

  it('does not request permission when requestPermission is false', async () => {
    const deps = createDeps();
    deps.notifications.permission = 'denied';
    const result = await acquireNativePushRegistration({ requestPermission: false }, deps);

    assert.equal(deps.calls.requestPermissions, 0);
    assert.equal(deps.calls.deviceToken, 0);
    assert.equal(result.reason, 'permission_denied');
    assert.equal(result.status, 'denied');
    assert.equal(result.token, undefined);
  });

  it('may request permission when requestPermission is true', async () => {
    const deps = createDeps();
    deps.notifications.permission = 'undetermined';
    deps.notifications.nextPermission = 'granted';
    const result = await acquireNativePushRegistration({ requestPermission: true }, deps);

    assert.equal(deps.calls.requestPermissions, 1);
    assert.equal(deps.calls.deviceToken, 1);
    assert.equal(deps.calls.registrations[0].platform, 'ios');
    assert.equal(result.registered, true);
    assertTokenAbsentFromLogs(deps.calls, IOS_TOKEN);
  });

  it('does not request permission again when it is already granted', async () => {
    const deps = createDeps();
    await acquireNativePushRegistration({ requestPermission: true }, deps);
    assert.equal(deps.calls.requestPermissions, 0);
    assert.equal(deps.calls.deviceToken, 1);
  });

  it('skips native registration on the iOS simulator', async () => {
    const deps = createDeps({
      isIosSimulator() {
        return true;
      },
    });
    let loaded = false;
    deps.loadNotificationsModule = async () => {
      loaded = true;
      return deps.notifications;
    };
    const result = await acquireNativePushRegistration({ requestPermission: true }, deps);

    assert.equal(result.reason, 'simulator');
    assert.equal(loaded, false);
    assert.equal(deps.calls.deviceToken, 0);
    assert.equal(deps.calls.requestPermissions, 0);
    assert.deepEqual(deps.calls.logs, []);
  });

  it('handles a failed native registration without logging the token', async () => {
    const deps = createDeps();
    deps.notifications.token = { type: 'android', data: ANDROID_TOKEN };
    deps.registerNativePushToken = async () => {
      throw new Error(`registration failed for ${ANDROID_TOKEN}`);
    };
    const result = await acquireNativePushRegistration({ requestPermission: false }, deps);

    assert.equal(result.registered, false);
    assert.equal(result.reason, 'registration_failed');
    assert.equal(result.token, undefined);
    assert.deepEqual(deps.calls.registrations, []);
    assertTokenAbsentFromLogs(deps.calls, ANDROID_TOKEN);
  });

  it('builds a development log line from the platform only', () => {
    assert.equal(logLineForNativePushToken('ios'), 'Native push token acquired: ios');
    assert.equal(logLineForNativePushToken('android'), 'Native push token acquired: android');
    assert.equal(logLineForNativePushToken(IOS_TOKEN), null);
    assert.equal(normalizeNativeDevicePushToken({ type: 'ios', data: IOS_TOKEN }).data, IOS_TOKEN);
    assert.equal(normalizeNativeDevicePushToken({ type: 'web', data: IOS_TOKEN }), null);
  });
});

describe('pushRegistration source contract', () => {
  const registration = fs.readFileSync(REGISTRATION_PATH, 'utf8');
  const acquire = fs.readFileSync(ACQUIRE_PATH, 'utf8');

  it('no longer uses Expo push tokens or an EAS project id', () => {
    assert.match(acquire, /getDevicePushTokenAsync/);
    assert.match(registration, /acquireNativePushRegistration/);
    assert.doesNotMatch(registration, /getExpoPushTokenAsync/);
    assert.doesNotMatch(acquire, /getExpoPushTokenAsync/);
    assert.doesNotMatch(registration, /getExpoProjectId/);
    assert.doesNotMatch(registration, /no_project_id/);
    assert.doesNotMatch(registration, /EXPO_PUBLIC_EAS_PROJECT_ID/);
    assert.doesNotMatch(acquire, /projectId/);
  });

  it('keeps simulator detection and registers native tokens without the Expo payload', () => {
    assert.match(registration, /telefonak_is_simulator/);
    assert.match(registration, /deactivateDevicePushToken/);
    assert.match(registration, /apiClient\.delete\('\/notifications\/push-token'/);
    assert.match(registration, /expo_push_token: expoPushToken/);
    const syncStart = registration.indexOf('export async function syncDevicePushRegistration');
    const syncBody = registration.slice(syncStart);
    const expoHelper = registration.slice(
      registration.indexOf('export async function registerDevicePushToken'),
      syncStart
    );
    assert.match(syncBody, /registerNativePushToken/);
    assert.match(registration, /apiClient\.put\('\/notifications\/push-token'/);
    assert.match(registration, /device_token: body\.device_token/);
    assert.match(registration, /provider: body\.provider/);
    assert.match(registration, /platform: body\.platform/);
    assert.match(expoHelper, /expo_push_token: expoPushToken/);
    assert.doesNotMatch(syncBody, /registerDevicePushToken/);
    assert.doesNotMatch(syncBody, /rememberDevicePushToken/);
    assert.match(registration, /nativePushRegistration/);
    assert.match(registration, /device_token: native\.device_token/);
    assert.match(registration, /provider: native\.provider/);
    assert.match(registration, /platform: native\.platform/);
    assert.doesNotMatch(expoHelper, /provider: 'fcm'/);
    assert.doesNotMatch(acquire, /apiClient/);
    assert.doesNotMatch(acquire, /AsyncStorage/);
    assert.doesNotMatch(acquire, /backend_not_migrated/);
    assert.match(acquire, /provider: 'fcm'/);
    assert.match(acquire, /provider: 'apns'/);
  });

  it('does not write the native token value into a log call', () => {
    assert.match(acquire, /deps\.log\(line\)/);
    assert.match(acquire, /Native push token acquired: \$\{type\}/);
    assert.doesNotMatch(acquire, /deps\.log\(\s*token/);
    assert.doesNotMatch(acquire, /console\.(log|warn|error|debug|info)\([^)]*token/);
    assert.match(registration, /console\.log\(line\)/);
    assert.doesNotMatch(registration, /console\.log\(\s*token/);
    assert.doesNotMatch(registration, /console\.log\([^)]*tokenResponse/);
    assert.doesNotMatch(registration, /console\.warn\([^)]*device_token/);
    const otp = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'OTPScreen.js'), 'utf8');
    assert.match(otp, /syncEnabledPushRegistration\(\{ requestPermission: false \}\)/);
  });
});
