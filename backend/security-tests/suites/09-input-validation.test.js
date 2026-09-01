'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, customerToken, loadFixtures } = require('../lib/harness');

describe('09 — Input validation', () => {
  let fx;
  let token;

  before(async () => {
    fx = await loadFixtures();
    token = customerToken(fx.owner.id, fx.owner.phone_number);
  });

  it('rejects offer with non-positive price', async () => {
    if (!fx.listing) return;
    // Buyer must not be the listing owner
    if (fx.listing.user_id === fx.stranger.id) return;
    const buyerToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('POST', `/offers/${fx.listing.id}`, {
      token: buyerToken,
      body: { offered_price: -10 },
    });
    assert.ok([400, 403].includes(res.status), `got ${res.status}`);
  });

  it('rejects offer on own listing', async () => {
    if (!fx.listing) return;
    const ownerToken = customerToken(fx.listing.user_id);
    const res = await api('POST', `/offers/${fx.listing.id}`, {
      token: ownerToken,
      body: { offered_price: 100 },
    });
    assert.ok([403, 409].includes(res.status), `got ${res.status}`);
  });

  it('rejects invalid phone on OTP request', async () => {
    const res = await api('POST', '/auth/request-otp', {
      body: { phone_number: 'not-a-phone' },
    });
    assert.equal(res.status, 400);
  });

  it('rejects malformed listing id', async () => {
    const res = await api('GET', '/listings/not-an-id', { token });
    assert.ok([400, 404, 500].includes(res.status));
  });
});
