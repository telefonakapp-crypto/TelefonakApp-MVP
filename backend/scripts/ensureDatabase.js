const fs = require('fs');
const path = require('path');

/**
 * Ordered, idempotent SQL scripts applied to every database on startup / init-db.
 * Keep this list as the single source of truth for schema evolution.
 * New schema/seed/migration files should be appended here.
 */
const MIGRATION_FILES = [
  { file: 'schema.sql',                   label: 'Core schema (users, OTP)' },
  { file: 'listings_schema.sql',          label: 'Listings schema + base seed' },
  { file: 'add_battery_percentage.sql',   label: 'Battery percentage column' },
  { file: 'add_bilingual_support.sql',    label: 'Bilingual listing descriptions' },
  { file: 'update_conditions.sql',        label: 'Standardize conditions' },
  { file: 'phone_models_jordan.sql',      label: 'Jordan phone brands/models seed' },
  { file: 'admin_schema.sql',             label: 'Admin role + notifications' },
  { file: 'standardize_listing_status.sql', label: 'Standardize listing statuses' },
  { file: 'ads_schema.sql',               label: 'Ads schema' },
  { file: 'banners_schema.sql',           label: 'Marketing banners schema' },
  { file: 'catalog_schema.sql',           label: 'Device catalog schema' },
  { file: 'catalog_seed.sql',             label: 'Device catalog seed data' },
  { file: 'catalog_migration.sql',        label: 'Catalog listing backfill' },
  { file: 'mvp_categories.sql',           label: 'MVP category visibility (phones + smartwatches)' },
  { file: 'locations_schema.sql',         label: 'Cities/areas schema + indexes' },
  { file: 'locations_seed.sql',           label: 'Jordan cities/areas seed' },
  { file: 'marketplace_search_indexes.sql', label: 'Marketplace search indexes (pg_trgm + unaccent)' },
  { file: 'favorites_schema.sql',         label: 'Favorites (saved listings) schema' },
  { file: 'listing_views_schema.sql',     label: 'Listing view counter + cooldown tracking' },
  { file: 'notifications_schema.sql',     label: 'Notification center schema + indexes' },
  { file: 'offers_schema.sql',            label: 'Offers / bids schema + indexes' },
  { file: 'phone_change_schema.sql',      label: 'OTP purpose scoping + pending phone change' },
  { file: 'otp_rate_limit_schema.sql',    label: 'OTP attempt counter + rate limit index' },
  { file: 'admins_schema.sql',            label: 'Admin Web auth (admins table)' },
  { file: 'listing_decline_reason.sql',   label: 'Listing decline_reason column' },
  { file: 'banners_admin_fields.sql',     label: 'Banner subtitle + CTA text columns' },
  { file: 'users_is_active.sql',          label: 'Marketplace users is_active column' },
  { file: 'settings_schema.sql',          label: 'Marketplace settings key/value store' },
  { file: 'audit_logs_schema.sql',        label: 'Admin Web audit logs' },
  { file: 'production_indexes.sql',       label: 'Production hardening indexes' },
  { file: 'notifications_admin_recipient.sql', label: 'Notifications admin_id recipient (Admin Web staff)' },
  { file: 'drop_users_is_admin.sql',          label: 'Drop legacy users.is_admin column' },
];

const REQUIRED_TABLES = [
  'users',
  'brands',
  'models',
  'listings',
  'storage_options',
  'colors',
  'conditions',
  'categories',
  'storage_capacities',
  'model_storages',
  'model_colors',
  'sim_configurations',
  'spec_definitions',
  'model_spec_values',
  'notifications',
  'banners',
  'cities',
  'areas',
  'favorites',
  'listing_views',
  'offers',
  'admins',
  'settings',
  'audit_logs',
];

const REQUIRED_LISTING_COLUMNS = [
  'model_storage_id',
  'model_color_id',
  'sim_configuration_id',
  'battery_percentage',
  'city_id',
  'area_id',
  'views',
  'decline_reason',
];

const DATABASE_DIR = path.join(__dirname, '../database');

function log(message) {
  console.log(`[db] ${message}`);
}

function logError(message, err) {
  console.error(`[db] ✗ ${message}`);
  if (err) {
    console.error(`[db]   ${err.message || err}`);
    if (err.code) console.error(`[db]   code: ${err.code}`);
    if (err.detail) console.error(`[db]   detail: ${err.detail}`);
    if (err.hint) console.error(`[db]   hint: ${err.hint}`);
  }
}

async function applySqlFile(pool, { file, label }) {
  const filePath = path.join(DATABASE_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file missing: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  const started = Date.now();
  log(`Applying ${file} — ${label}...`);
  await pool.query(sql);
  log(`✓ ${file} applied (${Date.now() - started}ms)`);
}

async function verifySchema(pool) {
  log('Verifying required tables...');
  const tablesResult = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );
  const foundTables = new Set(tablesResult.rows.map((r) => r.table_name));
  const missingTables = REQUIRED_TABLES.filter((t) => !foundTables.has(t));
  if (missingTables.length > 0) {
    throw new Error(`Missing required tables after migration: ${missingTables.join(', ')}`);
  }
  log(`✓ All ${REQUIRED_TABLES.length} required tables present`);

  log('Verifying required listings columns...');
  const colsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'listings'
       AND column_name = ANY($1::text[])`,
    [REQUIRED_LISTING_COLUMNS]
  );
  const foundCols = new Set(colsResult.rows.map((r) => r.column_name));
  const missingCols = REQUIRED_LISTING_COLUMNS.filter((c) => !foundCols.has(c));
  if (missingCols.length > 0) {
    throw new Error(`Missing required listings columns after migration: ${missingCols.join(', ')}`);
  }
  log(`✓ Required listings columns present (${REQUIRED_LISTING_COLUMNS.join(', ')})`);

  const simCount = await pool.query(
    'SELECT COUNT(*)::int AS count FROM sim_configurations WHERE is_active = TRUE'
  );
  if (simCount.rows[0].count === 0) {
    throw new Error('sim_configurations seed is empty — catalog seed may have failed');
  }
  log(`✓ SIM configurations seeded (${simCount.rows[0].count} active)`);
}

/**
 * Apply all idempotent schema/seed/migration scripts, then verify critical objects exist.
 * Safe to call on every server start and via `npm run init-db`.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ ok: true, filesApplied: number, durationMs: number }>}
 */
async function ensureDatabase(pool) {
  const started = Date.now();
  log('────────────────────────────────────────');
  log('Database initialization starting...');
  log(`Scripts to apply: ${MIGRATION_FILES.length}`);

  try {
    // Confirm connectivity early with a clear error if the DB is unreachable
    await pool.query('SELECT 1');
    log('✓ Connected to PostgreSQL');

    for (const migration of MIGRATION_FILES) {
      try {
        await applySqlFile(pool, migration);
      } catch (err) {
        logError(`Failed while applying ${migration.file} (${migration.label})`, err);
        throw err;
      }
    }

    await verifySchema(pool);

    const durationMs = Date.now() - started;
    log(`Database initialization completed successfully (${durationMs}ms)`);
    log('────────────────────────────────────────');
    return { ok: true, filesApplied: MIGRATION_FILES.length, durationMs };
  } catch (err) {
    logError('Database initialization FAILED — server cannot start safely', err);
    log('────────────────────────────────────────');
    throw err;
  }
}

module.exports = {
  ensureDatabase,
  MIGRATION_FILES,
  REQUIRED_TABLES,
  REQUIRED_LISTING_COLUMNS,
};
