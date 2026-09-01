/**
 * Marketplace listing search — brand, model, and "Brand Model" combined.
 * Normalizes input; SQL uses parameterized ILIKE (injection-safe).
 */

/**
 * Trim, collapse internal whitespace.
 * @param {string} raw
 * @returns {string}
 */
function normalizeMarketplaceSearch(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Escape ILIKE wildcards in user input.
 * @param {string} normalized
 * @returns {string}
 */
function toLikePattern(normalized) {
  const escaped = normalized.replace(/[%_\\]/g, '');
  return `%${escaped}%`;
}

/**
 * Accent-insensitive partial match on brand, model, and combined name.
 * Requires PostgreSQL `unaccent` extension (see marketplace_search_indexes.sql).
 *
 * @param {string} normalizedSearch
 * @param {(value: unknown) => number} pushParam
 * @returns {string|null} SQL WHERE fragment
 */
function buildMarketplaceSearchClause(normalizedSearch, pushParam) {
  if (!normalizedSearch) return null;

  const pattern = toLikePattern(normalizedSearch);
  const idx = pushParam(pattern);

  return `(
    unaccent(COALESCE(b.name, '')) ILIKE unaccent($${idx}::text) OR
    unaccent(COALESCE(m.name, '')) ILIKE unaccent($${idx}::text) OR
    unaccent(COALESCE(b.name, '') || ' ' || COALESCE(m.name, '')) ILIKE unaccent($${idx}::text) OR
    unaccent(COALESCE(l.custom_brand_name, '')) ILIKE unaccent($${idx}::text) OR
    unaccent(COALESCE(l.custom_model_name, '')) ILIKE unaccent($${idx}::text) OR
    unaccent(COALESCE(l.custom_brand_name, '') || ' ' || COALESCE(l.custom_model_name, '')) ILIKE unaccent($${idx}::text)
  )`;
}

module.exports = {
  normalizeMarketplaceSearch,
  toLikePattern,
  buildMarketplaceSearchClause,
};
