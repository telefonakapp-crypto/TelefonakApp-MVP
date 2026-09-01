'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, pool } = require('../lib/harness');

const APPLE_WATCH_MODELS = [
  'Apple Watch',
  'Apple Watch Series 1',
  'Apple Watch Series 2',
  'Apple Watch Series 3',
  'Apple Watch Series 4',
  'Apple Watch Series 5',
  'Apple Watch Series 6',
  'Apple Watch Series 7',
  'Apple Watch Series 8',
  'Apple Watch Series 9',
  'Apple Watch Series 10',
  'Apple Watch Series 11',
  'Apple Watch SE',
  'Apple Watch SE 2',
  'Apple Watch SE 3',
  'Apple Watch Ultra',
  'Apple Watch Ultra 2',
  'Apple Watch Ultra 3',
];

const SAMSUNG_WATCH_MODELS = [
  'Galaxy Gear',
  'Gear 2',
  'Gear 2 Neo',
  'Gear S',
  'Gear S2',
  'Gear S2 Classic',
  'Gear S3',
  'Gear S3 Classic',
  'Gear S3 Frontier',
  'Gear Sport',
  'Galaxy Watch',
  'Galaxy Watch Active',
  'Galaxy Watch Active2',
  'Galaxy Watch3',
  'Galaxy Watch4',
  'Galaxy Watch4 Classic',
  'Galaxy Watch5',
  'Galaxy Watch5 Pro',
  'Galaxy Watch6',
  'Galaxy Watch6 Classic',
  'Galaxy Watch FE',
  'Galaxy Watch7',
  'Galaxy Watch Ultra',
  'Galaxy Watch8',
  'Galaxy Watch8 Classic',
  'Galaxy Watch9',
  'Galaxy Watch Ultra2',
];

const HUAWEI_WATCH_MODELS = [
  'HUAWEI WATCH',
  'HUAWEI WATCH 2',
  'HUAWEI WATCH 2 Classic',
  'HUAWEI WATCH 3',
  'HUAWEI WATCH 3 Pro',
  'HUAWEI WATCH 4',
  'HUAWEI WATCH 4 Pro',
  'HUAWEI WATCH 5',
  'HUAWEI WATCH GT',
  'HUAWEI WATCH GT 2',
  'HUAWEI WATCH GT 2e',
  'HUAWEI WATCH GT 2 Pro',
  'HUAWEI WATCH GT 3',
  'HUAWEI WATCH GT 3 SE',
  'HUAWEI WATCH GT 3 Pro',
  'HUAWEI WATCH GT Runner',
  'HUAWEI WATCH GT Runner 2',
  'HUAWEI WATCH GT Cyber',
  'HUAWEI WATCH GT 4',
  'HUAWEI WATCH GT 5',
  'HUAWEI WATCH GT 5 Pro',
  'HUAWEI WATCH GT 6',
  'HUAWEI WATCH GT 6 Pro',
  'HUAWEI WATCH Ultimate',
  'HUAWEI WATCH Ultimate Design',
  'HUAWEI WATCH Ultimate 2',
  'HUAWEI WATCH FIT',
  'HUAWEI WATCH FIT 2',
  'HUAWEI WATCH FIT SE',
  'HUAWEI WATCH FIT 3',
  'HUAWEI WATCH FIT 4',
  'HUAWEI WATCH FIT 4 Pro',
  'HUAWEI WATCH FIT 5',
  'HUAWEI WATCH FIT 5 Pro',
  'HUAWEI WATCH D',
  'HUAWEI WATCH D2',
  'HUAWEI WATCH Buds',
  'HUAWEI WATCH Buds 2',
];

const SEED_PATH = path.join(__dirname, '../../database/smartwatch_catalog_seed.sql');

async function catalogRows(slug, brandName) {
  const result = await pool.query(
    `SELECT m.name, m.sort_order
     FROM models m
     JOIN brands b ON b.id = m.brand_id
     JOIN categories c ON c.id = m.category_id
     WHERE c.slug = $1 AND b.name = $2
     ORDER BY m.sort_order ASC NULLS LAST, m.release_year DESC, m.name`,
    [slug, brandName]
  );
  return result.rows;
}

describe('13 — Smartwatch catalog', () => {
  let phonesCat;
  let watchesCat;
  let apple;
  let samsung;
  let huawei;
  let phoneModelCountBeforeIdempotency;

  before(async () => {
    const cats = await pool.query(
      `SELECT id, slug FROM categories WHERE slug IN ('phones', 'smartwatches')`
    );
    phonesCat = cats.rows.find((r) => r.slug === 'phones');
    watchesCat = cats.rows.find((r) => r.slug === 'smartwatches');

    const brands = await pool.query(
      `SELECT id, name FROM brands WHERE name IN ('Apple', 'Samsung', 'Huawei')`
    );
    apple = brands.rows.find((r) => r.name === 'Apple');
    samsung = brands.rows.find((r) => r.name === 'Samsung');
    huawei = brands.rows.find((r) => r.name === 'Huawei');
  });

  it('smartwatches category exists and is active', async () => {
    const result = await pool.query(
      `SELECT slug, is_active FROM categories WHERE slug = 'smartwatches'`
    );
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].is_active, true);
  });

  it('Apple, Samsung, and Huawei exist under Smartwatches', async () => {
    const result = await pool.query(
      `SELECT DISTINCT b.name
       FROM brands b
       JOIN models m ON m.brand_id = b.id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND b.name IN ('Apple', 'Samsung', 'Huawei')
       ORDER BY b.name`
    );
    assert.deepEqual(
      result.rows.map((r) => r.name),
      ['Apple', 'Huawei', 'Samsung']
    );
  });

  it('Apple has all expected smartwatch models in catalog order', async () => {
    const names = (await catalogRows('smartwatches', 'Apple')).map((r) => r.name);
    assert.deepEqual(names, APPLE_WATCH_MODELS);
  });

  it('Samsung has all expected smartwatch models in catalog order', async () => {
    const names = (await catalogRows('smartwatches', 'Samsung')).map((r) => r.name);
    assert.deepEqual(names, SAMSUNG_WATCH_MODELS);
  });

  it('Huawei has all expected smartwatch models in catalog order', async () => {
    const names = (await catalogRows('smartwatches', 'Huawei')).map((r) => r.name);
    assert.deepEqual(names, HUAWEI_WATCH_MODELS);
  });

  it('has no duplicate brand/model relationships', async () => {
    const dupes = await pool.query(
      `SELECT brand_id, name, COUNT(*)::int AS count
       FROM models
       GROUP BY brand_id, name
       HAVING COUNT(*) > 1`
    );
    assert.equal(dupes.rows.length, 0);

    const watchDupes = await pool.query(
      `SELECT b.name AS brand, m.name AS model, COUNT(*)::int AS count
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
       GROUP BY b.name, m.name
       HAVING COUNT(*) > 1`
    );
    assert.equal(watchDupes.rows.length, 0);
  });

  it('key 2025/2026 models resolve through the catalog', async () => {
    const result = await pool.query(
      `SELECT b.name AS brand, m.name AS model
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'
         AND m.name = ANY($1::text[])
       ORDER BY b.name, m.name`,
      [[
        'Apple Watch Series 11',
        'Galaxy Watch9',
        'Galaxy Watch Ultra2',
        'HUAWEI WATCH FIT 5',
        'HUAWEI WATCH FIT 5 Pro',
        'HUAWEI WATCH GT Runner 2',
      ]]
    );
    assert.deepEqual(
      result.rows.map((r) => `${r.brand} → ${r.model}`),
      [
        'Apple → Apple Watch Series 11',
        'Huawei → HUAWEI WATCH FIT 5',
        'Huawei → HUAWEI WATCH FIT 5 Pro',
        'Huawei → HUAWEI WATCH GT Runner 2',
        'Samsung → Galaxy Watch Ultra2',
        'Samsung → Galaxy Watch9',
      ]
    );
  });

  it('phone brand/model data remains in the phones category', async () => {
    const phones = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM models m
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'`
    );
    assert.ok(phones.rows[0].count > 50, `expected phone models, got ${phones.rows[0].count}`);

    const iphone = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones' AND b.name = 'Apple' AND m.name LIKE 'iPhone%'`
    );
    assert.ok(iphone.rows[0].count > 10);

    const watchInPhones = await pool.query(
      `SELECT m.name
       FROM models m
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'
         AND (
           m.name ILIKE 'Apple Watch%'
           OR m.name ILIKE 'Galaxy Watch%'
           OR m.name ILIKE 'HUAWEI WATCH%'
           OR m.name ILIKE 'Gear %'
           OR m.name = 'Galaxy Gear'
         )`
    );
    assert.equal(watchInPhones.rows.length, 0);

    phoneModelCountBeforeIdempotency = phones.rows[0].count;
  });

  it('re-running the seed is idempotent', async () => {
    const sql = fs.readFileSync(SEED_PATH, 'utf8');
    const before = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watches,
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phones,
         (SELECT COUNT(*)::int FROM models) AS models`
    );

    await pool.query(sql);
    await pool.query(sql);

    const after = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watches,
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phones,
         (SELECT COUNT(*)::int FROM models) AS models`
    );

    assert.equal(after.rows[0].watches, before.rows[0].watches);
    assert.equal(after.rows[0].phones, before.rows[0].phones);
    assert.equal(after.rows[0].models, before.rows[0].models);
    assert.equal(after.rows[0].watches, APPLE_WATCH_MODELS.length + SAMSUNG_WATCH_MODELS.length + HUAWEI_WATCH_MODELS.length);
    if (phoneModelCountBeforeIdempotency != null) {
      assert.equal(after.rows[0].phones, phoneModelCountBeforeIdempotency);
    }
  });

  it('API returns smartwatch brands for the Smartwatches category', async () => {
    assert.ok(watchesCat, 'smartwatches category missing');
    const res = await api('GET', `/brands?category_id=${watchesCat.id}`);
    assert.equal(res.status, 200);
    const names = (res.data.brands || []).map((b) => b.name).sort();
    assert.ok(names.includes('Apple'));
    assert.ok(names.includes('Samsung'));
    assert.ok(names.includes('Huawei'));
  });

  it('API returns Apple Watch models for Smartwatches → Apple, not iPhones', async () => {
    const res = await api(
      'GET',
      `/brands/${apple.id}/models?category_id=${watchesCat.id}`
    );
    assert.equal(res.status, 200);
    const names = (res.data.models || []).map((m) => m.name);
    assert.deepEqual(names, APPLE_WATCH_MODELS);
    assert.equal(names.some((n) => n.startsWith('iPhone')), false);
  });

  it('API returns Samsung watch models for Smartwatches → Samsung, not phones', async () => {
    const res = await api(
      'GET',
      `/brands/${samsung.id}/models?category_id=${watchesCat.id}`
    );
    assert.equal(res.status, 200);
    const names = (res.data.models || []).map((m) => m.name);
    assert.deepEqual(names, SAMSUNG_WATCH_MODELS);
    assert.equal(names.some((n) => n.startsWith('Galaxy S')), false);
  });

  it('API returns Huawei watch models for Smartwatches → Huawei, not phones', async () => {
    const res = await api(
      'GET',
      `/brands/${huawei.id}/models?category_id=${watchesCat.id}`
    );
    assert.equal(res.status, 200);
    const names = (res.data.models || []).map((m) => m.name);
    assert.deepEqual(names, HUAWEI_WATCH_MODELS);
    assert.equal(names.some((n) => n.startsWith('Huawei P') || n.startsWith('Huawei Mate')), false);
  });

  it('API does not return smartwatch models when Phones is selected', async () => {
    assert.ok(phonesCat, 'phones category missing');
    const applePhones = await api(
      'GET',
      `/brands/${apple.id}/models?category_id=${phonesCat.id}`
    );
    assert.equal(applePhones.status, 200);
    const appleNames = (applePhones.data.models || []).map((m) => m.name);
    assert.ok(appleNames.some((n) => n.startsWith('iPhone')));
    assert.equal(appleNames.some((n) => n.startsWith('Apple Watch')), false);

    const samsungPhones = await api(
      'GET',
      `/brands/${samsung.id}/models?category_id=${phonesCat.id}`
    );
    assert.equal(samsungPhones.status, 200);
    const samsungNames = (samsungPhones.data.models || []).map((m) => m.name);
    assert.ok(samsungNames.some((n) => n.startsWith('Galaxy S')));
    assert.equal(
      samsungNames.some(
        (n) =>
          n.startsWith('Galaxy Watch') ||
          n.startsWith('Gear ') ||
          n === 'Galaxy Gear'
      ),
      false
    );

    const huaweiPhones = await api(
      'GET',
      `/brands/${huawei.id}/models?category_id=${phonesCat.id}`
    );
    assert.equal(huaweiPhones.status, 200);
    const huaweiNames = (huaweiPhones.data.models || []).map((m) => m.name);
    assert.equal(huaweiNames.some((n) => n.startsWith('HUAWEI WATCH')), false);
  });
});
