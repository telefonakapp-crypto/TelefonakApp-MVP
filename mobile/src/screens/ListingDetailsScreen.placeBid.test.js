'use strict';

/**
 * Listing Details Bid vs Normal (source).
 * Run: node --test src/screens/ListingDetailsScreen.placeBid.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');

describe('Listing Details Place Bid', () => {
  const details = fs.readFileSync(DETAILS, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');

  it('keeps Normal price and Make Offer gating', () => {
    assert.match(details, /\{listing\.price\}/);
    assert.match(details, /shouldShowMakeOffer\(listing, isOwner\)/);
    assert.match(details, /offers\.makeAnOffer/);
  });

  it('hides Make Offer for Bid and shows auction fields from listing.auction', () => {
    assert.match(details, /isBidListing\(listing\)/);
    assert.match(details, /canPlaceBidOnListing\(listing\)/);
    assert.match(details, /bids\.startingPrice/);
    assert.match(details, /bids\.currentHighestBid/);
    assert.match(details, /bids\.noBidsYet/);
    assert.match(details, /bids\.minimumNextBid/);
    assert.match(details, /bids\.maximumBid/);
    assert.match(details, /auctionHasBids\(auction\)/);
  });

  it('uses server ends_at for countdown and refetches on zero and AppState active', () => {
    assert.match(details, /countdownFromEndsAt\(auction\?\.ends_at, nowMs\)/);
    assert.match(details, /AppState\.addEventListener/);
    assert.match(details, /expiredRefetchFor/);
    assert.match(details, /fetchListingDetails\(\)/);
    assert.doesNotMatch(details, /duration_hours as/);
    assert.doesNotMatch(details, /setTimeout\(.*winner/i);
  });

  it('Place Bid posts the exact listing id and amount string', () => {
    assert.match(details, /bids\.placeBid/);
    assert.match(
      details,
      /apiClient\.post\(`\/listings\/\$\{listingId\}\/bids`, \{ amount \}\)/
    );
    assert.match(details, /applyPlaceBidToListing\(prev, response\.data\)/);
    assert.match(details, /submittingBid/);
    assert.match(details, /const amount = String\(bidAmount \?\? ''\)\.trim\(\)/);
    const submitBid = details.slice(
      details.indexOf('const submitBid'),
      details.indexOf('const openMyBidsHistory')
    );
    assert.doesNotMatch(submitBid, /offered_price/);
    assert.doesNotMatch(submitBid, /parseFloat\(amount\)/);
  });

  it('maps bid errors and refreshes on too-low / ended / not-live', () => {
    assert.match(details, /bidErrorI18nKey/);
    assert.match(details, /bidErrorNeedsRefresh/);
    assert.match(details, /bidErrorShouldCloseSheet/);
    assert.match(translations, /tooLow: 'Bid is too low'/);
    assert.match(translations, /tooHigh: 'Bid is too high'/);
    assert.match(translations, /auctionEnded: 'Bid has ended'/);
    assert.match(translations, /auctionNotLive: 'This Bid is not live'/);
    assert.match(translations, /cannotBidOwn: 'You cannot bid on your own listing'/);
  });

  it('loads only the authenticated buyer my-bids endpoint', () => {
    const mine = details.slice(
      details.indexOf('openMyBidsHistory'),
      details.indexOf('formatJod')
    );
    assert.match(mine, /apiClient\.get\(`\/listings\/\$\{listingId\}\/my-bids`\)/);
    assert.doesNotMatch(mine, /\/listings\/\$\{listingId\}\/bids`/);
    assert.doesNotMatch(mine, /phone_number/);
    assert.match(details, /bid\.is_highest/);
    assert.match(details, /bids\.noOwnBids/);
  });

  it('loads public Recent Bids from bid-history without inventing bidder identities', () => {
    assert.match(details, /shouldFetchPublicBidHistory/);
    assert.match(
      details,
      /apiClient\.get\(`\/listings\/\$\{listingId\}\/bid-history`, \{\s*params: \{ limit: 4 \}/
    );
    assert.match(details, /sanitizePublicBidHistory/);
    assert.match(details, /formatBidTimeAgo\(bid\.created_at, nowMs, t\)/);
    assert.match(details, /formatJod\(bid\.amount\)/);
    assert.match(details, /auction\.bid_count/);
    assert.match(details, /bids\.viewAllBids/);
    const recent = details.slice(
      details.indexOf('styles.recentBidsBlock'),
      details.indexOf('titleRow')
    );
    assert.doesNotMatch(recent, /onPress/);
    assert.doesNotMatch(recent, /bidder_id/);
    assert.doesNotMatch(recent, /phone_number/);
    assert.match(details, /bids\.viewYourBids/);
    assert.match(details, /isViewerHighestBidder/);
    assert.match(details, /isViewerOutbid/);
    assert.match(details, /bids\.minNextBid/);
    assert.match(details, /KeyboardAvoidingView/);
    const composer = details.slice(
      details.indexOf('styles.bidComposer'),
      details.indexOf('Offer modal')
    );
    assert.doesNotMatch(composer, /phone_number/);
    assert.doesNotMatch(composer, /bidder\?\.name/);
  });

  it('localizes Bid strings in English and Arabic', () => {
    assert.match(translations, /placeBid: 'Place Bid'/);
    assert.match(translations, /placeBid: 'قدّم مزايدة'/);
    assert.match(translations, /startingPrice: 'Starting Price'/);
    assert.match(translations, /noBidsYet: 'No bids yet'/);
    assert.match(translations, /tooLow: 'Bid is too low'/);
    assert.match(translations, /cannotBidOwn: 'You cannot bid on your own listing'/);
  });
});
