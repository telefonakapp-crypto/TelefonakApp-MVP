'use strict';

/**
 * Customer push delivery.
 *
 * Inbox rows in `notifications` are written regardless of this module.
 * This module is the only place that sends OS/device push, and it is the
 * authority for whether a push goes out:
 *
 *   1. users.push_notifications_enabled must be true
 *   2. the user must have at least one active token
 *   3. Expo tokens are delivered through the Expo Push API
 *   4. Android FCM tokens are delivered through Firebase Admin
 *   5. APNs tokens stay provider_not_configured until that sender exists
 *
 * Admin-recipient notifications (admin_id) are not pushed to mobile.
 *
 * Legacy rows with a NULL provider and an expo_push_token are treated as
 * provider 'expo'. No token value is written to logs.
 */

const { getFirebaseMessaging } = require('./firebaseAdmin');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;
const NATIVE_PROVIDERS = new Set(['fcm', 'apns']);
const PERMANENT_FCM_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'registration-token-not-registered',
  'invalid-registration-token',
]);

function isExpoPushToken(value) {
  return typeof value === 'string' && EXPO_TOKEN_RE.test(value.trim());
}

/**
 * Opaque native device token. FCM requires android. APNs requires ios.
 * The token string itself is not parsed.
 */
function isNativePushToken(value, { provider, platform } = {}) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (provider === 'fcm') return platform === 'android';
  if (provider === 'apns') return platform === 'ios';
  return false;
}

function resolveProvider(row) {
  if (row.provider === 'expo' || row.provider === 'fcm' || row.provider === 'apns') {
    return row.provider;
  }
  if (row.expo_push_token) return 'expo';
  return null;
}

function toPublicToken(row) {
  const provider = resolveProvider(row);
  if (provider === 'fcm' || provider === 'apns') {
    return {
      id: row.id,
      user_id: row.user_id,
      device_token: row.device_token,
      provider,
      platform: row.platform,
      is_active: row.is_active,
    };
  }
  return {
    id: row.id,
    user_id: row.user_id,
    expo_push_token: row.expo_push_token,
    provider: 'expo',
    platform: row.platform,
    is_active: row.is_active,
  };
}

async function defaultExpoTransport(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { data: [] };
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(`Expo push failed with HTTP ${response.status}`);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload || { data: [] };
}

let pushTransport = defaultExpoTransport;

function setPushTransport(fn) {
  pushTransport = typeof fn === 'function' ? fn : defaultExpoTransport;
}

function resetPushTransport() {
  pushTransport = defaultExpoTransport;
}

function parseUserId(userId) {
  const parsed = parseInt(userId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parsePlatform(platform, { required = false } = {}) {
  if (platform == null || String(platform).trim() === '') {
    return required ? { error: 'platform is required' } : { value: null };
  }
  const normalized = String(platform).trim().toLowerCase();
  if (normalized !== 'ios' && normalized !== 'android') {
    return { error: 'Invalid platform' };
  }
  return { value: normalized };
}

async function isPushEnabledForUser(pool, userId) {
  const parsed = parseUserId(userId);
  if (!parsed) return false;

  const result = await pool.query(
    `SELECT push_notifications_enabled
     FROM users
     WHERE id = $1`,
    [parsed]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].push_notifications_enabled !== false;
}

async function listActivePushTokens(pool, userId) {
  const result = await pool.query(
    `SELECT id, user_id, device_token, expo_push_token, provider, platform, is_active
     FROM user_push_tokens
     WHERE user_id = $1
       AND is_active = TRUE`,
    [userId]
  );
  return result.rows;
}

async function deactivatePushToken(pool, token) {
  await pool.query(
    `UPDATE user_push_tokens
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE expo_push_token = $1
       AND is_active = TRUE`,
    [token]
  );
}

async function deactivateFcmToken(pool, deviceToken) {
  await pool.query(
    `UPDATE user_push_tokens
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE device_token = $1
       AND provider = 'fcm'
       AND is_active = TRUE`,
    [deviceToken]
  );
}

function fcmErrorCode(error) {
  if (!error || typeof error !== 'object') return '';
  if (typeof error.code === 'string') return error.code;
  if (error.errorInfo && typeof error.errorInfo.code === 'string') {
    return error.errorInfo.code;
  }
  return '';
}

function isPermanentFcmTokenError(error) {
  return PERMANENT_FCM_TOKEN_ERRORS.has(fcmErrorCode(error));
}

function toFcmData(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    if (typeof value === 'string') out[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = String(value);
    else out[key] = JSON.stringify(value);
  }
  return out;
}

const TOKEN_RETURNING = `
  RETURNING id, user_id, device_token, expo_push_token, provider, platform, is_active
`;

async function registerExpoPushToken(pool, parsedUserId, expoPushToken, platform) {
  const token = String(expoPushToken || '').trim();
  if (!isExpoPushToken(token)) {
    return { error: 'Invalid Expo push token' };
  }
  const platformResult = parsePlatform(platform);
  if (platformResult.error) return { error: platformResult.error };

  const result = await pool.query(
    `INSERT INTO user_push_tokens (
       user_id, expo_push_token, device_token, provider, platform, is_active
     )
     VALUES ($1, $2, NULL, 'expo', $3, TRUE)
     ON CONFLICT (expo_push_token)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       provider = 'expo',
       platform = COALESCE(EXCLUDED.platform, user_push_tokens.platform),
       is_active = TRUE,
       updated_at = CURRENT_TIMESTAMP
     ${TOKEN_RETURNING}`,
    [parsedUserId, token, platformResult.value]
  );

  return { token: toPublicToken(result.rows[0]) };
}

async function registerNativePushToken(pool, parsedUserId, deviceToken, provider, platform) {
  if (deviceToken == null || typeof deviceToken !== 'string' || deviceToken.trim() === '') {
    return { error: 'Invalid device token' };
  }
  if (provider == null || String(provider).trim() === '') {
    return { error: 'provider is required' };
  }
  const normalizedProvider = String(provider).trim().toLowerCase();
  if (!NATIVE_PROVIDERS.has(normalizedProvider)) {
    return { error: 'Invalid provider' };
  }

  const platformResult = parsePlatform(platform, { required: true });
  if (platformResult.error) return { error: platformResult.error };

  if (normalizedProvider === 'fcm' && platformResult.value !== 'android') {
    return { error: 'FCM tokens require platform android' };
  }
  if (normalizedProvider === 'apns' && platformResult.value !== 'ios') {
    return { error: 'APNs tokens require platform ios' };
  }

  const token = deviceToken.trim();
  if (!isNativePushToken(token, { provider: normalizedProvider, platform: platformResult.value })) {
    return { error: 'Invalid device token' };
  }

  const result = await pool.query(
    `INSERT INTO user_push_tokens (
       user_id, expo_push_token, device_token, provider, platform, is_active
     )
     VALUES ($1, NULL, $2, $3, $4, TRUE)
     ON CONFLICT (device_token) WHERE device_token IS NOT NULL
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       expo_push_token = NULL,
       provider = EXCLUDED.provider,
       platform = EXCLUDED.platform,
       is_active = TRUE,
       updated_at = CURRENT_TIMESTAMP
     ${TOKEN_RETURNING}`,
    [parsedUserId, token, normalizedProvider, platformResult.value]
  );

  return { token: toPublicToken(result.rows[0]) };
}

/**
 * Upsert a device token onto the current user. The same physical token is
 * moved off any previous user so a device cannot stay registered to two accounts.
 */
async function registerPushToken(pool, input = {}) {
  const parsedUserId = parseUserId(input.userId);
  if (!parsedUserId) return { error: 'Invalid user' };

  const expoPushToken = input.expoPushToken;
  const deviceToken = input.deviceToken;
  const hasExpo = typeof expoPushToken === 'string' && expoPushToken.trim() !== '';
  const hasDevice = typeof deviceToken === 'string' && deviceToken.trim() !== '';

  if (hasExpo && hasDevice) {
    return { error: 'Provide either an Expo push token or a native device token' };
  }
  if (hasExpo || (expoPushToken != null && expoPushToken !== '' && !hasDevice)) {
    return registerExpoPushToken(pool, parsedUserId, expoPushToken, input.platform);
  }
  if (deviceToken != null && deviceToken !== '') {
    return registerNativePushToken(
      pool,
      parsedUserId,
      deviceToken,
      input.provider,
      input.platform
    );
  }
  return { error: 'A push token is required' };
}

async function deactivateUserPushToken(pool, input = {}) {
  const parsedUserId = parseUserId(input.userId);
  if (!parsedUserId) return { error: 'Invalid user' };

  const expoPushToken = input.expoPushToken;
  const deviceToken = input.deviceToken;
  const hasExpo = typeof expoPushToken === 'string' && expoPushToken.trim() !== '';
  const hasDevice = typeof deviceToken === 'string' && deviceToken.trim() !== '';

  if (hasExpo && hasDevice) {
    return { error: 'Provide either an Expo push token or a native device token' };
  }

  if (hasExpo || (expoPushToken != null && expoPushToken !== '' && !hasDevice)) {
    const token = String(expoPushToken || '').trim();
    if (!isExpoPushToken(token)) return { error: 'Invalid Expo push token' };
    const result = await pool.query(
      `UPDATE user_push_tokens
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND expo_push_token = $2
         AND is_active = TRUE
       RETURNING id`,
      [parsedUserId, token]
    );
    return { deactivated: result.rows.length };
  }

  if (deviceToken == null || typeof deviceToken !== 'string' || deviceToken.trim() === '') {
    return { error: 'A push token is required' };
  }
  if (input.provider == null || String(input.provider).trim() === '') {
    return { error: 'provider is required' };
  }
  const normalizedProvider = String(input.provider).trim().toLowerCase();
  if (!NATIVE_PROVIDERS.has(normalizedProvider)) {
    return { error: 'Invalid provider' };
  }
  const platformResult = parsePlatform(input.platform, { required: true });
  if (platformResult.error) return { error: platformResult.error };
  if (normalizedProvider === 'fcm' && platformResult.value !== 'android') {
    return { error: 'FCM tokens require platform android' };
  }
  if (normalizedProvider === 'apns' && platformResult.value !== 'ios') {
    return { error: 'APNs tokens require platform ios' };
  }

  const result = await pool.query(
    `UPDATE user_push_tokens
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
       AND device_token = $2
       AND provider = $3
       AND platform = $4
       AND is_active = TRUE
     RETURNING id`,
    [parsedUserId, deviceToken.trim(), normalizedProvider, platformResult.value]
  );
  return { deactivated: result.rows.length };
}

function ticketIndicatesInvalidToken(ticket) {
  if (!ticket || ticket.status !== 'error') return false;
  const code = ticket.details?.error;
  return code === 'DeviceNotRegistered' || code === 'InvalidCredentials';
}

async function sendExpoPush(pool, tokens, { title, message, data }) {
  const messages = tokens.map((row) => ({
    to: row.expo_push_token,
    title: title || 'Telefonak',
    body: message || '',
    sound: 'default',
    data,
  }));

  const payload = await pushTransport(messages);
  const tickets = Array.isArray(payload?.data) ? payload.data : [];

  await Promise.all(
    tickets.map(async (ticket, index) => {
      if (ticketIndicatesInvalidToken(ticket) && tokens[index]?.expo_push_token) {
        await deactivatePushToken(pool, tokens[index].expo_push_token);
      }
    })
  );

  const sent = tickets.filter((ticket) => ticket?.status === 'ok').length;
  return { status: 'sent', sent: tickets.length ? sent : messages.length };
}

function sendApnsPush() {
  return { status: 'provider_not_configured', provider: 'apns' };
}

/**
 * Android FCM via Firebase Admin. Never throws. A send failure does not
 * remove the inbox row. Permanently invalid tokens are deactivated.
 * The device token and credential material are not written to logs.
 */
async function sendFcmPush(pool, tokens, { title, message, data }) {
  const deliverable = (tokens || []).filter(
    (row) => row && row.platform === 'android' && row.device_token
  );
  if (deliverable.length === 0) {
    return { status: 'provider_not_configured', provider: 'fcm' };
  }

  let messaging;
  try {
    messaging = await getFirebaseMessaging();
  } catch (error) {
    if (fcmErrorCode(error) === 'provider_not_configured') {
      return { status: 'provider_not_configured', provider: 'fcm' };
    }
    console.error('[push] FCM configuration failed');
    return { status: 'failed', provider: 'fcm', reason: 'configuration_error' };
  }

  if (!messaging || typeof messaging.sendEach !== 'function') {
    console.error('[push] FCM configuration failed');
    return { status: 'failed', provider: 'fcm', reason: 'configuration_error' };
  }

  const fcmData = toFcmData(data);
  const messages = deliverable.map((row) => {
    const payload = {
      token: row.device_token,
      notification: {
        title: title || 'Telefonak',
        body: message || '',
      },
    };
    if (Object.keys(fcmData).length > 0) payload.data = fcmData;
    return payload;
  });

  let batch;
  try {
    batch = await messaging.sendEach(messages);
  } catch (error) {
    console.error('[push] FCM send failed:', fcmErrorCode(error) || 'unknown');
    return { status: 'failed', provider: 'fcm', reason: 'send_failed' };
  }

  const responses = Array.isArray(batch?.responses) ? batch.responses : [];
  await Promise.all(
    responses.map(async (response, index) => {
      if (!response || response.success) return;
      if (isPermanentFcmTokenError(response.error) && deliverable[index]?.device_token) {
        try {
          await deactivateFcmToken(pool, deliverable[index].device_token);
        } catch (_error) {
          console.error('[push] FCM token deactivation failed');
        }
        return;
      }
      console.error('[push] FCM delivery failed:', fcmErrorCode(response.error) || 'unknown');
    })
  );

  const sent = responses.filter((response) => response?.success).length;
  return { status: 'sent', provider: 'fcm', sent };
}

/**
 * Attempt OS push for a customer notification. Never throws to callers of
 * createNotification — inbox insert already succeeded.
 * APNs remains provider_not_configured.
 *
 * @returns {Promise<{ status: string, sent?: number, reason?: string, provider?: string }>}
 */
async function deliverPushForNotification(pool, { userId, title, message, data = {} }) {
  const parsedUserId = parseUserId(userId);
  if (!parsedUserId) {
    return { status: 'skipped', reason: 'no_user' };
  }

  const enabled = await isPushEnabledForUser(pool, parsedUserId);
  if (!enabled) {
    return { status: 'skipped', reason: 'preference_disabled' };
  }

  const tokens = await listActivePushTokens(pool, parsedUserId);
  const expoTokens = [];
  const fcmTokens = [];
  const apnsTokens = [];
  for (const row of tokens) {
    const provider = resolveProvider(row);
    if (provider === 'expo' && row.expo_push_token) expoTokens.push(row);
    else if (provider === 'fcm' && row.device_token) fcmTokens.push(row);
    else if (provider === 'apns' && row.device_token) apnsTokens.push(row);
  }

  if (expoTokens.length === 0 && fcmTokens.length === 0 && apnsTokens.length === 0) {
    return { status: 'skipped', reason: 'no_tokens' };
  }

  const expoResult = expoTokens.length
    ? await sendExpoPush(pool, expoTokens, { title, message, data })
    : null;
  const nativeResults = [];
  if (fcmTokens.length) {
    nativeResults.push(await sendFcmPush(pool, fcmTokens, { title, message, data }));
  }
  if (apnsTokens.length) nativeResults.push(sendApnsPush());

  if (!expoResult && nativeResults.length === 1) return nativeResults[0];
  if (!expoResult) {
    return { status: 'provider_not_configured', providers: nativeResults };
  }
  if (nativeResults.length === 0) return expoResult;
  return { ...expoResult, native: nativeResults };
}

module.exports = {
  isExpoPushToken,
  isNativePushToken,
  isPushEnabledForUser,
  registerPushToken,
  deactivateUserPushToken,
  deliverPushForNotification,
  setPushTransport,
  resetPushTransport,
};
