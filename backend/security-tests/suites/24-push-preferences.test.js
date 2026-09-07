'use strict';

/**
 * Push notification preference + delivery authority.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  pool,
  customerToken,
  adminToken,
  loadFixtures,
} = require('../lib/harness');
const { createNotification, notifySystem } = require('../../utils/notifications');
const {
  deliverPushForNotification,
  registerPushToken,
  setPushTransport,
  resetPushTransport,
} = require('../../utils/pushDelivery');

function fakeExpoToken(suffix) {
  return `ExponentPushToken[telefonak-test-${suffix}]`;
}

describe('24 — Push notification preference', () => {
  let fx;
  let ownerToken;
  let otherToken;
  let createdNotificationIds = [];
  const createdTokens = [];

  before(async () => {
    fx = await loadFixtures();
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    otherToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = ANY($1::int[])`,
      [[fx.owner.id, fx.stranger.id]]
    );
  });

  beforeEach(() => {
    resetPushTransport();
  });

  after(async () => {
    resetPushTransport();
    if (createdNotificationIds.length > 0) {
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1::int[])`, [
        createdNotificationIds,
      ]);
    }
    if (createdTokens.length > 0) {
      await pool.query(
        `DELETE FROM user_push_tokens WHERE expo_push_token = ANY($1::text[])`,
        [createdTokens]
      );
    }
    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = ANY($1::int[])`,
      [[fx.owner.id, fx.stranger.id]]
    );
  });

  function trackNotification(row) {
    if (row?.id) createdNotificationIds.push(row.id);
    return row;
  }

  it('unauthenticated preference requests are rejected', async () => {
    const getRes = await api('GET', '/notifications/preferences');
    assert.equal(getRes.status, 401);
    const patchRes = await api('PATCH', '/notifications/preferences', {
      body: { push_notifications_enabled: false },
    });
    assert.equal(patchRes.status, 401);
  });

  it('admin JWT cannot read or change customer push preferences', async () => {
    if (!fx.admin) return;
    const token = adminToken({
      adminId: fx.admin.id,
      email: fx.admin.email,
      role: fx.admin.role,
    });
    const getRes = await api('GET', '/notifications/preferences', { token });
    assert.equal(getRes.status, 401);
    const patchRes = await api('PATCH', '/notifications/preferences', {
      token,
      body: { push_notifications_enabled: false },
    });
    assert.equal(patchRes.status, 401);
  });

  it('default preference is enabled', async () => {
    const res = await api('GET', '/notifications/preferences', { token: ownerToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.push_notifications_enabled, true);
  });

  it('user can disable and re-enable push notifications', async () => {
    const off = await api('PATCH', '/notifications/preferences', {
      token: ownerToken,
      body: { push_notifications_enabled: false },
    });
    assert.equal(off.status, 200);
    assert.equal(off.data.push_notifications_enabled, false);

    const stored = await api('GET', '/notifications/preferences', { token: ownerToken });
    assert.equal(stored.status, 200);
    assert.equal(stored.data.push_notifications_enabled, false);

    const on = await api('PATCH', '/notifications/preferences', {
      token: ownerToken,
      body: { push_notifications_enabled: true },
    });
    assert.equal(on.status, 200);
    assert.equal(on.data.push_notifications_enabled, true);
  });

  it('rejects invalid preference values', async () => {
    const stringVal = await api('PATCH', '/notifications/preferences', {
      token: ownerToken,
      body: { push_notifications_enabled: 'yes' },
    });
    assert.equal(stringVal.status, 400);

    const missing = await api('PATCH', '/notifications/preferences', {
      token: ownerToken,
      body: {},
    });
    assert.equal(missing.status, 400);
  });

  it('ignores a client-supplied user id and only updates the JWT user', async () => {
    const res = await api('PATCH', '/notifications/preferences', {
      token: ownerToken,
      body: {
        push_notifications_enabled: false,
        user_id: fx.stranger.id,
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.push_notifications_enabled, false);

    const other = await api('GET', '/notifications/preferences', { token: otherToken });
    assert.equal(other.status, 200);
    assert.equal(other.data.push_notifications_enabled, true);

    await api('PATCH', '/notifications/preferences', {
      token: ownerToken,
      body: { push_notifications_enabled: true },
    });
  });

  it('registers a device token and reassigns it across users', async () => {
    const tokenValue = fakeExpoToken('reassign');
    createdTokens.push(tokenValue);

    const first = await api('PUT', '/notifications/push-token', {
      token: ownerToken,
      body: { expo_push_token: tokenValue, platform: 'ios' },
    });
    assert.equal(first.status, 200);
    assert.equal(first.data.token.user_id, fx.owner.id);
    assert.equal(first.data.token.is_active, true);

    const second = await api('PUT', '/notifications/push-token', {
      token: otherToken,
      body: { expo_push_token: tokenValue, platform: 'ios' },
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.token.user_id, fx.stranger.id);

    const ownerRows = await pool.query(
      `SELECT user_id, is_active FROM user_push_tokens WHERE expo_push_token = $1`,
      [tokenValue]
    );
    assert.equal(ownerRows.rows.length, 1);
    assert.equal(ownerRows.rows[0].user_id, fx.stranger.id);
  });

  it('rejects an invalid Expo token', async () => {
    const res = await api('PUT', '/notifications/push-token', {
      token: ownerToken,
      body: { expo_push_token: 'not-a-token' },
    });
    assert.equal(res.status, 400);
  });

  it('deactivates the current device token without deleting the row', async () => {
    const tokenValue = fakeExpoToken('logout-deactivate');
    createdTokens.push(tokenValue);
    await api('PUT', '/notifications/push-token', {
      token: ownerToken,
      body: { expo_push_token: tokenValue, platform: 'ios' },
    });

    const res = await api('DELETE', '/notifications/push-token', {
      token: ownerToken,
      body: { expo_push_token: tokenValue },
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.deactivated, 1);

    const row = await pool.query(
      `SELECT is_active FROM user_push_tokens WHERE expo_push_token = $1`,
      [tokenValue]
    );
    assert.equal(row.rows[0].is_active, false);
  });

  async function clearUserTokens(userId) {
    await pool.query(`DELETE FROM user_push_tokens WHERE user_id = $1`, [userId]);
  }

  it('does not send push when the user preference is disabled, even with a token', async () => {
    const tokenValue = fakeExpoToken('disabled-send');
    createdTokens.push(tokenValue);
    await clearUserTokens(fx.owner.id);
    await registerPushToken(pool, {
      userId: fx.owner.id,
      expoPushToken: tokenValue,
      platform: 'ios',
    });
    await pool.query(
      `UPDATE users SET push_notifications_enabled = FALSE WHERE id = $1`,
      [fx.owner.id]
    );

    let transportCalls = 0;
    setPushTransport(async () => {
      transportCalls += 1;
      return { data: [{ status: 'ok' }] };
    });

    const result = await deliverPushForNotification(pool, {
      userId: fx.owner.id,
      title: 'New Offer',
      message: 'Should not be pushed',
    });
    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'preference_disabled');
    assert.equal(transportCalls, 0);

    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.owner.id]
    );
  });

  it('sends push when the user preference is enabled and a token exists', async () => {
    const tokenValue = fakeExpoToken('enabled-send');
    createdTokens.push(tokenValue);
    await clearUserTokens(fx.owner.id);
    await registerPushToken(pool, {
      userId: fx.owner.id,
      expoPushToken: tokenValue,
      platform: 'ios',
    });
    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.owner.id]
    );

    let sentMessages = null;
    setPushTransport(async (messages) => {
      sentMessages = messages;
      return { data: messages.map(() => ({ status: 'ok' })) };
    });

    const result = await deliverPushForNotification(pool, {
      userId: fx.owner.id,
      title: 'Listing Approved',
      message: 'Your listing is live.',
    });
    assert.equal(result.status, 'sent');
    assert.equal(result.sent, 1);
    assert.ok(Array.isArray(sentMessages));
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, tokenValue);
  });

  it('skips push when enabled but no tokens are registered', async () => {
    await pool.query(`DELETE FROM user_push_tokens WHERE user_id = $1`, [fx.stranger.id]);
    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.stranger.id]
    );

    let transportCalls = 0;
    setPushTransport(async () => {
      transportCalls += 1;
      return { data: [] };
    });

    const result = await deliverPushForNotification(pool, {
      userId: fx.stranger.id,
      title: 'Hi',
      message: 'No device',
    });
    assert.equal(result.status, 'skipped');
    assert.equal(result.reason, 'no_tokens');
    assert.equal(transportCalls, 0);
  });

  it('sends to every active token for a user', async () => {
    const tokenA = fakeExpoToken('multi-a');
    const tokenB = fakeExpoToken('multi-b');
    createdTokens.push(tokenA, tokenB);
    await clearUserTokens(fx.owner.id);
    await registerPushToken(pool, {
      userId: fx.owner.id,
      expoPushToken: tokenA,
      platform: 'ios',
    });
    await registerPushToken(pool, {
      userId: fx.owner.id,
      expoPushToken: tokenB,
      platform: 'android',
    });
    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.owner.id]
    );

    let sentMessages = null;
    setPushTransport(async (messages) => {
      sentMessages = messages;
      return { data: messages.map(() => ({ status: 'ok' })) };
    });

    const result = await deliverPushForNotification(pool, {
      userId: fx.owner.id,
      title: 'New Offer',
      message: 'Two devices',
    });
    assert.equal(result.status, 'sent');
    assert.equal(sentMessages.length, 2);
    const targets = sentMessages.map((row) => row.to).sort();
    assert.deepEqual(targets, [tokenA, tokenB].sort());
  });

  it('deactivates invalid Expo tokens', async () => {
    const tokenValue = fakeExpoToken('invalid-device');
    createdTokens.push(tokenValue);
    await clearUserTokens(fx.owner.id);
    await registerPushToken(pool, {
      userId: fx.owner.id,
      expoPushToken: tokenValue,
      platform: 'ios',
    });
    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.owner.id]
    );

    setPushTransport(async () => ({
      data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    }));

    await deliverPushForNotification(pool, {
      userId: fx.owner.id,
      title: 'Hi',
      message: 'Stale token',
    });

    const row = await pool.query(
      `SELECT is_active FROM user_push_tokens WHERE expo_push_token = $1`,
      [tokenValue]
    );
    assert.equal(row.rows[0].is_active, false);
  });

  it('still writes the in-app inbox when push is disabled', async () => {
    await pool.query(
      `UPDATE users SET push_notifications_enabled = FALSE WHERE id = $1`,
      [fx.owner.id]
    );

    const row = trackNotification(
      await createNotification(pool, {
        userId: fx.owner.id,
        type: 'system',
        title: 'Inbox stays',
        message: 'Push off should not drop the notification center row.',
      })
    );
    assert.ok(row.id);

    const stored = await pool.query(`SELECT id FROM notifications WHERE id = $1`, [row.id]);
    assert.equal(stored.rows.length, 1);

    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.owner.id]
    );
  });

  it('notifySystem path uses the same preference-aware sender', async () => {
    const tokenValue = fakeExpoToken('system-path');
    createdTokens.push(tokenValue);
    await registerPushToken(pool, {
      userId: fx.owner.id,
      expoPushToken: tokenValue,
      platform: 'ios',
    });
    await pool.query(
      `UPDATE users SET push_notifications_enabled = FALSE WHERE id = $1`,
      [fx.owner.id]
    );

    let transportCalls = 0;
    setPushTransport(async () => {
      transportCalls += 1;
      return { data: [{ status: 'ok' }] };
    });

    const row = trackNotification(
      await notifySystem(pool, {
        userId: fx.owner.id,
        title: 'System',
        message: 'Should skip push',
      })
    );
    assert.ok(row.id);

    const skipped = await deliverPushForNotification(pool, {
      userId: fx.owner.id,
      title: 'System',
      message: 'Should skip push',
    });
    assert.equal(skipped.reason, 'preference_disabled');
    assert.equal(transportCalls, 0);

    await pool.query(
      `UPDATE users SET push_notifications_enabled = TRUE WHERE id = $1`,
      [fx.owner.id]
    );
  });
});
