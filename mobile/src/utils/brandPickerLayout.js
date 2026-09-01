/**
 * Presentational grouping for the create-listing brand picker.
 * Does not modify stored catalog or API values — only orders existing options.
 */

export const POPULAR_BRAND_NAMES = ['Apple', 'Samsung', 'Huawei'];

export function matchesBrandQuery(label, query) {
  return String(label || '')
    .toLowerCase()
    .includes(query);
}

/**
 * Presentational grouping for the brand picker.
 * Does not change brand records — only orders and sections existing options.
 */
export function buildBrandPickerSections(
  options = [],
  { query = '', popularNames = POPULAR_BRAND_NAMES, manualId } = {}
) {
  const catalog = manualId
    ? options.filter((opt) => String(opt.id) !== String(manualId))
    : options.slice();

  const q = String(query || '')
    .trim()
    .toLowerCase();
  const isSearching = q.length > 0;
  const filtered = isSearching
    ? catalog.filter((opt) => matchesBrandQuery(opt.label, q))
    : catalog;

  const popular = isSearching
    ? []
    : popularNames
        .map((name) =>
          catalog.find(
            (opt) =>
              String(opt.label || '').toLowerCase() === String(name).toLowerCase()
          )
        )
        .filter(Boolean);

  const seen = new Set();
  const all = [...filtered]
    .sort((a, b) =>
      String(a.label || '').localeCompare(String(b.label || ''), 'en', {
        sensitivity: 'base',
      })
    )
    .filter((opt) => {
      const key = String(opt.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { popular, all, isSearching };
}
