'use strict';

/**
 * Phase 2F-3 — seller live-auction extension (once, within 168h from starts_at).
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
const {
  AUCTION_DURATION_HOURS,
  AUCTION_STATUS,
  LISTING_SALE_TYPE,
} = require('../../utils/listingAuctions');

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'bidding-extend.jpg'
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
            starts_at, original_ends_at, ends_at, extension_used, winning_bid_id
     FROM listing_auctions
     WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function listingRow(listingId) {
  const result = await pool.query(
    `SELECT id, user_id, status, price, sale_type
     FROM listings
     WHERE id = $1`,
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

describe('32 — Bidding seller auction extension', () => {
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
      description: 'Phase 2F-3 extend bid listing',
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

  async function placeBid(listingId, token, amount, extra = {}) {
    return api('POST', `/listings/${listingId}/bids`, {
      token,
      body: { amount, ...extra },
    });
  }

  async function extendBid(listingId, token, body) {
    return api('POST', `/listings/${listingId}/extend-bid`, { token, body });
  }

  async function endBid(listingId, token, body) {
    return api('POST', `/listings/${listingId}/end-bid`, { token, body });
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

  async function marketplaceHas(listingId, price) {
    const res = await api(
      'GET',
      `/listings?min_price=${price}&max_price=${price}&model_id=${fx.catalog.model_id}&limit=100`
    );
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return (res.data.listings || []).some((row) => row.id === listingId);
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

  it('rejects unauthenticated, admin, and non-owner extension', async () => {
    const { listing } = await createLiveBid();
    const anon = await extendBid(listing.id, undefined, { duration_hours: 24 });
    assert.equal(anon.status, 401);

    if (staffToken) {
      const adminRes = await extendBid(listing.id, staffToken, { duration_hours: 24 });
      assert.equal(adminRes.status, 401);
    }

    const stranger = await extendBid(listing.id, bidderToken, { duration_hours: 24 });
    assert.equal(stranger.status, 403);
    assert.equal(stranger.data.code, 'END_BID_NOT_OWNER');
    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(after.extension_used, false);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
  });

  it('owner can extend a live Bid listing once', async () => {
    const { listing, auction } = await createLiveBid();
    const placed = await placeBid(listing.id, bidderToken, '305');
    assert.equal(placed.status, 201, JSON.stringify(placed.data));
    const beforeBids = await bidsFor(auction.id);

    const res = await extendBid(listing.id, ownerToken, {
      duration_hours: 24,
      starts_at: '2000-01-01T00:00:00.000Z',
      ends_at: '2000-01-02T00:00:00.000Z',
      original_ends_at: '2000-01-02T00:00:00.000Z',
      extension_used: false,
      auction_id: 999999,
      seller_id: extraBidder.id,
      user_id: extraBidder.id,
      listing_status: 'sold',
      auction_status: 'completed',
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(res.data.auction.extension_used, true);
    assert.equal(res.data.listing.status, LISTING_STATUS.APPROVED);
    assert.equal(Number(res.data.listing.price), 300);

    const clocks = await pool.query(
      `SELECT
         starts_at,
         original_ends_at,
         ends_at,
         ends_at = original_ends_at + make_interval(hours => 24) AS ends_extended,
         (ends_at - starts_at) = INTERVAL '48 hours' AS total_duration,
         duration_hours,
         extension_used,
         auction_status
       FROM listing_auctions WHERE listing_id = $1`,
      [listing.id]
    );
    assert.equal(String(clocks.rows[0].starts_at), String(auction.starts_at));
    assert.equal(String(clocks.rows[0].original_ends_at), String(auction.original_ends_at));
    assert.equal(clocks.rows[0].ends_extended, true);
    assert.equal(clocks.rows[0].total_duration, true);
    assert.equal(Number(clocks.rows[0].duration_hours), 24);
    assert.equal(clocks.rows[0].extension_used, true);
    assert.equal(clocks.rows[0].auction_status, AUCTION_STATUS.LIVE);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
    assert.equal(Number((await listingRow(listing.id)).price), 300);
    assert.equal(await marketplaceHas(listing.id, 300), true);

    const afterBids = await bidsFor(auction.id);
    assert.equal(afterBids.length, beforeBids.length);
    assert.equal(afterBids[0].id, beforeBids[0].id);
    assert.equal(Number(afterBids[0].amount), Number(beforeBids[0].amount));
  });

  it('normal listings and missing auctions are rejected', async () => {
    const normal = await createApprovedNormal({ price: 223.13 });
    const normalRes = await extendBid(normal.id, ownerToken, { duration_hours: 24 });
    assert.equal(normalRes.status, 409);
    assert.equal(normalRes.data.code, 'END_BID_NOT_AUCTION');

    const pending = await createPendingBid();
    await pool.query('DELETE FROM listing_auctions WHERE listing_id = $1', [pending.listing.id]);
    const missing = await extendBid(pending.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(missing.status, 404);
    assert.equal(missing.data.code, 'AUCTION_NOT_FOUND');
  });

  it('rejects pending_start, completed, cancelled, ended, expired, and bid_duration_ended', async () => {
    const pending = await createPendingBid();
    const pendingRes = await extendBid(pending.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(pendingRes.status, 409);
    assert.equal(pendingRes.data.code, 'AUCTION_NOT_LIVE');

    for (const status of [
      AUCTION_STATUS.COMPLETED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.ENDED,
    ]) {
      const live = await createLiveBid({ description: `State ${status}` });
      await setAuctionStatus(live.listing.id, status);
      const res = await extendBid(live.listing.id, ownerToken, { duration_hours: 24 });
      assert.equal(res.status, 409, `${status} ${JSON.stringify(res.data)}`);
      assert.ok(
        ['AUCTION_ENDED', 'AUCTION_NOT_LIVE'].includes(res.data.code),
        `${status} ${res.data.code}`
      );
      const after = await auctionFor(live.listing.id);
      assert.equal(after.auction_status, status);
      assert.equal(after.extension_used, false);
    }

    const due = await createLiveBid();
    const first = await placeBid(due.listing.id, bidderToken, '305');
    const second = await placeBid(due.listing.id, secondBidderToken, '310');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    await expireAuctionClock(due.auction.id);
    const expired = await extendBid(due.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(expired.status, 409);
    assert.equal(expired.data.code, 'AUCTION_ENDED');
    const completed = await auctionFor(due.listing.id);
    assert.equal(completed.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(completed.winning_bid_id, second.data.bid.id);
    assert.equal(completed.extension_used, false);
    assert.equal((await listingRow(due.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);

    const alreadyEnded = await createLiveBid();
    await expireAuctionClock(alreadyEnded.auction.id);
    await api('GET', `/listings/${alreadyEnded.listing.id}`, { token: ownerToken });
    const endedListing = await extendBid(alreadyEnded.listing.id, ownerToken, {
      duration_hours: 24,
    });
    assert.equal(endedListing.status, 409);
    assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(endedListing.data.code));
    assert.equal((await auctionFor(alreadyEnded.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
  });

  it('accepts every allowed duration that fits under 168h and rejects invalid values', async () => {
    const fitting = AUCTION_DURATION_HOURS.filter((hours) => hours <= 144);
    for (const hours of fitting) {
      const { listing } = await createLiveBid({
        description: `Extend ${hours}h`,
        duration_hours: 24,
      });
      const res = await extendBid(listing.id, ownerToken, { duration_hours: hours });
      assert.equal(res.status, 200, `${hours} ${JSON.stringify(res.data)}`);
      const clocks = await pool.query(
        `SELECT
           ends_at = original_ends_at + make_interval(hours => $2) AS ends_extended,
           (ends_at - starts_at) <= INTERVAL '168 hours' AS within_max,
           extension_used
         FROM listing_auctions WHERE listing_id = $1`,
        [listing.id, hours]
      );
      assert.equal(clocks.rows[0].ends_extended, true);
      assert.equal(clocks.rows[0].within_max, true);
      assert.equal(clocks.rows[0].extension_used, true);
    }

    const overHours = AUCTION_DURATION_HOURS.filter((hours) => hours > 144);
    for (const hours of overHours) {
      const { listing } = await createLiveBid({ description: `Reject ${hours}h` });
      const res = await extendBid(listing.id, ownerToken, { duration_hours: hours });
      assert.equal(res.status, 409, `${hours} ${JSON.stringify(res.data)}`);
      assert.equal(res.data.code, 'EXTENSION_EXCEEDS_MAX');
      assert.equal((await auctionFor(listing.id)).extension_used, false);
    }

    const { listing } = await createLiveBid();
    for (const value of [0, -24, 1, 1.5, 23, 24.5, 169, '24.0', '1 day', '24 hours', true, {}]) {
      const res = await extendBid(listing.id, ownerToken, { duration_hours: value });
      assert.equal(res.status, 400, `${JSON.stringify(value)} ${JSON.stringify(res.data)}`);
      assert.equal(res.data.code, 'INVALID_AUCTION_DURATION');
    }
    const missing = await extendBid(listing.id, ownerToken, {});
    assert.equal(missing.status, 400);
    assert.equal(missing.data.code, 'INVALID_AUCTION_DURATION');
    assert.equal((await auctionFor(listing.id)).extension_used, false);
  });

  it('enforces remaining 168h capacity for 120h, 144h, and 168h auctions', async () => {
    const from120 = await createLiveBid({ duration_hours: 120, description: '120h auction' });
    const reject60 = await extendBid(from120.listing.id, ownerToken, { duration_hours: 60 });
    assert.equal(reject60.status, 409);
    assert.equal(reject60.data.code, 'EXTENSION_EXCEEDS_MAX');
    const allow48 = await extendBid(from120.listing.id, ownerToken, { duration_hours: 48 });
    assert.equal(allow48.status, 200, JSON.stringify(allow48.data));

    const from120b = await createLiveBid({ duration_hours: 120, description: '120h allow 24' });
    const allow24 = await extendBid(from120b.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(allow24.status, 200);
    const from120c = await createLiveBid({ duration_hours: 120, description: '120h allow 36' });
    const allow36 = await extendBid(from120c.listing.id, ownerToken, { duration_hours: 36 });
    assert.equal(allow36.status, 200);

    const from144 = await createLiveBid({ duration_hours: 144, description: '144h auction' });
    const reject36 = await extendBid(from144.listing.id, ownerToken, { duration_hours: 36 });
    assert.equal(reject36.status, 409);
    assert.equal(reject36.data.code, 'EXTENSION_EXCEEDS_MAX');
    const allow144 = await extendBid(from144.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(allow144.status, 200);

    const from168 = await createLiveBid({ duration_hours: 168, description: '168h auction' });
    const reject168 = await extendBid(from168.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(reject168.status, 409);
    assert.equal(reject168.data.code, 'EXTENSION_EXCEEDS_MAX');
    assert.equal((await auctionFor(from168.listing.id)).extension_used, false);
  });

  it('second extension is rejected and concurrent extensions succeed only once', async () => {
    const once = await createLiveBid();
    const first = await extendBid(once.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(first.status, 200);
    const second = await extendBid(once.listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(second.status, 409);
    assert.equal(second.data.code, 'EXTENSION_ALREADY_USED');
    const afterOnce = await auctionFor(once.listing.id);
    assert.equal(afterOnce.extension_used, true);
    const total = await pool.query(
      `SELECT (ends_at - starts_at) = INTERVAL '48 hours' AS total_duration
       FROM listing_auctions WHERE listing_id = $1`,
      [once.listing.id]
    );
    assert.equal(total.rows[0].total_duration, true);

    const concurrent = await createLiveBid();
    const [left, right] = await Promise.all([
      extendBid(concurrent.listing.id, ownerToken, { duration_hours: 24 }),
      extendBid(concurrent.listing.id, ownerToken, { duration_hours: 36 }),
    ]);
    const results = [left, right];
    assert.equal(results.filter((res) => res.status === 200).length, 1, JSON.stringify(results.map((res) => res.data)));
    assert.equal(results.filter((res) => res.status === 409).length, 1);
    assert.equal(results.find((res) => res.status === 409).data.code, 'EXTENSION_ALREADY_USED');
    const afterConcurrent = await auctionFor(concurrent.listing.id);
    assert.equal(afterConcurrent.extension_used, true);
    assert.equal(afterConcurrent.auction_status, AUCTION_STATUS.LIVE);
    const hours = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (ends_at - starts_at)) / 3600 AS total_hours
       FROM listing_auctions WHERE listing_id = $1`,
      [concurrent.listing.id]
    );
    assert.ok([48, 60].includes(Number(hours.rows[0].total_hours)));
  });

  it('serializes extension against bids, End Bid, and expiration', async () => {
    const vsBid = await createLiveBid();
    const existing = await placeBid(vsBid.listing.id, bidderToken, '305');
    assert.equal(existing.status, 201);
    const [extendRes, lateBid] = await Promise.all([
      extendBid(vsBid.listing.id, ownerToken, { duration_hours: 24 }),
      placeBid(vsBid.listing.id, secondBidderToken, '310'),
    ]);
    assert.equal(extendRes.status, 200, JSON.stringify(extendRes.data));
    assert.ok([201, 409].includes(lateBid.status), JSON.stringify(lateBid.data));
    if (lateBid.status === 201) {
      assert.equal(lateBid.data.auction_status, AUCTION_STATUS.LIVE);
    } else {
      assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(lateBid.data.code));
    }
    const vsBidAuction = await auctionFor(vsBid.listing.id);
    assert.equal(vsBidAuction.extension_used, true);
    assert.equal(vsBidAuction.auction_status, AUCTION_STATUS.LIVE);
    const vsBidRows = await bidsFor(vsBid.auction.id);
    assert.ok(vsBidRows.length >= 1);
    assert.equal(vsBidRows[0].id, existing.data.bid.id);
    assert.equal(Number(vsBidRows[0].amount), 305);
    if (lateBid.status === 201) {
      assert.equal(vsBidRows.length, 2);
      assert.equal(Number(vsBidRows[1].amount), 310);
    }

    const vsEnd = await createLiveBid();
    const selected = await placeBid(vsEnd.listing.id, bidderToken, '305');
    const [endRes, extendDuringEnd] = await Promise.all([
      endBid(vsEnd.listing.id, ownerToken, {
        action: 'sold',
        winning_bid_id: selected.data.bid.id,
      }),
      extendBid(vsEnd.listing.id, ownerToken, { duration_hours: 24 }),
    ]);
    const endPair = [endRes, extendDuringEnd];
    assert.equal(endPair.filter((res) => res.status === 200).length, 1, JSON.stringify(endPair.map((res) => res.data)));
    if (endRes.status === 200) {
      assert.equal(extendDuringEnd.status, 409);
      assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(extendDuringEnd.data.code));
      assert.equal((await auctionFor(vsEnd.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
      assert.equal((await listingRow(vsEnd.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
    } else {
      assert.equal(extendDuringEnd.status, 200);
      assert.equal((await auctionFor(vsEnd.listing.id)).auction_status, AUCTION_STATUS.LIVE);
      const afterExtendEnd = await endBid(vsEnd.listing.id, ownerToken, {
        action: 'sold',
        winning_bid_id: selected.data.bid.id,
      });
      assert.equal(afterExtendEnd.status, 200, JSON.stringify(afterExtendEnd.data));
    }
    assert.notEqual((await auctionFor(vsEnd.listing.id)).auction_status, AUCTION_STATUS.LIVE);
    assert.equal((await bidsFor(vsEnd.auction.id)).length, 1);

    const vsExpire = await createLiveBid();
    const expireLow = await placeBid(vsExpire.listing.id, bidderToken, '305');
    const expireHigh = await placeBid(vsExpire.listing.id, secondBidderToken, '310');
    assert.equal(expireLow.status, 201);
    assert.equal(expireHigh.status, 201);
    await expireAuctionClock(vsExpire.auction.id);
    const [expireGet, expireExtend] = await Promise.all([
      api('GET', `/listings/${vsExpire.listing.id}`, { token: ownerToken }),
      extendBid(vsExpire.listing.id, ownerToken, { duration_hours: 24 }),
    ]);
    assert.equal(expireGet.status, 200);
    assert.equal(expireExtend.status, 409);
    const expiredAuction = await auctionFor(vsExpire.listing.id);
    assert.equal(expiredAuction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(expiredAuction.winning_bid_id, expireHigh.data.bid.id);
    assert.notEqual(expiredAuction.winning_bid_id, expireLow.data.bid.id);
    assert.equal(expiredAuction.extension_used, false);
    assert.equal((await listingRow(vsExpire.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('changing listing id or using an old revision cannot extend another auction', async () => {
    const first = await createLiveBid({ description: 'Owner A live' });
    const second = await createLiveBid({ description: 'Owner A other live' });
    const crossed = await extendBid(first.listing.id, ownerToken, {
      duration_hours: 24,
      auction_id: second.auction.id,
      listing_id: second.listing.id,
      seller_id: extraBidder.id,
    });
    assert.equal(crossed.status, 200, JSON.stringify(crossed.data));
    assert.equal((await auctionFor(first.listing.id)).extension_used, true);
    assert.equal((await auctionFor(second.listing.id)).extension_used, false);
    assert.equal((await auctionFor(second.listing.id)).auction_status, AUCTION_STATUS.LIVE);

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
          description: 'Resubmitted extend-bid child',
        }),
      })
    );
    assert.ok([200, 201].includes(resubmitted.status), JSON.stringify(resubmitted.data));
    const oldRevision = await extendBid(pending.listing.id, ownerToken, {
      duration_hours: 24,
      auction_id: first.auction.id,
    });
    assert.ok([404, 409].includes(oldRevision.status), JSON.stringify(oldRevision.data));
    assert.equal((await auctionFor(first.listing.id)).auction_status, AUCTION_STATUS.LIVE);
    assert.equal((await auctionFor(first.listing.id)).extension_used, true);
  });

  it('existing bid placement, End Bid, GET bids, and expiration still work after extension', async () => {
    const { listing, auction } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    assert.equal(first.status, 201);
    const extended = await extendBid(listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(extended.status, 200);

    const second = await placeBid(listing.id, secondBidderToken, '310');
    assert.equal(second.status, 201, JSON.stringify(second.data));
    assert.equal(second.data.auction_status, AUCTION_STATUS.LIVE);

    const listed = await api('GET', `/listings/${listing.id}/bids`, { token: ownerToken });
    assert.equal(listed.status, 200, JSON.stringify(listed.data));
    assert.equal(listed.data.auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(listed.data.bids.length, 2);
    assert.equal(listed.data.auction.current_highest_bid, '310.00');

    await pool.query(
      `UPDATE listing_auctions
       SET original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [auction.id]
    );
    const stillLive = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(stillLive.status, 200);
    assert.equal(stillLive.data.listing.status, LISTING_STATUS.APPROVED);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.LIVE);
    assert.equal(await marketplaceHas(listing.id, 300), true);

    const sold = await endBid(listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: first.data.bid.id,
    });
    assert.equal(sold.status, 200, JSON.stringify(sold.data));
    assert.equal(sold.data.auction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(sold.data.auction.winning_bid_id, first.data.bid.id);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await bidsFor(auction.id)).length, 2);

    const revive = await extendBid(listing.id, ownerToken, { duration_hours: 24 });
    assert.equal(revive.status, 409);
    assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(revive.data.code));
  });
});
