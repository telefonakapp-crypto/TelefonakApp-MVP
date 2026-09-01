'use strict';

/**
 * Seller-edit status: declined → resubmitted, approved → updated.
 * Admin approve/decline works for both queue statuses.
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
const {
  LISTING_STATUS,
  resolveSellerEditNextStatus,
} = require('../../utils/listingStatus');

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'updated-status.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, 'upload fixture should succeed');
  assert.ok(res.data?.image_urls?.[0]);
  return res.data.image_urls[0];
}

describe('19 — Listing updated vs resubmitted status', () => {
  let fx;
  let ownerToken;
  let staffToken;
  let ownedImageUrl;
  const createdListingIds = [];

  function trackListing(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  function phonePayload(overrides = {}) {
    return {
      model_id: fx.catalog.model_id,
      model_storage_id: fx.catalog.model_storage_id,
      model_color_id: fx.catalog.model_color_id,
      sim_configuration_id: fx.catalog.sim_configuration_id,
      condition_id: fx.catalog.condition_id,
      price: 250,
      description: 'Updated-status regression listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  async function createListing() {
    const res = trackListing(
      await api('POST', '/listings', {
        token: ownerToken,
        body: phonePayload(),
      })
    );
    assert.ok([200, 201].includes(res.status), `create failed ${res.status} ${JSON.stringify(res.data)}`);
    return res.data.listing;
  }

  async function setStatus(listingId, status) {
    await pool.query(
      `UPDATE listings
       SET status = $1::varchar,
           decline_reason = CASE WHEN $1::varchar = 'declined' THEN 'Needs photos' ELSE NULL END,
           approved_or_rejected_at = CASE
             WHEN $1::varchar IN ('approved', 'declined') THEN CURRENT_TIMESTAMP
             ELSE NULL
           END
       WHERE id = $2`,
      [status, listingId]
    );
  }

  async function sellerEdit(listingId, extra = {}) {
    const body = phonePayload({
      price: 240,
      description: extra.description || 'Seller edited listing',
    });
    delete body.images;
    const res = await api('PUT', `/listings/${listingId}`, {
      token: ownerToken,
      body: { ...body, ...extra },
    });
    return res;
  }

  async function adminList(query = {}) {
    const params = new URLSearchParams();
    params.set('page', String(query.page ?? 1));
    params.set('limit', String(query.limit ?? 50));
    if (query.status) params.set('status', query.status);
    const res = await api('GET', `/admin/listings?${params.toString()}`, {
      token: staffToken,
    });
    assert.equal(res.status, 200, `admin list failed ${res.status}`);
    return res;
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog, 'Need phone catalog fixture');
    assert.ok(fx.owner, 'Need listing owner');
    assert.ok(fx.admin, 'Need admin fixture');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    staffToken = adminToken({
      adminId: fx.admin.id,
      email: fx.admin.email,
      role: fx.admin.role || 'super_admin',
    });
    ownedImageUrl = await uploadOne(ownerToken);
  });

  after(async () => {
    await deleteListingsByIds(createdListingIds);
  });

  it('helper maps previous status to the correct next seller-edit status', () => {
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.DECLINED), LISTING_STATUS.RESUBMITTED);
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.APPROVED), LISTING_STATUS.UPDATED);
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.RESUBMITTED), LISTING_STATUS.RESUBMITTED);
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.UPDATED), LISTING_STATUS.UPDATED);
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.PENDING), null);
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.HIDDEN), null);
    assert.equal(resolveSellerEditNextStatus(LISTING_STATUS.SOLD), null);
  });

  it('new listing is pending or approved, never updated/resubmitted', async () => {
    const listing = await createListing();
    assert.ok(
      listing.status === LISTING_STATUS.PENDING || listing.status === LISTING_STATUS.APPROVED,
      `unexpected create status ${listing.status}`
    );
    assert.notEqual(listing.status, LISTING_STATUS.UPDATED);
    assert.notEqual(listing.status, LISTING_STATUS.RESUBMITTED);
  });

  it('declined listing edited by seller becomes resubmitted (new revision)', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.DECLINED);
    const res = await sellerEdit(listing.id);
    assert.ok([200, 201].includes(res.status), `edit failed ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.status, LISTING_STATUS.RESUBMITTED);
    assert.notEqual(res.data.listing.id, listing.id);
    createdListingIds.push(res.data.listing.id);

    const parent = await pool.query('SELECT status FROM listings WHERE id = $1', [listing.id]);
    assert.equal(parent.rows[0].status, LISTING_STATUS.DECLINED);
  });

  it('approved listing edited by seller becomes updated on the same row', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    const res = await sellerEdit(listing.id);
    assert.ok([200, 201].includes(res.status), `edit failed ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.status, LISTING_STATUS.UPDATED);
    assert.equal(res.data.listing.id, listing.id);

    const publicDetail = await api('GET', `/listings/${listing.id}`, {});
    assert.equal(publicDetail.status, 404, 'updated listing must not be public');
  });

  it('admin can approve a resubmitted listing', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.DECLINED);
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    const approve = await api('POST', `/admin/listings/${edited.data.listing.id}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approve.status), `approve failed ${approve.status}`);
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);
  });

  it('admin can approve an updated listing', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    const edited = await sellerEdit(listing.id);
    assert.equal(edited.data.listing.status, LISTING_STATUS.UPDATED);
    const approve = await api('POST', `/admin/listings/${listing.id}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approve.status), `approve failed ${approve.status}`);
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);
  });

  it('admin can decline a resubmitted listing', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.DECLINED);
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    const decline = await api('POST', `/admin/listings/${edited.data.listing.id}/decline`, {
      token: staffToken,
      body: { reason: 'Still incomplete' },
    });
    assert.ok([200, 201].includes(decline.status), `decline failed ${decline.status}`);
    assert.equal(decline.data.listing.status, LISTING_STATUS.DECLINED);
  });

  it('admin can decline an updated listing', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    await sellerEdit(listing.id);
    const decline = await api('POST', `/admin/listings/${listing.id}/decline`, {
      token: staffToken,
      body: { reason: 'Price mismatch' },
    });
    assert.ok([200, 201].includes(decline.status), `decline failed ${decline.status}`);
    assert.equal(decline.data.listing.status, LISTING_STATUS.DECLINED);
  });

  it('declined after updated → seller edit is resubmitted, not updated', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    const updated = await sellerEdit(listing.id, { description: 'first approved edit' });
    assert.equal(updated.data.listing.status, LISTING_STATUS.UPDATED);

    const decline = await api('POST', `/admin/listings/${listing.id}/decline`, {
      token: staffToken,
      body: { reason: 'Needs correction' },
    });
    assert.equal(decline.data.listing.status, LISTING_STATUS.DECLINED);

    const again = await sellerEdit(listing.id, { description: 'after decline' });
    assert.ok([200, 201].includes(again.status), `second edit failed ${again.status}`);
    assert.equal(again.data.listing.status, LISTING_STATUS.RESUBMITTED);
    createdListingIds.push(again.data.listing.id);
  });

  it('approved after updated → seller edit is updated again', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    await sellerEdit(listing.id, { description: 'cycle 1' });
    const approve = await api('POST', `/admin/listings/${listing.id}/approve`, {
      token: staffToken,
    });
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);
    const again = await sellerEdit(listing.id, { description: 'cycle 2' });
    assert.equal(again.data.listing.status, LISTING_STATUS.UPDATED);
    assert.equal(again.data.listing.id, listing.id);
  });

  it('admin Resubmitted filter returns only resubmitted', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.DECLINED);
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    const res = await adminList({ status: 'resubmitted' });
    assert.ok((res.data.items || []).every((row) => row.status === 'resubmitted'));
    assert.ok((res.data.items || []).some((row) => row.id === edited.data.listing.id));
    assert.equal(
      (res.data.items || []).some((row) => row.status === 'updated'),
      false
    );
  });

  it('admin Updated filter returns only updated', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    await sellerEdit(listing.id);
    const res = await adminList({ status: 'updated' });
    assert.ok((res.data.items || []).every((row) => row.status === 'updated'));
    assert.ok((res.data.items || []).some((row) => row.id === listing.id));
    assert.equal(
      (res.data.items || []).some((row) => row.status === 'resubmitted'),
      false
    );
  });

  it('All statuses includes updated listings and keeps created_at sort', async () => {
    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);
    await sellerEdit(listing.id);

    const all = await adminList({ status: 'all', limit: 100 });
    const row = (all.data.items || []).find((item) => item.id === listing.id);
    assert.ok(row, 'updated listing must appear under All statuses');
    assert.equal(row.status, LISTING_STATUS.UPDATED);

    const approve = await api('POST', `/admin/listings/${listing.id}/approve`, {
      token: staffToken,
    });
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);
    const after = await adminList({ limit: 20 });
    assert.ok(
      (after.data.items || []).some((item) => item.id === listing.id),
      'approving an updated listing must not drop it from All statuses page 1'
    );
  });

  it('approved-edit snapshot is not a second current listing in Admin Listings', async () => {
    const before = await adminList({ limit: 1 });
    const beforeCount = before.data.pagination.totalItems;

    const listing = await createListing();
    await setStatus(listing.id, LISTING_STATUS.APPROVED);

    const afterCreate = await adminList({ limit: 1 });
    assert.equal(afterCreate.data.pagination.totalItems, beforeCount + 1);

    const edited = await sellerEdit(listing.id, { price: 199 });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.listing.id, listing.id);
    assert.equal(edited.data.listing.status, LISTING_STATUS.UPDATED);
    const snapshotId = edited.data.listing.previous_listing_id;
    assert.ok(snapshotId);
    createdListingIds.push(snapshotId);

    const snapshotRow = await pool.query('SELECT status FROM listings WHERE id = $1', [snapshotId]);
    assert.equal(snapshotRow.rows[0].status, LISTING_STATUS.APPROVED);

    const afterEdit = await adminList({ status: 'all', limit: 100 });
    const idsAfterEdit = (afterEdit.data.items || []).map((row) => row.id);
    assert.equal(idsAfterEdit.includes(listing.id), true);
    assert.equal(idsAfterEdit.includes(snapshotId), false);
    assert.equal(afterEdit.data.pagination.totalItems, beforeCount + 1);

    const approvedFilter = await adminList({ status: 'approved', limit: 100 });
    const approvedIds = (approvedFilter.data.items || []).map((row) => row.id);
    assert.equal(approvedIds.includes(snapshotId), false);
    assert.equal(approvedIds.includes(listing.id), false);

    const updatedFilter = await adminList({ status: 'updated', limit: 100 });
    const updatedIds = (updatedFilter.data.items || []).map((row) => row.id);
    assert.equal(updatedIds.includes(listing.id), true);
    assert.equal(updatedIds.includes(snapshotId), false);

    const approve = await api('POST', `/admin/listings/${listing.id}/approve`, {
      token: staffToken,
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.data.listing.status, LISTING_STATUS.APPROVED);

    const afterApprove = await adminList({ status: 'all', limit: 100 });
    const idsAfterApprove = (afterApprove.data.items || []).map((row) => row.id);
    assert.equal(idsAfterApprove.includes(listing.id), true);
    assert.equal(idsAfterApprove.includes(snapshotId), false);
    assert.equal(afterApprove.data.pagination.totalItems, beforeCount + 1);

    const updatedAfter = await adminList({ status: 'updated', limit: 100 });
    assert.equal((updatedAfter.data.items || []).some((row) => row.id === listing.id), false);
    assert.equal((updatedAfter.data.items || []).some((row) => row.id === snapshotId), false);

    const approvedAfter = await adminList({ status: 'approved', limit: 100 });
    assert.equal((approvedAfter.data.items || []).some((row) => row.id === listing.id), true);
    assert.equal((approvedAfter.data.items || []).some((row) => row.id === snapshotId), false);

    const liveDetail = await api('GET', `/admin/listings/${listing.id}`, { token: staffToken });
    assert.equal(liveDetail.status, 200);
    const history = liveDetail.data.listing.revision_history || [];
    const liveHist = history.find((h) => h.id === listing.id);
    const snapHist = history.find((h) => h.id === snapshotId);
    assert.ok(liveHist);
    assert.ok(snapHist);
    assert.equal(liveHist.is_current, true);
    assert.equal(snapHist.is_current, false);
    assert.equal(snapHist.is_historical_snapshot, true);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const historyRes = await api(
      'GET',
      `/admin/moderation-history?type=updated&month=${month}&limit=100`,
      { token: staffToken }
    );
    assert.equal(historyRes.status, 200);
    const event = (historyRes.data.items || []).find((row) => row.listing_id === listing.id);
    assert.ok(event, 'Updates (Month) must keep the update event after approval');
    assert.equal(event.previous_listing_id, snapshotId);

    const publicList = await api('GET', '/listings?status=approved&limit=100', {});
    assert.equal(publicList.status, 200);
    const publicIds = (publicList.data.listings || publicList.data.items || []).map((row) => row.id);
    assert.equal(publicIds.includes(listing.id), true);
    assert.equal(publicIds.includes(snapshotId), false);

    const guestSnapshot = await api('GET', `/listings/${snapshotId}`, {});
    assert.equal(guestSnapshot.status, 404);

    const myList = await api('GET', '/listings/user/my', { token: ownerToken });
    const myIds = (myList.data.listings || []).map((row) => row.id);
    assert.equal(myIds.includes(listing.id), true);
    assert.equal(myIds.includes(snapshotId), false);

    if (fx.stranger) {
      const strangerToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
      const fav = await api('POST', `/favorites/${snapshotId}`, { token: strangerToken });
      assert.ok([400, 404].includes(fav.status), `snapshot favorite should fail, got ${fav.status}`);
      const favList = await api('GET', '/favorites', { token: strangerToken });
      const favIds = (favList.data.listings || []).map((row) => row.id);
      assert.equal(favIds.includes(snapshotId), false);
    }
  });

  it('existing approved/pending/sold/hidden statuses still validate', async () => {
    const allowed = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'listings'::regclass
         AND conname = 'listings_status_check'`
    );
    assert.ok(allowed.rows[0], 'listings_status_check must exist');
    const def = allowed.rows[0].def;
    for (const status of ['pending', 'resubmitted', 'updated', 'approved', 'declined', 'sold', 'hidden', 'deleted']) {
      assert.ok(def.includes(`'${status}'`), `CHECK missing ${status}: ${def}`);
    }
  });
});
