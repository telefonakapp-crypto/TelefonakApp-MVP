'use strict';

/**
 * Phase 2F-1 — seller End Bid (sold to selected bidder or cancel).
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
    'bidding-end.jpg'
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

describe('30 — Bidding seller End Bid', () => {
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
      description: 'Phase 2F-1 end bid listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  function editBody(overrides = {}) {
    const body = payload(overrides);
    delete body.images;
    return body;
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

  it('rejects unauthenticated, admin, and non-owner End Bid', async () => {
    const { listing } = await createLiveBid();
    const anon = await endBid(listing.id, undefined, { action: 'cancel' });
    assert.equal(anon.status, 401);

    if (staffToken) {
      const adminRes = await endBid(listing.id, staffToken, { action: 'cancel' });
      assert.equal(adminRes.status, 401);
    }

    const stranger = await endBid(listing.id, bidderToken, { action: 'cancel' });
    assert.equal(stranger.status, 403);
    assert.equal(stranger.data.code, 'END_BID_NOT_OWNER');
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.LIVE);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
  });

  it('owner can sold or cancel a live Bid listing', async () => {
    const soldTarget = await createLiveBid();
    const first = await placeBid(soldTarget.listing.id, bidderToken, '305');
    assert.equal(first.status, 201, JSON.stringify(first.data));
    const sold = await endBid(soldTarget.listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: first.data.bid.id,
      seller_id: extraBidder.id,
      user_id: extraBidder.id,
      auction_id: 999999,
    });
    assert.equal(sold.status, 200, JSON.stringify(sold.data));
    assert.equal(sold.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(sold.data.auction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(sold.data.auction.winning_bid_id, first.data.bid.id);

    const cancelTarget = await createLiveBid();
    const cancel = await endBid(cancelTarget.listing.id, ownerToken, { action: 'cancel' });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    assert.equal(cancel.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(cancel.data.auction.auction_status, AUCTION_STATUS.CANCELLED);
    assert.equal(cancel.data.auction.winning_bid_id, null);
  });

  it('normal listings and missing auctions are rejected', async () => {
    const normal = await createApprovedNormal({ price: 223 });
    const normalRes = await endBid(normal.id, ownerToken, { action: 'cancel' });
    assert.equal(normalRes.status, 409);
    assert.equal(normalRes.data.code, 'END_BID_NOT_AUCTION');

    const pending = await createPendingBid();
    await pool.query('DELETE FROM listing_auctions WHERE listing_id = $1', [pending.listing.id]);
    const missing = await endBid(pending.listing.id, ownerToken, { action: 'cancel' });
    assert.equal(missing.status, 404);
    assert.equal(missing.data.code, 'AUCTION_NOT_FOUND');
  });

  it('rejects pending_start, completed, cancelled, ended, and expired auctions', async () => {
    const pending = await createPendingBid();
    const pendingRes = await endBid(pending.listing.id, ownerToken, { action: 'cancel' });
    assert.equal(pendingRes.status, 409);
    assert.equal(pendingRes.data.code, 'AUCTION_NOT_LIVE');

    for (const status of [
      AUCTION_STATUS.COMPLETED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.ENDED,
    ]) {
      const live = await createLiveBid({ description: `State ${status}` });
      await setAuctionStatus(live.listing.id, status);
      const res = await endBid(live.listing.id, ownerToken, { action: 'cancel' });
      assert.equal(res.status, 409, `${status} ${JSON.stringify(res.data)}`);
      assert.ok(
        ['AUCTION_ENDED', 'AUCTION_NOT_LIVE'].includes(res.data.code),
        `${status} ${res.data.code}`
      );
      assert.equal((await auctionFor(live.listing.id)).auction_status, status);
    }

    const due = await createLiveBid({ description: 'Already expired' });
    const placed = await placeBid(due.listing.id, bidderToken, '305');
    assert.equal(placed.status, 201);
    await expireAuctionClock(due.auction.id);
    await api('GET', `/listings/${due.listing.id}`, { token: ownerToken });
    const expired = await endBid(due.listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: placed.data.bid.id,
    });
    assert.equal(expired.status, 409);
    assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(expired.data.code));
    assert.equal((await auctionFor(due.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal((await listingRow(due.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('sold requires a bid from this auction and may select a lower bid', async () => {
    const { listing, auction } = await createLiveBid();
    const missingField = await endBid(listing.id, ownerToken, { action: 'sold' });
    assert.equal(missingField.status, 400);
    assert.equal(missingField.data.code, 'WINNING_BID_REQUIRED');

    const missingBid = await endBid(listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: 99999999,
    });
    assert.equal(missingBid.status, 404);
    assert.equal(missingBid.data.code, 'WINNING_BID_NOT_FOUND');

    const other = await createLiveBid({ description: 'Other auction bids' });
    const otherBid = await placeBid(other.listing.id, bidderToken, '305');
    assert.equal(otherBid.status, 201);

    const lower = await placeBid(listing.id, bidderToken, '305');
    const higher = await placeBid(listing.id, secondBidderToken, '310');
    assert.equal(lower.status, 201, JSON.stringify(lower.data));
    assert.equal(higher.status, 201, JSON.stringify(higher.data));

    const wrongAuction = await endBid(listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: otherBid.data.bid.id,
    });
    assert.equal(wrongAuction.status, 409);
    assert.equal(wrongAuction.data.code, 'WINNING_BID_WRONG_AUCTION');

    const sold = await endBid(listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: lower.data.bid.id,
    });
    assert.equal(sold.status, 200, JSON.stringify(sold.data));
    assert.equal(sold.data.auction.winning_bid_id, lower.data.bid.id);
    assert.notEqual(sold.data.auction.winning_bid_id, higher.data.bid.id);
    assert.equal(sold.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);

    const afterBids = await bidsFor(auction.id);
    assert.equal(afterBids.length, 2);
    assert.equal(Number(afterBids[0].amount), 305);
    assert.equal(Number(afterBids[1].amount), 310);
    const winner = await pool.query('SELECT id, auction_id, amount FROM bids WHERE id = $1', [
      sold.data.auction.winning_bid_id,
    ]);
    assert.equal(winner.rows[0].id, lower.data.bid.id);
    assert.equal(winner.rows[0].auction_id, auction.id);
    assert.equal(Number(winner.rows[0].amount), 305);
    assert.equal(Number((await listingRow(listing.id)).price), 300);
    assert.equal((await bidsFor((await auctionFor(other.listing.id)).id)).length, 1);
  });

  it('cancel preserves bids, leaves winner NULL, and rejects a supplied winner', async () => {
    const { listing, auction } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    const second = await placeBid(listing.id, secondBidderToken, '310');
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    const withWinner = await endBid(listing.id, ownerToken, {
      action: 'cancel',
      winning_bid_id: second.data.bid.id,
    });
    assert.equal(withWinner.status, 400);
    assert.equal(withWinner.data.code, 'WINNING_BID_INVALID');
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.LIVE);

    const cancel = await endBid(listing.id, ownerToken, { action: 'cancel' });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    assert.equal(cancel.data.auction.auction_status, AUCTION_STATUS.CANCELLED);
    assert.equal(cancel.data.auction.winning_bid_id, null);
    assert.equal(cancel.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    const afterBids = await bidsFor(auction.id);
    assert.equal(afterBids.length, 2);
    assert.equal(Number(afterBids[0].amount), 305);
    assert.equal(Number(afterBids[1].amount), 310);
    assert.equal(await marketplaceHas(listing.id, 300), false);
  });

  it('manually ended listings leave the marketplace, stay in history, and stay locked', async () => {
    const { listing } = await createLiveBid();
    const bid = await placeBid(listing.id, bidderToken, '305');
    const sold = await endBid(listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: bid.data.bid.id,
    });
    assert.equal(sold.status, 200);
    assert.equal(await marketplaceHas(listing.id, 300), false);
    const guest = await api('GET', `/listings/${listing.id}`);
    assert.equal(guest.status, 404);
    const ownerDetail = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(ownerDetail.status, 200);
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    const mine = await api('GET', '/listings/user/my', { token: ownerToken });
    const mineRow = (mine.data.listings || []).find((row) => row.id === listing.id);
    assert.ok(mineRow);
    assert.equal(mineRow.status, LISTING_STATUS.BID_DURATION_ENDED);

    const edit = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ price: 301, description: 'should not edit ended bid' }),
    });
    assert.ok([400, 409].includes(edit.status), JSON.stringify(edit.data));
    const hide = await api('PATCH', `/listings/${listing.id}/hide`, { token: ownerToken });
    assert.equal(hide.status, 409);
    const unhide = await api('PATCH', `/listings/${listing.id}/unhide`, { token: ownerToken });
    assert.equal(unhide.status, 409);
    const markedSold = await api('PUT', `/listings/${listing.id}/mark-sold`, {
      token: ownerToken,
    });
    assert.equal(markedSold.status, 409);
    const del = await api('DELETE', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(del.status, 409);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('serializes concurrent End Bid, late bids, and expiration', async () => {
    const twoEnds = await createLiveBid();
    const bidA = await placeBid(twoEnds.listing.id, bidderToken, '305');
    const bidB = await placeBid(twoEnds.listing.id, secondBidderToken, '310');
    const [first, second] = await Promise.all([
      endBid(twoEnds.listing.id, ownerToken, {
        action: 'sold',
        winning_bid_id: bidA.data.bid.id,
      }),
      endBid(twoEnds.listing.id, ownerToken, {
        action: 'sold',
        winning_bid_id: bidB.data.bid.id,
      }),
    ]);
    const results = [first, second];
    assert.equal(results.filter((res) => res.status === 200).length, 1, JSON.stringify(results.map((res) => res.data)));
    assert.equal(results.filter((res) => res.status === 409).length, 1);
    const afterTwo = await auctionFor(twoEnds.listing.id);
    assert.equal(afterTwo.auction_status, AUCTION_STATUS.COMPLETED);
    assert.ok([bidA.data.bid.id, bidB.data.bid.id].includes(afterTwo.winning_bid_id));
    assert.equal((await listingRow(twoEnds.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);

    const vsBid = await createLiveBid();
    const selected = await placeBid(vsBid.listing.id, bidderToken, '305');
    const [endRes, lateBid] = await Promise.all([
      endBid(vsBid.listing.id, ownerToken, {
        action: 'sold',
        winning_bid_id: selected.data.bid.id,
      }),
      placeBid(vsBid.listing.id, secondBidderToken, '310'),
    ]);
    assert.equal(endRes.status, 200, JSON.stringify(endRes.data));
    assert.equal(lateBid.status, 409);
    assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(lateBid.data.code));
    assert.equal((await auctionFor(vsBid.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal((await bidsFor(vsBid.auction.id)).length, 1);

    const vsExpire = await createLiveBid();
    const expireBid = await placeBid(vsExpire.listing.id, bidderToken, '305');
    const lower = expireBid.data.bid.id;
    await placeBid(vsExpire.listing.id, secondBidderToken, '310');
    await expireAuctionClock(vsExpire.auction.id);
    const [expireGet, expireEnd] = await Promise.all([
      api('GET', `/listings/${vsExpire.listing.id}`, { token: ownerToken }),
      endBid(vsExpire.listing.id, ownerToken, {
        action: 'sold',
        winning_bid_id: lower,
      }),
    ]);
    assert.equal(expireGet.status, 200);
    assert.equal(expireEnd.status, 409);
    const expiredAuction = await auctionFor(vsExpire.listing.id);
    assert.equal(expiredAuction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.notEqual(expiredAuction.winning_bid_id, lower);
    assert.equal((await listingRow(vsExpire.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('changing listing id or using an old revision cannot end another auction', async () => {
    const first = await createLiveBid({ description: 'Owner A live' });
    const second = await createLiveBid({ description: 'Owner A other live' });
    const firstBid = await placeBid(first.listing.id, bidderToken, '305');
    const secondBid = await placeBid(second.listing.id, bidderToken, '305');
    const crossed = await endBid(first.listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: secondBid.data.bid.id,
      auction_id: second.auction.id,
      listing_id: second.listing.id,
    });
    assert.equal(crossed.status, 409);
    assert.equal(crossed.data.code, 'WINNING_BID_WRONG_AUCTION');
    assert.equal((await auctionFor(first.listing.id)).auction_status, AUCTION_STATUS.LIVE);
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
          description: 'Resubmitted end-bid child',
        }),
      })
    );
    assert.ok([200, 201].includes(resubmitted.status), JSON.stringify(resubmitted.data));
    const oldRevision = await endBid(pending.listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: firstBid.data.bid.id,
    });
    assert.ok([404, 409].includes(oldRevision.status), JSON.stringify(oldRevision.data));
    assert.equal((await auctionFor(first.listing.id)).auction_status, AUCTION_STATUS.LIVE);
    assert.equal((await bidsFor(first.auction.id)).length, 1);
  });

  it('Offers stay allowed on normal listings and forbidden on Bid listings', async () => {
    const { listing } = await createLiveBid();
    const bidOffer = await api('POST', `/offers/${listing.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.equal(bidOffer.status, 409);
    assert.equal(bidOffer.data.code, 'BID_LISTING_NO_OFFERS');

    const normal = await createApprovedNormal({ price: 224 });
    const offer = await api('POST', `/offers/${normal.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.ok([200, 201].includes(offer.status), JSON.stringify(offer.data));

    const stillLive = await createLiveBid();
    const placed = await placeBid(stillLive.listing.id, bidderToken, '305');
    assert.equal(placed.status, 201);
    assert.equal(placed.data.auction_status, AUCTION_STATUS.LIVE);
  });
});
