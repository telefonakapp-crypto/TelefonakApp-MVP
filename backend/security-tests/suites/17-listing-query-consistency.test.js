'use strict';

/**
 * Phase 2G — Listing query consistency for optional watch storage,
 * official finishes, and null watch attributes.
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

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'p2g.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, 'upload fixture should succeed');
  assert.ok(res.data?.image_urls?.[0]);
  return res.data.image_urls[0];
}

async function catalogModel(brandName, modelName) {
  const result = await pool.query(
    `SELECT m.id
     FROM models m
     JOIN brands b ON b.id = m.brand_id
     JOIN categories c ON c.id = m.category_id
     WHERE b.name = $1
       AND m.name = $2
       AND c.slug = 'smartwatches'`,
    [brandName, modelName]
  );
  assert.ok(result.rows[0], `expected ${brandName} ${modelName}`);
  return result.rows[0].id;
}

describe('17 — Listing query consistency (Phase 2G)', () => {
  let fx;
  let ownerToken;
  let strangerToken;
  let series8;
  let graphite;
  let size45;
  let gpsCellular;
  let storage32;
  let ownedImageUrl;
  const createdListingIds = [];

  function trackListing(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  async function approve(id) {
    await pool.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [id]);
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog, 'Need phone catalog fixture');
    assert.ok(fx.owner && fx.stranger, 'Need two users');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    strangerToken = customerToken(fx.stranger.id, fx.stranger.phone_number);

    const modelId = await catalogModel('Apple', 'Apple Watch Series 8');
    const opts = await api('GET', `/models/${modelId}/watch-options`);
    assert.equal(opts.status, 200);
    series8 = opts.data;
    size45 = (series8.sizes || []).find((row) => row.label === '45mm');
    gpsCellular = (series8.connectivities || []).find((row) => row.name_en === 'GPS + Cellular');
    storage32 = (series8.storages || []).find((row) => Number(row.capacity_gb) === 32);
    graphite = (series8.colors || []).find(
      (row) => row.display_name === 'Graphite (PVD)' || row.name === 'Graphite'
    );
    assert.ok(size45 && gpsCellular && storage32 && graphite);
    ownedImageUrl = await uploadOne(ownerToken);
  });

  after(async () => {
    await deleteListingsByIds(createdListingIds);
  });

  async function createWatch(extra = {}) {
    const body = {
      model_id: series8.model_id,
      model_watch_case_size_id: size45.id,
      model_watch_connectivity_id: gpsCellular.id,
      model_storage_id: storage32.id,
      model_color_id: graphite.id,
      condition_id: fx.catalog.condition_id,
      price: 250,
      description: 'Phase 2G watch listing',
      images: extra.images || [ownedImageUrl],
      ...extra,
    };
    const res = trackListing(await api('POST', '/listings', { token: ownerToken, body }));
    assert.ok([200, 201].includes(res.status), `create failed ${res.status} ${JSON.stringify(res.data)}`);
    return res.data.listing;
  }

  it('smartwatch listing with storage appears in search', async () => {
    const listing = await createWatch();
    await approve(listing.id);
    const res = await api(
      'GET',
      `/listings?status=approved&model_id=${series8.model_id}&limit=50`
    );
    assert.equal(res.status, 200);
    assert.ok((res.data.listings || []).some((row) => row.id === listing.id));
    const row = res.data.listings.find((item) => item.id === listing.id);
    assert.equal(Number(row.capacity_gb), 32);
  });

  it('smartwatch listing with NULL storage appears in search', async () => {
    const listing = await createWatch();
    await pool.query(
      `UPDATE listings SET storage_id = NULL, model_storage_id = NULL WHERE id = $1`,
      [listing.id]
    );
    await approve(listing.id);
    const res = await api(
      'GET',
      `/listings?status=approved&model_id=${series8.model_id}&limit=50`
    );
    assert.equal(res.status, 200);
    const row = (res.data.listings || []).find((item) => item.id === listing.id);
    assert.ok(row, 'null-storage watch must remain in search');
    assert.equal(row.capacity_gb, null);
  });

  it('smartwatch listing with NULL storage appears in favorites', async () => {
    const listing = await createWatch();
    await pool.query(
      `UPDATE listings SET storage_id = NULL, model_storage_id = NULL WHERE id = $1`,
      [listing.id]
    );
    await approve(listing.id);

    const fav = await api('POST', `/favorites/${listing.id}`, { token: strangerToken });
    assert.ok([200, 201].includes(fav.status), `favorite failed ${fav.status}`);

    const list = await api('GET', '/favorites', { token: strangerToken });
    assert.equal(list.status, 200);
    const row = (list.data.listings || []).find((item) => item.id === listing.id);
    assert.ok(row, 'null-storage watch must appear in favorites');
    assert.equal(row.capacity_gb, null);
  });

  it('smartwatch listing returns case_size_label and watch_connectivity_name', async () => {
    const listing = await createWatch();
    await approve(listing.id);
    const res = await api('GET', `/listings/${listing.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.listing.case_size_label, '45mm');
    assert.equal(res.data.listing.watch_connectivity_name, 'GPS + Cellular');
  });

  it('smartwatch listing does not require or invent SIM', async () => {
    const listing = await createWatch();
    assert.equal(listing.sim_configuration_id, null);
    assert.equal(listing.sim_configuration_name, null);
    const res = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.listing.sim_configuration_id, null);
    assert.equal(res.data.listing.sim_configuration_name, null);
  });

  it('phone listing still requires SIM and returns storage', async () => {
    const missingSim = await api('POST', '/listings', {
      token: ownerToken,
      body: {
        model_id: fx.catalog.model_id,
        model_storage_id: fx.catalog.model_storage_id,
        model_color_id: fx.catalog.model_color_id,
        condition_id: fx.catalog.condition_id,
        price: 199,
        description: 'Phase 2G phone missing SIM',
        images: [ownedImageUrl],
      },
    });
    assert.equal(missingSim.status, 400);

    const created = trackListing(
      await api('POST', '/listings', {
        token: ownerToken,
        body: {
          model_id: fx.catalog.model_id,
          model_storage_id: fx.catalog.model_storage_id,
          model_color_id: fx.catalog.model_color_id,
          sim_configuration_id: fx.catalog.sim_configuration_id,
          condition_id: fx.catalog.condition_id,
          price: 199,
          description: 'Phase 2G phone listing',
          images: [ownedImageUrl],
        },
      })
    );
    assert.ok([200, 201].includes(created.status));
    await approve(created.data.listing.id);
    const detail = await api('GET', `/listings/${created.data.listing.id}`);
    assert.equal(detail.status, 200);
    assert.ok(detail.data.listing.sim_configuration_id);
    assert.ok(detail.data.listing.capacity_gb != null);
    const search = await api(
      'GET',
      `/listings?status=approved&model_id=${fx.catalog.model_id}&limit=50`
    );
    assert.ok((search.data.listings || []).some((row) => row.id === created.data.listing.id));
  });

  it('official smartwatch color/finish is preserved', async () => {
    const listing = await createWatch();
    const res = await api('GET', `/listings/${listing.id}`, { token: ownerToken });
    assert.equal(res.status, 200);
    assert.equal(res.data.listing.color_display_name, 'Graphite (PVD)');
  });

  it('smartwatch with NULL case size or connectivity does not crash', async () => {
    const listing = await createWatch();
    await pool.query(
      `UPDATE listings
       SET model_watch_case_size_id = NULL,
           model_watch_connectivity_id = NULL
       WHERE id = $1`,
      [listing.id]
    );
    await approve(listing.id);
    const detail = await api('GET', `/listings/${listing.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.listing.case_size_label, null);
    assert.equal(detail.data.listing.watch_connectivity_name, null);

    const search = await api(
      'GET',
      `/listings?status=approved&model_id=${series8.model_id}&limit=50`
    );
    assert.equal(search.status, 200);
    assert.ok((search.data.listings || []).some((row) => row.id === listing.id));
  });
});
