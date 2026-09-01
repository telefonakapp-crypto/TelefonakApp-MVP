'use strict';

/**
 * Category-aware listing catalog helpers.
 *
 * Category is always resolved from:
 *   listings.model_id → models.category_id → categories.slug
 *
 * Never from brand name, model name, or hardcoded manufacturer checks.
 */

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

async function resolveModelCategory(pool, modelId) {
  const parsed = parseInt(modelId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: 'Invalid model' };
  }

  const result = await pool.query(
    `SELECT m.id AS model_id, c.id AS category_id, c.slug AS category_slug
     FROM models m
     JOIN categories c ON c.id = m.category_id
     WHERE m.id = $1`,
    [parsed]
  );

  if (result.rows.length === 0) {
    return { error: 'Invalid model' };
  }

  return result.rows[0];
}

async function countActiveModelStorages(pool, modelId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM model_storages
     WHERE model_id = $1 AND is_active = TRUE`,
    [modelId]
  );
  return result.rows[0].count;
}

async function validatePhoneListingAttributes(pool, body, modelId, resolveLegacyStorageId) {
  if (isPresent(body.model_watch_case_size_id) || isPresent(body.model_watch_connectivity_id)) {
    return { error: 'Watch attributes are not supported for phones' };
  }

  if (!isPresent(body.model_storage_id)) {
    return { error: 'Storage is required for phones' };
  }
  if (!isPresent(body.model_color_id)) {
    return { error: 'Color is required for phones' };
  }
  if (!isPresent(body.sim_configuration_id)) {
    return { error: 'SIM configuration is required for phones' };
  }

  const storageResolved = await resolveLegacyStorageId(body.model_storage_id);
  if (storageResolved.error) {
    return { error: storageResolved.error };
  }
  if (storageResolved.model_id !== modelId) {
    return { error: 'Storage option does not belong to this model' };
  }

  const mcResult = await pool.query(
    `SELECT mc.id, mc.model_id, mc.color_id
     FROM model_colors mc
     WHERE mc.id = $1`,
    [body.model_color_id]
  );
  if (mcResult.rows.length === 0) {
    return { error: 'Invalid color option' };
  }
  if (mcResult.rows[0].model_id !== modelId) {
    return { error: 'Color option does not belong to this model' };
  }

  const simResult = await pool.query(
    'SELECT id FROM sim_configurations WHERE id = $1 AND is_active = TRUE',
    [body.sim_configuration_id]
  );
  if (simResult.rows.length === 0) {
    return { error: 'Invalid SIM configuration' };
  }

  return {
    storage_id: storageResolved.storage_id,
    color_id: mcResult.rows[0].color_id,
    model_storage_id: parseInt(body.model_storage_id, 10),
    model_color_id: parseInt(body.model_color_id, 10),
    sim_configuration_id: parseInt(body.sim_configuration_id, 10),
    model_watch_case_size_id: null,
    model_watch_connectivity_id: null,
  };
}

async function validateWatchListingAttributes(pool, body, modelId, resolveLegacyStorageId) {
  if (isPresent(body.sim_configuration_id)) {
    return { error: 'SIM configuration is not supported for smartwatches' };
  }

  if (!isPresent(body.model_watch_case_size_id)) {
    return { error: 'Case size is required for smartwatches' };
  }
  if (!isPresent(body.model_watch_connectivity_id)) {
    return { error: 'Connectivity is required for smartwatches' };
  }
  if (!isPresent(body.model_color_id)) {
    return { error: 'Color is required for smartwatches' };
  }

  const sizeResult = await pool.query(
    `SELECT id, model_id
     FROM model_watch_case_sizes
     WHERE id = $1 AND is_active = TRUE`,
    [body.model_watch_case_size_id]
  );
  if (sizeResult.rows.length === 0 || sizeResult.rows[0].model_id !== modelId) {
    return { error: 'Invalid case size for this model' };
  }

  const connectivityResult = await pool.query(
    `SELECT mwc.id, mwc.model_id
     FROM model_watch_connectivities mwc
     JOIN watch_connectivities wc ON wc.id = mwc.connectivity_id
     WHERE mwc.id = $1
       AND mwc.is_active = TRUE
       AND wc.is_active = TRUE`,
    [body.model_watch_connectivity_id]
  );
  if (connectivityResult.rows.length === 0 || connectivityResult.rows[0].model_id !== modelId) {
    return { error: 'Invalid connectivity option for this model' };
  }

  const mcResult = await pool.query(
    `SELECT mc.id, mc.model_id, mc.color_id
     FROM model_colors mc
     WHERE mc.id = $1 AND mc.is_active = TRUE`,
    [body.model_color_id]
  );
  if (mcResult.rows.length === 0 || mcResult.rows[0].model_id !== modelId) {
    return { error: 'Invalid color for this model' };
  }

  const activeStorageCount = await countActiveModelStorages(pool, modelId);
  let storage_id = null;
  let model_storage_id = null;

  if (isPresent(body.model_storage_id)) {
    const msResult = await pool.query(
      `SELECT id, model_id
       FROM model_storages
       WHERE id = $1 AND is_active = TRUE`,
      [body.model_storage_id]
    );
    if (msResult.rows.length === 0 || msResult.rows[0].model_id !== modelId) {
      return { error: 'Invalid storage option for this model' };
    }

    const storageResolved = await resolveLegacyStorageId(body.model_storage_id);
    if (storageResolved.error) {
      return { error: 'Invalid storage option for this model' };
    }
    if (storageResolved.model_id !== modelId) {
      return { error: 'Invalid storage option for this model' };
    }

    storage_id = storageResolved.storage_id;
    model_storage_id = parseInt(body.model_storage_id, 10);
  } else if (activeStorageCount > 0) {
    return { error: 'Storage is required for smartwatches' };
  }

  return {
    storage_id,
    color_id: mcResult.rows[0].color_id,
    model_storage_id,
    model_color_id: parseInt(body.model_color_id, 10),
    sim_configuration_id: null,
    model_watch_case_size_id: parseInt(body.model_watch_case_size_id, 10),
    model_watch_connectivity_id: parseInt(body.model_watch_connectivity_id, 10),
  };
}

/**
 * Validate create/edit catalog fields against the model's category.
 * Returns either `{ error }` or resolved FK values to persist.
 */
async function validateListingCatalogAttributes(pool, body, { resolveLegacyStorageId }) {
  const category = await resolveModelCategory(pool, body.model_id);
  if (category.error) {
    return category;
  }

  const modelId = category.model_id;
  const slug = category.category_slug;

  let resolved;
  if (slug === 'phones') {
    resolved = await validatePhoneListingAttributes(pool, body, modelId, resolveLegacyStorageId);
  } else if (slug === 'smartwatches') {
    resolved = await validateWatchListingAttributes(pool, body, modelId, resolveLegacyStorageId);
  } else {
    return { error: 'Unsupported listing category' };
  }

  if (resolved.error) {
    return resolved;
  }

  return {
    category_slug: slug,
    ...resolved,
  };
}

const LISTING_IDENTITY_JOINS = `LEFT JOIN models m ON l.model_id = m.id
         LEFT JOIN brands b ON m.brand_id = b.id
         LEFT JOIN categories cat ON cat.id = COALESCE(l.category_id, m.category_id)`;

const LISTING_BRAND_NAME_SQL = `COALESCE(b.name, l.custom_brand_name)`;
const LISTING_MODEL_NAME_SQL = `COALESCE(m.name, l.custom_model_name)`;
const LISTING_STORAGE_DISPLAY_SQL = `COALESCE(
          CASE WHEN s.capacity_gb IS NOT NULL THEN s.capacity_gb::text || ' GB' ELSE NULL END,
          l.custom_storage
        )`;
const LISTING_SIM_NAME_SQL = `COALESCE(sim.name, l.custom_sim_configuration)`;

const LISTING_WATCH_SELECT_FIELDS = `COALESCE(wcs.label, l.custom_case_size) AS case_size_label,
          COALESCE(wc.name_en, l.custom_connectivity) AS watch_connectivity_name`;

const LISTING_WATCH_JOINS = `LEFT JOIN model_watch_case_sizes mwcs ON mwcs.id = l.model_watch_case_size_id
         LEFT JOIN watch_case_sizes wcs ON wcs.id = mwcs.case_size_id
         LEFT JOIN model_watch_connectivities mwconn ON mwconn.id = l.model_watch_connectivity_id
         LEFT JOIN watch_connectivities wc ON wc.id = mwconn.connectivity_id`;

const LISTING_STORAGE_JOIN = `LEFT JOIN storage_options s ON l.storage_id = s.id`;

const LISTING_COLOR_SELECT_FIELDS = `c.name AS color_name,
          COALESCE(mc.official_name, c.name, l.custom_color_name) AS color_display_name,
          c.hex_code AS color_hex`;

const LISTING_COLOR_JOINS = `LEFT JOIN colors c ON l.color_id = c.id
         LEFT JOIN model_colors mc ON mc.id = l.model_color_id`;

module.exports = {
  isPresent: isPresent,
  resolveModelCategory: resolveModelCategory,
  countActiveModelStorages: countActiveModelStorages,
  validateListingCatalogAttributes: validateListingCatalogAttributes,
  LISTING_IDENTITY_JOINS,
  LISTING_IDENTITY_JOINS: LISTING_IDENTITY_JOINS,
  LISTING_BRAND_NAME_SQL,
  LISTING_BRAND_NAME_SQL: LISTING_BRAND_NAME_SQL,
  LISTING_MODEL_NAME_SQL,
  LISTING_MODEL_NAME_SQL: LISTING_MODEL_NAME_SQL,
  LISTING_STORAGE_DISPLAY_SQL,
  LISTING_STORAGE_DISPLAY_SQL: LISTING_STORAGE_DISPLAY_SQL,
  LISTING_SIM_NAME_SQL,
  LISTING_SIM_NAME_SQL: LISTING_SIM_NAME_SQL,
  LISTING_WATCH_SELECT_FIELDS,
  LISTING_WATCH_SELECT_FIELDS: LISTING_WATCH_SELECT_FIELDS,
  LISTING_WATCH_JOINS,
  LISTING_WATCH_JOINS: LISTING_WATCH_JOINS,
  LISTING_STORAGE_JOIN,
  LISTING_STORAGE_JOIN: LISTING_STORAGE_JOIN,
  LISTING_COLOR_SELECT_FIELDS,
  LISTING_COLOR_SELECT_FIELDS: LISTING_COLOR_SELECT_FIELDS,
  LISTING_COLOR_JOINS,
  LISTING_COLOR_JOINS: LISTING_COLOR_JOINS,
};
