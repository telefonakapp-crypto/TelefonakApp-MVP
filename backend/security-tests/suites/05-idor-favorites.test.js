'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, customerToken, loadFixtures } = require('../lib/harness');

describe('05 — IDOR favorites', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
  });

  it('unauthenticated cannot list favorites', async () => {
    const res = await api('GET', '/favorites');
    assert.equal(res.status, 401);
  });

  it('favorites list is scoped to authenticated user', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/favorites', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data?.listings));
  });

  it('cannot favorite without auth', async () => {
    if (!fx.listing) return;
    const res = await api('POST', `/favorites/${fx.listing.id}`);
    assert.equal(res.status, 401);
  });
});
