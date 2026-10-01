'use strict';

/**
 * Phase 9.2A — buyer-safe public bid history.
 * Hits the local API. Cleans up listings it creates.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  pool,
  customerToken,
  adminToken,
  tinyJpegBuffer,
  loadFixtures,
  deleteListingsByIds,
} = require('../lib/harness');
const { LISTING_STATUS } = require('../../utils/listingStatus');
const { AUCTION_STATUS, LISTING_SALE_TYPE } = require('../../utils/listingAuctions');

const FORBIDDEN_BID_KEYS = [
  'id',
  'bidder_id',
  'seller_id',
  'phone_number',
  'name',
  'email',
  'bidder',
  'seller',
];

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'public-bid-history.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, 'upload fixture should succeed');
  return res.data.image_urls[0];
}

async function readAutoApprove() {
  const row = await pool.query(
    `SELECT value FROM settings WHERE key = 'auto_approve_listings'`
  );
  return row.rows[0]?.value === 'true';
}

async function setAutoApprove(enabled) {
  await pool.query(
    `INSERT INTO settings (key, value)
     VALUES ('auto_approve_listings', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [enabled ? 'true' : 'false']
  );
}

async function auctionFor(listingId) {
  const result = await pool.query(
    `SELECT id, listing_id, starting_price, duration_hours, auction_status,
            starts_at, original_ends_at, ends_at, winning_bid_id, updated_at
     FROM listing_auctions
     WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function listingSnapshot(listingId) {
  const result = await pool.query(
    `SELECT id, status, sale_type, updated_at FROM listings WHERE id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function bidCount(listingId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n, COALESCE(MAX(id), 0)::int AS max_id
     FROM bids WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0];
}

function assertPublicHistoryShape(data, { limit, hasMore, amounts } = {}) {
  assert.deepEqual(Object.keys(data).sort(), ['bids', 'has_more', 'limit']);
  assert.equal(typeof data.has_more, 'boolean');
  assert.equal(typeof data.limit, 'number');
  assert.ok(Array.isArray(data.bids));
  if (limit !== undefined) assert.equal(data.limit, limit);
  if (hasMore !== undefined) assert.equal(data.has_more, hasMore);
  if (amounts) {
    assert.deepEqual(
      data.bids.map((bid) => bid.amount),
      amounts
    );
  }
  for (const bid of data.bids) {
    assert.deepEqual(Object.keys(bid).sort(), ['amount', 'created_at']);
    assert.match(String(bid.amount), /^\d+\.\d{2}$/);
    assert.ok(bid.created_at);
    for (const key of FORBIDDEN_BID_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(bid, key), false, key);
      assert.equal(bid[key], undefined, key);
    }
  }
}

describe('36 — Public buyer-safe bid history', () => {
  let fx;
  let ownerToken;
  let bidderToken;
  let secondBidderToken;
  let extraBidder;
  let staffToken;
  let ownedImageUrl;
  let originalAutoApprove;
  const createdListingIds = [];

  function track(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  function payload(overrides = {}) {
    return {
      model_id: fx.catalog.model_id,
      model_storage_id: fx.catalog.model_storage_id,
      model_color_id: fx.catalog.model_color_id,
      sim_configuration_id: fx.catalog.sim_configuration_id,
      condition_id: fx.catalog.condition_id,
      price: 300,
      description: 'Phase 9.2A public bid history listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  async function createLiveBid(overrides = {}) {
    await setAutoApprove(true);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({
          sale_type: 'bid',
          duration_hours: 24,
          price: 300,
          ...overrides,
        }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    return { listing: res.data.listing, auction: await auctionFor(res.data.listing.id) };
  }

  async function createPendingBid(overrides = {}) {
    await setAutoApprove(false);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({
          sale_type: 'bid',
          duration_hours: 24,
          price: 300,
          ...overrides,
        }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    return { listing: res.data.listing, auction: await auctionFor(res.data.listing.id) };
  }

  async function createApprovedNormal(overrides = {}) {
    await setAutoApprove(true);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'normal', price: 220, ...overrides }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    return res.data.listing;
  }

  function history(listingId, token, query = '') {
    return api('GET', `/listings/${listingId}/bid-history${query}`, { token });
  }

  async function placeBid(listingId, token, amount) {
    return api('POST', `/listings/${listingId}/bids`, {
      token,
      body: { amount },
    });
  }

  async function expireAuctionClock(auctionId) {
    await pool.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [auctionId]
    );
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog, 'Need phone catalog fixture');
    assert.ok(fx.owner, 'Need listing owner');
    assert.ok(fx.stranger, 'Need bidder fixture');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    bidderToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
    extraBidder = fx.users.find(
      (user) => user.id !== fx.owner.id && user.id !== fx.stranger.id
    );
    if (!extraBidder) {
      const inserted = await pool.query(
        `INSERT INTO users (phone_number, first_name, last_name, gender, is_verified)
         VALUES ($1, 'History', 'Bidder', 'male', TRUE)
         RETURNING id, phone_number`,
        [`077${String(Date.now()).slice(-7)}`]
      );
      extraBidder = inserted.rows[0];
    }
    secondBidderToken = customerToken(extraBidder.id, extraBidder.phone_number);
    staffToken = fx.admin
      ? adminToken({
          adminId: fx.admin.id,
          email: fx.admin.email,
          role: fx.admin.role || 'super_admin',
        })
      : null;
    ownedImageUrl = await uploadOne(ownerToken);
    originalAutoApprove = await readAutoApprove();
  });

  after(async () => {
    await setAutoApprove(originalAutoApprove);
    await deleteListingsByIds(createdListingIds);
  });

  it('authenticated customer can read public bid amounts and created_at', async () => {
    const { listing } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    const second = await placeBid(listing.id, secondBidderToken, '310');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    const res = await history(listing.id, bidderToken);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assertPublicHistoryShape(res.data, {
      limit: 4,
      hasMore: false,
      amounts: ['310.00', '305.00'],
    });
    assert.ok(res.data.bids[0].created_at);
    assert.ok(res.data.bids[1].created_at);
  });

  it('rejects unauthenticated and admin tokens', async () => {
    const { listing } = await createLiveBid();
    await placeBid(listing.id, bidderToken, '305');

    const anon = await history(listing.id);
    assert.equal(anon.status, 401);

    const invalid = await history(listing.id, 'not-a-valid-token');
    assert.equal(invalid.status, 401);

    if (staffToken) {
      const adminRes = await history(listing.id, staffToken);
      assert.equal(adminRes.status, 401);
    }
  });

  it('rejects missing and Normal listings with the same not-found response', async () => {
    const missing = await history(99999999, bidderToken);
    assert.equal(missing.status, 404);
    assert.equal(missing.data.error, 'Listing not found');
    assert.equal(missing.data.bids, undefined);

    const invalid = await history('abc', bidderToken);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.error, 'Invalid listing ID');

    const normal = await createApprovedNormal();
    const res = await history(normal.id, bidderToken);
    assert.equal(res.status, 404);
    assert.equal(res.data.error, 'Listing not found');
    assert.equal(res.data.code, undefined);
    assert.equal(res.data.bids, undefined);
  });

  it('returns an empty list when a Bid listing has no bids', async () => {
    const { listing } = await createLiveBid();
    const res = await history(listing.id, bidderToken);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assertPublicHistoryShape(res.data, { limit: 4, hasMore: false, amounts: [] });
  });

  it('orders by amount DESC, created_at DESC, id DESC', async () => {
    const { listing, auction } = await createLiveBid();
    await placeBid(listing.id, bidderToken, '305');
    await placeBid(listing.id, secondBidderToken, '325');
    await pool.query(
      `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount, created_at)
       VALUES
         ($1, $2, $3, $4, 340.00, '2026-09-29 10:00:00'),
         ($1, $2, $3, $4, 340.00, '2026-09-29 11:00:00'),
         ($1, $2, $5, $4, 350.00, '2026-09-29 09:00:00')`,
      [listing.id, auction.id, fx.stranger.id, fx.owner.id, extraBidder.id]
    );

    const res = await history(listing.id, bidderToken, '?limit=10');
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assertPublicHistoryShape(res.data, {
      limit: 10,
      hasMore: false,
      amounts: ['350.00', '340.00', '340.00', '325.00', '305.00'],
    });
    assert.ok(
      new Date(res.data.bids[1].created_at).getTime() >
        new Date(res.data.bids[2].created_at).getTime()
    );
  });

  it('enforces default limit 4, maximum limit 20, and has_more', async () => {
    const { listing, auction } = await createLiveBid();
    for (let i = 0; i < 21; i += 1) {
      await pool.query(
        `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount)
         VALUES ($1, $2, $3, $4, $5::decimal)`,
        [listing.id, auction.id, extraBidder.id, fx.owner.id, (305 + i * 5).toFixed(2)]
      );
    }

    const def = await history(listing.id, bidderToken);
    assert.equal(def.status, 200, JSON.stringify(def.data));
    assertPublicHistoryShape(def.data, { limit: 4, hasMore: true });
    assert.equal(def.data.bids.length, 4);
    assert.equal(def.data.bids[0].amount, '405.00');
    assert.equal(def.data.bids[3].amount, '390.00');

    const capped = await history(listing.id, bidderToken, '?limit=100');
    assert.equal(capped.status, 200, JSON.stringify(capped.data));
    assertPublicHistoryShape(capped.data, { limit: 20, hasMore: true });
    assert.equal(capped.data.bids.length, 20);

    const exact = await history(listing.id, bidderToken, '?limit=21');
    assert.equal(exact.status, 200);
    assert.equal(exact.data.limit, 20);
    assert.equal(exact.data.has_more, true);
  });

  it('never returns bidder identity, even to the seller', async () => {
    const { listing } = await createLiveBid();
    await placeBid(listing.id, bidderToken, '305');
    await placeBid(listing.id, secondBidderToken, '310');

    const sellerPublic = await history(listing.id, ownerToken);
    assert.equal(sellerPublic.status, 200, JSON.stringify(sellerPublic.data));
    assertPublicHistoryShape(sellerPublic.data, {
      limit: 4,
      hasMore: false,
      amounts: ['310.00', '305.00'],
    });
    const raw = JSON.stringify(sellerPublic.data);
    assert.equal(raw.includes(String(fx.stranger.phone_number)), false);
    assert.equal(raw.includes(String(extraBidder.phone_number)), false);
    assert.doesNotMatch(raw, /"bidder_id"/);
    assert.doesNotMatch(raw, /"seller_id"/);
    assert.doesNotMatch(raw, /"phone_number"/);
    assert.doesNotMatch(raw, /"bidder"/);
    assert.doesNotMatch(raw, /"seller"/);

    const privateList = await api('GET', `/listings/${listing.id}/bids`, {
      token: ownerToken,
    });
    assert.equal(privateList.status, 200, JSON.stringify(privateList.data));
    assert.ok(privateList.data.bids.length >= 2);
    assert.ok(privateList.data.bids[0].bidder);
    assert.ok(privateList.data.bids[0].bidder.phone_number);
    assert.ok(privateList.data.bids[0].bidder.name);
  });

  it('follows GET /listings/:id visibility for hidden, pending, deleted, and completed auctions', async () => {
    const live = await createLiveBid({ description: 'Hide me' });
    await placeBid(live.listing.id, bidderToken, '305');
    await pool.query(`UPDATE listings SET status = $2 WHERE id = $1`, [
      live.listing.id,
      LISTING_STATUS.HIDDEN,
    ]);

    const hiddenBuyer = await history(live.listing.id, bidderToken);
    assert.equal(hiddenBuyer.status, 404);
    assert.equal(hiddenBuyer.data.error, 'Listing not found');
    assert.equal(hiddenBuyer.data.bids, undefined);

    const hiddenOwner = await history(live.listing.id, ownerToken);
    assert.equal(hiddenOwner.status, 200, JSON.stringify(hiddenOwner.data));
    assertPublicHistoryShape(hiddenOwner.data, { amounts: ['305.00'] });

    const pending = await createPendingBid();
    const pendingBuyer = await history(pending.listing.id, bidderToken);
    assert.equal(pendingBuyer.status, 404);
    const pendingOwner = await history(pending.listing.id, ownerToken);
    assert.equal(pendingOwner.status, 200, JSON.stringify(pendingOwner.data));
    assertPublicHistoryShape(pendingOwner.data, { amounts: [] });

    const toDelete = await createLiveBid({ description: 'Delete me' });
    await placeBid(toDelete.listing.id, bidderToken, '305');
    await pool.query(`UPDATE listings SET status = $2 WHERE id = $1`, [
      toDelete.listing.id,
      LISTING_STATUS.DELETED,
    ]);
    const deletedBuyer = await history(toDelete.listing.id, bidderToken);
    assert.equal(deletedBuyer.status, 404);
    const deletedOwner = await history(toDelete.listing.id, ownerToken);
    assert.equal(deletedOwner.status, 200, JSON.stringify(deletedOwner.data));
    assertPublicHistoryShape(deletedOwner.data, { amounts: ['305.00'] });

    const expired = await createLiveBid({ description: 'Expire me' });
    await placeBid(expired.listing.id, bidderToken, '305');
    await expireAuctionClock(expired.auction.id);
    const ownerDetail = await api('GET', `/listings/${expired.listing.id}`, {
      token: ownerToken,
    });
    assert.equal(ownerDetail.status, 200);
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(ownerDetail.data.listing.auction.auction_status, AUCTION_STATUS.COMPLETED);

    const buyerDetail = await api('GET', `/listings/${expired.listing.id}`, {
      token: bidderToken,
    });
    assert.equal(buyerDetail.status, 404);
    const expiredBuyer = await history(expired.listing.id, bidderToken);
    assert.equal(expiredBuyer.status, 404);
    const expiredOwner = await history(expired.listing.id, ownerToken);
    assert.equal(expiredOwner.status, 200, JSON.stringify(expiredOwner.data));
    assertPublicHistoryShape(expiredOwner.data, { amounts: ['305.00'] });
  });

  it('returns AUCTION_NOT_FOUND when a Bid listing has no auction', async () => {
    const pending = await createPendingBid();
    await pool.query('DELETE FROM listing_auctions WHERE listing_id = $1', [
      pending.listing.id,
    ]);
    const res = await history(pending.listing.id, ownerToken);
    assert.equal(res.status, 404);
    assert.equal(res.data.code, 'AUCTION_NOT_FOUND');
    assert.equal(res.data.bids, undefined);
  });

  it('does not mutate listings, auctions, or bids', async () => {
    const { listing, auction } = await createLiveBid();
    await placeBid(listing.id, bidderToken, '305');
    const beforeListing = await listingSnapshot(listing.id);
    const beforeAuction = await auctionFor(listing.id);
    const beforeBids = await bidCount(listing.id);

    const res = await history(listing.id, bidderToken);
    assert.equal(res.status, 200);

    const afterListing = await listingSnapshot(listing.id);
    const afterAuction = await auctionFor(listing.id);
    const afterBids = await bidCount(listing.id);
    assert.equal(afterListing.status, beforeListing.status);
    assert.equal(afterListing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(String(afterListing.updated_at), String(beforeListing.updated_at));
    assert.equal(afterAuction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(afterAuction.auction_status, beforeAuction.auction_status);
    assert.equal(String(afterAuction.updated_at), String(beforeAuction.updated_at));
    assert.equal(afterBids.n, beforeBids.n);
    assert.equal(afterBids.max_id, beforeBids.max_id);
  });

  it('leaves existing Bid APIs unchanged', async () => {
    const live = await createLiveBid({ description: 'Regression live' });
    const placed = await placeBid(live.listing.id, bidderToken, '305');
    assert.equal(placed.status, 201, JSON.stringify(placed.data));

    const publicHistory = await history(live.listing.id, bidderToken);
    assert.equal(publicHistory.status, 200);

    const detail = await api('GET', `/listings/${live.listing.id}`, { token: bidderToken });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.listing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(detail.data.listing.auction.current_highest_bid, '305.00');
    assert.equal(detail.data.listing.auction.bid_count, 1);

    const myListingBids = await api('GET', `/listings/${live.listing.id}/my-bids`, {
      token: bidderToken,
    });
    assert.equal(myListingBids.status, 200, JSON.stringify(myListingBids.data));
    assert.equal(myListingBids.data.bids[0].amount, '305.00');
    assert.ok(myListingBids.data.bids[0].id);

    const sellerBids = await api('GET', `/listings/${live.listing.id}/bids`, {
      token: ownerToken,
    });
    assert.equal(sellerBids.status, 200);
    assert.equal(sellerBids.data.bids[0].bidder.phone_number, fx.stranger.phone_number);

    const myBids = await api('GET', '/bids/my', { token: bidderToken });
    assert.equal(myBids.status, 200);
    assert.ok(myBids.data.listings.some((row) => row.id === live.listing.id));

    const received = await api('GET', '/bids/received', { token: ownerToken });
    assert.equal(received.status, 200);
    assert.ok(received.data.listings.some((row) => row.id === live.listing.id));

    const extendable = await createLiveBid({ description: 'Extend regression' });
    await placeBid(extendable.listing.id, bidderToken, '305');
    const extended = await api('POST', `/listings/${extendable.listing.id}/extend-bid`, {
      token: ownerToken,
      body: { duration_hours: 24 },
    });
    assert.equal(extended.status, 200, JSON.stringify(extended.data));

    const sold = await createLiveBid({ description: 'End regression' });
    const soldBid = await placeBid(sold.listing.id, bidderToken, '305');
    const ended = await api('POST', `/listings/${sold.listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'sold', winning_bid_id: soldBid.data.bid.id },
    });
    assert.equal(ended.status, 200, JSON.stringify(ended.data));

    const listAgainSource = await createLiveBid({ description: 'List again regression' });
    await placeBid(listAgainSource.listing.id, bidderToken, '305');
    await expireAuctionClock(listAgainSource.auction.id);
    await api('GET', `/listings/${listAgainSource.listing.id}`, { token: ownerToken });
    const listedAgain = track(
      await api('POST', `/listings/${listAgainSource.listing.id}/list-again`, {
        token: ownerToken,
        body: { duration_hours: 48 },
      })
    );
    assert.ok([200, 201].includes(listedAgain.status), JSON.stringify(listedAgain.data));
  });
});
