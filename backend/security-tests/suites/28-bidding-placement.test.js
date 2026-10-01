'use strict';

/**
 * Phase 2D — append-only bid placement.
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

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'bidding-place.jpg'
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
            starts_at, original_ends_at, ends_at, winning_bid_id
     FROM listing_auctions
     WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function bidsFor(auctionId) {
  const result = await pool.query(
    `SELECT id, listing_id, auction_id, bidder_id, seller_id, amount, created_at
     FROM bids
     WHERE auction_id = $1
     ORDER BY id`,
    [auctionId]
  );
  return result.rows;
}

describe('28 — Bidding placement', () => {
  let fx;
  let ownerToken;
  let bidderToken;
  let secondBidderToken;
  let staffToken;
  let ownedImageUrl;
  let originalAutoApprove;
  let extraBidder;
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
      description: 'Phase 2D bid placement listing',
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
    assert.equal(res.data.listing.status, LISTING_STATUS.APPROVED);
    const auction = await auctionFor(res.data.listing.id);
    assert.equal(auction.auction_status, AUCTION_STATUS.LIVE);
    return { listing: res.data.listing, auction };
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

  async function placeBid(listingId, token, amount, extra = {}) {
    return api('POST', `/listings/${listingId}/bids`, {
      token,
      body: { amount, ...extra },
    });
  }

  async function setAuctionStatus(listingId, status) {
    await pool.query(
      `UPDATE listing_auctions
       SET auction_status = $2,
           starts_at = COALESCE(starts_at, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
           original_ends_at = COALESCE(original_ends_at, CURRENT_TIMESTAMP + INTERVAL '22 hours'),
           ends_at = COALESCE(ends_at, CURRENT_TIMESTAMP + INTERVAL '22 hours')
       WHERE listing_id = $1`,
      [listingId, status]
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
         VALUES ($1, 'Second', 'Bidder', 'male', TRUE)
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

  it('unauthenticated user cannot bid', async () => {
    const { listing } = await createLiveBid();
    const res = await api('POST', `/listings/${listing.id}/bids`, {
      body: { amount: '305' },
    });
    assert.equal(res.status, 401);
    assert.equal((await bidsFor((await auctionFor(listing.id)).id)).length, 0);
  });

  it('seller cannot bid', async () => {
    const { listing, auction } = await createLiveBid();
    const res = await placeBid(listing.id, ownerToken, '305');
    assert.equal(res.status, 403);
    assert.equal(res.data.code, 'BID_SELF');
    assert.equal((await bidsFor(auction.id)).length, 0);
  });

  it('cannot bid on another listing by changing URL', async () => {
    const first = await createLiveBid({ description: 'Listing A' });
    const second = await createLiveBid({ description: 'Listing B' });
    const res = await placeBid(second.listing.id, bidderToken, '305');
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal((await bidsFor(first.auction.id)).length, 0);
    const secondBids = await bidsFor(second.auction.id);
    assert.equal(secondBids.length, 1);
    assert.equal(Number(secondBids[0].listing_id), second.listing.id);
    assert.equal(Number(secondBids[0].auction_id), second.auction.id);
  });

  it('cannot spoof bidder_id, seller_id, or auction_id', async () => {
    const { listing, auction } = await createLiveBid();
    const res = await placeBid(listing.id, bidderToken, '305', {
      bidder_id: fx.owner.id,
      seller_id: extraBidder.id,
      auction_id: 999999,
      listing_id: 999999,
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(res.data.seller_id, undefined);
    assert.equal(res.data.bidder_id, undefined);
    assert.equal(res.data.bid.bidder_id, undefined);
    const rows = await bidsFor(auction.id);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].bidder_id), fx.stranger.id);
    assert.equal(Number(rows[0].seller_id), fx.owner.id);
    assert.equal(Number(rows[0].auction_id), auction.id);
    assert.equal(Number(rows[0].listing_id), listing.id);
  });

  it('cannot mismatch listing/auction and cannot bid on an old revision', async () => {
    const live = await createLiveBid();
    const pending = await createPendingBid({ description: 'Old revision parent' });
    await pool.query(
      `UPDATE listings SET status = 'declined', decline_reason = 'Needs photos' WHERE id = $1`,
      [pending.listing.id]
    );
    const resubmitted = track(
      await api('PUT', `/listings/${pending.listing.id}`, {
        token: ownerToken,
        body: payload({
          sale_type: 'bid',
          duration_hours: 48,
          price: 300,
          description: 'Resubmitted bid child',
        }),
      })
    );
    assert.ok([200, 201].includes(resubmitted.status), JSON.stringify(resubmitted.data));

    const mismatched = await placeBid(pending.listing.id, bidderToken, '305', {
      auction_id: live.auction.id,
    });
    assert.equal(mismatched.status, 409);
    assert.equal(mismatched.data.code, 'AUCTION_NOT_LIVE');
    assert.equal((await bidsFor(live.auction.id)).length, 0);
    assert.equal((await bidsFor(pending.auction.id)).length, 0);
  });

  it('pending_start rejects bids', async () => {
    const { listing, auction } = await createPendingBid();
    const res = await placeBid(listing.id, bidderToken, '305');
    assert.equal(res.status, 409);
    assert.equal(res.data.code, 'AUCTION_NOT_LIVE');
    assert.equal((await bidsFor(auction.id)).length, 0);
  });

  it('live auction accepts a first bid of starting + 5', async () => {
    const { listing, auction } = await createLiveBid();
    const res = await placeBid(listing.id, bidderToken, '305');
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(res.data.bid.amount, '305.00');
    assert.equal(res.data.highest_bid, '305.00');
    assert.equal(res.data.minimum_next_bid, '310.00');
    assert.equal(res.data.maximum_bid, '600.00');
    assert.equal(res.data.auction_status, AUCTION_STATUS.LIVE);
    assert.ok(res.data.ends_at);
    const listingAfter = await pool.query('SELECT price, status FROM listings WHERE id = $1', [
      listing.id,
    ]);
    assert.equal(Number(listingAfter.rows[0].price), 300);
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.APPROVED);
    assert.equal((await bidsFor(auction.id)).length, 1);
  });

  it('ended, cancelled, and completed auctions reject bids', async () => {
    for (const status of [
      AUCTION_STATUS.ENDED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.COMPLETED,
    ]) {
      const { listing, auction } = await createLiveBid({ description: `State ${status}` });
      await setAuctionStatus(listing.id, status);
      const res = await placeBid(listing.id, bidderToken, '305');
      assert.equal(res.status, 409, `${status} ${JSON.stringify(res.data)}`);
      if (status === AUCTION_STATUS.ENDED || status === AUCTION_STATUS.COMPLETED) {
        assert.equal(res.data.code, 'AUCTION_ENDED');
      } else {
        assert.equal(res.data.code, 'AUCTION_NOT_LIVE');
      }
      assert.equal((await bidsFor(auction.id)).length, 0);
      assert.equal((await auctionFor(listing.id)).auction_status, status);
    }
  });

  it('first bid below starting + 5 and at starting price fail', async () => {
    const { listing, auction } = await createLiveBid();
    const below = await placeBid(listing.id, bidderToken, '304');
    assert.equal(below.status, 409);
    assert.equal(below.data.code, 'BID_TOO_LOW');
    const atStart = await placeBid(listing.id, bidderToken, '300');
    assert.equal(atStart.status, 409);
    assert.equal(atStart.data.code, 'BID_TOO_LOW');
    assert.equal((await bidsFor(auction.id)).length, 0);
  });

  it('subsequent bids respect highest + 5 and allow non-multiples of 5', async () => {
    const { listing, auction } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    assert.equal(first.status, 201);
    const tooLow = await placeBid(listing.id, secondBidderToken, '309');
    assert.equal(tooLow.status, 409);
    assert.equal(tooLow.data.code, 'BID_TOO_LOW');
    const exact = await placeBid(listing.id, secondBidderToken, '310');
    assert.equal(exact.status, 201, JSON.stringify(exact.data));
    const arbitrary = await placeBid(listing.id, bidderToken, '322.25');
    assert.equal(arbitrary.status, 201, JSON.stringify(arbitrary.data));
    assert.equal(arbitrary.data.bid.amount, '322.25');
    const rows = await bidsFor(auction.id);
    assert.equal(rows.length, 3);
    assert.equal(Number(rows[0].amount), 305);
    assert.equal(Number(rows[1].amount), 310);
    assert.equal(Number(rows[2].amount), 322.25);
  });

  it('exactly 2x starting succeeds and above 2x fails', async () => {
    const { listing, auction } = await createLiveBid({ price: 125.5 });
    const maxOk = await placeBid(listing.id, bidderToken, '251.00');
    assert.equal(maxOk.status, 201, JSON.stringify(maxOk.data));
    assert.equal(maxOk.data.bid.amount, '251.00');
    assert.equal(maxOk.data.maximum_bid, '251.00');
    const over = await createLiveBid({ price: 125.5, description: 'Over max' });
    const tooHigh = await placeBid(over.listing.id, bidderToken, '251.01');
    assert.equal(tooHigh.status, 400);
    assert.equal(tooHigh.data.code, 'BID_TOO_HIGH');
    assert.equal((await bidsFor(over.auction.id)).length, 0);
    assert.equal((await bidsFor(auction.id)).length, 1);
  });

  it('zero, negative, malformed, and over-precise amounts fail', async () => {
    const { listing, auction } = await createLiveBid();
    for (const amount of [0, '0', '0.00', -1, '-5', 'abc', '', null, '305.123']) {
      const res = await placeBid(listing.id, bidderToken, amount);
      assert.equal(res.status, 400, `${amount} ${JSON.stringify(res.data)}`);
      assert.equal(res.data.code, 'INVALID_BID_AMOUNT');
    }
    assert.equal((await bidsFor(auction.id)).length, 0);
  });

  it('same bidder can place multiple append-only bids without changing previous rows', async () => {
    const { listing, auction } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    const second = await placeBid(listing.id, bidderToken, '310');
    const third = await placeBid(listing.id, bidderToken, '325');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(third.status, 201);
    const rows = await bidsFor(auction.id);
    assert.equal(rows.length, 3);
    assert.equal(Number(rows[0].bidder_id), fx.stranger.id);
    assert.equal(Number(rows[1].bidder_id), fx.stranger.id);
    assert.equal(Number(rows[2].bidder_id), fx.stranger.id);
    assert.notEqual(rows[0].id, rows[1].id);
    assert.notEqual(rows[1].id, rows[2].id);
    assert.equal(Number(rows[0].amount), 305);
    assert.equal(Number(rows[1].amount), 310);
    assert.equal(Number(rows[2].amount), 325);
  });

  it('concurrent bids serialize and never violate highest + 5', async () => {
    const { listing, auction } = await createLiveBid();
    const [first, second] = await Promise.all([
      placeBid(listing.id, bidderToken, '305'),
      placeBid(listing.id, secondBidderToken, '306'),
    ]);
    const results = [first, second];
    const accepted = results.filter((res) => res.status === 201);
    const rejected = results.filter((res) => res.status === 409);
    assert.equal(accepted.length, 1, JSON.stringify(results.map((res) => res.data)));
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].data.code, 'BID_TOO_LOW');
    assert.equal(accepted[0].data.bid.amount, '305.00');

    const rows = await bidsFor(auction.id);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].amount), 305);
    const highest = await pool.query(
      'SELECT MAX(amount) AS highest FROM bids WHERE auction_id = $1',
      [auction.id]
    );
    assert.equal(Number(highest.rows[0].highest), 305);
  });

  it('expired auction rejects the bid after lazy expiry and inserts no row', async () => {
    const { listing, auction } = await createLiveBid();
    await pool.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [auction.id]
    );
    const res = await placeBid(listing.id, bidderToken, '305');
    assert.equal(res.status, 409);
    assert.equal(res.data.code, 'AUCTION_ENDED');
    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal((await bidsFor(auction.id)).length, 0);
    const listingAfter = await pool.query('SELECT status, price FROM listings WHERE id = $1', [
      listing.id,
    ]);
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(listingAfter.rows[0].price), 300);
  });

  it('sold and deleted listings reject bids while hidden+live still uses auction state', async () => {
    const sold = await createLiveBid({ description: 'Sold live bid' });
    await pool.query(`UPDATE listings SET status = 'sold' WHERE id = $1`, [sold.listing.id]);
    const soldRes = await placeBid(sold.listing.id, bidderToken, '305');
    assert.equal(soldRes.status, 409);
    assert.equal(soldRes.data.code, 'LISTING_NOT_BIDDABLE');
    assert.equal((await bidsFor(sold.auction.id)).length, 0);

    const deleted = await createLiveBid({ description: 'Deleted live bid' });
    await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [deleted.listing.id]);
    const deletedRes = await placeBid(deleted.listing.id, bidderToken, '305');
    assert.equal(deletedRes.status, 409);
    assert.equal(deletedRes.data.code, 'LISTING_NOT_BIDDABLE');
    assert.equal((await bidsFor(deleted.auction.id)).length, 0);

    const hidden = await createLiveBid({ description: 'Hidden live bid' });
    await pool.query(`UPDATE listings SET status = 'hidden' WHERE id = $1`, [hidden.listing.id]);
    const hiddenRes = await placeBid(hidden.listing.id, bidderToken, '305');
    assert.equal(hiddenRes.status, 201, JSON.stringify(hiddenRes.data));
    assert.equal((await bidsFor(hidden.auction.id)).length, 1);
  });

  it('normal listings still accept offers and reject bids', async () => {
    const listing = await createApprovedNormal();
    const bid = await placeBid(listing.id, bidderToken, '305');
    assert.equal(bid.status, 404);
    assert.equal(bid.data.code, 'AUCTION_NOT_FOUND');
    const offer = await api('POST', `/offers/${listing.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.ok([200, 201].includes(offer.status), JSON.stringify(offer.data));
    assert.ok(offer.data.offer);
    assert.equal(Number(offer.data.offer.offered_price), 200);
  });

  it('admin JWT cannot place a customer bid', async () => {
    if (!staffToken) return;
    const { listing, auction } = await createLiveBid();
    const res = await placeBid(listing.id, staffToken, '305');
    assert.equal(res.status, 401);
    assert.equal((await bidsFor(auction.id)).length, 0);
  });
});
