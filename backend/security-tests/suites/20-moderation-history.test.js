'use strict';

const fs = require('fs');
const path = require('path');
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
    'history.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200);
  return res.data.image_urls[0];
}

describe('20 — Moderation history events', () => {
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
      price: 300,
      description: 'Moderation history regression',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  async function createListing() {
    const res = trackListing(
      await api('POST', '/listings', { token: ownerToken, body: phonePayload() })
    );
    assert.ok([200, 201].includes(res.status), `create failed ${res.status}`);
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
      price: extra.price || 280,
      description: extra.description || 'Seller edited listing',
    });
    delete body.images;
    return api('PUT', `/listings/${listingId}`, { token: ownerToken, body });
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog && fx.owner && fx.admin);
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

  it('declined → resubmitted creates a historical resubmission event', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    assert.equal(edited.data.listing.status, 'resubmitted');

    const events = await pool.query(
      `SELECT * FROM listing_moderation_events
       WHERE listing_id = $1 AND event_type = 'resubmitted'`,
      [edited.data.listing.id]
    );
    assert.equal(events.rows.length, 1);
    assert.equal(events.rows[0].previous_listing_id, listing.id);
  });

  it('resubmitted → approved does not delete the historical resubmission event', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    const approve = await api('POST', `/admin/listings/${edited.data.listing.id}/approve`, {
      token: staffToken,
    });
    assert.equal(approve.data.listing.status, 'approved');
    const events = await pool.query(
      `SELECT * FROM listing_moderation_events
       WHERE listing_id = $1 AND event_type = 'resubmitted'`,
      [edited.data.listing.id]
    );
    assert.equal(events.rows.length, 1);
  });

  it('resubmitted → declined does not delete the historical resubmission event', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    await api('POST', `/admin/listings/${edited.data.listing.id}/decline`, {
      token: staffToken,
      body: { reason: 'Still incomplete' },
    });
    const events = await pool.query(
      `SELECT COUNT(*)::int AS n FROM listing_moderation_events
       WHERE listing_id = $1 AND event_type = 'resubmitted'`,
      [edited.data.listing.id]
    );
    assert.equal(events.rows[0].n, 1);
  });

  it('resubmission appears in the current month history API', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const res = await api(
      'GET',
      `/admin/moderation-history?type=resubmitted&month=${month}&limit=100`,
      { token: staffToken }
    );
    assert.equal(res.status, 200);
    assert.ok((res.data.items || []).some((row) => row.listing_id === edited.data.listing.id));
  });

  it('resubmission from a previous month does not appear in another month', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    await pool.query(
      `UPDATE listing_moderation_events
       SET occurred_at = TIMESTAMP '2024-01-15 12:00:00'
       WHERE listing_id = $1 AND event_type = 'resubmitted'`,
      [edited.data.listing.id]
    );
    const res = await api(
      'GET',
      '/admin/moderation-history?type=resubmitted&month=2024-02&limit=100',
      { token: staffToken }
    );
    assert.equal(res.status, 200);
    assert.equal(
      (res.data.items || []).some((row) => row.listing_id === edited.data.listing.id),
      false
    );
    const jan = await api(
      'GET',
      '/admin/moderation-history?type=resubmitted&month=2024-01&limit=100',
      { token: staffToken }
    );
    assert.ok((jan.data.items || []).some((row) => row.listing_id === edited.data.listing.id));
  });

  it('Resubmissions (Month) dashboard count is based on events, not current status', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const edited = await sellerEdit(listing.id);
    createdListingIds.push(edited.data.listing.id);
    await api('POST', `/admin/listings/${edited.data.listing.id}/approve`, {
      token: staffToken,
    });
    const before = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM listing_moderation_events
       WHERE event_type = 'resubmitted'
         AND occurred_at >= date_trunc('month', CURRENT_TIMESTAMP)
         AND occurred_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'`
    );
    const dash = await api('GET', '/admin/dashboard', { token: staffToken });
    assert.equal(dash.status, 200);
    assert.equal(dash.data.stats.resubmissionsReceivedThisMonth, before.rows[0].n);
    const queue = await api('GET', '/admin/listings?status=resubmitted&limit=100', {
      token: staffToken,
    });
    assert.equal(
      (queue.data.items || []).some((row) => row.id === edited.data.listing.id),
      false
    );
  });

  it('approved → updated creates a historical update event and keeps listing id', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'approved');
    const edited = await sellerEdit(listing.id, { price: 250 });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.listing.status, 'updated');
    assert.equal(edited.data.listing.id, listing.id);
    assert.ok(edited.data.listing.previous_listing_id);

    const snapshot = await pool.query('SELECT status, price FROM listings WHERE id = $1', [
      edited.data.listing.previous_listing_id,
    ]);
    assert.equal(snapshot.rows[0].status, 'approved');
    assert.equal(Number(snapshot.rows[0].price), 300);

    const events = await pool.query(
      `SELECT * FROM listing_moderation_events
       WHERE listing_id = $1 AND event_type = 'updated'`,
      [listing.id]
    );
    assert.equal(events.rows.length, 1);
  });

  it('updated → approved does not delete the historical update event', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'approved');
    await sellerEdit(listing.id, { price: 240 });
    await api('POST', `/admin/listings/${listing.id}/approve`, { token: staffToken });
    const events = await pool.query(
      `SELECT COUNT(*)::int AS n FROM listing_moderation_events
       WHERE listing_id = $1 AND event_type = 'updated'`,
      [listing.id]
    );
    assert.equal(events.rows[0].n, 1);
    const live = await pool.query('SELECT status FROM listings WHERE id = $1', [listing.id]);
    assert.equal(live.rows[0].status, 'approved');
  });

  it('updated → declined does not delete the historical update event', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'approved');
    await sellerEdit(listing.id, { price: 230 });
    await api('POST', `/admin/listings/${listing.id}/decline`, {
      token: staffToken,
      body: { reason: 'Price issue' },
    });
    const events = await pool.query(
      `SELECT COUNT(*)::int AS n FROM listing_moderation_events
       WHERE listing_id = $1 AND event_type = 'updated'`,
      [listing.id]
    );
    assert.equal(events.rows[0].n, 1);
  });

  it('update appears in the current month Updates history', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'approved');
    await sellerEdit(listing.id, { price: 220 });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const res = await api(
      'GET',
      `/admin/moderation-history?type=updated&month=${month}&limit=100`,
      { token: staffToken }
    );
    assert.equal(res.status, 200);
    assert.ok((res.data.items || []).some((row) => row.listing_id === listing.id));
  });

  it('Updates (Month) count is based on historical events, not current updated queue', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'approved');
    await sellerEdit(listing.id, { price: 210 });
    await api('POST', `/admin/listings/${listing.id}/approve`, { token: staffToken });
    const eventCount = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM listing_moderation_events
       WHERE event_type = 'updated'
         AND occurred_at >= date_trunc('month', CURRENT_TIMESTAMP)
         AND occurred_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'`
    );
    const dash = await api('GET', '/admin/dashboard', { token: staffToken });
    assert.equal(dash.data.stats.updatesReceivedThisMonth, eventCount.rows[0].n);
    const queue = await api('GET', '/admin/listings?status=updated&limit=100', {
      token: staffToken,
    });
    assert.equal((queue.data.items || []).some((row) => row.id === listing.id), false);
  });

  it('historical resubmission and update can access previous and new revisions', async () => {
    const listing = await createListing();
    await setStatus(listing.id, 'declined');
    const resub = await sellerEdit(listing.id);
    createdListingIds.push(resub.data.listing.id);
    const detail = await api('GET', `/admin/listings/${resub.data.listing.id}`, {
      token: staffToken,
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.listing.previous_listing.id, listing.id);
    assert.ok((detail.data.listing.revision_history || []).length >= 2);

    const live = await createListing();
    await setStatus(live.id, 'approved');
    const upd = await sellerEdit(live.id, { price: 200 });
    createdListingIds.push(upd.data.listing.previous_listing_id);
    const updDetail = await api('GET', `/admin/listings/${live.id}`, { token: staffToken });
    assert.ok(updDetail.data.listing.previous_listing_id);
    assert.equal(updDetail.data.listing.previous_listing.id, upd.data.listing.previous_listing_id);
    const history = updDetail.data.listing.revision_history || [];
    assert.equal(history.find((h) => h.id === live.id)?.is_current, true);
    assert.equal(
      history.find((h) => h.id === upd.data.listing.previous_listing_id)?.is_current,
      false
    );
    const listRes = await api('GET', '/admin/listings?status=all&limit=100', { token: staffToken });
    const listIds = (listRes.data.items || []).map((row) => row.id);
    assert.equal(listIds.includes(live.id), true);
    assert.equal(listIds.includes(upd.data.listing.previous_listing_id), false);
    const prev = await api(
      'GET',
      `/admin/listings/${upd.data.listing.previous_listing_id}`,
      { token: staffToken }
    );
    assert.equal(prev.status, 200);
    assert.equal(prev.data.listing.status, 'approved');
  });

  it('customer cannot access moderation history', async () => {
    const res = await api('GET', '/admin/moderation-history?type=resubmitted', {
      token: ownerToken,
    });
    assert.equal(res.status, 401);
    const anon = await api('GET', '/admin/moderation-history?type=updated');
    assert.equal(anon.status, 401);
  });

  it('dashboard cards point current status vs historical routes', () => {
    const dash = fs.readFileSync(
      path.join(__dirname, '../../../admin-web/src/pages/dashboard/DashboardPage.tsx'),
      'utf8'
    );
    assert.match(dash, /to="\/listings\?status=approved"/);
    assert.match(dash, /to="\/listings\?status=pending"/);
    assert.match(dash, /to="\/listings\?status=resubmitted"/);
    assert.match(dash, /to="\/listings\?status=updated"/);
    assert.match(dash, /to="\/listings\?status=declined"/);
    assert.match(dash, /to="\/listings\?status=sold"/);
    assert.match(dash, /to="\/moderation-history\?type=resubmitted"/);
    assert.match(dash, /to="\/moderation-history\?type=updated"/);
  });
});
