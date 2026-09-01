export const EMPTY_MARKETPLACE_FILTERS = {
  category_id: '',
  brand_id: '',
  model_id: '',
  model_storage_id: '',
  model_color_id: '',
  model_watch_case_size_id: '',
  model_watch_connectivity_id: '',
  condition_id: '',
  min_price: '',
  max_price: '',
  min_battery: '',
  max_battery: '',
  city_id: '',
  area_id: '',
  sort: 'newest',
};

export function emptyWatchMarketplaceFilters() {
  return {
    model_watch_case_size_id: '',
    model_watch_connectivity_id: '',
  };
}

export function emptyModelMarketplaceFilters() {
  return {
    model_id: '',
    model_storage_id: '',
    model_color_id: '',
    ...emptyWatchMarketplaceFilters(),
  };
}

export function countActiveMarketplaceFilters(filters) {
  let count = 0;
  if (filters.category_id) count += 1;
  if (filters.brand_id) count += 1;
  if (filters.model_id) count += 1;
  if (filters.model_storage_id) count += 1;
  if (filters.model_color_id) count += 1;
  if (filters.model_watch_case_size_id) count += 1;
  if (filters.model_watch_connectivity_id) count += 1;
  if (filters.condition_id) count += 1;
  if (filters.min_price) count += 1;
  if (filters.max_price) count += 1;
  if (filters.min_battery) count += 1;
  if (filters.max_battery) count += 1;
  if (filters.city_id) count += 1;
  if (filters.area_id) count += 1;
  if (filters.sort && filters.sort !== 'newest') count += 1;
  return count;
}

export function normalizeMarketplaceSearch(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

export function buildMarketplaceListingParams(filters, { search = '', limit = 20, offset = 0, status = 'approved' } = {}) {
  const params = new URLSearchParams({
    status,
    limit: String(limit),
    offset: String(offset),
    sort: filters.sort || 'newest',
  });

  const normalizedSearch = normalizeMarketplaceSearch(search);
  if (normalizedSearch) params.append('search', normalizedSearch);

  const keys = [
    'category_id',
    'brand_id',
    'model_id',
    'model_storage_id',
    'model_color_id',
    'model_watch_case_size_id',
    'model_watch_connectivity_id',
    'condition_id',
    'min_price',
    'max_price',
    'min_battery',
    'max_battery',
    'city_id',
    'area_id',
  ];

  keys.forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== null && String(filters[key]).trim() !== '') {
      params.append(key, String(filters[key]).trim());
    }
  });

  return params;
}

export function validateMarketplaceFilters(filters) {
  const minPrice = filters.min_price !== '' ? parseFloat(filters.min_price) : null;
  const maxPrice = filters.max_price !== '' ? parseFloat(filters.max_price) : null;
  if (minPrice !== null && Number.isNaN(minPrice)) {
    return 'Minimum price must be a number';
  }
  if (maxPrice !== null && Number.isNaN(maxPrice)) {
    return 'Maximum price must be a number';
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return 'Minimum price cannot be greater than maximum price';
  }

  const minBattery = filters.min_battery !== '' ? parseInt(filters.min_battery, 10) : null;
  const maxBattery = filters.max_battery !== '' ? parseInt(filters.max_battery, 10) : null;
  if (minBattery !== null && (Number.isNaN(minBattery) || minBattery < 0 || minBattery > 100)) {
    return 'Battery minimum must be between 0 and 100';
  }
  if (maxBattery !== null && (Number.isNaN(maxBattery) || maxBattery < 0 || maxBattery > 100)) {
    return 'Battery maximum must be between 0 and 100';
  }
  if (minBattery !== null && maxBattery !== null && minBattery > maxBattery) {
    return 'Battery minimum cannot be greater than maximum';
  }

  return null;
}

export function localizedPlaceName(place, language) {
  if (!place) return '';
  if (language === 'ar' && place.name_ar) return place.name_ar;
  return place.name_en || place.name || '';
}

const LISTING_LOCATION_MAX = 100;

function cityNameCandidates(listing) {
  if (!listing) return [];
  return [listing.city_name_en, listing.city_name, listing.city_name_ar]
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean);
}

/**
 * Area text stored in `listings.location` when there is no catalog area_id.
 * Location snapshots are either "Area, City", the city name alone, or just Area.
 */
export function parseManualAreaFromLocation(listing) {
  const loc = typeof listing?.location === 'string' ? listing.location.trim() : '';
  if (!loc) return '';
  for (const city of cityNameCandidates(listing)) {
    if (loc === city) return '';
    const suffix = `, ${city}`;
    if (loc.endsWith(suffix)) return loc.slice(0, -suffix.length).trim();
  }
  return loc;
}

/** Prefill the Area text field: catalog name when present, else the location snapshot. */
export function listingAreaText(listing, language) {
  if (!listing) return '';
  const catalogArea = localizedPlaceName(
    {
      name_en: listing.area_name_en || listing.area_name,
      name_ar: listing.area_name_ar,
    },
    language
  );
  if (catalogArea) return catalogArea;
  return parseManualAreaFromLocation(listing);
}

/** Denormalized location snapshot written to listings.location (VARCHAR 100). */
export function composeListingLocation(areaText, cityName) {
  const area = String(areaText || '').trim().replace(/\s+/g, ' ');
  const city = String(cityName || '').trim();
  let value = '';
  if (area && city) value = `${area}, ${city}`;
  else if (city) value = city;
  else value = area;
  if (!value) return null;
  return value.length <= LISTING_LOCATION_MAX
    ? value
    : value.slice(0, LISTING_LOCATION_MAX);
}

/**
 * Display a listing's city/area in the current UI language.
 * Prefer bilingual catalog fields over the denormalized `location` snapshot,
 * which is stored in whatever language was active when the listing was saved.
 * Free-text areas (no area_id) are read from that snapshot.
 */
export function formatListingLocation(listing, language) {
  if (!listing) return '';
  const cityLabel = localizedPlaceName(
    {
      name_en: listing.city_name_en || listing.city_name,
      name_ar: listing.city_name_ar,
    },
    language
  );
  const catalogArea = localizedPlaceName(
    {
      name_en: listing.area_name_en || listing.area_name,
      name_ar: listing.area_name_ar,
    },
    language
  );
  const areaLabel = catalogArea || parseManualAreaFromLocation(listing);
  if (areaLabel && cityLabel) return `${areaLabel}, ${cityLabel}`;
  if (cityLabel) return cityLabel;
  if (areaLabel) return areaLabel;
  return typeof listing.location === 'string' ? listing.location : '';
}
