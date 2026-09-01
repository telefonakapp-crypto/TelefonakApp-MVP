'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, customerToken, loadFixtures } = require('../lib/harness');

describe('03 — IDOR listings', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.listing, 'Need approved listing fixture');
  });

  it('non-owner cannot delete another user listing', async () => {
    if (fx.listing.user_id === fx.stranger.id) return;
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('DELETE', `/listings/${fx.listing.id}`, { token });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('non-owner cannot mark another user listing sold', async () => {
    if (fx.listing.user_id === fx.stranger.id) return;
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('PUT', `/listings/${fx.listing.id}/mark-sold`, { token });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('non-owner cannot hide another user listing', async () => {
    if (fx.listing.user_id === fx.stranger.id) return;
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('PATCH', `/listings/${fx.listing.id}/hide`, { token });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('unauthenticated cannot delete listing', async () => {
    const res = await api('DELETE', `/listings/${fx.listing.id}`);
    assert.equal(res.status, 401);
  });
});
