const pool = require('../config/database');

/** Canonical setting keys and defaults (string-encoded values). */
const SETTING_DEFAULTS = Object.freeze({
  marketplace_name: 'Telefonak',
  marketplace_description:
    "Jordan's trusted marketplace for buying and selling used phones.",
  contact_email: 'support@telefonak.com',
  contact_phone: '+962700000000',
  auto_approve_listings: 'false',
  max_images_per_listing: '10',
  max_listing_price: '5000',
  min_listing_price: '1',
  allow_offers: 'true',
  max_active_banners: '5',
  maintenance_mode: 'false',
});

const BOOLEAN_KEYS = new Set([
  'auto_approve_listings',
  'allow_offers',
  'maintenance_mode',
]);

const NUMBER_KEYS = new Set([
  'max_images_per_listing',
  'max_listing_price',
  'min_listing_price',
  'max_active_banners',
]);

function parseSettingValue(key, raw) {
  if (BOOLEAN_KEYS.has(key)) {
    return raw === true || raw === 'true' || raw === '1';
  }
  if (NUMBER_KEYS.has(key)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
  }
  return raw == null ? '' : String(raw);
}

function serializeSettingValue(key, value) {
  if (BOOLEAN_KEYS.has(key)) {
    return value === true || value === 'true' || value === 1 || value === '1'
      ? 'true'
      : 'false';
  }
  if (NUMBER_KEYS.has(key)) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      const error = new Error(`Invalid numeric value for ${key}`);
      error.statusCode = 400;
      throw error;
    }
    return String(n);
  }
  return String(value ?? '');
}

async function ensureDefaultSettings(client = pool) {
  const entries = Object.entries(SETTING_DEFAULTS);
  for (const [key, value] of entries) {
    await client.query(
      `INSERT INTO settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
}

async function getAllSettings(client = pool) {
  await ensureDefaultSettings(client);
  const result = await client.query(
    `SELECT key, value, updated_at, updated_by
     FROM settings
     ORDER BY key ASC`
  );

  const settings = {};
  const meta = {};

  for (const key of Object.keys(SETTING_DEFAULTS)) {
    settings[key] = parseSettingValue(key, SETTING_DEFAULTS[key]);
  }

  for (const row of result.rows) {
    settings[row.key] = parseSettingValue(row.key, row.value);
    meta[row.key] = {
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    };
  }

  return { settings, meta };
}

async function getSetting(key, client = pool) {
  const { settings } = await getAllSettings(client);
  return settings[key];
}

/** Keys safe to expose to the mobile app / unauthenticated clients. */
const PUBLIC_SETTING_KEYS = Object.freeze([
  'marketplace_name',
  'contact_email',
  'contact_phone',
]);

/**
 * Subset of marketplace settings for customer apps.
 * Never includes moderation/admin-only flags (auto_approve, maintenance, limits, …).
 */
async function getPublicSettings(client = pool) {
  const { settings } = await getAllSettings(client);
  const publicSettings = {};
  for (const key of PUBLIC_SETTING_KEYS) {
    publicSettings[key] = settings[key];
  }
  return publicSettings;
}

/** Short-lived cache so maintenance checks do not hit the DB on every request. */
const MAINTENANCE_CACHE_TTL_MS = 2000;
let maintenanceCache = {
  value: null,
  expiresAt: 0,
};

function invalidateMaintenanceCache() {
  maintenanceCache = { value: null, expiresAt: 0 };
}

/**
 * Fast path for request middleware. Reads `maintenance_mode` with a small TTL cache.
 * On DB failure, fail open (return false) so a settings outage does not brick the API;
 * admins can still toggle once the DB recovers.
 */
async function isMaintenanceModeEnabled(client = pool) {
  const now = Date.now();
  if (maintenanceCache.value !== null && now < maintenanceCache.expiresAt) {
    return maintenanceCache.value;
  }

  try {
    const result = await client.query(
      `SELECT value FROM settings WHERE key = 'maintenance_mode' LIMIT 1`
    );
    const raw = result.rows[0]?.value;
    const enabled =
      raw == null
        ? parseSettingValue('maintenance_mode', SETTING_DEFAULTS.maintenance_mode)
        : parseSettingValue('maintenance_mode', raw);

    maintenanceCache = {
      value: enabled,
      expiresAt: now + MAINTENANCE_CACHE_TTL_MS,
    };
    return enabled;
  } catch (error) {
    console.error('[settings] Failed to read maintenance_mode:', error.message);
    return false;
  }
}

async function upsertSettings(updates, adminId, client = pool) {
  const allowedKeys = new Set(Object.keys(SETTING_DEFAULTS));
  const entries = Object.entries(updates || {});

  if (entries.length === 0) {
    const error = new Error('No settings provided');
    error.statusCode = 400;
    throw error;
  }

  for (const [key] of entries) {
    if (!allowedKeys.has(key)) {
      const error = new Error(`Unknown setting key: ${key}`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate related numeric constraints before writing.
  const current = (await getAllSettings(client)).settings;
  const next = { ...current };
  for (const [key, value] of entries) {
    next[key] = parseSettingValue(key, serializeSettingValue(key, value));
  }

  if (next.min_listing_price > next.max_listing_price) {
    const error = new Error('Minimum listing price cannot exceed maximum listing price');
    error.statusCode = 400;
    throw error;
  }
  if (next.max_images_per_listing < 1) {
    const error = new Error('Maximum images per listing must be at least 1');
    error.statusCode = 400;
    throw error;
  }
  if (next.max_active_banners < 0) {
    const error = new Error('Maximum active banners cannot be negative');
    error.statusCode = 400;
    throw error;
  }
  if (next.min_listing_price < 0 || !Number.isFinite(next.min_listing_price)) {
    const error = new Error('Minimum listing price cannot be negative');
    error.statusCode = 400;
    throw error;
  }
  if (!(next.max_listing_price > 0) || !Number.isFinite(next.max_listing_price)) {
    const error = new Error('Maximum listing price must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  for (const [key, value] of entries) {
    const serialized = serializeSettingValue(key, value);
    await client.query(
      `INSERT INTO settings (key, value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by`,
      [key, serialized, adminId]
    );
  }

  if (Object.prototype.hasOwnProperty.call(updates || {}, 'maintenance_mode')) {
    invalidateMaintenanceCache();
  }

  return getAllSettings(client);
}

module.exports = {
  SETTING_DEFAULTS,
  BOOLEAN_KEYS,
  NUMBER_KEYS,
  PUBLIC_SETTING_KEYS,
  parseSettingValue,
  serializeSettingValue,
  ensureDefaultSettings,
  getAllSettings,
  getSetting,
  getPublicSettings,
  isMaintenanceModeEnabled,
  invalidateMaintenanceCache,
  upsertSettings,
};
