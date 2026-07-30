/**
 * Shared banner helpers for public, mobile-admin, and Admin Web routes.
 */
const { resolveBaseUrl } = require('./baseUrl');

const ALLOWED_ACTION_TYPES = new Set(['none', 'url', 'screen', 'listing']);

const ACTIVE_BANNERS_WHERE = `
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
  AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
`;

function absolutizeImageUrl(imageUrl, baseUrl) {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith('/')) return `${baseUrl}${imageUrl}`;
  return imageUrl;
}

function mapBannerRow(row, baseUrl) {
  return {
    ...row,
    image_url: absolutizeImageUrl(row.image_url, baseUrl),
  };
}

/**
 * Derived lifecycle status for Admin Web badges/filters.
 * @param {{ is_active: boolean, starts_at?: string|Date|null, ends_at?: string|Date|null }} banner
 * @param {Date} [now]
 * @returns {'active'|'scheduled'|'expired'|'disabled'}
 */
function deriveBannerStatus(banner, now = new Date()) {
  if (!banner.is_active) return 'disabled';

  if (banner.ends_at) {
    const endsAt = new Date(banner.ends_at);
    if (!Number.isNaN(endsAt.getTime()) && endsAt <= now) return 'expired';
  }

  if (banner.starts_at) {
    const startsAt = new Date(banner.starts_at);
    if (!Number.isNaN(startsAt.getTime()) && startsAt > now) return 'scheduled';
  }

  return 'active';
}

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseOptionalTimestamp(value, fieldName) {
  if (value === undefined) return { provided: false, value: undefined };
  if (value === null || value === '') return { provided: true, value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }
  return { provided: true, value: date.toISOString() };
}

function assertValidDateRange(startsAt, endsAt) {
  if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
    const error = new Error('Start date must be before or equal to end date');
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  ALLOWED_ACTION_TYPES,
  ACTIVE_BANNERS_WHERE,
  absolutizeImageUrl,
  mapBannerRow,
  deriveBannerStatus,
  isValidHttpUrl,
  parseOptionalTimestamp,
  assertValidDateRange,
  resolveBaseUrl,
};
