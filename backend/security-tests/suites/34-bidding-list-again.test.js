'use strict';

/**
 * Phase 2G — List Again for automatically duration-ended Bid listings.
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
    'bidding-list-again.jpg'
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
            extension_used, extension_notice_sent_at, completion_source
     FROM listing_auctions
     WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function listingRow(listingId) {
  const result = await pool.query(
    `SELECT id, user_id, status, price, sale_type, views, listed_from_listing_id,
            previous_listing_id, created_at, updated_at
     FROM listings
     WHERE id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function bidsFor(auctionId) {
  const result = await pool.query(
    `SELECT id, listing_id, auction_id, bidder_id, seller_id, amount
     FROM bids
     WHERE auction_id = $1
     ORDER BY id`,
    [auctionId]
  );
  return result.rows;
}

async function imagesFor(listingId) {
  const result = await pool.query(
    `SELECT id, listing_id, image_url, display_order
     FROM listing_images
     WHERE listing_id = $1
     ORDER BY display_order ASC, id ASC`,
    [listingId]
  );
  return result.rows;
}

describe('34 — Bidding List Again', () => {
  let fx;
  let ownerToken;
  let bidderToken;
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
      description: 'Phase 2G list again listing',
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

  async function listAgain(listingId, token, body = { duration_hours: 48 }) {
    return api('POST', `/listings/${listingId}/list-again`, { token, body });
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

  async function expireAutomatically(listing, auction) {
    await expireAuctionClock(auction.id);
    const ownerDetail = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(ownerDetail.status, 200, JSON.stringify(ownerDetail.data));
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    const after = await auctionFor(listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(after.completion_source, 'expired');
    return after;
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
         VALUES ($1, 'List', 'Again', 'male', TRUE)
         RETURNING id, phone_number`,
        [`077${String(Date.now()).slice(-7)}`]
      );
      extraBidder = inserted.rows[0];
    }
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

  it('rejects unauthenticated, admin JWT, and non-owner List Again', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAutomatically(listing, auction);

    const anon = await listAgain(listing.id, undefined);
    assert.equal(anon.status, 401);

    if (staffToken) {
      const adminRes = await listAgain(listing.id, staffToken, { duration_hours: 48 });
      assert.equal(adminRes.status, 401);
    }

    const stranger = await listAgain(listing.id, bidderToken, { duration_hours: 48 });
    assert.equal(stranger.status, 403);
    assert.equal(stranger.data.code, 'LIST_AGAIN_NOT_OWNER');
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await auctionFor(listing.id)).id, auction.id);
  });

  it('owner can list again an automatically duration-ended Bid listing', async () => {
    const { listing, auction } = await createLiveBid({ price: 312.5, description: 'List again happy path' });
    const bid = await placeBid(listing.id, bidderToken, '317.5');
    assert.equal(bid.status, 201, JSON.stringify(bid.data));
    await pool.query(
      `UPDATE listing_auctions
       SET extension_notice_sent_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [auction.id]
    );
    const expired = await expireAutomatically(listing, auction);
    const originalImages = await imagesFor(listing.id);
    assert.ok(originalImages.length >= 1);
    await pool.query(`UPDATE listings SET views = 17 WHERE id = $1`, [listing.id]);
    await pool.query(
      `INSERT INTO favorites (user_id, listing_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [fx.stranger.id, listing.id]
    );
    const oldNotifications = await pool.query(
      `SELECT id FROM notifications WHERE related_listing_id = $1 ORDER BY id`,
      [listing.id]
    );

    await setAutoApprove(true);
    const created = track(
      await listAgain(listing.id, ownerToken, {
        duration_hours: 48,
        seller_id: extraBidder.id,
        user_id: extraBidder.id,
        auction_id: auction.id,
        original_listing_id: listing.id,
        status: 'approved',
        sale_type: 'normal',
        starts_at: '2000-01-01T00:00:00.000Z',
        ends_at: '2000-01-02T00:00:00.000Z',
        winning_bid_id: bid.data.bid.id,
        extension_used: true,
        price: 1,
      })
    );
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const newListing = created.data.listing;
    const newAuction = created.data.auction;
    createdListingIds.push(newListing.id);

    assert.notEqual(newListing.id, listing.id);
    assert.equal(newListing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(newListing.user_id, fx.owner.id);
    assert.equal(Number(newListing.price), 312.5);
    assert.ok(['pending', 'approved'].includes(newListing.status));
    assert.notEqual(newAuction.id, expired.id);
    assert.equal(newAuction.listing_id, newListing.id);
    assert.equal(Number(newAuction.duration_hours), 48);
    assert.equal(Number(newAuction.starting_price), 312.5);
    assert.equal(newAuction.extension_used, false);
    assert.equal(newAuction.winning_bid_id, null);
    assert.equal(newAuction.completion_source, null);
    assert.notEqual(String(newAuction.starts_at), String(expired.starts_at));
    assert.notEqual(String(newAuction.ends_at), String(expired.ends_at));
    if (newListing.status === LISTING_STATUS.APPROVED) {
      assert.equal(newAuction.auction_status, AUCTION_STATUS.LIVE);
      assert.ok(newAuction.starts_at);
      assert.ok(newAuction.ends_at);
    } else {
      assert.equal(newAuction.auction_status, AUCTION_STATUS.PENDING_START);
      assert.equal(newAuction.starts_at, null);
    }

    const original = await listingRow(listing.id);
    assert.equal(original.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(original.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(Number(original.price), 312.5);
    assert.equal(original.views, 17);
    assert.equal(original.listed_from_listing_id, null);
    const originalAuction = await auctionFor(listing.id);
    assert.equal(originalAuction.id, expired.id);
    assert.equal(originalAuction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(originalAuction.completion_source, 'expired');
    assert.equal(originalAuction.winning_bid_id, bid.data.bid.id);
    assert.equal(originalAuction.extension_used, false);
    assert.ok(originalAuction.extension_notice_sent_at);
    assert.equal(Number(originalAuction.duration_hours), 24);

    const originalBids = await bidsFor(expired.id);
    assert.equal(originalBids.length, 1);
    assert.equal(originalBids[0].id, bid.data.bid.id);
    assert.equal((await bidsFor(newAuction.id)).length, 0);

    const imagesAfter = await imagesFor(listing.id);
    assert.deepEqual(
      imagesAfter.map((row) => ({ id: row.id, url: row.image_url, order: row.display_order })),
      originalImages.map((row) => ({ id: row.id, url: row.image_url, order: row.display_order }))
    );
    const newImages = await imagesFor(newListing.id);
    assert.equal(newImages.length, originalImages.length);
    assert.ok(newImages.every((row) => row.listing_id === newListing.id));
    assert.ok(newImages.every((row) => !originalImages.some((old) => old.id === row.id)));

    const newRow = await listingRow(newListing.id);
    assert.equal(newRow.views, 0);
    assert.equal(Number(newRow.listed_from_listing_id), listing.id);
    assert.equal(newRow.previous_listing_id, null);
    const favNew = await pool.query(
      `SELECT COUNT(*)::int AS n FROM favorites WHERE listing_id = $1`,
      [newListing.id]
    );
    assert.equal(favNew.rows[0].n, 0);
    const favOld = await pool.query(
      `SELECT COUNT(*)::int AS n FROM favorites WHERE listing_id = $1`,
      [listing.id]
    );
    assert.equal(favOld.rows[0].n, 1);
    const viewsNew = await pool.query(
      `SELECT COUNT(*)::int AS n FROM listing_views WHERE listing_id = $1`,
      [newListing.id]
    );
    assert.equal(viewsNew.rows[0].n, 0);
    const offersNew = await pool.query(
      `SELECT COUNT(*)::int AS n FROM offers WHERE listing_id = $1`,
      [newListing.id]
    );
    assert.equal(offersNew.rows[0].n, 0);
    const eventsNew = await pool.query(
      `SELECT COUNT(*)::int AS n FROM listing_moderation_events WHERE listing_id = $1`,
      [newListing.id]
    );
    assert.equal(eventsNew.rows[0].n, 0);
    const stillOldNotifs = await pool.query(
      `SELECT id FROM notifications WHERE related_listing_id = $1 ORDER BY id`,
      [listing.id]
    );
    assert.deepEqual(
      stillOldNotifs.rows.map((row) => row.id),
      oldNotifications.rows.map((row) => row.id)
    );
    const newNotifIds = await pool.query(
      `SELECT id FROM notifications WHERE related_listing_id = $1`,
      [newListing.id]
    );
    const oldIdSet = new Set(oldNotifications.rows.map((row) => row.id));
    assert.ok(newNotifIds.rows.every((row) => !oldIdSet.has(row.id)));

    const offerRes = await api('POST', `/offers/${newListing.id}`, {
      token: bidderToken,
      body: { offered_price: 250 },
    });
    assert.equal(offerRes.status, 409);
    assert.equal(offerRes.data.code, 'BID_LISTING_NO_OFFERS');

    const edit = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ sale_type: 'bid', duration_hours: 24, price: 999, description: 'mutate' }),
    });
    assert.equal(edit.status, 400);
    const hide = await api('PATCH', `/listings/${listing.id}/hide`, { token: ownerToken });
    assert.equal(hide.status, 409);
    const unhide = await api('PATCH', `/listings/${listing.id}/unhide`, { token: ownerToken });
    assert.equal(unhide.status, 409);
    const sold = await api('PUT', `/listings/${listing.id}/mark-sold`, { token: ownerToken });
    assert.equal(sold.status, 409);
    const deleted = await api('DELETE', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(deleted.status, 409);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number((await listingRow(listing.id)).price), 312.5);
  });

  it('rejects live, pending_start, approved-active, cancelled, sold, normal, deleted, hidden, and missing listings', async () => {
    const live = await createLiveBid();
    const liveRes = await listAgain(live.listing.id, ownerToken);
    assert.equal(liveRes.status, 409);
    assert.equal(liveRes.data.code, 'LIST_AGAIN_NOT_ELIGIBLE');

    const pending = await createPendingBid();
    assert.equal(pending.auction.auction_status, AUCTION_STATUS.PENDING_START);
    const pendingRes = await listAgain(pending.listing.id, ownerToken);
    assert.equal(pendingRes.status, 409);
    assert.equal(pendingRes.data.code, 'LIST_AGAIN_NOT_ELIGIBLE');

    const approvedActive = await createLiveBid({ description: 'Approved active bid' });
    const approvedRes = await listAgain(approvedActive.listing.id, ownerToken);
    assert.equal(approvedRes.status, 409);

    const cancelTarget = await createLiveBid();
    const cancel = await endBid(cancelTarget.listing.id, ownerToken, { action: 'cancel' });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    const cancelRes = await listAgain(cancelTarget.listing.id, ownerToken);
    assert.equal(cancelRes.status, 409);
    assert.equal(cancelRes.data.code, 'LIST_AGAIN_NOT_ELIGIBLE');
    assert.equal((await auctionFor(cancelTarget.listing.id)).completion_source, 'cancelled');

    const soldTarget = await createLiveBid();
    const placed = await placeBid(soldTarget.listing.id, bidderToken, '305');
    assert.equal(placed.status, 201, JSON.stringify(placed.data));
    const sold = await endBid(soldTarget.listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: placed.data.bid.id,
    });
    assert.equal(sold.status, 200, JSON.stringify(sold.data));
    const soldRes = await listAgain(soldTarget.listing.id, ownerToken);
    assert.equal(soldRes.status, 409);
    assert.equal(soldRes.data.code, 'LIST_AGAIN_NOT_ELIGIBLE');
    assert.equal((await auctionFor(soldTarget.listing.id)).completion_source, 'sold');

    const normal = await createApprovedNormal();
    const normalRes = await listAgain(normal.id, ownerToken);
    assert.equal(normalRes.status, 409);
    assert.equal(normalRes.data.code, 'LIST_AGAIN_NOT_AUCTION');

    const deletedTarget = await createLiveBid();
    await expireAutomatically(deletedTarget.listing, deletedTarget.auction);
    await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [
      deletedTarget.listing.id,
    ]);
    const deletedRes = await listAgain(deletedTarget.listing.id, ownerToken);
    assert.equal(deletedRes.status, 409);

    const hiddenTarget = await createLiveBid();
    await pool.query(`UPDATE listings SET status = 'hidden' WHERE id = $1`, [
      hiddenTarget.listing.id,
    ]);
    const hiddenRes = await listAgain(hiddenTarget.listing.id, ownerToken);
    assert.equal(hiddenRes.status, 409);

    const missing = await listAgain(999999999, ownerToken);
    assert.equal(missing.status, 404);
  });

  it('accepts 168h, rejects invalid duration, and follows the create approval lifecycle', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAutomatically(listing, auction);

    const invalid = await listAgain(listing.id, ownerToken, { duration_hours: 25 });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.code, 'INVALID_AUCTION_DURATION');

    await setAutoApprove(false);
    const pendingCreated = track(await listAgain(listing.id, ownerToken, { duration_hours: 168 }));
    assert.equal(pendingCreated.status, 201, JSON.stringify(pendingCreated.data));
    assert.equal(pendingCreated.data.listing.status, LISTING_STATUS.PENDING);
    assert.equal(pendingCreated.data.listing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(pendingCreated.data.auction.auction_status, AUCTION_STATUS.PENDING_START);
    assert.equal(Number(pendingCreated.data.auction.duration_hours), 168);
    assert.equal(pendingCreated.data.auction.starts_at, null);
    assert.equal(pendingCreated.data.auction.ends_at, null);
    createdListingIds.push(pendingCreated.data.listing.id);
  });

  it('does not relist another seller listing or a live revision via body IDs', async () => {
    const ownerEnded = await createLiveBid();
    await expireAutomatically(ownerEnded.listing, ownerEnded.auction);
    const liveOther = await createLiveBid({ description: 'Still live' });

    await setAutoApprove(false);
    const declined = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 24, price: 300 }),
      })
    );
    assert.ok([200, 201].includes(declined.status), JSON.stringify(declined.data));
    await pool.query(
      `UPDATE listings SET status = 'declined', decline_reason = 'Photos' WHERE id = $1`,
      [declined.data.listing.id]
    );
    const resubmitted = track(
      await api('PUT', `/listings/${declined.data.listing.id}`, {
        token: ownerToken,
        body: editBody({ sale_type: 'bid', duration_hours: 24, price: 300, description: 'resubmit' }),
      })
    );
    assert.ok([200, 201].includes(resubmitted.status), JSON.stringify(resubmitted.data));

    const viaRevision = await listAgain(declined.data.listing.id, ownerToken, {
      duration_hours: 48,
      listing_id: liveOther.listing.id,
      original_listing_id: liveOther.listing.id,
    });
    assert.equal(viaRevision.status, 409);
    assert.equal((await auctionFor(liveOther.listing.id)).auction_status, AUCTION_STATUS.LIVE);

    const viaLive = await listAgain(liveOther.listing.id, ownerToken, {
      duration_hours: 48,
      original_listing_id: ownerEnded.listing.id,
    });
    assert.equal(viaLive.status, 409);

    await setAutoApprove(true);
    const strangerLive = await api('POST', '/listings', {
      token: bidderToken,
      body: {
        ...payload({ sale_type: 'bid', duration_hours: 24, price: 300, description: 'stranger' }),
        images: [await uploadOne(bidderToken)],
      },
    });
    assert.ok([200, 201].includes(strangerLive.status), JSON.stringify(strangerLive.data));
    createdListingIds.push(strangerLive.data.listing.id);
    const strangerAuction = await auctionFor(strangerLive.data.listing.id);
    await expireAuctionClock(strangerAuction.id);
    await api('GET', `/listings/${strangerLive.data.listing.id}`, { token: bidderToken });
    const steal = await listAgain(strangerLive.data.listing.id, ownerToken, {
      duration_hours: 48,
      seller_id: fx.owner.id,
    });
    assert.equal(steal.status, 403);
    assert.equal(steal.data.code, 'LIST_AGAIN_NOT_OWNER');
  });

  it('concurrent List Again does not duplicate; later relist of a successor is allowed', async () => {
    const { listing, auction } = await createLiveBid();
    await expireAutomatically(listing, auction);
    await setAutoApprove(true);
    const [first, second] = await Promise.all([
      listAgain(listing.id, ownerToken, { duration_hours: 36 }),
      listAgain(listing.id, ownerToken, { duration_hours: 60 }),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    const success = first.status === 201 ? first : second;
    const conflict = first.status === 201 ? second : first;
    assert.equal(conflict.data.code, 'LIST_AGAIN_ALREADY_USED');
    createdListingIds.push(success.data.listing.id);
    const successors = await pool.query(
      `SELECT id FROM listings WHERE listed_from_listing_id = $1`,
      [listing.id]
    );
    assert.equal(successors.rows.length, 1);

    const successorId = success.data.listing.id;
    const successorAuction = await auctionFor(successorId);
    if (successorAuction.auction_status !== AUCTION_STATUS.LIVE) {
      await pool.query(
        `UPDATE listings SET status = 'approved' WHERE id = $1`,
        [successorId]
      );
    }
    if ((await auctionFor(successorId)).auction_status !== AUCTION_STATUS.LIVE) {
      await pool.query(
        `UPDATE listing_auctions
         SET auction_status = 'live',
             starts_at = CURRENT_TIMESTAMP,
             original_ends_at = CURRENT_TIMESTAMP + INTERVAL '24 hours',
             ends_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'
         WHERE listing_id = $1 AND auction_status = 'pending_start'`,
        [successorId]
      );
    }
    await expireAutomatically({ id: successorId }, await auctionFor(successorId));
    const later = track(await listAgain(successorId, ownerToken, { duration_hours: 72 }));
    assert.equal(later.status, 201, JSON.stringify(later.data));
    assert.notEqual(later.data.listing.id, successorId);
    assert.notEqual(later.data.listing.id, listing.id);
    assert.equal(Number((await listingRow(later.data.listing.id)).listed_from_listing_id), successorId);
    createdListingIds.push(later.data.listing.id);
  });

  it('does not change normal create, Bid create, expiration, End Bid, extension, or one-hour notice', async () => {
    const normal = await createApprovedNormal({ description: 'Regression normal' });
    assert.equal(normal.sale_type, LISTING_SALE_TYPE.NORMAL);
    assert.equal(await auctionFor(normal.id), null);

    const live = await createLiveBid({ description: 'Regression bid' });
    assert.equal(live.auction.auction_status, AUCTION_STATUS.LIVE);
    const placed = await placeBid(live.listing.id, bidderToken, '305');
    assert.equal(placed.status, 201, JSON.stringify(placed.data));

    const extend = await api('POST', `/listings/${live.listing.id}/extend-bid`, {
      token: ownerToken,
      body: { duration_hours: 24 },
    });
    assert.equal(extend.status, 200, JSON.stringify(extend.data));
    assert.equal(extend.data.auction.extension_used, true);

    const other = await createLiveBid({ description: 'Regression expire' });
    await expireAutomatically(other.listing, other.auction);
    assert.equal((await listingRow(other.listing.id)).status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await auctionFor(other.listing.id)).completion_source, 'expired');

    const endTarget = await createLiveBid({ description: 'Regression end bid' });
    const endBidPlaced = await placeBid(endTarget.listing.id, bidderToken, '305');
    assert.equal(endBidPlaced.status, 201, JSON.stringify(endBidPlaced.data));
    const ended = await endBid(endTarget.listing.id, ownerToken, {
      action: 'sold',
      winning_bid_id: endBidPlaced.data.bid.id,
    });
    assert.equal(ended.status, 200, JSON.stringify(ended.data));
    assert.equal((await auctionFor(endTarget.listing.id)).completion_source, 'sold');
    const endAgain = await listAgain(endTarget.listing.id, ownerToken);
    assert.equal(endAgain.status, 409);

    const notice = await pool.query(
      `SELECT extension_notice_sent_at FROM listing_auctions WHERE listing_id = $1`,
      [live.listing.id]
    );
    assert.equal(notice.rows[0].extension_notice_sent_at, null);

    const offer = await api('POST', `/offers/${live.listing.id}`, {
      token: bidderToken,
      body: { offered_price: 250 },
    });
    assert.equal(offer.status, 409);
    assert.equal(offer.data.code, 'BID_LISTING_NO_OFFERS');
  });
});
