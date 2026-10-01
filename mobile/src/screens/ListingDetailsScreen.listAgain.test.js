'use strict';

/**
 * Listing Details List Again (source).
 * Run: node --test src/screens/ListingDetailsScreen.listAgain.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const DURATION = path.resolve(__dirname, '../utils/auctionDuration.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');

describe('Listing Details List Again', () => {
  const details = fs.readFileSync(DETAILS, 'utf8');
  const duration = fs.readFileSync(DURATION, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
  const submit = details.slice(
    details.indexOf('const submitListAgain'),
    details.indexOf('const confirmListAgain')
  );

  it('gates List Again with canListAgain and never uses live Bid controls', () => {
    assert.match(details, /canListAgain\(listing\)/);
    assert.match(details, /showListAgain \? \(/);
    assert.match(details, /sellerBid\.listAgain/);
    assert.match(details, /canManageLiveBid\(listing\)/);
    assert.match(details, /canPlaceBidOnListing\(listing\)/);
  });

  it('posts list-again with numeric duration_hours only', () => {
    assert.match(details, /\/listings\/\$\{listingId\}\/list-again/);
    assert.match(details, /buildListAgainBody\(hours\)/);
    assert.match(details, /auctionDurationOptions\(\)/);
    assert.match(details, /DEFAULT_AUCTION_DURATION_HOURS/);
    assert.match(duration, /24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168/);
    assert.doesNotMatch(submit, /starting_price/);
    assert.doesNotMatch(submit, /auction_id/);
    assert.doesNotMatch(submit, /bidder_id/);
    assert.doesNotMatch(submit, /setListing\(/);
  });

  it('confirms, prevents duplicate submit, and refetches the original listing', () => {
    assert.match(details, /sellerBid\.confirmListAgain/);
    assert.match(details, /listAgainSubmitting/);
    assert.match(details, /endBidSubmitting \|\| extendBidSubmitting \|\| listAgainSubmitting/);
    assert.match(submit, /fetchListingDetails\(\)/);
    assert.match(submit, /bidErrorShouldCloseListAgain/);
    assert.match(submit, /sellerBid\.listAgainSuccess/);
    assert.doesNotMatch(submit, /sellerBid\.listAgainSuccessTitle[\s\S]*setListing/);
  });

  it('localizes List Again copy in English and Arabic', () => {
    assert.match(translations, /listAgain: 'List Again'/);
    assert.match(translations, /listAgain: 'عرض مرة أخرى'/);
    assert.match(translations, /confirmListAgain:/);
    assert.match(translations, /listAgainSuccessTitle: 'Listed Again'/);
    assert.match(translations, /listAgainSuccess:/);
    assert.match(translations, /listAgainFailed:/);
    assert.match(translations, /listAgainNotEligible:/);
    assert.match(translations, /listAgainAlreadyUsed:/);
    assert.match(translations, /duration1Day: '1 day'/);
    assert.match(translations, /duration1Day: 'يوم واحد'/);
  });
});
