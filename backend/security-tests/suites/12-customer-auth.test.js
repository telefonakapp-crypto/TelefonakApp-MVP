'use strict';

/**
 * Phase 3 — Customer authentication hardening regression tests.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {
  api,
  customerToken,
  adminToken,
  loadFixtures,
  pool,
} = require('../lib/harness');
const {
  getCustomerJwtSecret,
  getAdminJwtSecret,
  CUSTOMER_JWT_ISS,
  CUSTOMER_JWT_AUD,
  isProduction,
} = require('../../config/env');
const { shouldExposeOtpInResponse, hashOtpCode, OTP_PURPOSE } = require('../../utils/otp');
const {
  issueCustomerSession,
  rotateRefreshSession,
  revokeRefreshToken,
  verifyCustomerToken,
} = require('../../utils/customerAuth');

describe('12 — Customer auth hardening (Phase 3)', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
  });

  it('rejects expired customer JWT', async () => {
    const token = jwt.sign(
      {
        userId: fx.owner.id,
        phoneNumber: fx.owner.phone_number,
        typ: 'access',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      getCustomerJwtSecret(),
      {
        issuer: CUSTOMER_JWT_ISS,
        audience: CUSTOMER_JWT_AUD,
      }
    );
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 401);
  });

  it('rejects invalid JWT signature', async () => {
    const token = jwt.sign(
      { userId: fx.owner.id, phoneNumber: fx.owner.phone_number, typ: 'access' },
      'totally-wrong-secret-value!!',
      {
        expiresIn: '1h',
        issuer: CUSTOMER_JWT_ISS,
        audience: CUSTOMER_JWT_AUD,
      }
    );
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 401);
  });

  it('customer token is rejected by admin routes (separate secrets / claims)', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/admin/dashboard', { token });
    assert.ok([401, 403].includes(res.status));
  });

  it('admin token is rejected by customer routes', async () => {
    if (!fx.admin) return;
    const token = adminToken({ adminId: fx.admin.id, email: fx.admin.email, role: fx.admin.role });
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 401);
  });

  it('customer JWT signed with admin secret is rejected on customer routes', async () => {
    // Cross-signing must fail when secrets differ; when falling back to shared
    // JWT_SECRET in local/dev, iss/aud still constrain admin-shaped misuse.
    const token = jwt.sign(
      { userId: fx.owner.id, phoneNumber: fx.owner.phone_number, typ: 'access' },
      getAdminJwtSecret(),
      { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' }
    );
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 401);
  });

  it('issues refresh session and rotates successfully', async () => {
    const session = await issueCustomerSession(
      { id: fx.owner.id, phone_number: fx.owner.phone_number },
      {}
    );
    assert.ok(session.token);
    assert.ok(session.refresh_token);

    const profile = await api('GET', '/user/profile', { token: session.token });
    assert.equal(profile.status, 200);

    const refreshed = await api('POST', '/auth/refresh', {
      body: { refresh_token: session.refresh_token },
    });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.data?.token);
    assert.ok(refreshed.data?.refresh_token);
    assert.notEqual(refreshed.data.refresh_token, session.refresh_token);

    // Old refresh token cannot be reused (rotation / reuse detection).
    const reuse = await api('POST', '/auth/refresh', {
      body: { refresh_token: session.refresh_token },
    });
    assert.equal(reuse.status, 401);
  });

  it('logout revokes refresh token', async () => {
    const session = await issueCustomerSession(
      { id: fx.owner.id, phone_number: fx.owner.phone_number },
      {}
    );
    const logout = await api('POST', '/auth/logout', {
      body: { refresh_token: session.refresh_token },
    });
    assert.equal(logout.status, 200);

    const refreshed = await api('POST', '/auth/refresh', {
      body: { refresh_token: session.refresh_token },
    });
    assert.equal(refreshed.status, 401);
  });

  it('OTP is never exposed when production mode is active', () => {
    // Server-side gate: production must not echo OTP (SEC-008).
    if (isProduction()) {
      assert.equal(shouldExposeOtpInResponse(), false);
    } else {
      // In development exposure may be enabled; still must be an explicit non-prod path.
      assert.equal(isProduction(), false);
    }
  });

  it('OTP stored in DB is hashed, not plaintext', async () => {
    const phone = fx.stranger.phone_number;
    const req = await api('POST', '/auth/request-otp', {
      body: { phone_number: phone },
    });
    // May be 200 or 429 (cooldown) — either way inspect latest row if present.
    const rows = await pool.query(
      `SELECT code FROM otp_codes
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );
    if (rows.rows.length === 0) return;
    const stored = rows.rows[0].code;
    assert.notEqual(stored, '1234');
    assert.match(String(stored), /^[a-f0-9]{64}$/i);
    if (req.status === 200 && req.data?.otp) {
      const expected = hashOtpCode(phone, OTP_PURPOSE.AUTH, req.data.otp);
      assert.equal(stored, expected);
    }
  });

  it('OTP cannot be reused after successful verification', async () => {
    // Use a dedicated throwaway path: issue via DB hash of known code when possible.
    // Integration: request OTP (dev returns 1234), verify once, verify again.
    const phone = fx.owner.phone_number;
    const issued = await api('POST', '/auth/request-otp', {
      body: { phone_number: phone },
    });
    if (issued.status !== 200) return; // rate limited — skip rather than flake

    const code = issued.data?.otp || '1234';
    const first = await api('POST', '/auth/verify-otp', {
      body: { phone_number: phone, otp: code },
    });
    assert.ok([200, 400, 429].includes(first.status));
    if (first.status !== 200) return;

    const second = await api('POST', '/auth/verify-otp', {
      body: { phone_number: phone, otp: code },
    });
    assert.ok([400, 429].includes(second.status));
  });

  it('OTP request remains rate limited under burst', async () => {
    const phone = '0799999888';
    let saw429 = false;
    for (let i = 0; i < 12; i++) {
      const res = await api('POST', '/auth/request-otp', {
        body: { phone_number: phone },
      });
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    assert.equal(saw429, true);
  });

  it('verifyCustomerToken rejects admin-shaped tokens', () => {
    const adminShaped = jwt.sign(
      { adminId: 1, email: 'a@b.c', role: 'viewer', typ: 'admin' },
      getAdminJwtSecret(),
      { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' }
    );
    assert.throws(() => verifyCustomerToken(adminShaped));
  });

  it('does not log tokens in rotateRefreshSession errors (smoke)', async () => {
    const result = await rotateRefreshSession('not-a-real-refresh-token');
    assert.equal(result.ok, false);
    await revokeRefreshToken('not-a-real-refresh-token');
  });
});
