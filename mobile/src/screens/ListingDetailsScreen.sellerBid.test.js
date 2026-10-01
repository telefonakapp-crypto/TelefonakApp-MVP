'use strict';

/**
 * Listing Details seller Bid management (source).
 * Run: node --test src/screens/ListingDetailsScreen.sellerBid.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const DURATION = path.resolve(__dirname, '../utils/auctionDuration.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');

describe('Listing Details seller Bid management', () => {
  const details = fs.readFileSync(DETAILS, 'utf8');
  const duration = fs.readFileSync(DURATION, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');

  it('gates seller controls to live Bid owners and never to Normal or buyers', () => {
    assert.match(details, /canManageLiveBid\(listing\)/);
    assert.match(details, /canExtendLiveBid\(listing\)/);
    assert.match(details, /sellerBid\.liveAuction/);
    assert.match(details, /sellerBid\.viewBiddersWithCount/);
    assert.match(details, /sellerBid\.extendBidDuration/);
    assert.match(details, /sellerBid\.endBidEarly/);
    assert.match(details, /auction\.bid_count/);
    assert.match(details, /sellerBid\.endBid/);
    assert.match(details, /sellerBid\.extendBid/);
    assert.doesNotMatch(details, /sellerBid\.yourLiveAuction/);
    assert.match(details, /sellerBid\.liveAuctionLockedTitle/);
    assert.match(details, /listingDetails\.insights/);
    assert.match(details, /canPlaceBidOnListing\(listing\)/);
    assert.doesNotMatch(details, /Seller View/);
    const hero = details.slice(
      details.indexOf('styles.sellerLiveHero'),
      details.indexOf('styles.sellerLiveActions')
    );
    assert.match(hero, /bidCountWithNumber/);
    assert.doesNotMatch(hero, /recentBids/);
  });

  it('View Bids opens the listing Received Bids screen without a bidder sheet', () => {
    assert.match(details, /navigate\('ReceivedListingBids'/);
    assert.match(details, /brandName: listing\?\.brand_name/);
    assert.match(details, /onPress=\{openReceivedBids\}/);
    assert.doesNotMatch(details, /openBiddersSheet/);
    assert.doesNotMatch(details, /sellerSheet === 'bidders'/);
    assert.match(details, /apiClient\.get\(`\/listings\/\$\{listingId\}\/bids`\)/);
    assert.match(details, /bid\.bidder\?\.name/);
    assert.match(details, /sellerBid\.noBiddersYet/);
  });

  it('End Bid sold sends winning_bid_id only and cancel sends action cancel', () => {
    assert.match(details, /\/listings\/\$\{listingId\}\/end-bid/);
    assert.match(details, /buildSoldEndBidBody\(winningBidId\)/);
    assert.match(details, /buildCancelEndBidBody\(\)/);
    assert.match(details, /selectedWinningBidId/);
    assert.doesNotMatch(details, /highest bidder/i);
    assert.doesNotMatch(details, /action: 'other'/);
    const soldSubmit = details.slice(
      details.indexOf('submitEndBidSold'),
      details.indexOf('submitEndBidCancel')
    );
    assert.doesNotMatch(soldSubmit, /bidder_id/);
    assert.doesNotMatch(soldSubmit, /winning_bid_id: sellerBids/);
    const cancelSubmit = details.slice(
      details.indexOf('submitEndBidCancel'),
      details.indexOf('openExtendSheet')
    );
    assert.match(cancelSubmit, /buildCancelEndBidBody\(\)/);
    assert.doesNotMatch(cancelSubmit, /winning_bid_id/);
  });

  it('Extend uses auctionDuration.js, posts duration_hours, and serializes with End Bid', () => {
    assert.match(details, /auctionDurationOptions\(\)/);
    assert.match(details, /\/listings\/\$\{listingId\}\/extend-bid/);
    assert.match(details, /buildExtendBidBody\(hours\)/);
    assert.match(details, /applyExtendToListing/);
    assert.match(details, /endBidSubmitting \|\| extendBidSubmitting/);
    assert.match(duration, /24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168/);
  });

  it('closes seller UI and refetches on AUCTION_ENDED / AUCTION_NOT_LIVE', () => {
    assert.match(details, /bidErrorShouldCloseSellerUi/);
    assert.match(details, /handleSellerAuctionGone/);
    assert.match(details, /isInvalidWinningBidError/);
    assert.match(details, /fetchListingDetails\(\)/);
  });

  it('localizes seller Bid copy in English and Arabic', () => {
    assert.match(translations, /viewBidders: 'View Bids'/);
    assert.match(translations, /viewBidders: 'عرض المزايدات'/);
    assert.match(translations, /viewBiddersWithCount: 'View Bids \(\{count\}\)'/);
    assert.match(translations, /yourLiveAuction: 'Your Live Auction'/);
    assert.match(translations, /yourLiveAuction: 'مزايدتك المباشرة'/);
    assert.match(translations, /liveAuctionLockedTitle:/);
    assert.match(translations, /soldToBidder: 'Sold to a bidder'/);
    assert.match(translations, /noLongerSell: 'No longer want to sell'/);
    assert.match(translations, /sellConfirm:/);
    assert.match(translations, /cancelConfirm:/);
    assert.match(translations, /listAgain: 'List Again'/);
    assert.match(translations, /listAgain: 'عرض مرة أخرى'/);
  });
});
