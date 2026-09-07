const fs = require('fs');
const path = require('path');

/**
 * Ordered SQL scripts applied once per database (tracked in schema_migrations).
 * Keep this list as the single source of truth for schema evolution.
 * New schema/seed/migration files should be appended here.
 */
const MIGRATION_FILES = [
  { file: 'schema.sql',                   label: 'Core schema (users, OTP)' },
  { file: 'users_gender_male_female.sql', label: 'Restrict user gender to male/female' },
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
  { file: 'smartwatch_catalog_seed.sql',  label: 'Smartwatch catalog (Apple, Samsung, Huawei)' },
  { file: 'watch_listing_attributes.sql', label: 'Smartwatch listing attributes (Phase 2A schema)' },
  { file: 'smartwatch_attributes_seed.sql', label: 'Smartwatch manufacturer attributes (Phase 2C)' },
  { file: 'locations_schema.sql',         label: 'Cities/areas schema + indexes' },
  { file: 'locations_seed.sql',           label: 'Jordan cities/areas seed' },
  { file: 'marketplace_search_indexes.sql', label: 'Marketplace search indexes (pg_trgm + unaccent)' },
  { file: 'favorites_schema.sql',         label: 'Favorites (saved listings) schema' },
  { file: 'listing_views_schema.sql',     label: 'Listing view counter + cooldown tracking' },
  { file: 'notifications_schema.sql',     label: 'Notification center schema + indexes' },
  { file: 'offers_schema.sql',            label: 'Offers / bids schema + indexes' },
  { file: 'offers_seller_seen.sql',       label: 'Offers seller_seen_at unread tracking' },
  { file: 'phone_change_schema.sql',      label: 'OTP purpose scoping + pending phone change' },
  { file: 'otp_rate_limit_schema.sql',    label: 'OTP attempt counter + rate limit index' },
  { file: 'admins_schema.sql',            label: 'Admin Web auth (admins table)' },
  { file: 'listing_decline_reason.sql',   label: 'Listing decline_reason column' },
  { file: 'banners_admin_fields.sql',     label: 'Banner subtitle + CTA text columns' },
  { file: 'users_is_active.sql',          label: 'Marketplace users is_active column' },
  { file: 'users_deactivation.sql',       label: 'User deactivation reason + timestamp' },
  { file: 'settings_schema.sql',          label: 'Marketplace settings key/value store' },
  { file: 'audit_logs_schema.sql',        label: 'Admin Web audit logs' },
  { file: 'production_indexes.sql',       label: 'Production hardening indexes' },
  { file: 'notifications_admin_recipient.sql', label: 'Notifications admin_id recipient (Admin Web staff)' },
  { file: 'drop_users_is_admin.sql',          label: 'Drop legacy users.is_admin column' },
  { file: 'listing_moderation_audit.sql',     label: 'Listing moderated_at / moderated_by columns' },
  { file: 'listing_resubmitted_status.sql',   label: 'Resubmitted listing status + resubmitted_at' },
  { file: 'listing_revisions.sql',            label: 'Listing revision chain (previous/root/revision_number)' },
  { file: 'listing_updated_status.sql',       label: 'Updated listing status (approved seller edits)' },
  { file: 'listing_moderation_events.sql',    label: 'Append-only listing moderation events' },
  { file: 'listing_image_uploads.sql',        label: 'Listing image upload ownership registry (SEC-002)' },
  { file: 'otp_code_hash.sql',                label: 'OTP code column widened for hashed storage (SEC-014)' },
  { file: 'auth_refresh_sessions.sql',        label: 'Customer refresh sessions (SEC-006/012)' },
  { file: 'custom_listings.sql',              label: 'Custom (Other) listing columns + source check' },
  { file: 'phone_catalog_seed.sql',           label: 'Researched phone catalog (brands/models/storage)' },
  { file: 'user_push_notifications.sql',      label: 'User push preference + Expo device tokens' },
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
  'listing_image_uploads',
  'auth_refresh_sessions',
  'listing_moderation_events',
  'watch_case_sizes',
  'model_watch_case_sizes',
  'watch_connectivities',
  'model_watch_connectivities',
  'user_push_tokens',
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
  'approved_or_rejected_at',
  'moderated_by_admin_id',
  'resubmitted_at',
  'previous_listing_id',
  'revision_number',
  'root_listing_id',
  'model_watch_case_size_id',
  'model_watch_connectivity_id',
  'category_id',
  'listing_source',
  'custom_brand_name',
  'custom_model_name',
  'custom_storage',
  'custom_color_name',
  'custom_sim_configuration',
  'custom_case_size',
  'custom_connectivity',
];

const DATABASE_DIR = path.join(__dirname, '../database');

// Session advisory lock so two backend processes cannot both decide the DB is
// empty / unbaselined. Keys are arbitrary but stable for this app.
const MIGRATION_LOCK_CLASS = 87261401;
const MIGRATION_LOCK_ID = 9;

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

async function ensureMigrationsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getRecordedFilenames(db) {
  const result = await db.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((row) => row.filename));
}

async function recordMigration(db, filename) {
  await db.query(
    `INSERT INTO schema_migrations (filename, applied_at)
     VALUES ($1, NOW())
     ON CONFLICT (filename) DO NOTHING`,
    [filename]
  );
}

async function recordBaseline(db) {
  const filenames = MIGRATION_FILES.map((migration) => migration.file);
  await db.query(
    `INSERT INTO schema_migrations (filename, applied_at)
     SELECT fname, NOW()
     FROM unnest($1::text[]) AS fname
     ON CONFLICT (filename) DO NOTHING`,
    [filenames]
  );
}

/**
 * Same signals as verifySchema(), but does not throw.
 * Used to distinguish empty vs fully initialized vs partial databases
 * when schema_migrations has no rows yet.
 */
async function inspectSchema(db) {
  const tablesResult = await db.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );
  const foundTables = new Set(tablesResult.rows.map((r) => r.table_name));
  const missingTables = REQUIRED_TABLES.filter((t) => !foundTables.has(t));

  let missingCols = [...REQUIRED_LISTING_COLUMNS];
  if (foundTables.has('listings')) {
    const colsResult = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'listings'
         AND column_name = ANY($1::text[])`,
      [REQUIRED_LISTING_COLUMNS]
    );
    const foundCols = new Set(colsResult.rows.map((r) => r.column_name));
    missingCols = REQUIRED_LISTING_COLUMNS.filter((c) => !foundCols.has(c));
  }

  let simCount = 0;
  if (foundTables.has('sim_configurations')) {
    const simResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM sim_configurations WHERE is_active = TRUE'
    );
    simCount = simResult.rows[0].count;
  }

  return {
    foundTableCount: foundTables.size,
    missingTables,
    missingCols,
    simCount,
  };
}

function isEmptyDatabase(inspection) {
  return inspection.foundTableCount === 0;
}

function isFullyInitialized(inspection) {
  return (
    inspection.missingTables.length === 0 &&
    inspection.missingCols.length === 0 &&
    inspection.simCount > 0
  );
}

function describePartialSchema(inspection) {
  const parts = [];
  if (inspection.missingTables.length > 0) {
    parts.push(`missing tables: ${inspection.missingTables.join(', ')}`);
  }
  if (inspection.missingCols.length > 0) {
    parts.push(`missing listings columns: ${inspection.missingCols.join(', ')}`);
  }
  if (inspection.simCount === 0) {
    parts.push('sim_configurations seed is empty');
  }
  return parts.join('; ');
}

async function applySqlFile(db, { file, label }) {
  const filePath = path.join(DATABASE_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file missing: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  const started = Date.now();
  log(`Applying ${file} — ${label}...`);
  await db.query(sql);
  log(`✓ ${file} applied (${Date.now() - started}ms)`);
}

async function applyPendingMigrations(db, recorded) {
  let filesApplied = 0;
  let filesSkipped = 0;

  for (const migration of MIGRATION_FILES) {
    if (recorded.has(migration.file)) {
      filesSkipped += 1;
      continue;
    }

    try {
      await applySqlFile(db, migration);
    } catch (err) {
      logError(`Failed while applying ${migration.file} (${migration.label})`, err);
      throw err;
    }

    await recordMigration(db, migration.file);
    recorded.add(migration.file);
    filesApplied += 1;
  }

  return { filesApplied, filesSkipped };
}

async function verifySchema(db) {
  log('Verifying required tables...');
  const tablesResult = await db.query(
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
  const colsResult = await db.query(
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

  const simCount = await db.query(
    'SELECT COUNT(*)::int AS count FROM sim_configurations WHERE is_active = TRUE'
  );
  if (simCount.rows[0].count === 0) {
    throw new Error('sim_configurations seed is empty — catalog seed may have failed');
  }
  log(`✓ SIM configurations seeded (${simCount.rows[0].count} active)`);
}

/**
 * Apply pending schema/seed/migration scripts (or baseline an existing DB),
 * then verify critical objects exist.
 * Safe to call on every server start and via `npm run init-db`.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ ok: true, filesApplied: number, filesSkipped: number, baselined: boolean, durationMs: number }>}
 */
async function ensureDatabase(pool) {
  const started = Date.now();
  log('────────────────────────────────────────');
  log('Database initialization starting...');
  log(`Migration files in catalog: ${MIGRATION_FILES.length}`);

  const client = await pool.connect();
  let locked = false;

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      MIGRATION_LOCK_CLASS,
      MIGRATION_LOCK_ID,
    ]);
    locked = true;

    await client.query('SELECT 1');
    log('✓ Connected to PostgreSQL');

    await ensureMigrationsTable(client);
    log('✓ Migration tracking table ready');

    const recorded = await getRecordedFilenames(client);
    let filesApplied = 0;
    let filesSkipped = 0;
    let baselined = false;

    if (recorded.size === 0) {
      const inspection = await inspectSchema(client);

      if (isFullyInitialized(inspection)) {
        log(
          'Existing initialized database detected — recording current migrations as baseline (no SQL replay)'
        );
        await recordBaseline(client);
        filesSkipped = MIGRATION_FILES.length;
        baselined = true;
        log(`✓ Baselined ${MIGRATION_FILES.length} migration files`);
      } else if (isEmptyDatabase(inspection)) {
        log('Empty database detected — applying all migration files');
        const applied = await applyPendingMigrations(client, recorded);
        filesApplied = applied.filesApplied;
        filesSkipped = applied.filesSkipped;
      } else {
        throw new Error(
          `Database is partially initialized and has no migration baseline (${describePartialSchema(inspection)}). Refusing to baseline or replay historical SQL. Investigate the database state before starting.`
        );
      }
    } else {
      if (recorded.size === MIGRATION_FILES.length) {
        log('All migrations already applied');
      } else {
        log(
          `${recorded.size} migration(s) already recorded; applying ${MIGRATION_FILES.length - recorded.size} pending`
        );
      }
      const applied = await applyPendingMigrations(client, recorded);
      filesApplied = applied.filesApplied;
      filesSkipped = applied.filesSkipped;
    }

    await verifySchema(client);

    const durationMs = Date.now() - started;
    log(
      `Database initialization completed successfully (${durationMs}ms; applied ${filesApplied}, skipped ${filesSkipped}${baselined ? ', baseline' : ''})`
    );
    log('────────────────────────────────────────');
    return {
      ok: true,
      filesApplied,
      filesSkipped,
      baselined,
      durationMs,
    };
  } catch (err) {
    logError('Database initialization FAILED — server cannot start safely', err);
    log('────────────────────────────────────────');
    throw err;
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [
          MIGRATION_LOCK_CLASS,
          MIGRATION_LOCK_ID,
        ]);
      } catch (unlockErr) {
        logError('Failed to release migration advisory lock', unlockErr);
      }
    }
    client.release();
  }
}

module.exports = {
  ensureDatabase,
  MIGRATION_FILES,
  REQUIRED_TABLES,
  REQUIRED_LISTING_COLUMNS,
};
