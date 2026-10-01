'use strict';

/**
 * Phase 2F-2 — seller live-auction bidder list (read-only).
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
const { AUCTION_STATUS } = require('../../utils/listingAuctions');

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'bidding-bidders.jpg'
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

async function userPublic(userId) {
  const result = await pool.query(
    `SELECT id, first_name, last_name, phone_number FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0];
}

function displayName(user) {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim();
}

function assertNoSensitiveFields(payload) {
  const raw = JSON.stringify(payload);
  for (const field of [
    'email',
    'date_of_birth',
    'gender',
    'city',
    'password',
    'token',
    'otp',
    'pending_phone_number',
  ]) {
    assert.equal(raw.includes(`"${field}"`), false, `must not expose ${field}`);
  }
}

describe('31 — Bidding seller bidder list', () => {
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
      description: 'Phase 2F-2 bidder list listing',
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

  async function listBids(listingId, token, query = '') {
    return api('GET', `/listings/${listingId}/bids${query}`, { token });
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
         RETURNING id, phone_number, first_name, last_name`,
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

  it('rejects unauthenticated, invalid, admin, and non-owner access', async () => {
    const { listing } = await createLiveBid();
    await placeBid(listing.id, bidderToken, '305');

    const anon = await listBids(listing.id);
    assert.equal(anon.status, 401);

    const invalid = await listBids(listing.id, 'not-a-valid-token');
    assert.equal(invalid.status, 401);

    if (staffToken) {
      const adminRes = await listBids(listing.id, staffToken);
      assert.equal(adminRes.status, 401);
    }

    const stranger = await listBids(listing.id, bidderToken);
    assert.equal(stranger.status, 403);
    assert.equal(stranger.data.code, 'END_BID_NOT_OWNER');
    assert.equal(stranger.data.bids, undefined);

    const spoofed = await listBids(listing.id, bidderToken, `?user_id=${fx.owner.id}&seller_id=${fx.owner.id}`);
    assert.equal(spoofed.status, 403);
  });

  it('owner can read live Bid bids with name, phone, amount, id, and time', async () => {
    const { listing, auction } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    const second = await placeBid(listing.id, bidderToken, '310');
    const other = await placeBid(listing.id, secondBidderToken, '315');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(other.status, 201);

    const res = await listBids(listing.id, ownerToken, `?user_id=${extraBidder.id}`);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(res.data.listing_id, listing.id);
    assert.equal(res.data.auction.id, auction.id);
    assert.equal(res.data.auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(res.data.auction.starting_price, '300.00');
    assert.equal(res.data.auction.current_highest_bid, '315.00');
    assert.ok(res.data.auction.ends_at);
    assert.equal(res.data.bids.length, 3);

    assert.equal(res.data.bids[0].id, other.data.bid.id);
    assert.equal(res.data.bids[0].amount, '315.00');
    assert.equal(res.data.bids[1].id, second.data.bid.id);
    assert.equal(res.data.bids[2].id, first.data.bid.id);
    assert.notEqual(res.data.bids[1].id, res.data.bids[2].id);

    const bidder = await userPublic(fx.stranger.id);
    const secondUser = await userPublic(extraBidder.id);
    assert.equal(res.data.bids[1].bidder.id, fx.stranger.id);
    assert.equal(res.data.bids[1].bidder.name, displayName(bidder));
    assert.equal(res.data.bids[1].bidder.phone_number, bidder.phone_number);
    assert.equal(res.data.bids[2].bidder.phone_number, bidder.phone_number);
    assert.equal(res.data.bids[0].bidder.phone_number, secondUser.phone_number);
    assert.ok(res.data.bids[0].created_at);
    assertNoSensitiveFields(res.data);

    const end = await api('POST', `/listings/${listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'sold', winning_bid_id: first.data.bid.id },
    });
    assert.equal(end.status, 200, JSON.stringify(end.data));
    assert.equal(end.data.auction.winning_bid_id, first.data.bid.id);
  });

  it('rejects normal listings, missing auctions, pending auctions, and deleted listings', async () => {
    const normal = await createApprovedNormal();
    const normalRes = await listBids(normal.id, ownerToken);
    assert.equal(normalRes.status, 409);
    assert.equal(normalRes.data.code, 'END_BID_NOT_AUCTION');

    const pending = await createPendingBid();
    const pendingRes = await listBids(pending.listing.id, ownerToken);
    assert.equal(pendingRes.status, 409);
    assert.equal(pendingRes.data.code, 'AUCTION_NOT_LIVE');

    await pool.query('DELETE FROM listing_auctions WHERE listing_id = $1', [pending.listing.id]);
    const missing = await listBids(pending.listing.id, ownerToken);
    assert.equal(missing.status, 404);
    assert.equal(missing.data.code, 'AUCTION_NOT_FOUND');

    const deleted = await createLiveBid({ description: 'Deleted bidder list' });
    await placeBid(deleted.listing.id, bidderToken, '305');
    await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [deleted.listing.id]);
    const deletedRes = await listBids(deleted.listing.id, ownerToken);
    assert.equal(deletedRes.status, 409);
    assert.equal(deletedRes.data.code, 'LISTING_NOT_BIDDABLE');
    assert.equal(deletedRes.data.bids, undefined);
    const deletedRaw = JSON.stringify(deletedRes.data);
    assert.equal(deletedRaw.includes('phone_number'), false);
  });

  it('owner can read completed, cancelled, ended, and expired bidder lists', async () => {
    for (const status of [
      AUCTION_STATUS.COMPLETED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.ENDED,
    ]) {
      const live = await createLiveBid({ description: `State ${status}` });
      const first = await placeBid(live.listing.id, bidderToken, '305');
      const second = await placeBid(live.listing.id, bidderToken, '310');
      const other = await placeBid(live.listing.id, secondBidderToken, '315');
      assert.equal(first.status, 201);
      assert.equal(second.status, 201);
      assert.equal(other.status, 201);
      await setAuctionStatus(live.listing.id, status);

      const bidderUser = await userPublic(fx.stranger.id);
      const otherUser = await userPublic(extraBidder.id);
      const publicWhileVisible = await api('GET', `/listings/${live.listing.id}/bid-history`, {
        token: bidderToken,
      });
      assert.equal(publicWhileVisible.status, 200, JSON.stringify(publicWhileVisible.data));
      const visibleRaw = JSON.stringify(publicWhileVisible.data);
      assert.equal(visibleRaw.includes('phone_number'), false);
      assert.equal(visibleRaw.includes('"bidder"'), false);
      assert.equal(visibleRaw.includes(String(bidderUser.phone_number)), false);
      assert.equal(visibleRaw.includes(String(otherUser.phone_number)), false);

      const visibleDetail = await api('GET', `/listings/${live.listing.id}`, { token: bidderToken });
      const visibleDetailRaw = JSON.stringify(visibleDetail.data || {});
      assert.equal(visibleDetailRaw.includes('"bidder"'), false);
      assert.equal(visibleDetailRaw.includes(String(bidderUser.phone_number)), false);
      assert.equal(visibleDetailRaw.includes(String(otherUser.phone_number)), false);

      await pool.query(`UPDATE listings SET status = 'bid_duration_ended' WHERE id = $1`, [
        live.listing.id,
      ]);

      const anon = await listBids(live.listing.id);
      assert.equal(anon.status, 401);

      const stranger = await listBids(live.listing.id, bidderToken);
      assert.equal(stranger.status, 403);
      assert.equal(stranger.data.code, 'END_BID_NOT_OWNER');
      assert.equal(stranger.data.bids, undefined);

      const res = await listBids(live.listing.id, ownerToken);
      assert.equal(res.status, 200, `${status} ${JSON.stringify(res.data)}`);
      assert.equal(res.data.auction.auction_status, status);
      assert.equal(res.data.auction.current_highest_bid, '315.00');
      assert.equal(res.data.bids.length, 3);
      assert.equal(res.data.bids[0].id, other.data.bid.id);
      assert.equal(res.data.bids[1].id, second.data.bid.id);
      assert.equal(res.data.bids[2].id, first.data.bid.id);
      assert.equal(res.data.bids[1].bidder.id, res.data.bids[2].bidder.id);
      assert.notEqual(res.data.bids[1].id, res.data.bids[2].id);
      assert.ok(res.data.bids[0].bidder.phone_number);
      assert.ok(res.data.bids[0].bidder.name);
      assert.equal(res.data.auction.winning_bid_id, undefined);
      assert.equal((await auctionFor(live.listing.id)).auction_status, status);

      const history = await api('GET', `/listings/${live.listing.id}/bid-history`, {
        token: ownerToken,
      });
      assert.equal(history.status, 200, JSON.stringify(history.data));
      const historyRaw = JSON.stringify(history.data);
      assert.equal(historyRaw.includes('phone_number'), false);
      assert.equal(historyRaw.includes('"bidder"'), false);
      assert.equal(historyRaw.includes(String(res.data.bids[0].bidder.phone_number)), false);

      const buyerHistory = await api('GET', `/listings/${live.listing.id}/bid-history`, {
        token: bidderToken,
      });
      assert.equal(buyerHistory.status, 404);
      assert.equal(JSON.stringify(buyerHistory.data).includes('phone_number'), false);
    }

    const due = await createLiveBid({ description: 'Expired bidder list' });
    const dueBid = await placeBid(due.listing.id, bidderToken, '305');
    assert.equal(dueBid.status, 201);
    await expireAuctionClock(due.auction.id);
    const expired = await listBids(due.listing.id, ownerToken);
    assert.equal(expired.status, 200, JSON.stringify(expired.data));
    assert.equal(expired.data.auction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(expired.data.bids.length, 1);
    assert.equal(expired.data.bids[0].amount, '305.00');
    assert.ok(expired.data.bids[0].bidder.phone_number);
    assert.equal((await auctionFor(due.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
    const expiredListing = await pool.query('SELECT status FROM listings WHERE id = $1', [
      due.listing.id,
    ]);
    assert.equal(expiredListing.rows[0].status, 'bid_duration_ended');
  });

  it('old revisions cannot expose another listing live bidders', async () => {
    const live = await createLiveBid({ description: 'Live tip' });
    await placeBid(live.listing.id, bidderToken, '305');
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
          description: 'Resubmitted bidder-list child',
        }),
      })
    );
    assert.ok([200, 201].includes(resubmitted.status), JSON.stringify(resubmitted.data));
    const oldRevision = await listBids(pending.listing.id, ownerToken);
    assert.ok([404, 409].includes(oldRevision.status), JSON.stringify(oldRevision.data));
    assert.equal(oldRevision.data.bids, undefined);

    const ownerList = await listBids(live.listing.id, ownerToken);
    assert.equal(ownerList.status, 200);
    assert.equal(ownerList.data.bids.length, 1);

    const stillPlaces = await placeBid(live.listing.id, secondBidderToken, '310');
    assert.equal(stillPlaces.status, 201);
  });
});
