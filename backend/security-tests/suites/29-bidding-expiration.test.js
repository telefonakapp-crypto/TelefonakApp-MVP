'use strict';

/**
 * Phase 2E — automatic Bid auction expiration / completion.
 * Hits the local API. Cleans up listings it creates.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  pool,
  customerToken,
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
    'bidding-expire.jpg'
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
    `SELECT id, user_id, status, price, sale_type, description
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

describe('29 — Bidding expiration and completion', () => {
  let fx;
  let ownerToken;
  let bidderToken;
  let secondBidderToken;
  let extraBidder;
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
      description: 'Phase 2E bid expiration listing',
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

  async function placeBid(listingId, token, amount) {
    return api('POST', `/listings/${listingId}/bids`, {
      token,
      body: { amount },
    });
  }

  async function expireAuctionClock(auctionId, { exactlyDue = false } = {}) {
    const offset = exactlyDue
      ? 'CURRENT_TIMESTAMP'
      : `CURRENT_TIMESTAMP - INTERVAL '5 seconds'`;
    await pool.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = ${offset},
         ends_at = ${offset}
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
    ownedImageUrl = await uploadOne(ownerToken);
    originalAutoApprove = await readAutoApprove();
  });

  after(async () => {
    await setAutoApprove(originalAutoApprove);
    await deleteListingsByIds(createdListingIds);
  });

  it('live auction before ends_at remains live', async () => {
    const { listing, auction } = await createLiveBid();
    const detail = await api('GET', `/listings/${listing.id}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.data));
    assert.equal(detail.data.listing.status, LISTING_STATUS.APPROVED);
    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(after.winning_bid_id, null);
    assert.equal(String(after.ends_at), String(auction.ends_at));
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
  });

  it('expired auction becomes completed and listing becomes bid_duration_ended', async () => {
    const { listing, auction } = await createLiveBid({ price: 387.41 });
    assert.equal(await marketplaceHas(listing.id, 387.41), true);
    await expireAuctionClock(auction.id);
    const ownerDetail = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(ownerDetail.status, 200, JSON.stringify(ownerDetail.data));
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(ownerDetail.data.listing.price), 387.41);
    assert.ok(Array.isArray(ownerDetail.data.images));
    assert.ok(ownerDetail.data.images.length >= 1);

    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(after.winning_bid_id, null);
    const row = await listingRow(listing.id);
    assert.equal(row.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(row.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(Number(row.price), 387.41);
  });

  it('expired listing leaves the public marketplace and stays in seller history', async () => {
    const { listing, auction } = await createLiveBid({ price: 388.41 });
    await expireAuctionClock(auction.id);
    const guest = await api('GET', `/listings/${listing.id}`);
    assert.equal(guest.status, 404);
    const bidderDetail = await api('GET', `/listings/${listing.id}`, { token: bidderToken });
    assert.equal(bidderDetail.status, 404);
    assert.equal(await marketplaceHas(listing.id, 388.41), false);

    const ownerDetail = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(ownerDetail.status, 200, JSON.stringify(ownerDetail.data));
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(ownerDetail.data.listing.is_owner, true);

    const mineOnly = await createLiveBid({ price: 389.41 });
    await expireAuctionClock(mineOnly.auction.id);
    const mineBeforeDetail = await api('GET', '/listings/user/my', { token: ownerToken });
    assert.equal(mineBeforeDetail.status, 200);
    const mineOnlyRow = (mineBeforeDetail.data.listings || []).find(
      (row) => row.id === mineOnly.listing.id
    );
    assert.ok(mineOnlyRow, 'My Listings lazy expiration must materialize the completed Bid');
    assert.equal(mineOnlyRow.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await auctionFor(mineOnly.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
  });

  it('no bids leaves winning_bid_id NULL', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAuctionClock(auction.id);
    await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(after.winning_bid_id, null);
    assert.equal((await bidsFor(auction.id)).length, 0);
  });

  it('highest bid becomes winning_bid_id and lower bids stay intact', async () => {
    const { listing, auction } = await createLiveBid();
    const first = await placeBid(listing.id, bidderToken, '305');
    const second = await placeBid(listing.id, secondBidderToken, '310');
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(second.status, 201, JSON.stringify(second.data));
    const beforeBids = await bidsFor(auction.id);
    assert.equal(beforeBids.length, 2);

    await expireAuctionClock(auction.id);
    await api('GET', `/listings/${listing.id}`, { token: ownerToken });

    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(after.winning_bid_id, second.data.bid.id);
    assert.notEqual(after.winning_bid_id, first.data.bid.id);

    const winner = await pool.query(
      `SELECT id, auction_id, amount FROM bids WHERE id = $1`,
      [after.winning_bid_id]
    );
    assert.equal(winner.rows.length, 1);
    assert.equal(winner.rows[0].auction_id, auction.id);
    assert.equal(Number(winner.rows[0].amount), 310);

    const afterBids = await bidsFor(auction.id);
    assert.equal(afterBids.length, 2);
    assert.equal(Number(afterBids[0].amount), 305);
    assert.equal(Number(afterBids[1].amount), 310);
    assert.equal(afterBids[0].id, beforeBids[0].id);
    assert.equal(afterBids[1].id, beforeBids[1].id);
    assert.equal(Number((await listingRow(listing.id)).price), 300);
  });

  it('equal highest bids trigger AUCTION_WINNER_TIE and do not partially complete', async () => {
    const { listing, auction } = await createLiveBid();
    await pool.query(
      `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount)
       VALUES ($1, $2, $3, $4, 120.00), ($1, $2, $5, $4, 120.00)`,
      [listing.id, auction.id, fx.stranger.id, fx.owner.id, extraBidder.id]
    );
    await expireAuctionClock(auction.id);

    const bidRes = await placeBid(listing.id, bidderToken, '125');
    assert.equal(bidRes.status, 409, JSON.stringify(bidRes.data));
    assert.equal(bidRes.data.code, 'AUCTION_WINNER_TIE');

    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(after.winning_bid_id, null);
    const row = await listingRow(listing.id);
    assert.equal(row.status, LISTING_STATUS.APPROVED);
    assert.equal((await bidsFor(auction.id)).length, 2);

    const ownerDetail = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(ownerDetail.status, 200);
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.APPROVED);
  });

  it('expiration is idempotent', async () => {
    const { listing, auction } = await createLiveBid();
    const placed = await placeBid(listing.id, bidderToken, '305');
    assert.equal(placed.status, 201);
    await expireAuctionClock(auction.id);
    const first = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    const second = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(second.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(after.winning_bid_id, placed.data.bid.id);
    assert.equal((await bidsFor(auction.id)).length, 1);
  });

  it('bid placed after expiration is rejected', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAuctionClock(auction.id);
    await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    const res = await placeBid(listing.id, bidderToken, '305');
    assert.equal(res.status, 409);
    assert.ok(['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(res.data.code));
    assert.equal((await bidsFor(auction.id)).length, 0);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
  });

  it('bid placed exactly after PostgreSQL ends_at is rejected', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAuctionClock(auction.id, { exactlyDue: true });
    const res = await placeBid(listing.id, bidderToken, '305');
    assert.equal(res.status, 409, JSON.stringify(res.data));
    assert.equal(res.data.code, 'AUCTION_ENDED');
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await bidsFor(auction.id)).length, 0);
  });

  it('concurrent bid and expiration stay serialized', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAuctionClock(auction.id);
    const [bidRes, getRes] = await Promise.all([
      placeBid(listing.id, bidderToken, '305'),
      api('GET', `/listings/${listing.id}`, { token: ownerToken }),
    ]);
    assert.equal(bidRes.status, 409, JSON.stringify(bidRes.data));
    assert.ok(
      ['AUCTION_ENDED', 'LISTING_NOT_BIDDABLE'].includes(bidRes.data.code),
      JSON.stringify(bidRes.data)
    );
    assert.equal(getRes.status, 200, JSON.stringify(getRes.data));
    assert.equal(getRes.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal((await bidsFor(auction.id)).length, 0);

    const [firstExpire, secondExpire] = await Promise.all([
      api('GET', `/listings/${listing.id}`, { token: ownerToken }),
      api('GET', `/listings/${listing.id}`, { token: ownerToken }),
    ]);
    assert.equal(firstExpire.status, 200);
    assert.equal(secondExpire.status, 200);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('completed Bid cannot use normal active-listing mutation flows', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAuctionClock(auction.id);
    await api('GET', `/listings/${listing.id}`, { token: ownerToken });

    const edit = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ price: 301, description: 'should not edit completed bid' }),
    });
    assert.ok([400, 409].includes(edit.status), JSON.stringify(edit.data));
    assert.notEqual(edit.data.code, 'LIVE_AUCTION_FROZEN');

    const hide = await api('PATCH', `/listings/${listing.id}/hide`, { token: ownerToken });
    assert.equal(hide.status, 409);
    const sold = await api('PUT', `/listings/${listing.id}/mark-sold`, { token: ownerToken });
    assert.equal(sold.status, 409);
    const del = await api('DELETE', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(del.status, 409);

    const row = await listingRow(listing.id);
    assert.equal(row.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(row.price), 300);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
  });

  it('Bid listing cannot receive an Offer and normal listing still can', async () => {
    const { listing } = await createLiveBid();
    const bidOffer = await api('POST', `/offers/${listing.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.equal(bidOffer.status, 409, JSON.stringify(bidOffer.data));
    assert.equal(bidOffer.data.code, 'BID_LISTING_NO_OFFERS');

    const selfOffer = await api('POST', `/offers/${listing.id}`, {
      token: ownerToken,
      body: { offered_price: 200 },
    });
    assert.equal(selfOffer.status, 403);

    const missing = await api('POST', '/offers/99999999', {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.equal(missing.status, 404);

    const normal = await createApprovedNormal({ price: 221 });
    const offer = await api('POST', `/offers/${normal.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.ok([200, 201].includes(offer.status), JSON.stringify(offer.data));
    assert.ok(offer.data.offer);
    assert.equal(Number(offer.data.offer.offered_price), 200);

    const idorAccept = await api('PATCH', `/offers/${offer.data.offer.id}/accept`, {
      token: secondBidderToken,
    });
    assert.ok([403, 404].includes(idorAccept.status), `got ${idorAccept.status}`);
    const idorReject = await api('PATCH', `/offers/${offer.data.offer.id}/reject`, {
      token: secondBidderToken,
    });
    assert.ok([403, 404].includes(idorReject.status), `got ${idorReject.status}`);
    const idorSeen = await api('PATCH', `/offers/${offer.data.offer.id}/seen`, {
      token: bidderToken,
    });
    assert.ok([403, 404].includes(idorSeen.status), `got ${idorSeen.status}`);

    const stillPending = await pool.query('SELECT status FROM offers WHERE id = $1', [
      offer.data.offer.id,
    ]);
    assert.equal(stillPending.rows[0].status, 'pending');
  });

  it('normal listings are unaffected by lazy expiration', async () => {
    const listing = await createApprovedNormal({ price: 222 });
    const guest = await api('GET', `/listings/${listing.id}`);
    assert.equal(guest.status, 200);
    assert.equal(guest.data.listing.status, LISTING_STATUS.APPROVED);
    assert.equal(await auctionFor(listing.id), null);
    assert.equal(await marketplaceHas(listing.id, 222), true);

    const hide = await api('PATCH', `/listings/${listing.id}/hide`, { token: ownerToken });
    assert.ok([200, 201].includes(hide.status), JSON.stringify(hide.data));
    assert.equal(hide.data.listing.status, LISTING_STATUS.HIDDEN);
  });
});
