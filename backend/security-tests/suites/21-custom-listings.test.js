'use strict';

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

const UNIQUE = `ZedCustom${Date.now()}`;

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'custom.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, `upload failed ${res.status}`);
  return res.data.image_urls[0];
}

describe('21 — Custom (Other) listings', () => {
  let fx;
  let ownerToken;
  let strangerToken;
  let staffToken;
  let ownedImageUrl;
  let phonesCategoryId;
  let watchesCategoryId;
  const createdListingIds = [];

  function track(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  function customPhonePayload(overrides = {}) {
    return {
      listing_source: 'custom',
      category_id: phonesCategoryId,
      custom_brand_name: `${UNIQUE}Brand`,
      custom_model_name: `${UNIQUE}Phone`,
      custom_storage: '256 GB',
      custom_color_name: 'White',
      custom_sim_configuration: 'Dual SIM',
      condition_id: fx.catalog.condition_id,
      battery_percentage: 95,
      price: 199,
      description: 'Custom phone listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  function customWatchPayload(overrides = {}) {
    return {
      listing_source: 'custom',
      category_id: watchesCategoryId,
      custom_brand_name: `${UNIQUE}WatchBrand`,
      custom_model_name: `${UNIQUE}Watch`,
      custom_case_size: '45mm',
      custom_connectivity: 'GPS + Cellular',
      custom_storage: '32 GB',
      custom_color_name: 'Midnight',
      condition_id: fx.catalog.condition_id,
      battery_percentage: 92,
      price: 249,
      description: 'Custom watch listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  function catalogPhonePayload(overrides = {}) {
    return {
      listing_source: 'catalog',
      model_id: fx.catalog.model_id,
      model_storage_id: fx.catalog.model_storage_id,
      model_color_id: fx.catalog.model_color_id,
      sim_configuration_id: fx.catalog.sim_configuration_id,
      condition_id: fx.catalog.condition_id,
      battery_percentage: 90,
      price: 310,
      description: 'Catalog regression listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog, 'Need phone catalog fixture');
    assert.ok(fx.owner && fx.stranger && fx.admin, 'Need users and admin');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    strangerToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
    staffToken = adminToken({
      adminId: fx.admin.id,
      email: fx.admin.email,
      role: fx.admin.role || 'super_admin',
    });
    ownedImageUrl = await uploadOne(ownerToken);
    const cats = await pool.query(
      `SELECT id, slug FROM categories WHERE slug IN ('phones', 'smartwatches')`
    );
    phonesCategoryId = cats.rows.find((row) => row.slug === 'phones')?.id;
    watchesCategoryId = cats.rows.find((row) => row.slug === 'smartwatches')?.id;
    assert.ok(phonesCategoryId && watchesCategoryId, 'Need phones and smartwatches categories');
  });

  after(async () => {
    await deleteListingsByIds(createdListingIds);
  });

  it('creates a valid custom phone listing and persists custom fields', async () => {
    const res = track(
      await api('POST', '/listings', { token: ownerToken, body: customPhonePayload() })
    );
    assert.ok([200, 201].includes(res.status), `create phone ${res.status} ${JSON.stringify(res.data)}`);
    const listing = res.data.listing;
    assert.equal(listing.listing_source, 'custom');
    assert.equal(listing.model_id, null);
    assert.equal(listing.brand_name, `${UNIQUE}Brand`);
    assert.equal(listing.model_name, `${UNIQUE}Phone`);
    assert.equal(listing.storage_display, '256 GB');
    assert.equal(listing.color_display_name, 'White');
    assert.equal(listing.sim_configuration_name, 'Dual SIM');

    const row = await pool.query(
      `SELECT listing_source, model_id, custom_brand_name, custom_model_name
       FROM listings WHERE id = $1`,
      [listing.id]
    );
    assert.equal(row.rows[0].listing_source, 'custom');
    assert.equal(row.rows[0].model_id, null);
    assert.equal(row.rows[0].custom_brand_name, `${UNIQUE}Brand`);
  });

  it('creates a valid custom smartwatch listing', async () => {
    const res = track(
      await api('POST', '/listings', { token: ownerToken, body: customWatchPayload() })
    );
    assert.ok([200, 201].includes(res.status), `create watch ${res.status} ${JSON.stringify(res.data)}`);
    const listing = res.data.listing;
    assert.equal(listing.listing_source, 'custom');
    assert.equal(listing.case_size_label, '45mm');
    assert.equal(listing.watch_connectivity_name, 'GPS + Cellular');
    assert.equal(listing.sim_configuration_name, null);
  });

  it('rejects custom listings that mix catalog IDs or omit required fields', async () => {
    const mixed = await api('POST', '/listings', {
      token: ownerToken,
      body: customPhonePayload({ model_id: fx.catalog.model_id }),
    });
    assert.equal(mixed.status, 400);

    const missingBrand = await api('POST', '/listings', {
      token: ownerToken,
      body: customPhonePayload({ custom_brand_name: '   ' }),
    });
    assert.equal(missingBrand.status, 400);

    const watchSim = await api('POST', '/listings', {
      token: ownerToken,
      body: customWatchPayload({ custom_sim_configuration: 'Dual SIM' }),
    });
    assert.equal(watchSim.status, 400);

    const spoofed = await api('POST', '/listings', {
      token: ownerToken,
      body: customPhonePayload({ category_id: 999999 }),
    });
    assert.equal(spoofed.status, 400);

    const catalogMixed = await api('POST', '/listings', {
      token: ownerToken,
      body: catalogPhonePayload({ custom_brand_name: 'Nope' }),
    });
    assert.equal(catalogMixed.status, 400);
  });

  it('keeps catalog phone creation unchanged', async () => {
    const res = track(
      await api('POST', '/listings', { token: ownerToken, body: catalogPhonePayload() })
    );
    assert.ok([200, 201].includes(res.status), `catalog create ${res.status}`);
    assert.equal(res.data.listing.listing_source, 'catalog');
    assert.ok(res.data.listing.model_id);
    assert.equal(res.data.listing.custom_brand_name, null);
  });

  it('approves a custom listing into marketplace, my listings, search, favorites, and admin', async () => {
    const created = track(
      await api('POST', '/listings', { token: ownerToken, body: customPhonePayload({ price: 175 }) })
    );
    assert.ok([200, 201].includes(created.status));
    const listingId = created.data.listing.id;

    const approve = await api('POST', `/admin/listings/${listingId}/approve`, { token: staffToken });
    assert.ok([200, 201].includes(approve.status), `approve ${approve.status}`);

    const market = await api('GET', `/listings?status=approved&search=${UNIQUE}Brand&limit=50`);
    assert.equal(market.status, 200);
    assert.ok(
      (market.data.listings || []).some((row) => row.id === listingId),
      'custom listing missing from marketplace search'
    );

    const mine = await api('GET', '/listings/user/my', { token: ownerToken });
    assert.equal(mine.status, 200);
    assert.ok((mine.data.listings || []).some((row) => row.id === listingId));

    const detail = await api('GET', `/listings/${listingId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.listing.brand_name, `${UNIQUE}Brand`);
    assert.equal(detail.data.listing.custom_brand_name, `${UNIQUE}Brand`);

    const fav = await api('POST', `/favorites/${listingId}`, { token: strangerToken });
    assert.ok([200, 201].includes(fav.status), `favorite ${fav.status}`);
    const favList = await api('GET', '/favorites', { token: strangerToken });
    assert.equal(favList.status, 200);
    assert.ok((favList.data.listings || []).some((row) => row.id === listingId));

    const adminList = await api('GET', '/admin/listings?status=all&limit=100', { token: staffToken });
    assert.equal(adminList.status, 200);
    assert.ok((adminList.data.items || []).some((row) => row.id === listingId));

    const adminDetail = await api('GET', `/admin/listings/${listingId}`, { token: staffToken });
    assert.equal(adminDetail.status, 200);
    assert.equal(adminDetail.data.listing.brand_name, `${UNIQUE}Brand`);
  });

  it('edits a custom listing, preserves resubmit/update snapshots, and records history', async () => {
    const created = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: customPhonePayload({ custom_color_name: 'Black', price: 150 }),
      })
    );
    const listingId = created.data.listing.id;

    await pool.query(
      `UPDATE listings
       SET status = 'declined',
           decline_reason = 'Needs photos',
           approved_or_rejected_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [listingId]
    );

    const resub = track(
      await api('PUT', `/listings/${listingId}`, {
        token: ownerToken,
        body: customPhonePayload({ custom_color_name: 'Blue', price: 160 }),
      })
    );
    assert.ok([200, 201].includes(resub.status), `resubmit ${resub.status} ${JSON.stringify(resub.data)}`);
    const liveId = resub.data.listing.id;
    assert.equal(resub.data.listing.custom_color_name, 'Blue');

    const parent = await pool.query(
      `SELECT custom_color_name, listing_source FROM listings WHERE id = $1`,
      [listingId]
    );
    assert.equal(parent.rows[0].custom_color_name, 'Black');
    assert.equal(parent.rows[0].listing_source, 'custom');

    const approve = await api('POST', `/admin/listings/${liveId}/approve`, { token: staffToken });
    assert.ok([200, 201].includes(approve.status));

    const updated = await api('PUT', `/listings/${liveId}`, {
      token: ownerToken,
      body: customPhonePayload({ custom_color_name: 'Blue', price: 180 }),
    });
    assert.ok([200, 201].includes(updated.status), `update ${updated.status}`);
    const snapshotId = updated.data.listing.previous_listing_id;
    assert.ok(snapshotId, 'expected previous listing snapshot');

    const snapshot = await pool.query(
      `SELECT price, custom_brand_name, custom_color_name, listing_source
       FROM listings WHERE id = $1`,
      [snapshotId]
    );
    assert.equal(Number(snapshot.rows[0].price), 160);
    assert.equal(snapshot.rows[0].custom_brand_name, `${UNIQUE}Brand`);
    assert.equal(snapshot.rows[0].custom_color_name, 'Blue');
    assert.equal(snapshot.rows[0].listing_source, 'custom');

    const history = await api('GET', '/admin/moderation-history?type=updated&limit=50', {
      token: staffToken,
    });
    assert.equal(history.status, 200);
    assert.ok(
      (history.data.items || []).some((row) => row.listing_id === liveId || row.listing_id === updated.data.listing.id)
    );
  });
});
