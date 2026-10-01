'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { deliverPushForNotification } = require('./pushDelivery');
const {
  setFirebaseMessaging,
  resetFirebaseAdminForTests,
} = require('./firebaseAdmin');

const FCM_TOKEN = 'fcm-token-must-not-appear-in-logs';
const EXPO_TOKEN = 'ExponentPushToken[telefonak-test-expo-stays]';
const APNS_TOKEN = 'apns-token-must-stay-unconfigured';

function fakePool(tokens) {
  const updates = [];
  return {
    updates,
    async query(sql) {
      if (sql.includes('push_notifications_enabled')) {
        return { rows: [{ push_notifications_enabled: true }] };
      }
      if (sql.includes('FROM user_push_tokens')) {
        return { rows: tokens };
      }
      if (sql.includes('SET is_active = FALSE') && sql.includes('provider = \'fcm\'')) {
        updates.push('fcm');
        return { rows: [] };
      }
      if (sql.includes('SET is_active = FALSE')) {
        updates.push('expo');
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

const originalConsoleError = console.error;

describe('FCM push delivery', () => {
  let previousCredentials;
  let errorLines;

  beforeEach(() => {
    previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'backend/secrets/firebase-adminsdk.json';
    resetFirebaseAdminForTests();
    errorLines = [];
    console.error = (...args) => {
      errorLines.push(args.map((part) => String(part)).join(' '));
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
    resetFirebaseAdminForTests();
    if (previousCredentials == null) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
  });

  it('sends an FCM token through Firebase Admin with title, body, and data', async () => {
    const sent = [];
    setFirebaseMessaging({
      async sendEach(messages) {
        sent.push(...messages);
        return { responses: messages.map(() => ({ success: true })) };
      },
    });
    const pool = fakePool([
      {
        device_token: FCM_TOKEN,
        expo_push_token: null,
        provider: 'fcm',
        platform: 'android',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Bid update',
      message: 'You were outbid',
      data: {
        type: 'bid',
        notification_id: 42,
        related_listing_id: 9,
      },
    });

    assert.equal(result.status, 'sent');
    assert.equal(result.provider, 'fcm');
    assert.equal(result.sent, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].token, FCM_TOKEN);
    assert.deepEqual(sent[0].notification, {
      title: 'Bid update',
      body: 'You were outbid',
    });
    assert.deepEqual(sent[0].data, {
      type: 'bid',
      notification_id: '42',
      related_listing_id: '9',
    });
    assert.equal(pool.updates.length, 0);
  });

  it('does not send an FCM token to the Expo endpoint', async () => {
    const expoMessages = [];
    const { setPushTransport, resetPushTransport } = require('./pushDelivery');
    setPushTransport(async (messages) => {
      expoMessages.push(...messages);
      return { data: messages.map(() => ({ status: 'ok' })) };
    });
    setFirebaseMessaging({
      async sendEach(messages) {
        return { responses: messages.map(() => ({ success: true })) };
      },
    });
    const pool = fakePool([
      {
        device_token: FCM_TOKEN,
        expo_push_token: null,
        provider: 'fcm',
        platform: 'android',
      },
    ]);

    await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Hello',
      message: 'Body',
      data: { type: 'system', notification_id: 1, related_listing_id: null },
    });

    assert.equal(expoMessages.length, 0);
    resetPushTransport();
  });

  it('still sends Expo tokens through the Expo path', async () => {
    const expoMessages = [];
    let fcmCalls = 0;
    const { setPushTransport, resetPushTransport } = require('./pushDelivery');
    setPushTransport(async (messages) => {
      expoMessages.push(...messages);
      return { data: [{ status: 'ok' }] };
    });
    setFirebaseMessaging({
      async sendEach() {
        fcmCalls += 1;
        return { responses: [] };
      },
    });
    const pool = fakePool([
      {
        device_token: null,
        expo_push_token: EXPO_TOKEN,
        provider: 'expo',
        platform: 'android',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Expo title',
      message: 'Expo body',
      data: { type: 'system', notification_id: 3, related_listing_id: null },
    });

    assert.equal(result.status, 'sent');
    assert.equal(result.sent, 1);
    assert.equal(fcmCalls, 0);
    assert.equal(expoMessages.length, 1);
    assert.equal(expoMessages[0].to, EXPO_TOKEN);
    assert.equal(expoMessages[0].title, 'Expo title');
    assert.equal(expoMessages[0].body, 'Expo body');
    resetPushTransport();
  });

  it('keeps APNs on provider_not_configured and off FCM', async () => {
    let fcmCalls = 0;
    setFirebaseMessaging({
      async sendEach() {
        fcmCalls += 1;
        return { responses: [] };
      },
    });
    const pool = fakePool([
      {
        device_token: APNS_TOKEN,
        expo_push_token: null,
        provider: 'apns',
        platform: 'ios',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'APNs',
      message: 'Not this stage',
    });

    assert.equal(result.status, 'provider_not_configured');
    assert.equal(result.provider, 'apns');
    assert.equal(fcmCalls, 0);
  });

  it('returns provider_not_configured when Firebase credentials are missing', async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    resetFirebaseAdminForTests();
    const pool = fakePool([
      {
        device_token: FCM_TOKEN,
        expo_push_token: null,
        provider: 'fcm',
        platform: 'android',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Missing',
      message: 'No credentials',
    });

    assert.equal(result.status, 'provider_not_configured');
    assert.equal(result.provider, 'fcm');
    assert.equal(pool.updates.length, 0);
  });

  it('deactivates a permanently invalid FCM token', async () => {
    setFirebaseMessaging({
      async sendEach() {
        return {
          responses: [{
            success: false,
            error: { code: 'messaging/registration-token-not-registered' },
          }],
        };
      },
    });
    const pool = fakePool([
      {
        device_token: FCM_TOKEN,
        expo_push_token: null,
        provider: 'fcm',
        platform: 'android',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Invalid',
      message: 'Token is gone',
    });

    assert.equal(result.status, 'sent');
    assert.equal(result.sent, 0);
    assert.deepEqual(pool.updates, ['fcm']);
  });

  it('does not deactivate a token after a transient Firebase error', async () => {
    setFirebaseMessaging({
      async sendEach() {
        return {
          responses: [{
            success: false,
            error: { code: 'messaging/unavailable' },
          }],
        };
      },
    });
    const pool = fakePool([
      {
        device_token: FCM_TOKEN,
        expo_push_token: null,
        provider: 'fcm',
        platform: 'android',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Retry later',
      message: 'Temporary',
    });

    assert.equal(result.provider, 'fcm');
    assert.equal(result.sent, 0);
    assert.deepEqual(pool.updates, []);
  });

  it('does not throw when FCM delivery fails', async () => {
    setFirebaseMessaging({
      async sendEach() {
        throw Object.assign(new Error(`token ${FCM_TOKEN} private_key leaked`), {
          code: 'messaging/internal-error',
        });
      },
    });
    const pool = fakePool([
      {
        device_token: FCM_TOKEN,
        expo_push_token: null,
        provider: 'fcm',
        platform: 'android',
      },
    ]);

    const result = await deliverPushForNotification(pool, {
      userId: 7,
      title: 'Safe',
      message: 'Failure stays in push delivery',
    });

    assert.equal(result.status, 'failed');
    assert.equal(result.reason, 'send_failed');
    assert.deepEqual(pool.updates, []);
    const logged = errorLines.join('\n');
    assert.equal(logged.includes(FCM_TOKEN), false);
    assert.equal(logged.includes('private_key'), false);
    assert.match(logged, /messaging\/internal-error/);
  });
});
