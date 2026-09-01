'use strict';

const { isPresent, validateListingCatalogAttributes } = require('./listingCatalog');

const LISTING_SOURCE = {
  CATALOG: 'catalog',
  CUSTOM: 'custom',
};

const CUSTOM_LIMITS = {
  custom_brand_name: 80,
  custom_model_name: 120,
  custom_storage: 40,
  custom_color_name: 80,
  custom_sim_configuration: 80,
  custom_case_size: 40,
  custom_connectivity: 80,
};

const CATALOG_FK_FIELDS = [
  'model_id',
  'storage_id',
  'color_id',
  'model_storage_id',
  'model_color_id',
  'sim_configuration_id',
  'model_watch_case_size_id',
  'model_watch_connectivity_id',
];

const CUSTOM_TEXT_FIELDS = Object.keys(CUSTOM_LIMITS);

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function catalogFkPresent(body, field) {
  return isPresent(body[field]);
}

function customTextPresent(body, field) {
  return emptyToNull(body[field]) != null;
}

function requestedSource(body) {
  const raw = body?.listing_source;
  if (raw == null || raw === '') return null;
  return String(raw).trim().toLowerCase();
}

function inferCustomRequest(body) {
  const source = requestedSource(body);
  if (source === LISTING_SOURCE.CUSTOM) return true;
  if (source === LISTING_SOURCE.CATALOG) return false;
  const hasModel = catalogFkPresent(body, 'model_id');
  const hasCustomIdentity =
    customTextPresent(body, 'custom_brand_name') || customTextPresent(body, 'custom_model_name');
  return !hasModel && hasCustomIdentity;
}

function catalogNulls() {
  return {
    model_id: null,
    storage_id: null,
    color_id: null,
    model_storage_id: null,
    model_color_id: null,
    sim_configuration_id: null,
    model_watch_case_size_id: null,
    model_watch_connectivity_id: null,
  };
}

function customNulls() {
  return {
    custom_brand_name: null,
    custom_model_name: null,
    custom_storage: null,
    custom_color_name: null,
    custom_sim_configuration: null,
    custom_case_size: null,
    custom_connectivity: null,
  };
}

function rejectMixedIdentity(body, isCustom) {
  if (isCustom) {
    const mixedFk = CATALOG_FK_FIELDS.find((field) => catalogFkPresent(body, field));
    if (mixedFk) {
      return { error: 'Custom listings cannot include catalog attribute IDs' };
    }
    return null;
  }

  const mixedCustom = CUSTOM_TEXT_FIELDS.find((field) => customTextPresent(body, field));
  if (mixedCustom) {
    return { error: 'Catalog listings cannot include custom device fields' };
  }
  return null;
}

function requireCustomText(body, field, label) {
  const value = emptyToNull(body[field]);
  if (!value) {
    return { error: `${label} is required` };
  }
  if (value.length > CUSTOM_LIMITS[field]) {
    return { error: `${label} is too long` };
  }
  return { value };
}

async function resolveListingCategory(pool, categoryId) {
  const parsed = parseInt(categoryId, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: 'Category is required' };
  }
  const result = await pool.query(
    `SELECT id, slug FROM categories WHERE id = $1 AND is_active = TRUE`,
    [parsed]
  );
  if (result.rows.length === 0) {
    return { error: 'Invalid category' };
  }
  const slug = result.rows[0].slug;
  if (slug !== 'phones' && slug !== 'smartwatches') {
    return { error: 'Unsupported listing category' };
  }
  return { category_id: result.rows[0].id, category_slug: slug };
}

async function validateCustomListingAttributes(pool, body) {
  const category = await resolveListingCategory(pool, body.category_id);
  if (category.error) return category;

  const brand = requireCustomText(body, 'custom_brand_name', 'Brand');
  if (brand.error) return brand;
  const model = requireCustomText(body, 'custom_model_name', 'Model');
  if (model.error) return model;
  const color = requireCustomText(body, 'custom_color_name', 'Color');
  if (color.error) return color;

  const optional = (field, label) => {
    const value = emptyToNull(body[field]);
    if (!value) return { value: null };
    if (value.length > CUSTOM_LIMITS[field]) {
      return { error: `${label} is too long` };
    }
    return { value };
  };

  if (category.category_slug === 'phones') {
    if (customTextPresent(body, 'custom_case_size') || customTextPresent(body, 'custom_connectivity')) {
      return { error: 'Watch attributes are not supported for phones' };
    }
    const storage = requireCustomText(body, 'custom_storage', 'Storage');
    if (storage.error) return storage;
    const sim = requireCustomText(body, 'custom_sim_configuration', 'SIM configuration');
    if (sim.error) return sim;

    return {
      listing_source: LISTING_SOURCE.CUSTOM,
      category_id: category.category_id,
      category_slug: category.category_slug,
      ...catalogNulls(),
      custom_brand_name: brand.value,
      custom_model_name: model.value,
      custom_storage: storage.value,
      custom_color_name: color.value,
      custom_sim_configuration: sim.value,
      custom_case_size: null,
      custom_connectivity: null,
    };
  }

  if (customTextPresent(body, 'custom_sim_configuration')) {
    return { error: 'SIM configuration is not supported for smartwatches' };
  }
  const caseSize = requireCustomText(body, 'custom_case_size', 'Case size');
  if (caseSize.error) return caseSize;
  const connectivity = requireCustomText(body, 'custom_connectivity', 'Connectivity');
  if (connectivity.error) return connectivity;
  const storage = optional('custom_storage', 'Storage');
  if (storage.error) return storage;

  return {
    listing_source: LISTING_SOURCE.CUSTOM,
    category_id: category.category_id,
    category_slug: category.category_slug,
    ...catalogNulls(),
    custom_brand_name: brand.value,
    custom_model_name: model.value,
    custom_storage: storage.value,
    custom_color_name: color.value,
    custom_sim_configuration: null,
    custom_case_size: caseSize.value,
    custom_connectivity: connectivity.value,
  };
}

/**
 * Authoritative catalog-vs-custom validation. Does not trust listing_source alone.
 */
async function validateListingIdentityAttributes(pool, body, { resolveLegacyStorageId } = {}) {
  const source = requestedSource(body);
  if (source && source !== LISTING_SOURCE.CATALOG && source !== LISTING_SOURCE.CUSTOM) {
    return { error: 'listing_source must be catalog or custom' };
  }

  const isCustom = inferCustomRequest(body);
  if (source === LISTING_SOURCE.CUSTOM && catalogFkPresent(body, 'model_id')) {
    return { error: 'Custom listings cannot include a catalog model' };
  }
  if (source === LISTING_SOURCE.CATALOG && !catalogFkPresent(body, 'model_id')) {
    return { error: 'Model ID is required' };
  }

  const mixed = rejectMixedIdentity(body, isCustom);
  if (mixed) return mixed;

  if (isCustom) {
    return validateCustomListingAttributes(pool, body);
  }

  const catalog = await validateListingCatalogAttributes(pool, body, { resolveLegacyStorageId });
  if (catalog.error) return catalog;

  const category = await pool.query(
    `SELECT m.category_id, c.slug
     FROM models m
     JOIN categories c ON c.id = m.category_id
     WHERE m.id = $1`,
    [body.model_id]
  );

  return {
    listing_source: LISTING_SOURCE.CATALOG,
    category_id: category.rows[0]?.category_id || null,
    category_slug: category.rows[0]?.slug || catalog.category_slug,
    model_id: parseInt(body.model_id, 10),
    ...catalog,
    ...customNulls(),
  };
}

function formatListingDeviceName(brandName, modelName) {
  const brand = brandName == null ? '' : String(brandName).trim();
  const model = modelName == null ? '' : String(modelName).trim();
  if (!brand && !model) return null;
  if (!brand) return model;
  if (!model) return brand;
  if (model.toLowerCase().startsWith(brand.toLowerCase())) return model;
  return `${brand} ${model}`;
}

module.exports = {
  LISTING_SOURCE,
  inferCustomRequest,
  inferCustomRequest,
  validateListingIdentityAttributes,
  validateListingIdentityAttributes,
  formatListingDeviceName,
  formatListingDeviceName,
};
