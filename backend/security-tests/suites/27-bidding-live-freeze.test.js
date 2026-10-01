'use strict';

/**
 * Phase 2H — LIVE Bid listings are frozen against seller mutations.
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
    'bidding-freeze.jpg'
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

async function listingRow(listingId) {
  const result = await pool.query(
    `SELECT id, user_id, status, price, description, sale_type, location,
            revision_number, previous_listing_id, root_listing_id, updated_at,
            model_id, condition_id
     FROM listings
     WHERE id = $1`,
    [listingId]
  );
  return result.rows[0] || null;
}

async function revisionCount(listingId) {
  const listing = await listingRow(listingId);
  if (!listing?.previous_listing_id) return 0;
  const result = await pool.query(
    'SELECT COUNT(*)::int AS n FROM listings WHERE id = $1',
    [listing.previous_listing_id]
  );
  return result.rows[0].n;
}

function stamp(row) {
  if (!row) return null;
  return JSON.stringify(row);
}

describe('27 — Bidding live listing freeze', () => {
  let fx;
  let ownerToken;
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
      description: 'Phase 2H freeze listing',
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
          price: 210,
          description: 'Live bid freeze target',
          ...overrides,
        }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.APPROVED);
    const auction = await auctionFor(res.data.listing.id);
    assert.ok(auction);
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
          duration_hours: 48,
          price: 175,
          description: 'Pending bid freeze target',
          ...overrides,
        }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.PENDING);
    const auction = await auctionFor(res.data.listing.id);
    assert.equal(auction.auction_status, AUCTION_STATUS.PENDING_START);
    return { listing: res.data.listing, auction };
  }

  async function createApprovedNormal(overrides = {}) {
    await setAutoApprove(true);
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: payload({
          price: 220,
          description: 'Normal approved freeze control',
          ...overrides,
        }),
      })
    );
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.APPROVED);
    assert.equal(await auctionFor(res.data.listing.id), null);
    return res.data.listing;
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

  function assertFrozen(res) {
    assert.equal(res.status, 409, JSON.stringify(res.data));
    assert.equal(res.data.code, 'LIVE_AUCTION_FROZEN');
  }

  async function assertUnchanged(listingId, listingBefore, auctionBefore) {
    const listingAfter = await listingRow(listingId);
    const auctionAfter = await auctionFor(listingId);
    assert.equal(stamp(listingAfter), stamp(listingBefore));
    assert.equal(stamp(auctionAfter), stamp(auctionBefore));
    assert.equal(auctionAfter.auction_status, AUCTION_STATUS.LIVE);
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog, 'Need phone catalog fixture');
    assert.ok(fx.owner, 'Need listing owner');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    ownedImageUrl = await uploadOne(ownerToken);
    originalAutoApprove = await readAutoApprove();
  });

  after(async () => {
    await setAutoApprove(originalAutoApprove);
    await deleteListingsByIds(createdListingIds);
  });

  it('owner cannot PUT a LIVE Bid listing', async () => {
    const { listing, auction } = await createLiveBid();
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 210,
        description: 'Attempted live bid edit',
      }),
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
  });

  it('owner cannot change price on LIVE Bid', async () => {
    const { listing, auction } = await createLiveBid({ price: 210 });
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 350,
      }),
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
    assert.equal(Number((await listingRow(listing.id)).price), 210);
  });

  it('owner cannot change duration on LIVE Bid', async () => {
    const { listing, auction } = await createLiveBid({ duration_hours: 24 });
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 72,
        price: 210,
      }),
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
    assert.equal(Number((await auctionFor(listing.id)).duration_hours), 24);
  });

  it('owner cannot change sale_type on LIVE Bid', async () => {
    const { listing, auction } = await createLiveBid();
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'normal',
        duration_hours: 24,
        price: 210,
      }),
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
    assert.equal((await listingRow(listing.id)).sale_type, LISTING_SALE_TYPE.BID);
  });

  it('owner cannot change other editable listing fields on LIVE Bid', async () => {
    const { listing, auction } = await createLiveBid({
      description: 'Original live description',
    });
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 210,
        description: 'Changed description should be blocked',
        location: 'Amman',
      }),
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
    assert.equal(
      (await listingRow(listing.id)).description,
      'Original live description'
    );
  });

  it('no revision is created when PUT is rejected', async () => {
    const { listing } = await createLiveBid();
    assert.equal(await revisionCount(listing.id), 0);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 400,
        description: 'Should not freeze a revision',
      }),
    });
    assertFrozen(res);
    assert.equal(await revisionCount(listing.id), 0);
  });

  it('existing listing row remains unchanged after rejected PUT', async () => {
    const { listing } = await createLiveBid({ description: 'Keep listing row' });
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 36,
        price: 999,
        description: 'Mutated listing row',
      }),
    });
    assertFrozen(res);
    assert.equal(stamp(await listingRow(listing.id)), stamp(listingBefore));
  });

  it('auction remains live after rejected PUT', async () => {
    const { listing } = await createLiveBid();
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ sale_type: 'bid', duration_hours: 24, price: 500 }),
    });
    assertFrozen(res);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.LIVE);
  });

  it('auction starting_price remains unchanged after rejected PUT', async () => {
    const { listing } = await createLiveBid({ price: 210 });
    const before = Number((await auctionFor(listing.id)).starting_price);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ sale_type: 'bid', duration_hours: 24, price: 275 }),
    });
    assertFrozen(res);
    assert.equal(Number((await auctionFor(listing.id)).starting_price), before);
    assert.equal(before, 210);
  });

  it('auction duration remains unchanged after rejected PUT', async () => {
    const { listing } = await createLiveBid({ duration_hours: 24 });
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ sale_type: 'bid', duration_hours: 120, price: 210 }),
    });
    assertFrozen(res);
    assert.equal(Number((await auctionFor(listing.id)).duration_hours), 24);
  });

  it('auction ends_at remains unchanged after rejected PUT', async () => {
    const { listing } = await createLiveBid();
    const before = String((await auctionFor(listing.id)).ends_at);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({ sale_type: 'bid', duration_hours: 48, price: 210 }),
    });
    assertFrozen(res);
    assert.equal(String((await auctionFor(listing.id)).ends_at), before);
  });

  it('owner cannot hide LIVE Bid', async () => {
    const { listing, auction } = await createLiveBid();
    const listingBefore = await listingRow(listing.id);
    const res = await api('PATCH', `/listings/${listing.id}/hide`, {
      token: ownerToken,
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
  });

  it('owner cannot unhide LIVE Bid', async () => {
    const { listing, auction } = await createLiveBid();
    await pool.query(`UPDATE listings SET status = 'hidden' WHERE id = $1`, [listing.id]);
    const listingBefore = await listingRow(listing.id);
    const res = await api('PATCH', `/listings/${listing.id}/unhide`, {
      token: ownerToken,
    });
    assertFrozen(res);
    const listingAfter = await listingRow(listing.id);
    const auctionAfter = await auctionFor(listing.id);
    assert.equal(listingAfter.status, LISTING_STATUS.HIDDEN);
    assert.equal(stamp(listingAfter), stamp(listingBefore));
    assert.equal(auctionAfter.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(stamp(auctionAfter), stamp(auction));
  });

  it('owner cannot mark LIVE Bid sold', async () => {
    const { listing, auction } = await createLiveBid();
    const listingBefore = await listingRow(listing.id);
    const res = await api('PUT', `/listings/${listing.id}/mark-sold`, {
      token: ownerToken,
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
  });

  it('owner cannot generic DELETE LIVE Bid', async () => {
    const { listing } = await createLiveBid();
    const res = await api('DELETE', `/listings/${listing.id}`, {
      token: ownerToken,
    });
    assertFrozen(res);
    assert.equal((await listingRow(listing.id)).status, LISTING_STATUS.APPROVED);
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.LIVE);
  });

  it('rejected generic DELETE leaves listing and auction unchanged', async () => {
    const { listing, auction } = await createLiveBid();
    const listingBefore = await listingRow(listing.id);
    const res = await api('DELETE', `/listings/${listing.id}`, {
      token: ownerToken,
    });
    assertFrozen(res);
    await assertUnchanged(listing.id, listingBefore, auction);
  });

  it('normal approved listing can still be edited', async () => {
    const listing = await createApprovedNormal({ description: 'Normal before edit' });
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        price: 199,
        description: 'Normal after edit',
      }),
    });
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.UPDATED);
    assert.equal(Number(res.data.listing.price), 199);
    assert.equal(await auctionFor(listing.id), null);
  });

  it('normal approved listing can still be hidden', async () => {
    const listing = await createApprovedNormal();
    const res = await api('PATCH', `/listings/${listing.id}/hide`, {
      token: ownerToken,
    });
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.HIDDEN);
  });

  it('normal approved listing can still be marked sold', async () => {
    const listing = await createApprovedNormal();
    const res = await api('PUT', `/listings/${listing.id}/mark-sold`, {
      token: ownerToken,
    });
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal(res.data.listing.status, LISTING_STATUS.SOLD);
  });

  it('pending Bid listing can still follow its existing allowed edit flow', async () => {
    const { listing } = await createPendingBid({
      price: 175,
      duration_hours: 48,
      description: 'Pending before edit',
    });
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 72,
        price: 190,
        description: 'Pending after edit',
      }),
    });
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.notEqual(res.status, 409);
    assert.notEqual(res.data?.code, 'LIVE_AUCTION_FROZEN');
    assert.equal(res.data.listing.status, LISTING_STATUS.PENDING);
    assert.equal(Number(res.data.listing.price), 190);
    assert.equal(res.data.listing.description, 'Pending after edit');
  });

  it('pending Bid auction remains pending_start where appropriate', async () => {
    const { listing } = await createPendingBid({
      price: 160,
      duration_hours: 36,
    });
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 60,
        price: 165,
      }),
    });
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    const auction = await auctionFor(listing.id);
    assert.equal(auction.auction_status, AUCTION_STATUS.PENDING_START);
    assert.equal(Number(auction.starting_price), 165);
    assert.equal(Number(auction.duration_hours), 60);
    assert.equal(auction.starts_at, null);
    assert.equal(auction.ends_at, null);
  });

  it('ended Bid is not treated as live and is not rejected solely because it is a Bid', async () => {
    const { listing } = await createLiveBid({
      description: 'Ended bid still editable',
    });
    await setAuctionStatus(listing.id, AUCTION_STATUS.ENDED);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 210,
        description: 'Ended bid edit allowed',
      }),
    });
    assert.notEqual(res.status, 409);
    assert.notEqual(res.data?.code, 'LIVE_AUCTION_FROZEN');
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.ENDED);
  });

  it('cancelled Bid is not treated as live and is not rejected solely because it is a Bid', async () => {
    const { listing } = await createLiveBid({
      description: 'Cancelled bid still editable',
    });
    await setAuctionStatus(listing.id, AUCTION_STATUS.CANCELLED);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 210,
        description: 'Cancelled bid edit allowed',
      }),
    });
    assert.notEqual(res.status, 409);
    assert.notEqual(res.data?.code, 'LIVE_AUCTION_FROZEN');
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    assert.equal((await auctionFor(listing.id)).auction_status, AUCTION_STATUS.CANCELLED);
  });

  it('freezeCurrentListingRevision preserves sale_type=bid on an allowed revision', async () => {
    const { listing } = await createLiveBid({
      description: 'Bid snapshot source',
    });
    await setAuctionStatus(listing.id, AUCTION_STATUS.ENDED);
    assert.equal(await revisionCount(listing.id), 0);
    const res = await api('PUT', `/listings/${listing.id}`, {
      token: ownerToken,
      body: editBody({
        sale_type: 'bid',
        duration_hours: 24,
        price: 215,
        description: 'Ended bid revision snapshot',
      }),
    });
    assert.ok([200, 201].includes(res.status), JSON.stringify(res.data));
    const snapshotId = res.data.listing.previous_listing_id;
    assert.ok(snapshotId, 'approved Bid edit should freeze a revision snapshot');
    assert.equal(await revisionCount(listing.id), 1);
    const snapshot = await pool.query(
      `SELECT sale_type, status FROM listings WHERE id = $1`,
      [snapshotId]
    );
    assert.equal(snapshot.rows.length, 1);
    assert.equal(snapshot.rows[0].sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(res.data.listing.sale_type, LISTING_SALE_TYPE.BID);
  });
});
