'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { LISTING_STATUS } = require('./listingStatus');
const {
  AUCTION_STATUS,
  AUCTION_COMPLETION_SOURCE,
  LISTING_SALE_TYPE,
} = require('./listingAuctions');
const {
  AUCTION_JOIN_SQL,
  AUCTION_INNER_JOIN_SQL,
  computeCanListAgain,
  formatAuctionMoney,
  attachMarketplaceAuction,
  attachOwnerAuction,
  attachBuyerAuction,
} = require('./listingAuctionSummary');

const QUERIES = fs.readFileSync(path.join(__dirname, 'listingQueries.js'), 'utf8');
const LISTINGS_ROUTE = fs.readFileSync(path.join(__dirname, '../routes/listings.js'), 'utf8');
const BIDS_ROUTE = fs.readFileSync(path.join(__dirname, '../routes/listingBids.js'), 'utf8');
const AUCTIONS = fs.readFileSync(path.join(__dirname, 'listingAuctions.js'), 'utf8');

function fetchFnSource(name) {
  const start = QUERIES.indexOf(`function ${name}`);
  assert.ok(start >= 0, `expected ${name}`);
  const next = QUERIES.indexOf('\nfunction ', start + 1);
  const asyncNext = QUERIES.indexOf('\nasync function ', start + 1);
  let end = QUERIES.length;
  for (const candidate of [next, asyncNext]) {
    if (candidate > start && candidate < end) end = candidate;
  }
  return QUERIES.slice(start, end);
}

describe('auction summary can_list_again', () => {
  const eligible = {
    isOwner: true,
    saleType: LISTING_SALE_TYPE.BID,
    listingStatus: LISTING_STATUS.BID_DURATION_ENDED,
    auctionStatus: AUCTION_STATUS.COMPLETED,
    completionSource: AUCTION_COMPLETION_SOURCE.EXPIRED,
    alreadyListedAgain: false,
  };

  it('is true only for owner expired completed Bid listings that were not listed again', () => {
    assert.equal(computeCanListAgain(eligible), true);
  });

  it('is false for non-owners', () => {
    assert.equal(computeCanListAgain({ ...eligible, isOwner: false }), false);
  });

  it('is false for normal listings', () => {
    assert.equal(computeCanListAgain({ ...eligible, saleType: LISTING_SALE_TYPE.NORMAL }), false);
  });

  it('is false for live auctions', () => {
    assert.equal(
      computeCanListAgain({
        ...eligible,
        listingStatus: LISTING_STATUS.APPROVED,
        auctionStatus: AUCTION_STATUS.LIVE,
        completionSource: null,
      }),
      false
    );
  });

  it('is false for pending_start', () => {
    assert.equal(
      computeCanListAgain({
        ...eligible,
        listingStatus: LISTING_STATUS.PENDING,
        auctionStatus: AUCTION_STATUS.PENDING_START,
        completionSource: null,
      }),
      false
    );
  });

  it('is false for manually sold', () => {
    assert.equal(
      computeCanListAgain({ ...eligible, completionSource: AUCTION_COMPLETION_SOURCE.SOLD }),
      false
    );
  });

  it('is false for manually cancelled', () => {
    assert.equal(
      computeCanListAgain({
        ...eligible,
        auctionStatus: AUCTION_STATUS.CANCELLED,
        completionSource: AUCTION_COMPLETION_SOURCE.CANCELLED,
      }),
      false
    );
  });

  it('is false after List Again already created a successor', () => {
    assert.equal(computeCanListAgain({ ...eligible, alreadyListedAgain: true }), false);
  });
});

describe('auction summary shaping', () => {
  it('serializes money through cents, not JS floats', () => {
    assert.equal(formatAuctionMoney('300.00'), '300.00');
    assert.equal(formatAuctionMoney('305'), '305.00');
    assert.equal(formatAuctionMoney(null), null);
  });

  it('Normal listings get auction: null', () => {
    const listing = attachMarketplaceAuction({
      id: 1,
      sale_type: LISTING_SALE_TYPE.NORMAL,
      status: LISTING_STATUS.APPROVED,
      auc_id: null,
    });
    assert.equal(listing.auction, null);
    assert.equal(listing.auc_id, undefined);
  });

  it('guest Bid summary omits my_* and can_list_again', () => {
    const listing = attachMarketplaceAuction({
      id: 2,
      sale_type: LISTING_SALE_TYPE.BID,
      status: LISTING_STATUS.APPROVED,
      auc_id: 9,
      auc_status: AUCTION_STATUS.LIVE,
      auc_starting_price: '300.00',
      auc_duration_hours: 48,
      auc_starts_at: '2026-01-01T00:00:00.000Z',
      auc_original_ends_at: '2026-01-03T00:00:00.000Z',
      auc_ends_at: '2026-01-03T00:00:00.000Z',
      auc_extension_used: false,
      auc_winning_bid_id: null,
      auc_completion_source: null,
      auc_current_highest_bid: '350.00',
      auc_bid_count: 4,
      auc_minimum_next_bid: '355.00',
      auc_maximum_bid: '600.00',
      auc_my_bid_count: 2,
      auc_my_highest_bid: '350.00',
    });
    assert.equal(listing.auction.starting_price, '300.00');
    assert.equal(listing.auction.current_highest_bid, '350.00');
    assert.equal(listing.auction.minimum_next_bid, '355.00');
    assert.equal(listing.auction.maximum_bid, '600.00');
    assert.equal(listing.auction.bid_count, 4);
    assert.equal(listing.auction.has_my_bids, undefined);
    assert.equal(listing.auction.my_bid_count, undefined);
    assert.equal(listing.auction.can_list_again, undefined);
  });

  it('buyer summary includes only that viewer bid stats', () => {
    const listing = attachBuyerAuction({
      id: 3,
      sale_type: LISTING_SALE_TYPE.BID,
      status: LISTING_STATUS.APPROVED,
      auc_id: 9,
      auc_status: AUCTION_STATUS.LIVE,
      auc_starting_price: '300.00',
      auc_duration_hours: 24,
      auc_current_highest_bid: '310.00',
      auc_bid_count: 2,
      auc_minimum_next_bid: '315.00',
      auc_maximum_bid: '600.00',
      auc_my_bid_count: 1,
      auc_my_highest_bid: '305.00',
    });
    assert.equal(listing.auction.has_my_bids, true);
    assert.equal(listing.auction.my_bid_count, 1);
    assert.equal(listing.auction.my_highest_bid, '305.00');
    assert.equal(listing.auction.can_list_again, undefined);
  });

  it('owner expired Bid can_list_again is true', () => {
    const listing = attachOwnerAuction({
      id: 4,
      sale_type: LISTING_SALE_TYPE.BID,
      status: LISTING_STATUS.BID_DURATION_ENDED,
      auc_id: 11,
      auc_status: AUCTION_STATUS.COMPLETED,
      auc_starting_price: '300.00',
      auc_completion_source: AUCTION_COMPLETION_SOURCE.EXPIRED,
      auc_bid_count: 1,
      auc_already_listed_again: false,
    });
    assert.equal(listing.auction.can_list_again, true);
  });
});

describe('auction summary query helpers stay set-based', () => {
  it('marketplace, my listings, and detail queries join auctions once', () => {
    const marketplace = fetchFnSource('fetchMarketplaceListings');
    const mine = fetchFnSource('fetchOwnerMyListings');
    const detail = fetchFnSource('fetchListingRowById');
    for (const src of [marketplace, mine, detail]) {
      assert.match(src, /AUCTION_JOIN_SQL/);
      assert.match(src, /AUCTION_PUBLIC_SELECT_SQL/);
      assert.doesNotMatch(src, /for\s*\(/);
      assert.equal((src.match(/pool\.query/g) || []).length, 1);
    }
  });

  it('My Bids and Received Bids queries are single set-based SELECTs', () => {
    const myBids = fetchFnSource('fetchCustomerMyBids');
    const received = fetchFnSource('fetchCustomerReceivedBids');
    assert.match(myBids, /JOIN LATERAL/);
    assert.match(received, /COALESCE\(auc_bids\.bid_count, 0\) > 0/);
    assert.doesNotMatch(myBids, /for\s*\(/);
    assert.doesNotMatch(received, /for\s*\(/);
    assert.match(myBids, /ORDER BY CASE WHEN auc\.auction_status = 'live' THEN 0 ELSE 1 END/);
    assert.match(received, /ORDER BY CASE WHEN auc\.auction_status = 'live' THEN 0 ELSE 1 END/);
    assert.match(received, /l\.updated_at DESC/);
    assert.match(myBids, /mine\.my_last_bid_at DESC/);
  });

  it('exports the reusable join fragments', () => {
    assert.match(AUCTION_JOIN_SQL, /LEFT JOIN listing_auctions auc/);
    assert.match(AUCTION_INNER_JOIN_SQL, /JOIN listing_auctions auc/);
  });

  it('customer listing routes attach the shared auction helper', () => {
    assert.match(LISTINGS_ROUTE, /attachMarketplaceAuction/);
    assert.match(LISTINGS_ROUTE, /attachOwnerAuction/);
    assert.match(LISTINGS_ROUTE, /withAuctionForViewer/);
    assert.match(BIDS_ROUTE, /fetchCustomerMyBids/);
    assert.match(BIDS_ROUTE, /fetchCustomerReceivedBids/);
    assert.match(BIDS_ROUTE, /\/listings\/:id\/my-bids/);
    assert.match(BIDS_ROUTE, /\/listings\/:id\/bid-history/);
  });

  it('public bid history selects only amount and created_at without joining users', () => {
    const start = AUCTIONS.indexOf('async function listPublicBidHistory');
    assert.ok(start >= 0, 'expected listPublicBidHistory');
    const next = AUCTIONS.indexOf('\nasync function ', start + 1);
    const src = AUCTIONS.slice(start, next > start ? next : AUCTIONS.length);
    assert.match(src, /SELECT b\.amount, b\.created_at/);
    assert.doesNotMatch(src, /JOIN users/i);
    assert.doesNotMatch(src, /bidder_id/);
    assert.doesNotMatch(src, /seller_id/);
    assert.doesNotMatch(src, /phone_number/);
  });
});
