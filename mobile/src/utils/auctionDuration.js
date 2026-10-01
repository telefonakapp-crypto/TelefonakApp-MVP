/**
 * Shared Bid duration values and create-listing sale-type helpers.
 * Display labels live in translations.js (createListing.duration* keys).
 */

export const LISTING_SALE_TYPE = Object.freeze({
  NORMAL: 'normal',
  BID: 'bid',
});

export const DEFAULT_LISTING_SALE_TYPE = LISTING_SALE_TYPE.NORMAL;

export const AUCTION_DURATION_HOURS = Object.freeze([
  24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168,
]);

export const DEFAULT_AUCTION_DURATION_HOURS = AUCTION_DURATION_HOURS[0];

const DURATION_LABEL_KEYS = Object.freeze({
  24: 'duration1Day',
  36: 'duration1_5Days',
  48: 'duration2Days',
  60: 'duration2_5Days',
  72: 'duration3Days',
  84: 'duration3_5Days',
  96: 'duration4Days',
  108: 'duration4_5Days',
  120: 'duration5Days',
  132: 'duration5_5Days',
  144: 'duration6Days',
  156: 'duration6_5Days',
  168: 'duration7Days',
});

const CREATE_ERROR_I18N_BY_CODE = Object.freeze({
  INVALID_AUCTION_DURATION: 'createListing.invalidAuctionDuration',
  INVALID_STARTING_PRICE: 'createListing.invalidStartingPrice',
  INVALID_SALE_TYPE: 'createListing.invalidSaleType',
});

export function isBidSaleType(value) {
  return value === LISTING_SALE_TYPE.BID;
}

export function isAllowedAuctionDuration(hours) {
  return AUCTION_DURATION_HOURS.includes(Number(hours));
}

export function auctionDurationLabelKey(hours) {
  const key = DURATION_LABEL_KEYS[Number(hours)];
  return key ? `createListing.${key}` : 'createListing.duration';
}

export function auctionDurationOptions() {
  return AUCTION_DURATION_HOURS.map((hours) => ({
    id: hours,
    hours,
    labelKey: auctionDurationLabelKey(hours),
  }));
}

/**
 * Normal create omits sale_type and duration_hours (backend defaults to normal).
 * Bid create sends sale_type + duration_hours. Never send auction clocks.
 */
export function buildCreateSaleTypeFields({ saleType, durationHours } = {}) {
  if (!isBidSaleType(saleType)) return {};
  return {
    sale_type: LISTING_SALE_TYPE.BID,
    duration_hours: Number(durationHours),
  };
}

export function bidDurationIssue(saleType, durationHours) {
  if (!isBidSaleType(saleType)) return null;
  if (!isAllowedAuctionDuration(durationHours)) return 'pleaseSelectDuration';
  return null;
}

export function createListingErrorI18nKey(error) {
  const code = error?.response?.data?.code;
  return CREATE_ERROR_I18N_BY_CODE[code] || null;
}
