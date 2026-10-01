'use strict';

/**
 * Shared Bid auction summary for customer listing responses.
 * SQL is set-based (JOIN + LATERAL aggregates). Money math for min/max
 * next bid is done in PostgreSQL NUMERIC, then serialized with centsToMoney.
 */

const {
  MIN_BID_INCREMENT,
  MAX_BID_MULTIPLIER,
  AUCTION_STATUS,
  AUCTION_COMPLETION_SOURCE,
  LISTING_SALE_TYPE,
  centsToMoney,
  moneyToCents,
} = require('./listingAuctions');
const { LISTING_STATUS } = require('./listingStatus');

const AUCTION_BIDS_LATERAL_SQL = `
    LEFT JOIN LATERAL (
      SELECT
        MAX(b.amount) AS current_highest_bid,
        COUNT(*)::int AS bid_count
      FROM bids b
      WHERE b.auction_id = auc.id
        AND b.listing_id = l.id
    ) auc_bids ON TRUE
`;

const AUCTION_JOIN_SQL = `
    LEFT JOIN listing_auctions auc ON auc.listing_id = l.id
    ${AUCTION_BIDS_LATERAL_SQL}
`;

const AUCTION_INNER_JOIN_SQL = `
    JOIN listing_auctions auc ON auc.listing_id = l.id
    ${AUCTION_BIDS_LATERAL_SQL}
`;

const AUCTION_PUBLIC_SELECT_SQL = `
    auc.id AS auc_id,
    auc.auction_status AS auc_status,
    auc.starting_price AS auc_starting_price,
    auc.duration_hours AS auc_duration_hours,
    auc.starts_at AS auc_starts_at,
    auc.original_ends_at AS auc_original_ends_at,
    auc.ends_at AS auc_ends_at,
    auc.extension_used AS auc_extension_used,
    auc.winning_bid_id AS auc_winning_bid_id,
    auc.completion_source AS auc_completion_source,
    auc_bids.current_highest_bid AS auc_current_highest_bid,
    COALESCE(auc_bids.bid_count, 0) AS auc_bid_count,
    CASE
      WHEN auc.id IS NULL THEN NULL
      WHEN auc_bids.current_highest_bid IS NULL
        THEN auc.starting_price + ${MIN_BID_INCREMENT}
      ELSE auc_bids.current_highest_bid + ${MIN_BID_INCREMENT}
    END AS auc_minimum_next_bid,
    CASE
      WHEN auc.id IS NULL THEN NULL
      ELSE auc.starting_price * ${MAX_BID_MULTIPLIER}
    END AS auc_maximum_bid,
    EXISTS (
      SELECT 1 FROM listings listed_again
      WHERE listed_again.listed_from_listing_id = l.id
    ) AS auc_already_listed_again
`;

function auctionViewerSelectSql(bidderParam) {
  return `
    (
      SELECT COUNT(*)::int
      FROM bids mb
      WHERE mb.auction_id = auc.id
        AND mb.listing_id = l.id
        AND mb.bidder_id = ${bidderParam}
    ) AS auc_my_bid_count,
    (
      SELECT MAX(mb.amount)
      FROM bids mb
      WHERE mb.auction_id = auc.id
        AND mb.listing_id = l.id
        AND mb.bidder_id = ${bidderParam}
    ) AS auc_my_highest_bid
  `;
}

const AUC_ROW_KEYS = [
  'auc_id',
  'auc_status',
  'auc_starting_price',
  'auc_duration_hours',
  'auc_starts_at',
  'auc_original_ends_at',
  'auc_ends_at',
  'auc_extension_used',
  'auc_winning_bid_id',
  'auc_completion_source',
  'auc_current_highest_bid',
  'auc_bid_count',
  'auc_minimum_next_bid',
  'auc_maximum_bid',
  'auc_already_listed_again',
  'auc_my_bid_count',
  'auc_my_highest_bid',
  'auc_is_winner',
];

function formatAuctionMoney(value) {
  if (value == null || value === '') return null;
  return centsToMoney(moneyToCents(value));
}

function computeCanListAgain({
  isOwner,
  saleType,
  listingStatus,
  auctionStatus,
  completionSource,
  alreadyListedAgain,
}) {
  return Boolean(
    isOwner &&
      saleType === LISTING_SALE_TYPE.BID &&
      listingStatus === LISTING_STATUS.BID_DURATION_ENDED &&
      auctionStatus === AUCTION_STATUS.COMPLETED &&
      completionSource === AUCTION_COMPLETION_SOURCE.EXPIRED &&
      alreadyListedAgain !== true
  );
}

function listingIsLiveBiddable(listingStatus, auctionStatus) {
  return (
    auctionStatus === AUCTION_STATUS.LIVE &&
    listingStatus !== LISTING_STATUS.SOLD &&
    listingStatus !== LISTING_STATUS.DELETED &&
    listingStatus !== LISTING_STATUS.BID_DURATION_ENDED
  );
}

function publicAuctionFromRow(row) {
  if (!row.auc_id) return null;
  return {
    id: row.auc_id,
    auction_status: row.auc_status,
    starting_price: formatAuctionMoney(row.auc_starting_price),
    duration_hours: row.auc_duration_hours == null ? null : Number(row.auc_duration_hours),
    starts_at: row.auc_starts_at,
    original_ends_at: row.auc_original_ends_at,
    ends_at: row.auc_ends_at,
    extension_used: row.auc_extension_used === true,
    winning_bid_id: row.auc_winning_bid_id,
    completion_source: row.auc_completion_source,
    current_highest_bid: formatAuctionMoney(row.auc_current_highest_bid),
    minimum_next_bid: formatAuctionMoney(row.auc_minimum_next_bid),
    maximum_bid: formatAuctionMoney(row.auc_maximum_bid),
    bid_count: Number(row.auc_bid_count || 0),
  };
}

function stripAuctionRowKeys(listing) {
  const next = { ...listing };
  for (const key of AUC_ROW_KEYS) {
    delete next[key];
  }
  return next;
}

/**
 * @param {object} listingRow
 * @param {{ role: 'guest'|'buyer'|'owner', includeWinner?: boolean }} options
 */
function attachAuctionSummary(listingRow, { role, includeWinner } = { role: 'guest' }) {
  const listing = stripAuctionRowKeys(listingRow);
  const saleType = listing.sale_type || LISTING_SALE_TYPE.NORMAL;
  if (saleType !== LISTING_SALE_TYPE.BID) {
    listing.auction = null;
    return listing;
  }

  const auction = publicAuctionFromRow(listingRow);
  if (!auction) {
    listing.auction = null;
    return listing;
  }

  if (role === 'buyer') {
    const myCount = Number(listingRow.auc_my_bid_count || 0);
    auction.has_my_bids = myCount > 0;
    auction.my_bid_count = myCount;
    auction.my_highest_bid = formatAuctionMoney(listingRow.auc_my_highest_bid);
  }

  if (includeWinner) {
    auction.is_winner = listingRow.auc_is_winner === true;
  }

  if (role === 'owner') {
    auction.can_list_again = computeCanListAgain({
      isOwner: true,
      saleType,
      listingStatus: listing.status,
      auctionStatus: auction.auction_status,
      completionSource: auction.completion_source,
      alreadyListedAgain: listingRow.auc_already_listed_again === true,
    });
  }

  listing.auction = auction;
  return listing;
}

function attachMarketplaceAuction(listingRow) {
  return attachAuctionSummary(listingRow, { role: 'guest' });
}

function attachOwnerAuction(listingRow) {
  return attachAuctionSummary(listingRow, { role: 'owner' });
}

function attachBuyerAuction(listingRow, options = {}) {
  return attachAuctionSummary(listingRow, { role: 'buyer', ...options });
}

function attachMyBidsAuction(listingRow) {
  return attachAuctionSummary(listingRow, { role: 'buyer', includeWinner: true });
}

function receivedManagementFlags(listing) {
  const auction = listing.auction;
  if (!auction) {
    return {
      can_manage_auction: false,
      can_end_bid: false,
      can_extend: false,
    };
  }
  const live = listingIsLiveBiddable(listing.status, auction.auction_status);
  return {
    can_manage_auction: live,
    can_end_bid: live,
    can_extend: live && auction.extension_used !== true,
  };
}

function withAuctionForViewer(listingRow, userId) {
  const viewerId = userId || null;
  const isOwner = Boolean(viewerId) && listingRow.user_id === viewerId;
  if (!viewerId) return attachMarketplaceAuction(listingRow);
  if (isOwner) return attachOwnerAuction(listingRow);
  return attachBuyerAuction(listingRow);
}

function parseCustomerListPaging({ limit, offset } = {}) {
  return {
    limit: Math.min(parseInt(limit, 10) || 50, 100),
    offset: Math.max(parseInt(offset, 10) || 0, 0),
  };
}

module.exports = {
  AUCTION_JOIN_SQL,
  AUCTION_INNER_JOIN_SQL,
  AUCTION_BIDS_LATERAL_SQL,
  AUCTION_PUBLIC_SELECT_SQL,
  auctionViewerSelectSql,
  AUC_ROW_KEYS,
  formatAuctionMoney,
  computeCanListAgain,
  listingIsLiveBiddable,
  attachAuctionSummary,
  attachMarketplaceAuction,
  attachOwnerAuction,
  attachBuyerAuction,
  attachMyBidsAuction,
  withAuctionForViewer,
  parseCustomerListPaging,
  receivedManagementFlags,
};
