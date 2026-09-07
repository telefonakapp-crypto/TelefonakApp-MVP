'use strict';

/**
 * Phase 2B — Category-aware listing API + watch-options.
 * Uses temporary models/junctions only. Does not seed manufacturer catalog data.
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

const MODEL_A = '__p2b_watch_a__';
const MODEL_B = '__p2b_watch_b__';
const MODEL_NS = '__p2b_watch_ns__';
const MODEL_NZ = '__p2b_watch_nz__';
const SIZE_A = '__p2b_size_a__';
const SIZE_B = '__p2b_size_b__';
const SIZE_NS = '__p2b_size_ns__';

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'p2b.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, 'upload fixture should succeed');
  assert.ok(res.data?.image_urls?.[0]);
  return res.data.image_urls[0];
}

async function cleanupPhase2bFixtures() {
  const models = await pool.query(
    `SELECT id FROM models WHERE name IN ($1, $2, $3, $4)`,
    [MODEL_A, MODEL_B, MODEL_NS, MODEL_NZ]
  );
  const modelIds = models.rows.map((r) => r.id);
  if (modelIds.length > 0) {
    const listings = await pool.query(
      `SELECT id FROM listings WHERE model_id = ANY($1::int[])`,
      [modelIds]
    );
    const listingIds = listings.rows.map((r) => r.id);
    await deleteListingsByIds(listingIds);
    await pool.query(`DELETE FROM models WHERE id = ANY($1::int[])`, [modelIds]);
  }

  await pool.query(
    `DELETE FROM watch_case_sizes WHERE label IN ($1, $2, $3)`,
    [SIZE_A, SIZE_B, SIZE_NS]
  );
}

async function insertWatchModel(name, brandId, categoryId) {
  const result = await pool.query(
    `INSERT INTO models (brand_id, category_id, name, release_year)
     VALUES ($1, $2, $3, 2026)
     RETURNING id`,
    [brandId, categoryId, name]
  );
  return result.rows[0].id;
}

describe('15 — Smartwatch listing API (Phase 2B)', () => {
  let fx;
  let token;
  let phonesCatId;
  let watchesCatId;
  let catalogWatch;
  let phoneModelId;
  let watchA;
  let watchB;
  let watchNs;
  let watchNz;
  let createdListingIds = [];
  let ownedImageUrl;
  let baselineWatchListings;

  before(async () => {
    await cleanupPhase2bFixtures();
    const baseline = await pool.query(
      `SELECT COUNT(*)::int AS watch_listings
       FROM listings l
       JOIN models m ON m.id = l.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'`
    );
    baselineWatchListings = baseline.rows[0].watch_listings;
    fx = await loadFixtures();
    token = customerToken(fx.owner.id, fx.owner.phone_number);
    ownedImageUrl = await uploadOne(token);

    const cats = await pool.query(
      `SELECT id, slug FROM categories WHERE slug IN ('phones', 'smartwatches')`
    );
    phonesCatId = cats.rows.find((r) => r.slug === 'phones').id;
    watchesCatId = cats.rows.find((r) => r.slug === 'smartwatches').id;

    const watchModel = await pool.query(
      `SELECT m.id
       FROM models m
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches' AND m.name = 'Apple Watch Series 8'
       LIMIT 1`
    );
    catalogWatch = watchModel.rows[0];
    assert.ok(catalogWatch, 'expected Apple Watch Series 8 in catalog');

    const phoneModel = await pool.query(
      `SELECT m.id
       FROM models m
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'
       ORDER BY m.id
       LIMIT 1`
    );
    phoneModelId = phoneModel.rows[0].id;

    const apple = await pool.query(`SELECT id FROM brands WHERE name = 'Apple' LIMIT 1`);
    const brandId = apple.rows[0].id;

    const colors = await pool.query(`SELECT id FROM colors ORDER BY id LIMIT 2`);
    assert.ok(colors.rows.length >= 2, 'need at least two colors');
    const colorAId = colors.rows[0].id;
    const colorBId = colors.rows[1].id;

    const capacities = await pool.query(
      `SELECT id FROM storage_capacities ORDER BY capacity_gb LIMIT 2`
    );
    assert.ok(capacities.rows.length >= 2, 'need at least two storage capacities');

    const gps = await pool.query(`SELECT id FROM watch_connectivities WHERE slug = 'gps'`);
    const cellular = await pool.query(
      `SELECT id FROM watch_connectivities WHERE slug = 'gps_cellular'`
    );
    const gpsId = gps.rows[0].id;
    const cellularId = cellular.rows[0].id;

    const modelAId = await insertWatchModel(MODEL_A, brandId, watchesCatId);
    const modelBId = await insertWatchModel(MODEL_B, brandId, watchesCatId);
    const modelNsId = await insertWatchModel(MODEL_NS, brandId, watchesCatId);
    const modelNzId = await insertWatchModel(MODEL_NZ, brandId, watchesCatId);

    const sizeA = await pool.query(
      `INSERT INTO watch_case_sizes (size_mm, label, sort_order)
       VALUES (98.1, $1, 90) RETURNING id`,
      [SIZE_A]
    );
    const sizeB = await pool.query(
      `INSERT INTO watch_case_sizes (size_mm, label, sort_order)
       VALUES (98.2, $1, 91) RETURNING id`,
      [SIZE_B]
    );
    const sizeNs = await pool.query(
      `INSERT INTO watch_case_sizes (size_mm, label, sort_order)
       VALUES (98.3, $1, 92) RETURNING id`,
      [SIZE_NS]
    );

    const sizeAJunc = await pool.query(
      `INSERT INTO model_watch_case_sizes (model_id, case_size_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelAId, sizeA.rows[0].id]
    );
    const sizeBJunc = await pool.query(
      `INSERT INTO model_watch_case_sizes (model_id, case_size_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelBId, sizeB.rows[0].id]
    );
    const sizeNsJunc = await pool.query(
      `INSERT INTO model_watch_case_sizes (model_id, case_size_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelNsId, sizeNs.rows[0].id]
    );

    const connA = await pool.query(
      `INSERT INTO model_watch_connectivities (model_id, connectivity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelAId, gpsId]
    );
    const connB = await pool.query(
      `INSERT INTO model_watch_connectivities (model_id, connectivity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelBId, cellularId]
    );
    const connNs = await pool.query(
      `INSERT INTO model_watch_connectivities (model_id, connectivity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelNsId, gpsId]
    );
    const connNz = await pool.query(
      `INSERT INTO model_watch_connectivities (model_id, connectivity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelNzId, gpsId]
    );

    const storageA = await pool.query(
      `INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelAId, capacities.rows[0].id]
    );
    const storageB = await pool.query(
      `INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelBId, capacities.rows[1].id]
    );
    const storageNz = await pool.query(
      `INSERT INTO model_storages (model_id, storage_capacity_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelNzId, capacities.rows[0].id]
    );

    const mcA = await pool.query(
      `INSERT INTO model_colors (model_id, color_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelAId, colorAId]
    );
    const mcB = await pool.query(
      `INSERT INTO model_colors (model_id, color_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelBId, colorBId]
    );
    const mcNs = await pool.query(
      `INSERT INTO model_colors (model_id, color_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelNsId, colorAId]
    );
    const mcNz = await pool.query(
      `INSERT INTO model_colors (model_id, color_id, sort_order)
       VALUES ($1, $2, 0) RETURNING id`,
      [modelNzId, colorAId]
    );

    watchA = {
      model_id: modelAId,
      size_id: sizeAJunc.rows[0].id,
      connectivity_id: connA.rows[0].id,
      storage_id: storageA.rows[0].id,
      color_id: mcA.rows[0].id,
      size_label: SIZE_A,
    };
    watchB = {
      model_id: modelBId,
      size_id: sizeBJunc.rows[0].id,
      connectivity_id: connB.rows[0].id,
      storage_id: storageB.rows[0].id,
      color_id: mcB.rows[0].id,
    };
    watchNs = {
      model_id: modelNsId,
      size_id: sizeNsJunc.rows[0].id,
      connectivity_id: connNs.rows[0].id,
      color_id: mcNs.rows[0].id,
      size_label: SIZE_NS,
    };
    watchNz = {
      model_id: modelNzId,
      connectivity_id: connNz.rows[0].id,
      storage_id: storageNz.rows[0].id,
      color_id: mcNz.rows[0].id,
    };
  });

  after(async () => {
    await deleteListingsByIds(createdListingIds);
    createdListingIds = [];
    await cleanupPhase2bFixtures();
  });

  function trackListing(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  async function watchPayload(model, extra = {}) {
    const body = {
      model_id: model.model_id,
      condition_id: fx.catalog.condition_id,
      price: 199,
      description: 'Phase 2B watch listing',
      images: extra.images || [ownedImageUrl],
    };
    if (model.size_id) {
      body.model_watch_case_size_id = model.size_id;
    }
    if (model.connectivity_id) {
      body.model_watch_connectivity_id = model.connectivity_id;
    }
    if (model.color_id) {
      body.model_color_id = model.color_id;
    }
    if (model.storage_id) {
      body.model_storage_id = model.storage_id;
    }
    return { ...body, ...extra, images: extra.images || body.images };
  }

  async function liveWatchPayload(brandName, modelName, extra = {}) {
    const model = await pool.query(
      `SELECT m.id
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE b.name = $1
         AND m.name = $2
         AND c.slug = 'smartwatches'`,
      [brandName, modelName]
    );
    assert.ok(model.rows[0], `expected live catalog ${brandName} ${modelName}`);
    const optionsRes = await api('GET', `/models/${model.rows[0].id}/watch-options`);
    assert.equal(optionsRes.status, 200);
    const options = optionsRes.data;
    const body = {
      model_id: model.rows[0].id,
      condition_id: fx.catalog.condition_id,
      price: 199,
      description: `Live catalog ${brandName} ${modelName}`,
      images: extra.images || [ownedImageUrl],
    };
    if (options.sizes[0]) body.model_watch_case_size_id = options.sizes[0].id;
    if (options.connectivities[0]) {
      body.model_watch_connectivity_id = options.connectivities[0].id;
    }
    if (options.colors[0]) body.model_color_id = options.colors[0].id;
    if (options.storages[0]) body.model_storage_id = options.storages[0].id;
    return {
      modelId: model.rows[0].id,
      options,
      body: { ...body, ...extra, images: extra.images || body.images },
    };
  }

  function phonePayload(extra = {}) {
    return {
      model_id: fx.catalog.model_id,
      model_storage_id: fx.catalog.model_storage_id,
      model_color_id: fx.catalog.model_color_id,
      sim_configuration_id: fx.catalog.sim_configuration_id,
      condition_id: fx.catalog.condition_id,
      price: 199,
      description: 'Phase 2B phone listing',
      ...extra,
    };
  }

  it('existing smartwatch model returns 200 watch-options', async () => {
    const res = await api('GET', `/models/${catalogWatch.id}/watch-options`);
    assert.equal(res.status, 200);
    assert.equal(res.data.model_id, catalogWatch.id);
    assert.equal(res.data.category_slug, 'smartwatches');
    assert.deepEqual(res.data.sizes.map((row) => row.label), ['41mm', '45mm']);
    assert.deepEqual(res.data.connectivities.map((row) => row.slug), ['gps', 'gps_cellular']);
    assert.ok(Array.isArray(res.data.storages));
    assert.ok(Array.isArray(res.data.colors));
    assert.equal(res.data.required.size, true);
    assert.equal(res.data.required.connectivity, true);
    assert.equal(res.data.required.color, true);
  });

  it('watch-options storages and colors belong only to that model', async () => {
    const res = await api('GET', `/models/${catalogWatch.id}/watch-options`);
    assert.equal(res.status, 200);

    const dbStorages = await pool.query(
      `SELECT id FROM model_storages
       WHERE model_id = $1 AND is_active = TRUE
       ORDER BY id`,
      [catalogWatch.id]
    );
    const dbColors = await pool.query(
      `SELECT id FROM model_colors
       WHERE model_id = $1 AND is_active = TRUE
       ORDER BY id`,
      [catalogWatch.id]
    );

    assert.equal(res.data.storages.length, dbStorages.rows.length);
    assert.ok(res.data.storages.every((row) => row.model_id === catalogWatch.id));
    assert.equal(res.data.colors.length, dbColors.rows.length);
    assert.ok(res.data.colors.every((row) => row.model_id === catalogWatch.id));
    assert.equal(res.data.required.storage, dbStorages.rows.length > 0);
  });

  it('nonexistent model watch-options returns 404', async () => {
    const res = await api('GET', '/models/99999999/watch-options');
    assert.equal(res.status, 404);
  });

  it('phone model does not return smartwatch options', async () => {
    const res = await api('GET', `/models/${phoneModelId}/watch-options`);
    assert.equal(res.status, 400);
    assert.notEqual(res.data?.category_slug, 'smartwatches');
  });

  it('watch without size fails', async () => {
    const body = await watchPayload(watchA);
    delete body.model_watch_case_size_id;
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Case size is required for smartwatches');
  });

  it('watch without connectivity fails', async () => {
    const body = await watchPayload(watchA);
    delete body.model_watch_connectivity_id;
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Connectivity is required for smartwatches');
  });

  it('watch without color fails', async () => {
    const body = await watchPayload(watchA);
    delete body.model_color_id;
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Color is required for smartwatches');
  });

  it('watch with SIM configuration fails', async () => {
    const body = await watchPayload(watchA, {
      sim_configuration_id: fx.catalog.sim_configuration_id,
    });
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'SIM configuration is not supported for smartwatches');
  });

  it('watch with another models size fails', async () => {
    const body = await watchPayload(watchA, { model_watch_case_size_id: watchB.size_id });
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Invalid case size for this model');
  });

  it('watch with another models connectivity fails', async () => {
    const body = await watchPayload(watchA, {
      model_watch_connectivity_id: watchB.connectivity_id,
    });
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Invalid connectivity option for this model');
  });

  it('watch with another models color fails', async () => {
    const body = await watchPayload(watchA, { model_color_id: watchB.color_id });
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Invalid color for this model');
  });

  it('watch with another models storage fails', async () => {
    const body = await watchPayload(watchA, { model_storage_id: watchB.storage_id });
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Invalid storage option for this model');
  });

  it('phone without storage still fails', async () => {
    const body = phonePayload({ images: [ownedImageUrl] });
    delete body.model_storage_id;
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Storage is required for phones');
  });

  it('phone without color still fails', async () => {
    const body = phonePayload({ images: [ownedImageUrl] });
    delete body.model_color_id;
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Color is required for phones');
  });

  it('phone without SIM still fails', async () => {
    const body = phonePayload({ images: [ownedImageUrl] });
    delete body.sim_configuration_id;
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'SIM configuration is required for phones');
  });

  it('valid phone listing create remains unchanged', async () => {
    const res = trackListing(
      await api('POST', '/listings', { token, body: phonePayload({ images: [ownedImageUrl] }) })
    );
    assert.ok([200, 201].includes(res.status), `unexpected status ${res.status}`);
    const listing = res.data.listing;
    assert.ok(listing.id);
    assert.equal(listing.model_id, fx.catalog.model_id);
    assert.ok(listing.storage_id);
    assert.ok(listing.color_id);
    assert.ok(listing.sim_configuration_id);
    assert.ok(listing.sim_configuration_name);
    assert.equal(listing.case_size_label, null);
    assert.equal(listing.watch_connectivity_name, null);
    assert.equal(listing.model_watch_case_size_id, null);
    assert.equal(listing.model_watch_connectivity_id, null);
  });

  it('watch listing can be created without storage when model has none', async () => {
    const body = await watchPayload(watchNs);
    assert.equal(body.model_storage_id, undefined);
    const res = trackListing(await api('POST', '/listings', { token, body }));
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.storage_id, null);
    assert.equal(res.data.listing.model_storage_id, null);
    assert.equal(res.data.listing.sim_configuration_id, null);
    assert.equal(res.data.listing.sim_configuration_name, null);
    assert.equal(res.data.listing.case_size_label, SIZE_NS);
    assert.ok(res.data.listing.watch_connectivity_name);
  });

  it('watch-options marks size required only when the model has sizes', async () => {
    const withSizes = await api('GET', `/models/${watchA.model_id}/watch-options`);
    assert.equal(withSizes.status, 200);
    assert.ok(withSizes.data.sizes.length > 0);
    assert.equal(withSizes.data.required.size, true);

    const withoutSizes = await api('GET', `/models/${watchNz.model_id}/watch-options`);
    assert.equal(withoutSizes.status, 200);
    assert.equal(withoutSizes.data.sizes.length, 0);
    assert.equal(withoutSizes.data.required.size, false);
    assert.equal(withoutSizes.data.required.connectivity, true);
    assert.equal(withoutSizes.data.required.color, true);
    assert.equal(withoutSizes.data.required.storage, true);
  });

  it('watch without case size succeeds when the model has none', async () => {
    const body = await watchPayload(watchNz);
    assert.equal(body.model_watch_case_size_id, undefined);
    const res = trackListing(await api('POST', '/listings', { token, body }));
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.model_watch_case_size_id, null);
    assert.equal(res.data.listing.case_size_label, null);
    assert.ok(res.data.listing.model_watch_connectivity_id);
    assert.ok(res.data.listing.model_color_id);
  });

  it('watch null case size succeeds when the model has none', async () => {
    const body = await watchPayload(watchNz, { model_watch_case_size_id: null });
    const res = trackListing(await api('POST', '/listings', { token, body }));
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.model_watch_case_size_id, null);
  });

  it('watch with another models size still fails when this model has none', async () => {
    const body = await watchPayload(watchNz, { model_watch_case_size_id: watchA.size_id });
    const res = await api('POST', '/listings', { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Invalid case size for this model');
  });

  it('watch edit allows omitted case size when the model has none', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchNz) })
    );
    assert.ok(created.data.listing?.id);
    const body = await watchPayload(watchNz);
    delete body.images;
    delete body.model_watch_case_size_id;
    const res = await api('PUT', `/listings/${created.data.listing.id}`, { token, body });
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.model_watch_case_size_id, null);
    assert.equal(res.data.listing.case_size_label, null);
  });

  it('Samsung Gear S has no case sizes and listing create omits case size', async () => {
    const live = await liveWatchPayload('Samsung', 'Gear S');
    assert.equal(live.options.sizes.length, 0);
    assert.equal(live.options.required.size, false);
    assert.equal(live.body.model_watch_case_size_id, undefined);
    assert.ok(live.body.model_watch_connectivity_id);
    assert.ok(live.body.model_color_id);

    const res = trackListing(await api('POST', '/listings', { token, body: live.body }));
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.model_id, live.modelId);
    assert.equal(res.data.listing.model_watch_case_size_id, null);
    assert.equal(res.data.listing.case_size_label, null);
  });

  it('HUAWEI WATCH 2 Classic omits connectivity when the model has none', async () => {
    const live = await liveWatchPayload('Huawei', 'HUAWEI WATCH 2 Classic');
    assert.equal(live.options.connectivities.length, 0);
    assert.equal(live.options.required.connectivity, false);
    assert.equal(live.body.model_watch_connectivity_id, undefined);

    const res = trackListing(await api('POST', '/listings', { token, body: live.body }));
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.model_watch_connectivity_id, null);
    assert.equal(res.data.listing.watch_connectivity_name, null);
  });

  it('Apple Watch Series 1 omits color when the model has none', async () => {
    const live = await liveWatchPayload('Apple', 'Apple Watch Series 1');
    assert.equal(live.options.colors.length, 0);
    assert.equal(live.options.required.color, false);
    assert.equal(live.body.model_color_id, undefined);

    const res = trackListing(await api('POST', '/listings', { token, body: live.body }));
    assert.ok([200, 201].includes(res.status), `got ${res.status} ${JSON.stringify(res.data)}`);
    assert.equal(res.data.listing.model_color_id, null);
    assert.equal(res.data.listing.color_id, null);
  });

  it('watch edit validates size', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    assert.ok(created.data.listing?.id);
    const body = await watchPayload(watchA);
    delete body.images;
    delete body.model_watch_case_size_id;
    const res = await api('PUT', `/listings/${created.data.listing.id}`, { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Case size is required for smartwatches');
  });

  it('watch edit validates connectivity', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    const body = await watchPayload(watchA);
    delete body.images;
    delete body.model_watch_connectivity_id;
    const res = await api('PUT', `/listings/${created.data.listing.id}`, { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Connectivity is required for smartwatches');
  });

  it('watch edit validates color', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    const body = await watchPayload(watchA);
    delete body.images;
    delete body.model_color_id;
    const res = await api('PUT', `/listings/${created.data.listing.id}`, { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Color is required for smartwatches');
  });

  it('watch edit rejects SIM', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    const body = await watchPayload(watchA, {
      sim_configuration_id: fx.catalog.sim_configuration_id,
    });
    delete body.images;
    const res = await api('PUT', `/listings/${created.data.listing.id}`, { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'SIM configuration is not supported for smartwatches');
  });

  it('changing model revalidates existing attributes', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    const body = await watchPayload(watchA, { model_id: watchB.model_id });
    delete body.images;
    const res = await api('PUT', `/listings/${created.data.listing.id}`, { token, body });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'Invalid case size for this model');
  });

  it('watch listing with NULL storage is not hidden by GET /listings', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchNs) })
    );
    const listingId = created.data.listing.id;
    await pool.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listingId]);

    const res = await api(
      'GET',
      `/listings?model_id=${watchNs.model_id}&status=approved&limit=50`
    );
    assert.equal(res.status, 200);
    const found = res.data.listings.find((row) => row.id === listingId);
    assert.ok(found, 'NULL-storage watch listing must remain searchable');
    assert.equal(found.storage_id, null);
    assert.equal(found.capacity_gb, null);
  });

  it('model_watch_case_size_id filter works', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    await pool.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [
      created.data.listing.id,
    ]);
    const res = await api(
      'GET',
      `/listings?model_watch_case_size_id=${watchA.size_id}&status=approved&limit=50`
    );
    assert.equal(res.status, 200);
    assert.ok(res.data.listings.some((row) => row.id === created.data.listing.id));
    assert.ok(res.data.listings.every((row) => row.model_watch_case_size_id === watchA.size_id));
  });

  it('model_watch_connectivity_id filter works', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    await pool.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [
      created.data.listing.id,
    ]);
    const res = await api(
      'GET',
      `/listings?model_watch_connectivity_id=${watchA.connectivity_id}&status=approved&limit=50`
    );
    assert.equal(res.status, 200);
    assert.ok(res.data.listings.some((row) => row.id === created.data.listing.id));
    assert.ok(
      res.data.listings.every(
        (row) => row.model_watch_connectivity_id === watchA.connectivity_id
      )
    );
  });

  it('phone listings are not affected by watch filters', async () => {
    const phones = await api(
      'GET',
      `/listings?category_id=${phonesCatId}&status=approved&limit=50`
    );
    assert.equal(phones.status, 200);
    assert.ok(phones.data.listings.length > 0);
    assert.ok(phones.data.listings.every((row) => row.model_watch_case_size_id == null));

    const filtered = await api(
      'GET',
      `/listings?category_id=${phonesCatId}&model_watch_case_size_id=${watchA.size_id}&status=approved&limit=50`
    );
    assert.equal(filtered.status, 200);
    assert.equal(filtered.data.listings.length, 0);
  });

  it('existing phone storage filtering still works', async () => {
    assert.ok(fx.listing, 'need an approved phone listing fixture');
    const detail = await api('GET', `/listings/${fx.listing.id}`);
    assert.equal(detail.status, 200);
    const modelStorageId = detail.data.listing.model_storage_id;
    const storageId = detail.data.listing.storage_id;
    assert.ok(storageId);

    if (modelStorageId) {
      const res = await api(
        'GET',
        `/listings?model_storage_id=${modelStorageId}&status=approved&limit=50`
      );
      assert.equal(res.status, 200);
      assert.ok(res.data.listings.some((row) => row.id === fx.listing.id));
    } else {
      const res = await api(
        'GET',
        `/listings?storage_id=${storageId}&status=approved&limit=50`
      );
      assert.equal(res.status, 200);
      assert.ok(res.data.listings.some((row) => row.id === fx.listing.id));
    }
  });

  it('watch response contains case size and connectivity and no phone SIM', async () => {
    const created = trackListing(
      await api('POST', '/listings', { token, body: await watchPayload(watchA) })
    );
    const listingId = created.data.listing.id;
    await pool.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listingId]);

    const detail = await api('GET', `/listings/${listingId}`);
    assert.equal(detail.status, 200);
    const listing = detail.data.listing;
    assert.equal(listing.case_size_label, SIZE_A);
    assert.ok(listing.watch_connectivity_name);
    assert.equal(listing.sim_configuration_id, null);
    assert.equal(listing.sim_configuration_name, null);
    assert.ok(listing.color_name);
  });

  it('phone response retains existing fields and null watch attributes', async () => {
    assert.ok(fx.listing);
    const detail = await api('GET', `/listings/${fx.listing.id}`);
    assert.equal(detail.status, 200);
    const listing = detail.data.listing;
    assert.ok(listing.model_name);
    assert.ok(listing.brand_name);
    assert.ok(listing.color_name);
    assert.ok(listing.capacity_gb != null);
    assert.equal(listing.case_size_label, null);
    assert.equal(listing.watch_connectivity_name, null);
  });

  it('placeholder catalog rows remain unchanged after Phase 2B tests', async () => {
    await deleteListingsByIds(createdListingIds);
    createdListingIds = [];
    await cleanupPhase2bFixtures();
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phone_models,
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_models,
         (SELECT COUNT(*)::int FROM listings l JOIN models m ON m.id = l.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_listings,
         (SELECT COUNT(*)::int FROM model_storages ms JOIN models m ON m.id = ms.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phone_storages,
         (SELECT COUNT(*)::int FROM model_storages ms JOIN models m ON m.id = ms.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_storages,
         (SELECT COUNT(*)::int FROM model_colors mc JOIN models m ON m.id = mc.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phone_colors,
         (SELECT COUNT(*)::int FROM model_colors mc JOIN models m ON m.id = mc.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_colors,
         (SELECT COUNT(*)::int FROM sim_configurations) AS sims,
         (SELECT COUNT(*)::int FROM model_watch_case_sizes) AS size_links,
         (SELECT COUNT(*)::int FROM model_watch_connectivities) AS conn_links`
    );
    assert.ok(counts.rows[0].phone_models >= 168);
    assert.equal(counts.rows[0].watch_models, 83);
    assert.equal(counts.rows[0].watch_listings, baselineWatchListings);
    assert.ok(counts.rows[0].phone_storages >= 238);
    assert.ok(counts.rows[0].watch_storages >= 249, 'placeholder storage rows must not be deleted');
    assert.ok(counts.rows[0].phone_colors >= 372);
    assert.ok(counts.rows[0].watch_colors >= 332, 'placeholder color rows must not be deleted');
    assert.equal(counts.rows[0].sims, 5);
    assert.ok(counts.rows[0].size_links > 0);
    assert.ok(counts.rows[0].conn_links > 0);
  });
});
