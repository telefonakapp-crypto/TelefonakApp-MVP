'use strict';

/**
 * Phase 2C — Manufacturer-backed smartwatch attributes.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, pool } = require('../lib/harness');

const SEED_PATH = path.join(__dirname, '../../database/smartwatch_attributes_seed.sql');

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

async function watchOptions(modelId) {
  const res = await api('GET', `/models/${modelId}/watch-options`);
  assert.equal(res.status, 200, `watch-options for ${modelId} should succeed`);
  return res.data;
}

describe('16 — Smartwatch manufacturer attributes (Phase 2C)', () => {
  let series8Id;
  let watch8Id;
  let watch5Id;

  before(async () => {
    series8Id = await catalogModel('Apple', 'Apple Watch Series 8');
    watch8Id = await catalogModel('Samsung', 'Galaxy Watch8');
    watch5Id = await catalogModel('Huawei', 'HUAWEI WATCH 5');
  });

  it('Apple Watch Series 8 has exactly 41mm and 45mm', async () => {
    const data = await watchOptions(series8Id);
    assert.deepEqual(
      data.sizes.map((row) => row.label),
      ['41mm', '45mm']
    );
  });

  it('Apple Watch Series 8 has GPS and GPS + Cellular', async () => {
    const data = await watchOptions(series8Id);
    assert.deepEqual(
      data.connectivities.map((row) => row.slug),
      ['gps', 'gps_cellular']
    );
    assert.deepEqual(
      data.connectivities.map((row) => row.name_en),
      ['GPS', 'GPS + Cellular']
    );
  });

  it('Apple Watch Series 8 has 32 GB', async () => {
    const data = await watchOptions(series8Id);
    assert.deepEqual(
      data.storages.map((row) => row.capacity_gb),
      [32]
    );
  });

  it('Apple Watch Series 8 does not have 16 GB or 64 GB', async () => {
    const data = await watchOptions(series8Id);
    const gbs = data.storages.map((row) => row.capacity_gb);
    assert.equal(gbs.includes(16), false);
    assert.equal(gbs.includes(64), false);

    const inactive = await pool.query(
      `SELECT sc.capacity_gb
       FROM model_storages ms
       JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
       WHERE ms.model_id = $1
         AND ms.is_active = FALSE
         AND sc.capacity_gb IN (16, 64)
       ORDER BY sc.capacity_gb`,
      [series8Id]
    );
    assert.deepEqual(
      inactive.rows.map((row) => row.capacity_gb),
      [16, 64]
    );
  });

  it('Apple Watch Series 8 does not have generic Black or White', async () => {
    const data = await watchOptions(series8Id);
    const names = data.colors.map((row) => row.name);
    assert.equal(names.includes('Black'), false);
    assert.equal(names.includes('White'), false);
    assert.ok(names.includes('Midnight'));
    assert.ok(names.includes('Starlight'));
    assert.ok(names.includes('Silver'));
    assert.ok(names.includes('(PRODUCT)RED'));
  });

  it('Samsung Galaxy Watch8 has only its official sizes', async () => {
    const data = await watchOptions(watch8Id);
    assert.deepEqual(
      data.sizes.map((row) => row.label),
      ['40mm', '44mm']
    );
  });

  it('Samsung Galaxy Watch8 has only its official connectivity options', async () => {
    const data = await watchOptions(watch8Id);
    assert.deepEqual(
      data.connectivities.map((row) => row.slug),
      ['bluetooth', 'bluetooth_lte']
    );
  });

  it('Huawei WATCH 5 has manufacturer-backed attributes', async () => {
    const data = await watchOptions(watch5Id);
    assert.deepEqual(
      data.sizes.map((row) => row.label),
      ['42mm', '46mm']
    );
    assert.deepEqual(
      data.connectivities.map((row) => row.slug),
      ['gps', 'gps_cellular']
    );
    assert.ok(data.colors.length > 0);
    assert.equal(
      data.storages.length,
      0,
      'WATCH 5 storage is not a documented marketplace option'
    );
  });

  it('no phone model receives watch sizes', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_watch_case_sizes mwcs
       JOIN models m ON m.id = mwcs.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'`
    );
    assert.equal(result.rows[0].count, 0);
  });

  it('no phone model receives watch connectivity', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_watch_connectivities mwc
       JOIN models m ON m.id = mwc.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'`
    );
    assert.equal(result.rows[0].count, 0);
  });

  it('no smartwatch model receives SIM configurations', async () => {
    const listings = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM listings l
       JOIN models m ON m.id = l.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND l.sim_configuration_id IS NOT NULL`
    );
    assert.equal(listings.rows[0].count, 0);

    const data = await watchOptions(series8Id);
    assert.equal(Object.prototype.hasOwnProperty.call(data, 'sim_configurations'), false);
    assert.equal(data.required.color, true);
  });

  it('re-running the seed does not create duplicates', async () => {
    const sql = fs.readFileSync(SEED_PATH, 'utf8');
    const before = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM model_watch_case_sizes) AS sizes,
         (SELECT COUNT(*)::int FROM model_watch_connectivities) AS conns,
         (SELECT COUNT(*)::int FROM model_storages ms
            JOIN models m ON m.id = ms.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'smartwatches') AS storages,
         (SELECT COUNT(*)::int FROM model_colors mc
            JOIN models m ON m.id = mc.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'smartwatches') AS colors,
         (SELECT COUNT(*)::int FROM models m
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'phones') AS phones,
         (SELECT COUNT(*)::int FROM model_storages ms
            JOIN models m ON m.id = ms.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'phones') AS phone_storages,
         (SELECT COUNT(*)::int FROM model_colors mc
            JOIN models m ON m.id = mc.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'phones') AS phone_colors`
    );

    await pool.query(sql);
    await pool.query(sql);

    const after = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM model_watch_case_sizes) AS sizes,
         (SELECT COUNT(*)::int FROM model_watch_connectivities) AS conns,
         (SELECT COUNT(*)::int FROM model_storages ms
            JOIN models m ON m.id = ms.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'smartwatches') AS storages,
         (SELECT COUNT(*)::int FROM model_colors mc
            JOIN models m ON m.id = mc.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'smartwatches') AS colors,
         (SELECT COUNT(*)::int FROM models m
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'phones') AS phones,
         (SELECT COUNT(*)::int FROM model_storages ms
            JOIN models m ON m.id = ms.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'phones') AS phone_storages,
         (SELECT COUNT(*)::int FROM model_colors mc
            JOIN models m ON m.id = mc.model_id
            JOIN categories c ON c.id = m.category_id
            WHERE c.slug = 'phones') AS phone_colors`
    );

    assert.deepEqual(after.rows[0], before.rows[0]);
    assert.ok(after.rows[0].phones >= 168);

    const dupes = await pool.query(
      `SELECT 'size' AS kind, model_id, case_size_id AS attr_id, COUNT(*)::int AS count
       FROM model_watch_case_sizes
       GROUP BY model_id, case_size_id
       HAVING COUNT(*) > 1
       UNION ALL
       SELECT 'conn', model_id, connectivity_id, COUNT(*)::int
       FROM model_watch_connectivities
       GROUP BY model_id, connectivity_id
       HAVING COUNT(*) > 1
       UNION ALL
       SELECT 'storage', ms.model_id, ms.storage_capacity_id, COUNT(*)::int
       FROM model_storages ms
       JOIN models m ON m.id = ms.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
       GROUP BY ms.model_id, ms.storage_capacity_id
       HAVING COUNT(*) > 1
       UNION ALL
       SELECT 'color', mc.model_id, mc.color_id, COUNT(*)::int
       FROM model_colors mc
       JOIN models m ON m.id = mc.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
       GROUP BY mc.model_id, mc.color_id
       HAVING COUNT(*) > 1`
    );
    assert.equal(dupes.rows.length, 0);
  });

  it('placeholder inactive rows do not appear in watch-options', async () => {
    const data = await watchOptions(series8Id);
    const storageGbs = data.storages.map((row) => row.capacity_gb);
    const colorNames = data.colors.map((row) => row.name);
    assert.equal(storageGbs.includes(16), false);
    assert.equal(storageGbs.includes(64), false);
    assert.equal(colorNames.includes('Black'), false);
    assert.equal(colorNames.includes('White'), false);

    const leaked = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_storages ms
       JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
       WHERE ms.model_id = $1
         AND ms.is_active = FALSE
         AND sc.capacity_gb IN (16, 64)`,
      [series8Id]
    );
    assert.ok(leaked.rows[0].count >= 2);
    assert.equal(data.storages.every((row) => row.model_id === series8Id), true);
    assert.equal(data.colors.every((row) => row.model_id === series8Id), true);
  });

  it('every active watch color belongs to that model', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_colors mc
       JOIN models m ON m.id = mc.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND mc.is_active = TRUE
         AND mc.model_id IS NULL`
    );
    assert.equal(result.rows[0].count, 0);

    const crossed = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_colors mc
       JOIN models owner ON owner.id = mc.model_id
       JOIN categories c ON c.id = owner.category_id
       WHERE c.slug = 'smartwatches'
         AND mc.is_active = TRUE
         AND EXISTS (
           SELECT 1
           FROM model_colors other
           WHERE other.id = mc.id
             AND other.model_id <> mc.model_id
         )`
    );
    assert.equal(crossed.rows[0].count, 0);
  });

  it('every active watch storage belongs to that model', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_storages ms
       JOIN models m ON m.id = ms.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND ms.is_active = TRUE
         AND ms.model_id IS NULL`
    );
    assert.equal(result.rows[0].count, 0);
  });

  it('every active watch size belongs to that model', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_watch_case_sizes mwcs
       JOIN models m ON m.id = mwcs.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND mwcs.is_active = TRUE
         AND mwcs.model_id IS NULL`
    );
    assert.equal(result.rows[0].count, 0);

    const phones = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_watch_case_sizes mwcs
       JOIN models m ON m.id = mwcs.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug <> 'smartwatches'`
    );
    assert.equal(phones.rows[0].count, 0);
  });

  it('every active watch connectivity belongs to that model', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_watch_connectivities mwc
       JOIN models m ON m.id = mwc.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND mwc.is_active = TRUE
         AND mwc.model_id IS NULL`
    );
    assert.equal(result.rows[0].count, 0);

    const phones = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM model_watch_connectivities mwc
       JOIN models m ON m.id = mwc.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug <> 'smartwatches'`
    );
    assert.equal(phones.rows[0].count, 0);
  });
});
