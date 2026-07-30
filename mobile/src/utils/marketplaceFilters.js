export const EMPTY_MARKETPLACE_FILTERS = {
  category_id: '',
  brand_id: '',
  model_id: '',
  model_storage_id: '',
  model_color_id: '',
  condition_id: '',
  min_price: '',
  max_price: '',
  min_battery: '',
  max_battery: '',
  city_id: '',
  area_id: '',
  sort: 'newest',
};

export function countActiveMarketplaceFilters(filters) {
  let count = 0;
  if (filters.category_id) count += 1;
  if (filters.brand_id) count += 1;
  if (filters.model_id) count += 1;
  if (filters.model_storage_id) count += 1;
  if (filters.model_color_id) count += 1;
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
