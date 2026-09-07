'use strict';

/**
 * Customer push delivery (Expo Push API).
 *
 * Inbox rows in `notifications` are written regardless of this module.
 * This module is the only place that sends OS/device push, and it is the
 * authority for whether a push goes out:
 *
 *   1. users.push_notifications_enabled must be true
 *   2. the user must have at least one active Expo token
 *   3. Expo then delivers to those tokens
 *
 * Admin-recipient notifications (admin_id) are not pushed to mobile.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

function isExpoPushToken(value) {
  return typeof value === 'string' && EXPO_TOKEN_RE.test(value.trim());
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

async function isPushEnabledForUser(pool, userId) {
  const parsed = parseInt(userId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return false;

  const result = await pool.query(
    `SELECT push_notifications_enabled
     FROM users
     WHERE id = $1`,
    [parsed]
  );
  if (result.rows.length === 0) return false;
  // Missing/null → enabled (column is NOT NULL DEFAULT TRUE; this is the safe default).
  return result.rows[0].push_notifications_enabled !== false;
}

async function listActivePushTokens(pool, userId) {
  const result = await pool.query(
    `SELECT id, expo_push_token
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

/**
 * Upsert a device token onto the current user. The same physical token is
 * moved off any previous user so a device cannot stay registered to two accounts.
 */
async function registerPushToken(pool, { userId, expoPushToken, platform = null }) {
  const token = String(expoPushToken || '').trim();
  if (!isExpoPushToken(token)) {
    return { error: 'Invalid Expo push token' };
  }

  const parsedUserId = parseInt(userId, 10);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return { error: 'Invalid user' };
  }

  let platformValue = null;
  if (platform != null && platform !== '') {
    const normalized = String(platform).trim().toLowerCase();
    if (normalized !== 'ios' && normalized !== 'android') {
      return { error: 'Invalid platform' };
    }
    platformValue = normalized;
  }

  const result = await pool.query(
    `INSERT INTO user_push_tokens (user_id, expo_push_token, platform, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (expo_push_token)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = COALESCE(EXCLUDED.platform, user_push_tokens.platform),
       is_active = TRUE,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, user_id, expo_push_token, platform, is_active`,
    [parsedUserId, token, platformValue]
  );

  return { token: result.rows[0] };
}

async function deactivateUserPushToken(pool, { userId, expoPushToken }) {
  const token = String(expoPushToken || '').trim();
  if (!isExpoPushToken(token)) {
    return { error: 'Invalid Expo push token' };
  }
  const parsedUserId = parseInt(userId, 10);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return { error: 'Invalid user' };
  }

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

function ticketIndicatesInvalidToken(ticket) {
  if (!ticket || ticket.status !== 'error') return false;
  const code = ticket.details?.error;
  return code === 'DeviceNotRegistered' || code === 'InvalidCredentials';
}

/**
 * Attempt OS push for a customer notification. Never throws to callers of
 * createNotification — inbox insert already succeeded.
 *
 * @returns {Promise<{ status: string, sent?: number, reason?: string }>}
 */
async function deliverPushForNotification(
  pool,
  { userId, title, message, data = {} }
) {
  const parsedUserId = parseInt(userId, 10);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return { status: 'skipped', reason: 'no_user' };
  }

  const enabled = await isPushEnabledForUser(pool, parsedUserId);
  if (!enabled) {
    return { status: 'skipped', reason: 'preference_disabled' };
  }

  const tokens = await listActivePushTokens(pool, parsedUserId);
  if (tokens.length === 0) {
    return { status: 'skipped', reason: 'no_tokens' };
  }

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
      if (ticketIndicatesInvalidToken(ticket) && tokens[index]) {
        await deactivatePushToken(pool, tokens[index].expo_push_token);
      }
    })
  );

  const sent = tickets.filter((ticket) => ticket?.status === 'ok').length;
  return { status: 'sent', sent: tickets.length ? sent : messages.length };
}

module.exports = {
  isExpoPushToken,
  isPushEnabledForUser,
  registerPushToken,
  deactivateUserPushToken,
  deliverPushForNotification,
  setPushTransport,
  resetPushTransport,
};
