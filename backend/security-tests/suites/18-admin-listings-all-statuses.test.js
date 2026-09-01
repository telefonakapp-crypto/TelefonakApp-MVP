'use strict';

/**
 * Admin Listings "All statuses" must not act as a pending-only queue.
 * Approving a listing must leave it visible on the default All statuses page.
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

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'admin-all.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, 'upload fixture should succeed');
  assert.ok(res.data?.image_urls?.[0]);
  return res.data.image_urls[0];
}

function idsOnPage(res) {
  return (res.data?.items || []).map((row) => row.id);
}

describe('18 — Admin listings All statuses after approve', () => {
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

  async function adminList(query = {}) {
    const params = new URLSearchParams();
    params.set('page', String(query.page ?? 1));
    params.set('limit', String(query.limit ?? 20));
    if (query.status) params.set('status', query.status);
    const res = await api('GET', `/admin/listings?${params.toString()}`, {
      token: staffToken,
    });
    assert.equal(res.status, 200, `admin list failed ${res.status}`);
    return res;
  }

  async function findAcrossPages(listingId, extra = {}) {
    const first = await adminList({ page: 1, limit: 100, ...extra });
    const totalPages = first.data.pagination.totalPages || 1;
    const all = [...(first.data.items || [])];
    for (let page = 2; page <= totalPages; page++) {
      const next = await adminList({ page, limit: 100, ...extra });
      all.push(...(next.data.items || []));
    }
    return {
      row: all.find((item) => item.id === listingId) || null,
      totalItems: first.data.pagination.totalItems,
    };
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

  it('approve keeps the listing on All statuses page 1 and updates filters', async () => {
    const created = trackListing(
      await api('POST', '/listings', {
        token: ownerToken,
        body: {
          model_id: fx.catalog.model_id,
          model_storage_id: fx.catalog.model_storage_id,
          model_color_id: fx.catalog.model_color_id,
          sim_configuration_id: fx.catalog.sim_configuration_id,
          condition_id: fx.catalog.condition_id,
          price: 211,
          description: 'Admin All statuses approve regression',
          images: [ownedImageUrl],
        },
      })
    );
    assert.ok([200, 201].includes(created.status), `create failed ${created.status}`);
    const listingId = created.data.listing.id;
    await pool.query(
      `UPDATE listings
       SET status = 'pending',
           approved_or_rejected_at = NULL,
           moderated_by_admin_id = NULL,
           decline_reason = NULL
       WHERE id = $1`,
      [listingId]
    );

    const beforeAll = await adminList({ page: 1, limit: 20 });
    assert.ok(
      idsOnPage(beforeAll).includes(listingId),
      'pending listing must appear on All statuses page 1'
    );
    const beforeAllCount = beforeAll.data.pagination.totalItems;

    const beforePending = await adminList({ page: 1, limit: 20, status: 'pending' });
    assert.ok(idsOnPage(beforePending).includes(listingId));
    const beforePendingCount = beforePending.data.pagination.totalItems;

    const beforeApproved = await adminList({ page: 1, limit: 20, status: 'approved' });
    assert.equal(idsOnPage(beforeApproved).includes(listingId), false);
    const beforeApprovedCount = beforeApproved.data.pagination.totalItems;

    const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
      token: staffToken,
    });
    assert.ok([200, 201].includes(approve.status), `approve failed ${approve.status}`);

    const afterAll = await adminList({ page: 1, limit: 20 });
    assert.ok(
      idsOnPage(afterAll).includes(listingId),
      'approved listing must remain on All statuses page 1'
    );
    assert.equal(afterAll.data.pagination.totalItems, beforeAllCount);

    const afterAllAlias = await adminList({ page: 1, limit: 20, status: 'all' });
    assert.ok(idsOnPage(afterAllAlias).includes(listingId));
    assert.equal(afterAllAlias.data.pagination.totalItems, beforeAllCount);

    const afterApproved = await adminList({ page: 1, limit: 20, status: 'approved' });
    assert.ok(idsOnPage(afterApproved).includes(listingId));
    assert.equal(afterApproved.data.pagination.totalItems, beforeApprovedCount + 1);

    const afterPending = await adminList({ page: 1, limit: 20, status: 'pending' });
    assert.equal(idsOnPage(afterPending).includes(listingId), false);
    assert.equal(afterPending.data.pagination.totalItems, beforePendingCount - 1);
  });

  it('existing approved listing is included under All statuses', async () => {
    assert.ok(fx.listing, 'Need an existing approved listing');
    const found = await findAcrossPages(fx.listing.id);
    assert.ok(found.row, 'existing approved listing must appear under All statuses');
    assert.equal(found.row.status, 'approved');
  });

  it('individual status filters only return that status', async () => {
    for (const status of ['pending', 'resubmitted', 'updated', 'approved', 'declined', 'sold', 'hidden']) {
      const res = await adminList({ page: 1, limit: 50, status });
      assert.ok(
        (res.data.items || []).every((row) => row.status === status),
        `${status} filter leaked another status`
      );
    }
  });
});
