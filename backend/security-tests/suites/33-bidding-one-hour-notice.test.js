'use strict';

/**
 * Phase 2F-4 — seller one-hour remaining Bid notice.
 * Hits the local API for regressions. Dispatches the notice helper directly
 * so tests do not sleep for an hour.
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
  AUCTION_STATUS,
  dispatchOneHourAuctionNotices,
} = require('../../utils/listingAuctions');
const { NOTIFICATION_TYPES } = require('../../utils/notifications');

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'bidding-one-hour.jpg'
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
    `SELECT id, listing_id, auction_status, starts_at, original_ends_at, ends_at,
            extension_used, extension_notice_sent_at, winning_bid_id
     FROM listing_auctions
     WHERE listing_id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function noticesFor(listingId) {
  const result = await pool.query(
    `SELECT id, user_id, admin_id, related_listing_id, type, title, message, is_read
     FROM notifications
     WHERE related_listing_id = $1
       AND type = $2
     ORDER BY id`,
    [listingId, NOTIFICATION_TYPES.BID_ONE_HOUR_REMAINING]
  );
  return result.rows;
}

describe('33 — Bidding one-hour remaining notice', () => {
  let fx;
  let ownerToken;
  let bidderToken;
  let secondBidderToken;
  let extraBidder;
  let staffToken;
  let ownedImageUrl;
  let originalAutoApprove;
  const createdListingIds = [];
  const createdNotificationIds = [];

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
      description: 'Phase 2F-4 one-hour notice listing',
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

  async function setRemaining(auctionId, intervalSql) {
    await pool.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) + (${intervalSql}),
         original_ends_at = CURRENT_TIMESTAMP + (${intervalSql}),
         ends_at = CURRENT_TIMESTAMP + (${intervalSql})
       WHERE id = $1`,
      [auctionId]
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

  async function dispatchAndTrack() {
    const sent = await dispatchOneHourAuctionNotices(pool);
    for (const row of sent) {
      if (row.notification_id) createdNotificationIds.push(row.notification_id);
    }
    return sent;
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
    if (createdNotificationIds.length > 0) {
      await pool.query(`DELETE FROM notifications WHERE id = ANY($1::int[])`, [
        createdNotificationIds,
      ]);
    }
    await deleteListingsByIds(createdListingIds);
  });

  it('notifies only the seller of a live Bid inside the one-hour window', async () => {
    const { listing, auction } = await createLiveBid();
    await api('POST', `/listings/${listing.id}/bids`, {
      token: bidderToken,
      body: { amount: '305' },
    });
    await setRemaining(auction.id, `INTERVAL '50 minutes'`);
    const sent = await dispatchAndTrack();
    const rows = await noticesFor(listing.id);
    assert.equal(rows.length, 1, JSON.stringify({ sent, rows }));
    createdNotificationIds.push(rows[0].id);
    assert.equal(Number(rows[0].user_id), fx.owner.id);
    assert.equal(rows[0].admin_id, null);
    assert.equal(Number(rows[0].related_listing_id), listing.id);
    assert.equal(rows[0].type, NOTIFICATION_TYPES.BID_ONE_HOUR_REMAINING);
    assert.equal(rows[0].title, 'Bid ending soon');
    assert.match(rows[0].message, /1 hour remaining/);
    assert.equal(rows[0].message.includes(fx.stranger.phone_number || 'zzz'), false);
    assert.equal(rows[0].is_read, false);
    assert.ok((await auctionFor(listing.id)).extension_notice_sent_at);

    const inbox = await api('GET', '/notifications?limit=50', { token: ownerToken });
    assert.equal(inbox.status, 200);
    assert.equal(
      (inbox.data.notifications || []).some((row) => row.id === rows[0].id),
      true
    );
    const bidderInbox = await api('GET', '/notifications?limit=50', { token: bidderToken });
    assert.equal(
      (bidderInbox.data.notifications || []).some((row) => row.id === rows[0].id),
      false
    );
  });

  it('rejects ineligible listings and auction states', async () => {
    const normal = await createApprovedNormal({ price: 221 });
    assert.equal((await noticesFor(normal.id)).length, 0);

    const pending = await createPendingBid();
    const pendingSent = await dispatchAndTrack();
    assert.equal(pendingSent.some((row) => row.listing_id === pending.listing.id), false);
    assert.equal((await noticesFor(pending.listing.id)).length, 0);

    const far = await createLiveBid({ description: '90 minutes remaining' });
    await setRemaining(far.auction.id, `INTERVAL '90 minutes'`);
    const farSent = await dispatchAndTrack();
    assert.equal(farSent.some((row) => row.listing_id === far.listing.id), false);
    assert.equal((await auctionFor(far.listing.id)).extension_notice_sent_at, null);

    for (const status of [
      AUCTION_STATUS.ENDED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.COMPLETED,
    ]) {
      const live = await createLiveBid({ description: `State ${status}` });
      await setRemaining(live.auction.id, `INTERVAL '50 minutes'`);
      await pool.query(`UPDATE listing_auctions SET auction_status = $2 WHERE id = $1`, [
        live.auction.id,
        status,
      ]);
      const sent = await dispatchAndTrack();
      assert.equal(sent.some((row) => row.listing_id === live.listing.id), false);
      assert.equal((await noticesFor(live.listing.id)).length, 0);
    }

    const expired = await createLiveBid({ description: 'already due' });
    await expireAuctionClock(expired.auction.id);
    const expiredSent = await dispatchAndTrack();
    assert.equal(expiredSent.some((row) => row.listing_id === expired.listing.id), false);
    assert.equal((await noticesFor(expired.listing.id)).length, 0);
    const ownerDetail = await api('GET', `/listings/${expired.listing.id}`, { token: ownerToken });
    assert.equal(ownerDetail.status, 200);
    assert.equal(ownerDetail.data.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal((await auctionFor(expired.listing.id)).auction_status, AUCTION_STATUS.COMPLETED);
  });

  it('claims once under repeat and concurrent dispatch', async () => {
    const { listing, auction } = await createLiveBid();
    await setRemaining(auction.id, `INTERVAL '45 minutes'`);
    const first = await dispatchAndTrack();
    assert.equal((await noticesFor(listing.id)).length, 1);
    const second = await dispatchAndTrack();
    assert.equal(second.filter((row) => row.listing_id === listing.id).length, 0);
    assert.equal((await noticesFor(listing.id)).length, 1);

    const concurrent = await createLiveBid({ description: 'concurrent notice' });
    await setRemaining(concurrent.auction.id, `INTERVAL '42 minutes'`);
    const [left, right] = await Promise.all([
      dispatchOneHourAuctionNotices(pool),
      dispatchOneHourAuctionNotices(pool),
    ]);
    const combined = [...left, ...right].filter((row) => row.listing_id === concurrent.listing.id);
    for (const row of combined) {
      if (row.notification_id) createdNotificationIds.push(row.notification_id);
    }
    assert.equal(combined.length, 1);
    assert.equal((await noticesFor(concurrent.listing.id)).length, 1);
    assert.ok((await auctionFor(concurrent.listing.id)).extension_notice_sent_at);
  });

  it('uses current ends_at after extension and never resets a sent notice', async () => {
    const { listing, auction } = await createLiveBid();
    await setRemaining(auction.id, `INTERVAL '50 minutes'`);
    const extended = await api('POST', `/listings/${listing.id}/extend-bid`, {
      token: ownerToken,
      body: { duration_hours: 24 },
    });
    assert.equal(extended.status, 200, JSON.stringify(extended.data));
    const skipped = await dispatchAndTrack();
    assert.equal(skipped.some((row) => row.listing_id === listing.id), false);
    assert.equal((await auctionFor(listing.id)).extension_notice_sent_at, null);
    assert.equal((await auctionFor(listing.id)).extension_used, true);

    await pool.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - INTERVAL '23 hours 20 minutes',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '20 minutes',
         ends_at = CURRENT_TIMESTAMP + INTERVAL '40 minutes'
       WHERE id = $1`,
      [auction.id]
    );
    const sent = await dispatchAndTrack();
    assert.equal(sent.filter((row) => row.listing_id === listing.id).length, 1);
    const sentAt = (await auctionFor(listing.id)).extension_notice_sent_at;
    await pool.query(
      `UPDATE listing_auctions
       SET ends_at = CURRENT_TIMESTAMP + INTERVAL '25 minutes'
       WHERE id = $1`,
      [auction.id]
    );
    const again = await dispatchAndTrack();
    assert.equal(again.some((row) => row.listing_id === listing.id), false);
    assert.equal(String((await auctionFor(listing.id)).extension_notice_sent_at), String(sentAt));
    assert.equal((await noticesFor(listing.id)).length, 1);
  });

  it('does not notify after End Bid or cancellation, and does not duplicate afterward', async () => {
    const ended = await createLiveBid();
    const bid = await api('POST', `/listings/${ended.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: '305' },
    });
    await setRemaining(ended.auction.id, `INTERVAL '50 minutes'`);
    const sold = await api('POST', `/listings/${ended.listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'sold', winning_bid_id: bid.data.bid.id },
    });
    assert.equal(sold.status, 200, JSON.stringify(sold.data));
    const afterSold = await dispatchAndTrack();
    assert.equal(afterSold.some((row) => row.listing_id === ended.listing.id), false);
    assert.equal((await noticesFor(ended.listing.id)).length, 0);

    const cancelled = await createLiveBid();
    await setRemaining(cancelled.auction.id, `INTERVAL '50 minutes'`);
    const cancel = await api('POST', `/listings/${cancelled.listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'cancel' },
    });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    const afterCancel = await dispatchAndTrack();
    assert.equal(afterCancel.some((row) => row.listing_id === cancelled.listing.id), false);
    assert.equal((await noticesFor(cancelled.listing.id)).length, 0);

    const already = await createLiveBid();
    await setRemaining(already.auction.id, `INTERVAL '50 minutes'`);
    const sent = await dispatchAndTrack();
    assert.equal(sent.filter((row) => row.listing_id === already.listing.id).length, 1);
    const laterBid = await api('POST', `/listings/${already.listing.id}/bids`, {
      token: bidderToken,
      body: { amount: '305' },
    });
    assert.equal(laterBid.status, 201, JSON.stringify(laterBid.data));
    const endAfter = await api('POST', `/listings/${already.listing.id}/end-bid`, {
      token: ownerToken,
      body: { action: 'sold', winning_bid_id: laterBid.data.bid.id },
    });
    assert.equal(endAfter.status, 200);
    const afterEnd = await dispatchAndTrack();
    assert.equal(afterEnd.some((row) => row.listing_id === already.listing.id), false);
    assert.equal((await noticesFor(already.listing.id)).length, 1);

    const bidders = await api('GET', `/listings/${already.listing.id}/bids`, { token: ownerToken });
    assert.ok([200, 409].includes(bidders.status));
  });
});
