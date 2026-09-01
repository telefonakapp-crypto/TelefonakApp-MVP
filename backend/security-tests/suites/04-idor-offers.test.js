'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { api, customerToken, loadFixtures } = require('../lib/harness');

describe('04 — IDOR offers', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
  });

  it('non-seller cannot accept an offer', async () => {
    if (!fx.offer) return;
    const nonSeller =
      fx.users.find((u) => u.id !== fx.offer.seller_id) || fx.stranger;
    const token = customerToken(nonSeller.id, nonSeller.phone_number);
    const res = await api('PATCH', `/offers/${fx.offer.id}/accept`, { token });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('non-seller cannot reject an offer', async () => {
    if (!fx.offer) return;
    const nonSeller =
      fx.users.find((u) => u.id !== fx.offer.seller_id) || fx.stranger;
    const token = customerToken(nonSeller.id, nonSeller.phone_number);
    const res = await api('PATCH', `/offers/${fx.offer.id}/reject`, { token });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('buyer cannot mark seller offer as seen', async () => {
    if (!fx.offer) return;
    const token = customerToken(fx.offer.buyer_id);
    const res = await api('PATCH', `/offers/${fx.offer.id}/seen`, { token });
    assert.ok([403, 404].includes(res.status), `expected 403/404 got ${res.status}`);
  });

  it('received offers only return for authenticated seller scope', async () => {
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('GET', '/offers/received', { token });
    assert.equal(res.status, 200);
    const offers = res.data?.offers || [];
    for (const offer of offers) {
      assert.equal(offer.seller_id, fx.stranger.id);
    }
  });

  it('sent offers only return for authenticated buyer scope', async () => {
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('GET', '/offers/sent', { token });
    assert.equal(res.status, 200);
    const offers = res.data?.offers || [];
    for (const offer of offers) {
      assert.equal(offer.buyer_id, fx.stranger.id);
    }
  });

  it('unauthenticated cannot list received offers', async () => {
    const res = await api('GET', '/offers/received');
    assert.equal(res.status, 401);
  });
});
