'use strict';

/**
 * Phase 2C — Bid listing create + approval starts auctions.
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
    'bidding-create.jpg'
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

describe('26 — Bidding create and approval integration', () => {
  let fx;
  let ownerToken;
  let strangerToken;
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
      price: 200,
      description: 'Phase 2C bidding create listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog, 'Need phone catalog fixture');
    assert.ok(fx.owner, 'Need listing owner');
    assert.ok(fx.stranger, 'Need second user');
    assert.ok(fx.admin, 'Need admin fixture');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    strangerToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
    staffToken = adminToken({
      adminId: fx.admin.id,
      email: fx.admin.email,
      role: fx.admin.role || 'super_admin',
    });
    ownedImageUrl = await uploadOne(ownerToken);
    originalAutoApprove = await readAutoApprove();
  });

  after(async () => {
    await setAutoApprove(originalAutoApprove);
    await deleteListingsByIds(createdListingIds);
  });

  it('normal listing create does not create an auction', async () => {
    await setAutoApprove(false);
    const res = track(
      await api('POST', '/listings', { token: ownerToken, body: payload() })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.notEqual(res.data.listing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(await auctionFor(res.data.listing.id), null);
  });

  it('omitted sale_type stays normal even if duration_hours is sent', async () => {
    await setAutoApprove(false);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ duration_hours: 24 }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.sale_type, LISTING_SALE_TYPE.NORMAL);
    assert.equal(await auctionFor(res.data.listing.id), null);
  });

  it('Bid listing without duration is rejected', async () => {
    const res = await api('POST', '/listings', {
      token: ownerToken,
      body: payload({ sale_type: 'bid' }),
    });
    assert.equal(res.status, 400);
  });

  it('invalid Bid duration is rejected', async () => {
    const res = await api('POST', '/listings', {
      token: ownerToken,
      body: payload({ sale_type: 'bid', duration_hours: 25 }),
    });
    assert.equal(res.status, 400);
  });

  it('Bid listing + moderation required is pending with pending_start', async () => {
    await setAutoApprove(false);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 48, price: 175 }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.PENDING);
    assert.equal(res.data.listing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(Number(res.data.listing.price), 175);
    const auction = await auctionFor(res.data.listing.id);
    assert.ok(auction);
    assert.equal(auction.auction_status, AUCTION_STATUS.PENDING_START);
    assert.equal(Number(auction.starting_price), 175);
    assert.equal(Number(auction.duration_hours), 48);
    assert.equal(auction.starts_at, null);
    assert.equal(auction.ends_at, null);
  });

  it('Bid listing + auto-approval is approved with a live auction', async () => {
    await setAutoApprove(true);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 24, price: 210 }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.APPROVED);
    const auction = await auctionFor(res.data.listing.id);
    assert.ok(auction);
    assert.equal(auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(Number(auction.starting_price), 210);
    assert.equal(Number(res.data.listing.price), 210);
    assert.equal(Number(auction.duration_hours), 24);
    assert.ok(auction.starts_at);
    assert.ok(auction.ends_at);
  });

  it('admin approve of a pending Bid listing starts the auction once', async () => {
    await setAutoApprove(false);
    const created = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 36, price: 180 }),
      })
    );
    const listingId = created.data.listing.id;
    const before = await auctionFor(listingId);
    assert.equal(before.auction_status, AUCTION_STATUS.PENDING_START);

    const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approve.status), JSON.stringify(approve.data));
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);
    const live = await auctionFor(listingId);
    assert.equal(live.auction_status, AUCTION_STATUS.LIVE);
    const startsAt = String(live.starts_at);

    const again = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.equal(again.status, 409);
    const after = await auctionFor(listingId);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(String(after.starts_at), startsAt);
  });

  it('declined Bid resubmit creates a new pending auction on the new listing id', async () => {
    await setAutoApprove(false);
    const created = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 24, price: 160 }),
      })
    );
    const oldId = created.data.listing.id;
    await pool.query(
      `UPDATE listings
       SET status = 'declined', decline_reason = 'Needs photos'
       WHERE id = $1`,
      [oldId]
    );
    const oldAuction = await auctionFor(oldId);
    assert.equal(oldAuction.auction_status, AUCTION_STATUS.PENDING_START);

    const edited = track(
      await api('PUT', `/listings/${oldId}`, {
        token: ownerToken,
        body: payload({
          sale_type: 'bid',
          duration_hours: 72,
          price: 190,
          description: 'Resubmitted bid listing',
        }),
      })
    );
    assert.ok([200, 201].includes(edited.status), JSON.stringify(edited.data));
    assert.equal(edited.data.listing.status, LISTING_STATUS.RESUBMITTED);
    assert.notEqual(edited.data.listing.id, oldId);
    assert.equal(edited.data.listing.sale_type, LISTING_SALE_TYPE.BID);

    const stillOld = await auctionFor(oldId);
    assert.equal(stillOld.id, oldAuction.id);
    assert.equal(Number(stillOld.duration_hours), 24);
    const fresh = await auctionFor(edited.data.listing.id);
    assert.ok(fresh);
    assert.notEqual(fresh.id, oldAuction.id);
    assert.equal(fresh.auction_status, AUCTION_STATUS.PENDING_START);
    assert.equal(Number(fresh.starting_price), 190);
    assert.equal(Number(fresh.duration_hours), 72);
    assert.equal(fresh.starts_at, null);
  });

  it('admin approve of resubmitted and updated Bid listings starts live auctions', async () => {
    await setAutoApprove(false);
    const created = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 24, price: 150 }),
      })
    );
    const listingId = created.data.listing.id;
    await pool.query(`UPDATE listings SET status = 'resubmitted' WHERE id = $1`, [listingId]);
    const approveResubmitted = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approveResubmitted.status));
    assert.equal((await auctionFor(listingId)).auction_status, AUCTION_STATUS.LIVE);

    await pool.query(`UPDATE listings SET status = 'updated' WHERE id = $1`, [listingId]);
    const startsAt = String((await auctionFor(listingId)).starts_at);
    const approveUpdated = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approveUpdated.status));
    const after = await auctionFor(listingId);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(String(after.starts_at), startsAt);
  });

  it('duplicate auction creation cannot add a second row', async () => {
    await setAutoApprove(false);
    const created = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 24, price: 140 }),
      })
    );
    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM listing_auctions WHERE listing_id = $1',
      [created.data.listing.id]
    );
    assert.equal(count.rows[0].n, 1);
  });

  it('normal listing approval still has no auction and still accepts offers', async () => {
    await setAutoApprove(false);
    const created = track(
      await api('POST', '/listings', { token: ownerToken, body: payload({ price: 220 }) })
    );
    const listingId = created.data.listing.id;
    const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approve.status), JSON.stringify(approve.data));
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);
    assert.equal(await auctionFor(listingId), null);

    const offer = await api('POST', `/offers/${listingId}`, {
      token: strangerToken,
      body: { offered_price: 200 },
    });
    assert.ok([200, 201].includes(offer.status), JSON.stringify(offer.data));
  });

  it('approving a Bid listing without an auction rolls back the listing status', async () => {
    await setAutoApprove(false);
    const created = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({ sale_type: 'bid', duration_hours: 24, price: 130 }),
      })
    );
    const listingId = created.data.listing.id;
    await pool.query('DELETE FROM listing_auctions WHERE listing_id = $1', [listingId]);
    const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.ok([400, 404, 409, 500].includes(approve.status), `got ${approve.status}`);
    const listing = await pool.query('SELECT status FROM listings WHERE id = $1', [listingId]);
    assert.equal(listing.rows[0].status, LISTING_STATUS.PENDING);
  });
});
