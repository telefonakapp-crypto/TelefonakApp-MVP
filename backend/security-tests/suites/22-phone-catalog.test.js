'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../lib/harness');
const { records } = require('../../scripts/phoneCatalogData');

describe('22 — Phone catalog', () => {
  before(async () => {
    await pool.query('SELECT 1');
  });

  it('does not change the smartwatch model count', async () => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM models m
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'`
    );
    assert.equal(result.rows[0].n, 83);
  });

  it('seeds researched phone models with active storage', async () => {
    const phones = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM models m
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'`
    );
    assert.ok(phones.rows[0].n >= records.length);

    const missing = await pool.query(
      `SELECT b.name AS brand, m.name
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'
         AND NOT EXISTS (
           SELECT 1 FROM model_storages ms
           WHERE ms.model_id = m.id AND ms.is_active = TRUE
         )
       ORDER BY b.name, m.name`
    );
    assert.deepEqual(missing.rows, []);
  });

  it('corrects Apple storage SKUs from official support data', async () => {
    const result = await pool.query(
      `SELECT m.name, array_agg(sc.capacity_gb ORDER BY sc.capacity_gb) AS gb
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       JOIN model_storages ms ON ms.model_id = m.id AND ms.is_active
       JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
       WHERE b.name = 'Apple' AND c.slug = 'phones'
         AND m.name IN ('iPhone 8', 'iPhone X', 'iPhone 15 Pro Max', 'iPhone 17 Pro Max')
       GROUP BY m.name
       ORDER BY m.name`
    );
    const byName = Object.fromEntries(result.rows.map((row) => [row.name, row.gb]));
    assert.deepEqual(byName['iPhone 8'], [64, 128, 256]);
    assert.deepEqual(byName['iPhone X'], [64, 256]);
    assert.deepEqual(byName['iPhone 15 Pro Max'], [256, 512, 1024]);
    assert.deepEqual(byName['iPhone 17 Pro Max'], [256, 512, 1024, 2048]);
  });

  it('keeps Redmi and POCO as their own brands', async () => {
    const result = await pool.query(
      `SELECT b.name, COUNT(*)::int AS n
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones' AND b.name IN ('Redmi', 'POCO', 'Xiaomi')
       GROUP BY b.name
       ORDER BY b.name`
    );
    const byName = Object.fromEntries(result.rows.map((row) => [row.name, row.n]));
    assert.ok(byName.Redmi >= 1);
    assert.ok(byName.POCO >= 1);
    assert.ok(byName.Xiaomi >= 1);

    const leaked = await pool.query(
      `SELECT m.name
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones' AND b.name = 'Xiaomi'
         AND (m.name LIKE 'Redmi %' OR m.name LIKE 'POCO %')`
    );
    assert.deepEqual(leaked.rows, []);
  });

  it('has no duplicate phone models per brand+name', async () => {
    const dupes = await pool.query(
      `SELECT b.name AS brand, m.name, COUNT(*)::int AS n
       FROM models m
       JOIN brands b ON b.id = m.brand_id
       LEFT JOIN categories c ON c.id = m.category_id
       WHERE c.slug IS NULL OR c.slug = 'phones'
       GROUP BY b.name, m.name
       HAVING COUNT(*) > 1
       ORDER BY b.name, m.name`
    );
    assert.deepEqual(dupes.rows, []);
  });

  it('does not delete listing-referenced catalog rows', async () => {
    const orphaned = await pool.query(
      `SELECT l.id
       FROM listings l
       LEFT JOIN models m ON m.id = l.model_id
       WHERE l.listing_source = 'catalog'
         AND m.id IS NULL`
    );
    assert.deepEqual(orphaned.rows, []);
  });
});
