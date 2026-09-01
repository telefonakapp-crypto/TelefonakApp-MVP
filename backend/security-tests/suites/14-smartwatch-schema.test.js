'use strict';

/**
 * Phase 2A — Smartwatch listing attribute schema.
 * Manufacturer model attachments are seeded in Phase 2C.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../lib/harness');

const TEST_SIZE_LABEL = '__p2a_test_99.9mm__';
const TEST_SIZE_MM = 99.9;

async function watchModelId() {
  const result = await pool.query(
    `SELECT m.id
     FROM models m
     JOIN categories c ON c.id = m.category_id
     WHERE c.slug = 'smartwatches'
     ORDER BY m.id
     LIMIT 1`
  );
  assert.ok(result.rows[0], 'expected at least one smartwatch model');
  return result.rows[0].id;
}

async function secondWatchModelId(firstId) {
  const result = await pool.query(
    `SELECT m.id
     FROM models m
     JOIN categories c ON c.id = m.category_id
     WHERE c.slug = 'smartwatches' AND m.id <> $1
     ORDER BY m.id
     LIMIT 1`,
    [firstId]
  );
  assert.ok(result.rows[0], 'expected a second smartwatch model');
  return result.rows[0].id;
}

async function cleanupTestSize() {
  await pool.query(
    `DELETE FROM model_watch_case_sizes
     WHERE case_size_id IN (SELECT id FROM watch_case_sizes WHERE label = $1)`,
    [TEST_SIZE_LABEL]
  );
  await pool.query('DELETE FROM watch_case_sizes WHERE label = $1', [TEST_SIZE_LABEL]);
}

describe('14 — Smartwatch listing attribute schema (Phase 2A)', () => {
  let modelId;
  let otherModelId;
  let baselineWatchListings;

  before(async () => {
    const baseline = await pool.query(
      `SELECT COUNT(*)::int AS watch_listings
       FROM listings l
       JOIN models m ON m.id = l.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'smartwatches'`
    );
    baselineWatchListings = baseline.rows[0].watch_listings;
    await cleanupTestSize();
    await pool.query(
      `DELETE FROM model_watch_connectivities
       WHERE connectivity_id IN (SELECT id FROM watch_connectivities WHERE slug = '__p2a_test_conn__')`
    );
    await pool.query(`DELETE FROM watch_connectivities WHERE slug = '__p2a_test_conn__'`);
    modelId = await watchModelId();
    otherModelId = await secondWatchModelId(modelId);
    const gps = await pool.query(
      `SELECT id FROM watch_connectivities WHERE slug = 'gps'`
    );
    assert.equal(gps.rows.length, 1);
  });

  it('schema tables and listing columns exist', async () => {
    const tables = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [[
        'watch_case_sizes',
        'model_watch_case_sizes',
        'watch_connectivities',
        'model_watch_connectivities',
      ]]
    );
    assert.deepEqual(
      tables.rows.map((r) => r.table_name),
      [
        'model_watch_case_sizes',
        'model_watch_connectivities',
        'watch_case_sizes',
        'watch_connectivities',
      ]
    );

    const cols = await pool.query(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'listings'
         AND column_name IN (
           'storage_id',
           'color_id',
           'model_watch_case_size_id',
           'model_watch_connectivity_id'
         )
       ORDER BY column_name`
    );
    const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r.is_nullable]));
    assert.equal(byName.storage_id, 'YES');
    assert.equal(byName.color_id, 'YES');
    assert.equal(byName.model_watch_case_size_id, 'YES');
    assert.equal(byName.model_watch_connectivity_id, 'YES');
  });

  it('shared connectivity vocabulary is seeded', async () => {
    const vocab = await pool.query(
      `SELECT slug FROM watch_connectivities WHERE is_active = TRUE ORDER BY sort_order, slug`
    );
    assert.deepEqual(
      vocab.rows.map((r) => r.slug),
      ['gps', 'gps_cellular', 'bluetooth', 'bluetooth_lte', 'lte']
    );

    const phoneWatchAttrs = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int
          FROM model_watch_case_sizes mwcs
          JOIN models m ON m.id = mwcs.model_id
          JOIN categories c ON c.id = m.category_id
          WHERE c.slug = 'phones') AS phone_sizes,
         (SELECT COUNT(*)::int
          FROM model_watch_connectivities mwc
          JOIN models m ON m.id = mwc.model_id
          JOIN categories c ON c.id = m.category_id
          WHERE c.slug = 'phones') AS phone_conns`
    );
    assert.equal(phoneWatchAttrs.rows[0].phone_sizes, 0);
    assert.equal(phoneWatchAttrs.rows[0].phone_conns, 0);
  });

  it('accepts a model_watch_case_sizes row for a smartwatch model', async () => {
    const size = await pool.query(
      `INSERT INTO watch_case_sizes (size_mm, label, sort_order)
       VALUES ($1, $2, 99)
       RETURNING id`,
      [TEST_SIZE_MM, TEST_SIZE_LABEL]
    );
    const junction = await pool.query(
      `INSERT INTO model_watch_case_sizes (model_id, case_size_id, sort_order)
       VALUES ($1, $2, 0)
       RETURNING id, model_id`,
      [modelId, size.rows[0].id]
    );
    assert.equal(junction.rows[0].model_id, modelId);
  });

  it('rejects duplicate (model_id, case_size_id)', async () => {
    const size = await pool.query(
      `SELECT id FROM watch_case_sizes WHERE label = $1`,
      [TEST_SIZE_LABEL]
    );
    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO model_watch_case_sizes (model_id, case_size_id)
           VALUES ($1, $2)`,
          [modelId, size.rows[0].id]
        ),
      (err) => err && err.code === '23505'
    );
  });

  it('accepts a model_watch_connectivities row for a smartwatch model', async () => {
    const testConn = await pool.query(
      `INSERT INTO watch_connectivities (slug, name_en, sort_order, is_active)
       VALUES ('__p2a_test_conn__', 'Phase 2A test', 99, TRUE)
       ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en
       RETURNING id`
    );
    const junction = await pool.query(
      `INSERT INTO model_watch_connectivities (model_id, connectivity_id, sort_order)
       VALUES ($1, $2, 0)
       RETURNING id, model_id`,
      [modelId, testConn.rows[0].id]
    );
    assert.equal(junction.rows[0].model_id, modelId);
  });

  it('rejects duplicate (model_id, connectivity_id)', async () => {
    const testConn = await pool.query(
      `SELECT id FROM watch_connectivities WHERE slug = '__p2a_test_conn__'`
    );
    await assert.rejects(
      () =>
        pool.query(
          `INSERT INTO model_watch_connectivities (model_id, connectivity_id)
           VALUES ($1, $2)`,
          [modelId, testConn.rows[0].id]
        ),
      (err) => err && err.code === '23505'
    );
  });

  it('existing phone listings keep storage_id and NULL watch attribute FKs', async () => {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE storage_id IS NULL)::int AS null_storage,
         COUNT(*) FILTER (WHERE model_watch_case_size_id IS NOT NULL)::int AS with_size,
         COUNT(*) FILTER (WHERE model_watch_connectivity_id IS NOT NULL)::int AS with_conn
       FROM listings l
       JOIN models m ON m.id = l.model_id
       JOIN categories c ON c.id = m.category_id
       WHERE c.slug = 'phones'`
    );
    assert.ok(result.rows[0].total > 0, 'expected existing phone listings');
    assert.equal(result.rows[0].null_storage, 0);
    assert.equal(result.rows[0].with_size, 0);
    assert.equal(result.rows[0].with_conn, 0);
  });

  it('listings.storage_id can be NULL', async () => {
    const fx = await pool.query(
      `SELECT
         (SELECT id FROM users ORDER BY id LIMIT 1) AS user_id,
         (SELECT id FROM colors ORDER BY id LIMIT 1) AS color_id,
         (SELECT id FROM conditions ORDER BY id LIMIT 1) AS condition_id`
    );
    const { user_id, color_id, condition_id } = fx.rows[0];
    assert.ok(user_id && color_id && condition_id);

    const inserted = await pool.query(
      `INSERT INTO listings
         (user_id, model_id, storage_id, color_id, condition_id, price, status,
          model_watch_case_size_id, model_watch_connectivity_id)
       VALUES ($1, $2, NULL, $3, $4, 1.00, 'pending', NULL, NULL)
       RETURNING id, storage_id, model_watch_case_size_id, model_watch_connectivity_id`,
      [user_id, modelId, color_id, condition_id]
    );
    assert.equal(inserted.rows[0].storage_id, null);
    assert.equal(inserted.rows[0].model_watch_case_size_id, null);
    assert.equal(inserted.rows[0].model_watch_connectivity_id, null);

    await pool.query('DELETE FROM listings WHERE id = $1', [inserted.rows[0].id]);
  });

  it('compound FK rejects a case size belonging to a different model', async () => {
    const size = await pool.query(
      `SELECT id FROM watch_case_sizes WHERE label = $1`,
      [TEST_SIZE_LABEL]
    );
    const junction = await pool.query(
      `SELECT id FROM model_watch_case_sizes
       WHERE model_id = $1 AND case_size_id = $2`,
      [modelId, size.rows[0].id]
    );
    const fx = await pool.query(
      `SELECT
         (SELECT id FROM users ORDER BY id LIMIT 1) AS user_id,
         (SELECT id FROM colors ORDER BY id LIMIT 1) AS color_id,
         (SELECT id FROM conditions ORDER BY id LIMIT 1) AS condition_id`
    );

    await assert.rejects(
      async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO listings
               (user_id, model_id, storage_id, color_id, condition_id, price, status,
                model_watch_case_size_id)
             VALUES ($1, $2, NULL, $3, $4, 1.00, 'pending', $5)`,
            [
              fx.rows[0].user_id,
              otherModelId,
              fx.rows[0].color_id,
              fx.rows[0].condition_id,
              junction.rows[0].id,
            ]
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      (err) => err && (err.code === '23503' || err.code === '23514')
    );
  });

  it('existing model_storage and model_color unique constraints remain intact', async () => {
    const storage = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'model_storages'::regclass
         AND contype = 'u'
       ORDER BY conname`
    );
    const color = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'model_colors'::regclass
         AND contype = 'u'
       ORDER BY conname`
    );
    const storageNames = storage.rows.map((r) => r.conname);
    const colorNames = color.rows.map((r) => r.conname);
    assert.ok(storageNames.some((n) => n.includes('model_id') || n.includes('storages')));
    assert.ok(colorNames.some((n) => n.includes('model_id') || n.includes('colors')));

    const listingFks = await pool.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'listings'::regclass AND contype = 'f'
       ORDER BY conname`
    );
    const fkNames = listingFks.rows.map((r) => r.conname);
    assert.ok(fkNames.includes('fk_listings_model_storage_model'));
    assert.ok(fkNames.includes('fk_listings_model_color_model'));
    assert.ok(fkNames.includes('listings_storage_id_fkey'));
    assert.ok(fkNames.includes('fk_listings_watch_case_size_model'));
    assert.ok(fkNames.includes('fk_listings_watch_connectivity_model'));
  });

  it('phone and smartwatch catalog counts are unchanged by Phase 2A', async () => {
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phone_models,
         (SELECT COUNT(*)::int FROM models m JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_models,
         (SELECT COUNT(*)::int FROM listings l JOIN models m ON m.id = l.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'phones') AS phone_listings,
         (SELECT COUNT(*)::int FROM listings l JOIN models m ON m.id = l.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_listings,
         (SELECT COUNT(*)::int FROM model_storages ms JOIN models m ON m.id = ms.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_storages,
         (SELECT COUNT(*)::int FROM model_colors mc JOIN models m ON m.id = mc.model_id JOIN categories c ON c.id = m.category_id WHERE c.slug = 'smartwatches') AS watch_colors,
         (SELECT COUNT(*)::int FROM sim_configurations) AS sims`
    );
    assert.ok(counts.rows[0].phone_models >= 168);
    assert.equal(counts.rows[0].watch_models, 83);
    assert.equal(counts.rows[0].watch_listings, baselineWatchListings);
    assert.ok(counts.rows[0].watch_storages >= 249, 'placeholder storage rows must not be deleted');
    assert.ok(counts.rows[0].watch_colors >= 332, 'placeholder color rows must not be deleted');
    assert.equal(counts.rows[0].sims, 5);
    assert.ok(counts.rows[0].phone_listings > 0);
  });

  it('cleans up Phase 2A test junctions without touching catalog data', async () => {
    await pool.query(
      `DELETE FROM model_watch_connectivities
       WHERE connectivity_id IN (SELECT id FROM watch_connectivities WHERE slug = '__p2a_test_conn__')`
    );
    await pool.query(`DELETE FROM watch_connectivities WHERE slug = '__p2a_test_conn__'`);
    await cleanupTestSize();
    const leftover = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM model_watch_case_sizes WHERE case_size_id IN (
            SELECT id FROM watch_case_sizes WHERE label = $1
         )) AS test_size_links,
         (SELECT COUNT(*)::int FROM watch_case_sizes WHERE label = $1) AS test_sizes,
         (SELECT COUNT(*)::int FROM watch_connectivities WHERE slug = '__p2a_test_conn__') AS test_conns`,
      [TEST_SIZE_LABEL]
    );
    assert.equal(leftover.rows[0].test_size_links, 0);
    assert.equal(leftover.rows[0].test_sizes, 0);
    assert.equal(leftover.rows[0].test_conns, 0);
  });
});
