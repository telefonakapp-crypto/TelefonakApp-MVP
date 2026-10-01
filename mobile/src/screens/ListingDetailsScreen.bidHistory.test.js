'use strict';

/**
 * Listing Details public Recent Bids (source).
 * Run: node --test src/screens/ListingDetailsScreen.bidHistory.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');

describe('Listing Details public bid history', () => {
  const details = fs.readFileSync(DETAILS, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
  const fetchHistory = details.slice(
    details.indexOf('const fetchPublicBidHistory'),
    details.indexOf('const fetchListingDetails')
  );
  const fetchListing = details.slice(
    details.indexOf('const fetchListingDetails'),
    details.indexOf('const retryListingDetails')
  );
  const recent = details.slice(
    details.indexOf('styles.recentBidsBlock'),
    details.indexOf('titleRow')
  );
  const sellerFetch = details.slice(
    details.indexOf('const fetchSellerBids'),
    details.indexOf('const openEndBidSheet')
  );

  it('Bid listings call GET /listings/:id/bid-history?limit=4', () => {
    assert.match(fetchHistory, /shouldFetchPublicBidHistory\(listing\)/);
    assert.match(
      fetchHistory,
      /apiClient\.get\(`\/listings\/\$\{listingId\}\/bid-history`, \{\s*params: \{ limit: 4 \}/
    );
    assert.match(fetchListing, /fetchPublicBidHistory\(nextListing\)/);
    assert.doesNotMatch(fetchHistory, /offset/);
    assert.doesNotMatch(fetchHistory, /cursor/);
    assert.doesNotMatch(fetchHistory, /setInterval/);
  });

  it('does not call bid-history for Normal listings or owners', () => {
    assert.match(details, /shouldFetchPublicBidHistory\(listing\)/);
    assert.match(fetchHistory, /getAuthToken\(\)/);
    assert.match(fetchListing, /fetchPublicBidHistory\(nextListing\)/);
  });

  it('renders API amount, created_at, and auction.bid_count without re-sorting', () => {
    assert.match(recent, /bids\.recentBids/);
    assert.match(recent, /auction\.bid_count/);
    assert.match(recent, /formatJod\(bid\.amount\)/);
    assert.match(recent, /formatBidTimeAgo\(bid\.created_at, nowMs, t\)/);
    assert.match(recent, /publicBids\.map/);
    assert.doesNotMatch(recent, /\.sort\(/);
    assert.doesNotMatch(recent, /parseFloat/);
    assert.match(recent, /bidCountWithNumber[\s\S]*auction\.bid_count/);
    assert.match(recent, /bids\.noBidsYet/);
    assert.match(recent, /bids\.loadFailed/);
  });

  it('does not render bidder identity or paginate has_more', () => {
    assert.doesNotMatch(recent, /bidder_id/);
    assert.doesNotMatch(recent, /seller_id/);
    assert.doesNotMatch(recent, /phone_number/);
    assert.doesNotMatch(recent, /bid\.bidder/);
    assert.doesNotMatch(recent, /onPress/);
    assert.match(recent, /publicBidsHasMore/);
    assert.match(recent, /bids\.viewAllBids/);
    assert.doesNotMatch(fetchHistory, /has_more === true/);
    assert.doesNotMatch(details, /\/listings\/\$\{listingId\}\/bid-history.*offset/);
  });

  it('history errors do not replace Place Bid or seller bidder APIs', () => {
    assert.match(details, /setPublicBidsError\(true\)/);
    assert.match(
      details,
      /apiClient\.post\(`\/listings\/\$\{listingId\}\/bids`, \{ amount \}\)/
    );
    assert.match(sellerFetch, /apiClient\.get\(`\/listings\/\$\{listingId\}\/bids`\)/);
    assert.doesNotMatch(sellerFetch, /bid-history/);
    assert.match(details, /shouldShowMakeOffer\(listing, isOwner\)/);
  });

  it('localizes Recent Bids and relative timestamps in English and Arabic', () => {
    assert.match(translations, /recentBids: 'Recent Bids'/);
    assert.match(translations, /recentBids: 'أحدث المزايدات'/);
    assert.match(translations, /viewAllBids: 'View all bids'/);
    assert.match(translations, /viewAllBids: 'عرض كل المزايدات'/);
    assert.match(translations, /minutesAgo: '\{n\} mins ago'/);
    assert.match(translations, /minutesAgo: 'قبل \{n\} دقيقة'/);
    assert.match(translations, /hourAgo: '1 hour ago'/);
    assert.match(translations, /hoursAgo: '\{n\} hours ago'/);
  });
});
