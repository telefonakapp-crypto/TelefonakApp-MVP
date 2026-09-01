'use strict';

/**
 * SEC-001 — Marketplace seller contact on public listings.
 *
 * Product rule: seller phone_number is intentional public contact information
 * on approved listings (Call Seller). It must NOT require an offer.
 *
 * Other private account fields must NOT leak via listing detail.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  customerToken,
  loadFixtures,
} = require('../lib/harness');

const PRIVATE_ACCOUNT_FIELDS = [
  'email',
  'pending_phone_number',
  'pending_phone_expires_at',
  'password_hash',
  'date_of_birth',
  'deactivation_reason',
  'deactivated_at',
  'is_active',
];

function assertPublicSellerContact(payload, context) {
  const listing = payload?.listing;
  assert.ok(listing, `${context}: missing listing object`);
  assert.ok(
    listing.phone_number && String(listing.phone_number).length >= 7,
    `${context}: expected listing.phone_number for Call Seller`
  );
}

function assertNoPrivateAccountFields(payload, context) {
  const listing = payload?.listing || {};
  for (const key of PRIVATE_ACCOUNT_FIELDS) {
    assert.ok(
      listing[key] === undefined,
      `${context}: listing must not expose private field "${key}"`
    );
  }
}

describe('02 — Listings contact (SEC-001 product rule)', () => {
  let fx;

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.listing, 'Need at least one approved listing fixture');
  });

  it('GET /listings/:id guest on public listing includes seller phone (Call Seller)', async () => {
    const res = await api('GET', `/listings/${fx.listing.id}`);
    assert.equal(res.status, 200);
    assertPublicSellerContact(res.data, 'guest listing detail');
    assertNoPrivateAccountFields(res.data, 'guest listing detail');
  });

  it('GET /listings/:id unrelated authenticated user includes seller phone', async () => {
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('GET', `/listings/${fx.listing.id}`, { token });
    assert.equal(res.status, 200);
    if (fx.listing.user_id !== fx.stranger.id) {
      assertPublicSellerContact(res.data, 'stranger listing detail');
      assertNoPrivateAccountFields(res.data, 'stranger listing detail');
    }
  });

  it('GET /listings/:id buyer with pending offer includes seller phone', async () => {
    const pending = (fx.offers || []).find(
      (o) =>
        o.listing_id === fx.listing.id &&
        o.status === 'pending' &&
        o.buyer_id !== fx.listing.user_id
    );
    if (!pending) return;
    const token = customerToken(pending.buyer_id);
    const res = await api('GET', `/listings/${fx.listing.id}`, { token });
    assert.equal(res.status, 200);
    assertPublicSellerContact(res.data, 'pending-offer buyer listing detail');
  });

  it('GET /listings/:id buyer with accepted offer includes seller phone', async () => {
    const accepted = (fx.offers || []).find(
      (o) =>
        o.listing_id === fx.listing.id &&
        o.status === 'accepted' &&
        o.buyer_id !== fx.listing.user_id
    );
    if (!accepted) return;
    const token = customerToken(accepted.buyer_id);
    const res = await api('GET', `/listings/${fx.listing.id}`, { token });
    assert.equal(res.status, 200);
    assertPublicSellerContact(res.data, 'accepted-offer buyer listing detail');
  });

  it('GET /listings/:id listing owner includes seller phone', async () => {
    const token = customerToken(fx.listing.user_id);
    const res = await api('GET', `/listings/${fx.listing.id}`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.data?.listing?.is_owner, true);
    assertPublicSellerContact(res.data, 'owner listing detail');
  });

  it('GET /listings search does not expose seller phone (list cards only)', async () => {
    const res = await api('GET', '/listings?limit=10');
    assert.equal(res.status, 200);
    for (const row of res.data?.listings || []) {
      assert.ok(
        row.phone_number == null || row.phone_number === undefined,
        `search listing ${row.id} must not include phone_number`
      );
    }
  });

  it('GET /favorites does not expose seller phone (list cards only)', async () => {
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('GET', '/favorites', { token });
    assert.ok([200, 401].includes(res.status));
    if (res.status === 200) {
      for (const row of res.data?.listings || []) {
        assert.ok(
          row.phone_number == null || row.phone_number === undefined,
          `favorite listing ${row.id} must not include phone_number`
        );
      }
    }
  });

  it('GET /offers/sent exposes seller phone only when offer is accepted', async () => {
    const token = customerToken(fx.stranger.id, fx.stranger.phone_number);
    const res = await api('GET', '/offers/sent', { token });
    assert.equal(res.status, 200);
    for (const offer of res.data?.offers || []) {
      if (offer.status !== 'accepted') {
        assert.ok(
          offer.seller_phone_number == null || offer.seller_phone_number === '',
          `pending/rejected offer ${offer.id} must not include seller_phone_number`
        );
      }
    }
  });

  it('GET /user/profile returns only authenticated user own profile', async () => {
    const token = customerToken(fx.owner.id, fx.owner.phone_number);
    const res = await api('GET', '/user/profile', { token });
    assert.equal(res.status, 200);
    assert.equal(res.data?.user?.id, fx.owner.id);
    assert.ok(res.data?.user?.phone_number);
  });
});
