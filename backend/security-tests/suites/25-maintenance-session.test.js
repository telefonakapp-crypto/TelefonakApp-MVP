'use strict';

/**
 * Maintenance mode must not look like an auth failure and must not
 * destroy customer refresh sessions.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  adminToken,
  loadFixtures,
  pool,
} = require('../lib/harness');
const { issueCustomerSession } = require('../../utils/customerAuth');
const { invalidateMaintenanceCache } = require('../../utils/settings');

async function setMaintenance(enabled) {
  await pool.query(
    `INSERT INTO settings (key, value)
     VALUES ('maintenance_mode', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [enabled ? 'true' : 'false']
  );
  invalidateMaintenanceCache();
  // Running API process has its own 2s cache.
  await new Promise((r) => setTimeout(r, 2200));
}

describe('25 — Maintenance mode preserves customer sessions', () => {
  let fx;
  let session;
  let userBefore;

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.owner, 'Need an owner user');
    session = await issueCustomerSession(
      { id: fx.owner.id, phone_number: fx.owner.phone_number },
      { userAgent: 'security-test', ip: '127.0.0.1' }
    );
    const user = await pool.query(
      `SELECT id, phone_number, is_active, push_notifications_enabled
       FROM users WHERE id = $1`,
      [fx.owner.id]
    );
    userBefore = user.rows[0];
    await setMaintenance(true);
  });

  after(async () => {
    await setMaintenance(false);
  });

  it('does not change the user row when maintenance is enabled', async () => {
    const user = await pool.query(
      `SELECT id, phone_number, is_active, push_notifications_enabled
       FROM users WHERE id = $1`,
      [fx.owner.id]
    );
    assert.deepEqual(user.rows[0], userBefore);
  });

  it('authenticated marketplace requests get 503, not 401/403', async () => {
    const res = await api('GET', '/user/profile', { token: session.token });
    assert.equal(res.status, 503);
    assert.equal(res.data?.maintenance, true);
  });

  it('refresh still rotates during maintenance', async () => {
    const res = await api('POST', '/auth/refresh', {
      body: { refresh_token: session.refresh_token },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data?.token);
    assert.ok(res.data?.refresh_token);
    session = {
      token: res.data.token,
      refresh_token: res.data.refresh_token,
    };
  });

  it('invalid refresh token still returns 401 during maintenance', async () => {
    const res = await api('POST', '/auth/refresh', {
      body: { refresh_token: 'not-a-real-refresh-token' },
    });
    assert.equal(res.status, 401);
  });

  it('admin dashboard can still toggle settings during maintenance', async () => {
    if (!fx.admin || fx.admin.role !== 'super_admin') return;
    const token = adminToken({
      adminId: fx.admin.id,
      email: fx.admin.email,
      role: fx.admin.role,
    });
    const res = await api('GET', '/admin/settings', { token });
    assert.equal(res.status, 200);
    assert.equal(res.data.settings.maintenance_mode, true);
  });

  it('after maintenance OFF the same user can still use the rotated session', async () => {
    await setMaintenance(false);
    const res = await api('GET', '/user/profile', { token: session.token });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.id, fx.owner.id);
  });
});
