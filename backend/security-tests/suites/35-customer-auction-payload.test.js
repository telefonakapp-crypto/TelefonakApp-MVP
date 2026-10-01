'use strict';

/**
 * Phase 0 — customer auction payload + My Bids / Received Bids APIs.
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
    'auction-payload.jpg'
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
            starts_at, original_ends_at, ends_at, winning_bid_id,
            extension_used, completion_source
     FROM listing_auctions
     WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

function assertNoBidderIdentity(payload) {
  const raw = JSON.stringify(payload);
  assert.equal(raw.includes('"bids":['), false, 'must not nest other bidders');
  assert.doesNotMatch(raw, /bidder_phone|phone_number_of_bidder/i);
}

function assertPublicAuction(auction, { startingPrice, highest, bidCount, status }) {
  assert.ok(auction);
  assert.equal(auction.auction_status, status);
  assert.equal(auction.starting_price, startingPrice);
  assert.equal(auction.current_highest_bid, highest);
  assert.equal(auction.bid_count, bidCount);
  assert.ok(auction.ends_at);
  assert.equal(auction.has_my_bids, undefined);
  assert.equal(auction.my_bid_count, undefined);
  assert.equal(auction.my_highest_bid, undefined);
  assert.equal(auction.can_list_again, undefined);
}

describe('35 — Customer auction payload and bid lists', () => {
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
      description: 'Phase 0 customer auction payload listing',
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
         VALUES ($1, 'Auction', 'Payload', 'male', TRUE)
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

  it('Normal listing GET responses expose auction: null', async () => {
    const listing = await createApprovedNormal();
    const detail = await api('GET', `/listings/${listing.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.listing.auction, null);

    const mine = await api('GET', '/listings/user/my', { token: ownerToken });
    assert.equal(mine.status, 200);
    const mineRow = mine.data.listings.find((row) => row.id === listing.id);
    assert.ok(mineRow);
    assert.equal(mineRow.auction, null);

    const market = await api('GET', '/listings');
    assert.equal(market.status, 200);
    const card = market.data.listings.find((row) => row.id === listing.id);
    assert.ok(card);
    assert.equal(card.auction, null);
    assert.equal(card.sale_type, LISTING_SALE_TYPE.NORMAL);
  });

  it('Bid listing create returns auction summary and stable Bid error codes', async () => {
    const created = await createLiveBid();
    assert.equal(created.listing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(created.listing.auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(created.listing.auction.starting_price, '300.00');
    assert.equal(created.listing.auction.current_highest_bid, null);
    assert.equal(created.listing.auction.minimum_next_bid, '305.00');
    assert.equal(created.listing.auction.maximum_bid, '600.00');
    assert.equal(created.listing.auction.bid_count, 0);
    assert.equal(created.listing.auction.can_list_again, false);

    const invalidType = await api('POST', '/listings', {
      token: ownerToken,
      body: payload({ sale_type: 'auction' }),
    });
    assert.equal(invalidType.status, 400);
    assert.ok(
      invalidType.data.code === 'INVALID_SALE_TYPE' ||
        (invalidType.data.errors && invalidType.data.errors.length > 0)
    );

    const invalidDuration = await api('POST', '/listings', {
      token: ownerToken,
      body: payload({ sale_type: 'bid', duration_hours: 25 }),
    });
    assert.equal(invalidDuration.status, 400);
    assert.equal(invalidDuration.data.code, 'INVALID_AUCTION_DURATION');
  });

  it('Bid listing detail exposes public auction and role-specific fields', async () => {
    const { listing } = await createLiveBid({ price: 300 });
    const first = await api('POST', `/listings/${listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    const second = await api('POST', `/listings/${listing.id}/bids`, {
      token: secondBidderToken,
      body: { amount: 310 },
    });
    assert.equal(second.status, 201, JSON.stringify(second.data));
    await api('POST', `/listings/${listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 315 },
    });

    const guest = await api('GET', `/listings/${listing.id}`);
    assert.equal(guest.status, 200);
    assertPublicAuction(guest.data.listing.auction, {
      startingPrice: '300.00',
      highest: '315.00',
      bidCount: 3,
      status: AUCTION_STATUS.LIVE,
    });
    assert.equal(guest.data.listing.auction.minimum_next_bid, '320.00');
    assert.equal(guest.data.listing.auction.maximum_bid, '600.00');
    assertNoBidderIdentity(guest.data.listing.auction);

    const buyer = await api('GET', `/listings/${listing.id}`, { token: bidderToken });
    assert.equal(buyer.status, 200);
    assert.equal(buyer.data.listing.auction.has_my_bids, true);
    assert.equal(buyer.data.listing.auction.my_bid_count, 2);
    assert.equal(buyer.data.listing.auction.my_highest_bid, '315.00');
    assert.equal(buyer.data.listing.auction.can_list_again, undefined);
    assert.equal(buyer.data.listing.auction.current_highest_bid, '315.00');

    const otherBuyer = await api('GET', `/listings/${listing.id}`, {
      token: secondBidderToken,
    });
    assert.equal(otherBuyer.data.listing.auction.my_bid_count, 1);
    assert.equal(otherBuyer.data.listing.auction.my_highest_bid, '310.00');

    const owner = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(owner.status, 200);
    assert.equal(owner.data.listing.auction.can_list_again, false);
    assert.equal(owner.data.listing.auction.has_my_bids, undefined);
    assert.equal(owner.data.listing.auction.bid_count, 3);

    const market = await api('GET', '/listings');
    const card = market.data.listings.find((row) => row.id === listing.id);
    assert.ok(card);
    assertPublicAuction(card.auction, {
      startingPrice: '300.00',
      highest: '315.00',
      bidCount: 3,
      status: AUCTION_STATUS.LIVE,
    });
  });

  it('buyer bid history is own-bids only; seller cannot use that endpoint', async () => {
    const { listing } = await createLiveBid();
    await api('POST', `/listings/${listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    await api('POST', `/listings/${listing.id}/bids`, {
      token: secondBidderToken,
      body: { amount: 310 },
    });

    const mine = await api('GET', `/listings/${listing.id}/my-bids`, { token: bidderToken });
    assert.equal(mine.status, 200, JSON.stringify(mine.data));
    assert.equal(mine.data.listing_id, listing.id);
    assert.equal(mine.data.bids.length, 1);
    assert.equal(mine.data.bids[0].amount, '305.00');
    assert.equal(mine.data.bids[0].is_highest, false);

    const other = await api('GET', `/listings/${listing.id}/my-bids`, {
      token: secondBidderToken,
    });
    assert.equal(other.data.bids.length, 1);
    assert.equal(other.data.bids[0].amount, '310.00');
    assert.equal(other.data.bids[0].is_highest, true);

    const seller = await api('GET', `/listings/${listing.id}/my-bids`, { token: ownerToken });
    assert.equal(seller.status, 403);
    assert.equal(seller.data.code, 'SELLER_CANNOT_USE_MY_BIDS');

    const strangerNoBid = fx.users.find(
      (user) =>
        user.id !== fx.owner.id &&
        user.id !== fx.stranger.id &&
        user.id !== extraBidder.id
    );
    if (strangerNoBid) {
      const token = customerToken(strangerNoBid.id, strangerNoBid.phone_number);
      const res = await api('GET', `/listings/${listing.id}/my-bids`, { token });
      assert.equal(res.status, 404);
    }

    const sellerList = await api('GET', `/listings/${listing.id}/bids`, { token: ownerToken });
    assert.equal(sellerList.status, 200);
    assert.ok(sellerList.data.bids.length >= 2);
  });

  it('can_list_again is true only after automatic expiration', async () => {
    const expired = await createLiveBid({ price: 300 });
    await api('POST', `/listings/${expired.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    await expireAuctionClock(expired.auction.id);
    const expiredDetail = await api('GET', `/listings/${expired.listing.id}`, {
      token: ownerToken,
    });
    assert.equal(expiredDetail.status, 200);
    assert.equal(expiredDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(expiredDetail.data.listing.auction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(expiredDetail.data.listing.auction.completion_source, 'expired');
    assert.equal(expiredDetail.data.listing.auction.can_list_again, true);

    const buyerExpired = await api('GET', `/listings/${expired.listing.id}`, {
      token: bidderToken,
    });
    assert.equal(buyerExpired.status, 404);

    const myBids = await api('GET', '/bids/my', { token: bidderToken });
    const history = myBids.data.listings.find((row) => row.id === expired.listing.id);
    assert.ok(history);
    assert.equal(history.auction.completion_source, 'expired');
    assert.equal(history.auction.can_list_again, undefined);
    assert.equal(history.auction.is_winner, true);

    const sold = await createLiveBid({ price: 300 });
    const soldBid = await api('POST', `/listings/${sold.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    const soldEnd = await api('POST', `/listings/${sold.listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'sold', winning_bid_id: soldBid.data.bid.id },
    });
    assert.equal(soldEnd.status, 200, JSON.stringify(soldEnd.data));
    const soldDetail = await api('GET', `/listings/${sold.listing.id}`, { token: ownerToken });
    assert.equal(soldDetail.data.listing.auction.completion_source, 'sold');
    assert.equal(soldDetail.data.listing.auction.can_list_again, false);

    const cancelled = await createLiveBid({ price: 300 });
    await api('POST', `/listings/${cancelled.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    const cancelEnd = await api('POST', `/listings/${cancelled.listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'cancel' },
    });
    assert.equal(cancelEnd.status, 200, JSON.stringify(cancelEnd.data));
    const cancelDetail = await api('GET', `/listings/${cancelled.listing.id}`, {
      token: ownerToken,
    });
    assert.equal(cancelDetail.data.listing.auction.auction_status, AUCTION_STATUS.CANCELLED);
    assert.equal(cancelDetail.data.listing.auction.completion_source, 'cancelled');
    assert.equal(cancelDetail.data.listing.auction.can_list_again, false);
  });

  it('My Bids lists only the authenticated user and includes history', async () => {
    const live = await createLiveBid({ price: 300 });
    await api('POST', `/listings/${live.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    const historical = await createLiveBid({ price: 300 });
    await api('POST', `/listings/${historical.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    await expireAuctionClock(historical.auction.id);
    await api('GET', `/listings/${historical.listing.id}`, { token: bidderToken });

    const otherLive = await createLiveBid({ price: 300 });
    await api('POST', `/listings/${otherLive.listing.id}/bids`, {
      token: secondBidderToken,
      body: { amount: 305 },
    });

    const mine = await api('GET', '/bids/my?limit=50&offset=0', { token: bidderToken });
    assert.equal(mine.status, 200, JSON.stringify(mine.data));
    assert.equal(mine.data.limit, 50);
    assert.equal(mine.data.offset, 0);
    assert.equal(typeof mine.data.has_more, 'boolean');
    const ids = mine.data.listings.map((row) => row.id);
    assert.ok(ids.includes(live.listing.id));
    assert.ok(ids.includes(historical.listing.id));
    assert.equal(ids.includes(otherLive.listing.id), false);
    const liveRow = mine.data.listings.find((row) => row.id === live.listing.id);
    assert.equal(liveRow.auction.has_my_bids, true);
    assert.equal(liveRow.auction.my_highest_bid, '305.00');
    assert.equal(liveRow.phone_number, undefined);
    assert.equal(liveRow.auction.is_winner, false);

    const page = await api('GET', '/bids/my?limit=1&offset=0', { token: bidderToken });
    assert.equal(page.data.listings.length, 1);
    assert.equal(page.data.has_more, true);

    const ownerMine = await api('GET', '/bids/my', { token: ownerToken });
    assert.equal(ownerMine.status, 200);
    assert.equal(ownerMine.data.listings.some((row) => row.id === live.listing.id), false);
  });

  it('Received Bids lists only owned listings that have bids', async () => {
    const owned = await createLiveBid({ price: 300 });
    await api('POST', `/listings/${owned.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });

    const empty = await createLiveBid({ price: 300 });
    const strangerListing = track(
      await api('POST', '/listings', {
        token: secondBidderToken,
        body: payload({
          sale_type: 'bid',
          duration_hours: 24,
          price: 300,
          images: [await uploadOne(secondBidderToken)],
        }),
      })
    );
    assert.ok([200, 201].includes(strangerListing.status), JSON.stringify(strangerListing.data));
    await api('POST', `/listings/${strangerListing.data.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });

    const received = await api('GET', '/bids/received', { token: ownerToken });
    assert.equal(received.status, 200, JSON.stringify(received.data));
    const ids = received.data.listings.map((row) => row.id);
    assert.ok(ids.includes(owned.listing.id));
    assert.equal(ids.includes(empty.listing.id), false);
    assert.equal(ids.includes(strangerListing.data.listing.id), false);
    const row = received.data.listings.find((item) => item.id === owned.listing.id);
    assert.equal(row.auction.bid_count, 1);
    assert.equal(row.can_end_bid, true);
    assert.equal(row.can_extend, true);
    assert.equal(row.can_manage_auction, true);
    assert.equal(row.auction.can_list_again, false);
    assertNoBidderIdentity(row);

    const otherSeller = await api('GET', '/bids/received', { token: secondBidderToken });
    const otherIds = otherSeller.data.listings.map((item) => item.id);
    assert.ok(otherIds.includes(strangerListing.data.listing.id));
    assert.equal(otherIds.includes(owned.listing.id), false);
  });

  it('auth boundaries: unauthenticated and admin cannot use customer bid list APIs', async () => {
    const { listing } = await createLiveBid();
    await api('POST', `/listings/${listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });

    for (const path of [
      '/bids/my',
      '/bids/received',
      `/listings/${listing.id}/my-bids`,
    ]) {
      const anon = await api('GET', path);
      assert.equal(anon.status, 401, path);
      if (staffToken) {
        const adminRes = await api('GET', path, { token: staffToken });
        assert.equal(adminRes.status, 401, `admin ${path}`);
      }
    }
  });

  it('hidden, declined, sold, and deleted listings follow existing visibility', async () => {
    const hidden = await createLiveBid();
    await api('POST', `/listings/${hidden.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    await pool.query(`UPDATE listings SET status = 'hidden' WHERE id = $1`, [hidden.listing.id]);
    const guestHidden = await api('GET', `/listings/${hidden.listing.id}`);
    assert.equal(guestHidden.status, 404);
    const ownerHidden = await api('GET', `/listings/${hidden.listing.id}`, { token: ownerToken });
    assert.equal(ownerHidden.status, 200);
    const bidderHistory = await api('GET', `/listings/${hidden.listing.id}/my-bids`, {
      token: bidderToken,
    });
    assert.equal(bidderHistory.status, 200);

    const declined = await createLiveBid();
    await pool.query(`UPDATE listings SET status = 'declined' WHERE id = $1`, [declined.listing.id]);
    const guestDeclined = await api('GET', `/listings/${declined.listing.id}`);
    assert.equal(guestDeclined.status, 404);

    const deleted = await createLiveBid();
    await api('POST', `/listings/${deleted.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: 305 },
    });
    await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [deleted.listing.id]);
    const guestDeleted = await api('GET', `/listings/${deleted.listing.id}`);
    assert.equal(guestDeleted.status, 404);
    const myBidsDeleted = await api('GET', '/bids/my', { token: bidderToken });
    assert.equal(
      myBidsDeleted.data.listings.some((row) => row.id === deleted.listing.id),
      false
    );
    const receivedDeleted = await api('GET', '/bids/received', { token: ownerToken });
    assert.equal(
      receivedDeleted.data.listings.some((row) => row.id === deleted.listing.id),
      false
    );
  });

  it('Normal Offers still work and Bid listings still reject Offers', async () => {
    const normal = await createApprovedNormal({ price: 220 });
    const offer = await api('POST', `/offers/${normal.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.ok([200, 201].includes(offer.status), JSON.stringify(offer.data));

    const bid = await createLiveBid({ price: 300 });
    const bidOffer = await api('POST', `/offers/${bid.listing.id}`, {
      token: bidderToken,
      body: { offered_price: 200 },
    });
    assert.equal(bidOffer.status, 409);
    assert.equal(bidOffer.data.code, 'BID_LISTING_NO_OFFERS');
  });

  it('PUT live Bid remains frozen', async () => {
    const { listing } = await createLiveBid({ price: 300 });
    const frozen = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: payload({ sale_type: 'bid', duration_hours: 48, price: 400 }),
    });
    assert.equal(frozen.status, 409);
    assert.equal(frozen.data.code, 'LIVE_AUCTION_FROZEN');
  });
});
