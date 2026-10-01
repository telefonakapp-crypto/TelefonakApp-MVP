/**
 * Map backend bid/auction error codes to listingDetails/bids i18n keys.
 * Unknown codes fall through to getApiErrorMessage.
 */

const BID_ERROR_I18N_BY_CODE = Object.freeze({
  BID_TOO_LOW: 'bids.tooLow',
  BID_TOO_HIGH: 'bids.tooHigh',
  BID_SELF: 'bids.cannotBidOwn',
  AUCTION_NOT_LIVE: 'bids.auctionNotLive',
  AUCTION_ENDED: 'bids.auctionEnded',
  AUCTION_LISTING_NOT_FOUND: 'bids.cannotBidListing',
  AUCTION_NOT_FOUND: 'bids.cannotBidListing',
  LISTING_NOT_BIDDABLE: 'bids.cannotBidListing',
  INVALID_BID_AMOUNT: 'bids.invalidAmount',
  END_BID_NOT_OWNER: 'sellerBid.notOwner',
  END_BID_NOT_AUCTION: 'sellerBid.cannotManage',
  INVALID_END_BID_ACTION: 'sellerBid.endFailed',
  WINNING_BID_REQUIRED: 'sellerBid.selectBid',
  WINNING_BID_INVALID: 'sellerBid.invalidBid',
  WINNING_BID_NOT_FOUND: 'sellerBid.invalidBid',
  WINNING_BID_WRONG_AUCTION: 'sellerBid.invalidBid',
  EXTENSION_ALREADY_USED: 'sellerBid.extensionUsed',
  EXTENSION_EXCEEDS_MAX: 'sellerBid.extensionExceedsMax',
  LIVE_AUCTION_FROZEN: 'myListings.liveBidFrozen',
  LIST_AGAIN_NOT_OWNER: 'sellerBid.notOwner',
  LIST_AGAIN_NOT_AUCTION: 'sellerBid.cannotManage',
  LIST_AGAIN_NOT_ELIGIBLE: 'sellerBid.listAgainNotEligible',
  LIST_AGAIN_ALREADY_USED: 'sellerBid.listAgainAlreadyUsed',
  LIST_AGAIN_NO_IMAGES: 'sellerBid.listAgainFailed',
  INVALID_AUCTION_DURATION: 'createListing.invalidAuctionDuration',
});

const REFRESH_CODES = new Set([
  'BID_TOO_LOW',
  'AUCTION_ENDED',
  'AUCTION_NOT_LIVE',
  'LISTING_NOT_BIDDABLE',
  'EXTENSION_ALREADY_USED',
]);

const CLOSE_SHEET_CODES = new Set([
  'AUCTION_ENDED',
  'AUCTION_NOT_LIVE',
  'LISTING_NOT_BIDDABLE',
  'BID_SELF',
  'AUCTION_LISTING_NOT_FOUND',
  'AUCTION_NOT_FOUND',
]);

const CLOSE_SELLER_CODES = new Set([
  'AUCTION_ENDED',
  'AUCTION_NOT_LIVE',
  'LISTING_NOT_BIDDABLE',
  'AUCTION_LISTING_NOT_FOUND',
  'AUCTION_NOT_FOUND',
  'EXTENSION_ALREADY_USED',
]);

const CLOSE_LIST_AGAIN_CODES = new Set([
  'LIST_AGAIN_NOT_ELIGIBLE',
  'LIST_AGAIN_ALREADY_USED',
  'LIST_AGAIN_NOT_OWNER',
  'LIST_AGAIN_NOT_AUCTION',
  'LIST_AGAIN_NO_IMAGES',
  'AUCTION_LISTING_NOT_FOUND',
  'AUCTION_NOT_FOUND',
]);

const INVALID_WINNING_BID_CODES = new Set([
  'WINNING_BID_NOT_FOUND',
  'WINNING_BID_INVALID',
  'WINNING_BID_WRONG_AUCTION',
]);

export function bidErrorCode(error) {
  const code = error?.response?.data?.code;
  return typeof code === 'string' && code ? code : null;
}

export function bidErrorI18nKey(error) {
  const code = bidErrorCode(error);
  return code ? BID_ERROR_I18N_BY_CODE[code] || null : null;
}

export function bidErrorNeedsRefresh(error) {
  return REFRESH_CODES.has(bidErrorCode(error));
}

export function bidErrorShouldCloseSheet(error) {
  return CLOSE_SHEET_CODES.has(bidErrorCode(error));
}

export function bidErrorShouldCloseSellerUi(error) {
  return CLOSE_SELLER_CODES.has(bidErrorCode(error));
}

export function bidErrorShouldCloseListAgain(error) {
  return CLOSE_LIST_AGAIN_CODES.has(bidErrorCode(error));
}

export function isInvalidWinningBidError(error) {
  return INVALID_WINNING_BID_CODES.has(bidErrorCode(error));
}
