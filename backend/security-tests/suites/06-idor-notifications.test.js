'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, customerToken, loadFixtures } = require('../lib/harness');

describe('06 — IDOR notifications', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
  });

  it('unauthenticated cannot list notifications', async () => {
    const res = await api('GET', '/notifications');
    assert.equal(res.status, 401);
  });

  it('user cannot mark another user notification as read', async () => {
    if (!fx.notification) return;
    const other =
      fx.users.find((u) => u.id !== fx.notification.user_id) || fx.stranger;
    const token = customerToken(other.id, other.phone_number);
    const res = await api('PATCH', `/notifications/${fx.notification.id}/read`, {
      token,
    });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('notifications list only returns own user_id rows', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/notifications?limit=20', { token });
    assert.equal(res.status, 200);
    for (const row of res.data?.notifications || []) {
      assert.equal(row.user_id, fx.owner.id);
    }
  });
});
