'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  customerToken,
  adminToken,
  loadFixtures,
} = require('../lib/harness');

describe('01 — Auth boundaries', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
  });

  it('rejects missing bearer token on /user/profile', async () => {
    const res = await api('GET', '/user/profile');
    assert.equal(res.status, 401);
  });

  it('rejects admin JWT on customer /user/profile', async () => {
    if (!fx.admin) return;
    const token = adminToken({
      adminId: fx.admin.id,
      email: fx.admin.email,
      role: fx.admin.role,
    });
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 401);
  });

  it('rejects customer JWT on /admin/dashboard', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/admin/dashboard', { token });
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated access to /admin/users', async () => {
    const res = await api('GET', '/admin/users');
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated access to /admin/reports/overview', async () => {
    const res = await api('GET', '/admin/reports/overview');
    assert.equal(res.status, 401);
  });

  it('allows customer JWT to access own /user/profile', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 200);
    assert.ok(res.data?.user);
    assert.equal(res.data.user.id, fx.owner.id);
  });
});
