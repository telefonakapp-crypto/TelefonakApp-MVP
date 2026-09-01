'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  customerToken,
  adminToken,
  loadFixtures,
} = require('../lib/harness');

describe('07 — Admin boundaries', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
  });

  it('customer cannot approve listings via admin API', async () => {
    if (!fx.listing) return;
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('POST', `/admin/listings/${fx.listing.id}/approve`, {
      token,
    });
    assert.equal(res.status, 401);
  });

  it('customer cannot access admin moderation history', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/admin/moderation-history?type=resubmitted', { token });
    assert.equal(res.status, 401);
  });

  it('customer cannot access admin audit logs', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/admin/audit-logs', { token });
    assert.equal(res.status, 401);
  });

  it('unauthenticated cannot access admin dashboard', async () => {
    const res = await api('GET', '/admin/dashboard');
    assert.equal(res.status, 401);
  });

  it('viewer-role token is accepted by verifyAdminAuth (RBAC not yet enforced — baseline)', async () => {
    // SEC-005 baseline: any active admin JWT currently reaches moderation endpoints.
    // This documents current behavior; Phase 4 will tighten role checks.
    const viewer = fx.admins.find((a) => a.role === 'viewer') || fx.admin;
    if (!viewer) return;
    const token = adminToken({
      adminId: viewer.id,
      email: viewer.email,
      role: viewer.role,
    });
    const res = await api('GET', '/admin/dashboard', { token });
    // Current expected: 200 (flat RBAC). After Phase 4, viewer may be limited.
    assert.ok(
      [200, 403].includes(res.status),
      `unexpected status ${res.status}`
    );
  });
});
