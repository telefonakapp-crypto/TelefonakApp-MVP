'use strict';

/**
 * Listing Details Bid owner freeze (source).
 * Run: node --test src/screens/ListingDetailsScreen.bidOwner.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');

describe('Listing Details Bid owner state', () => {
  const details = fs.readFileSync(DETAILS, 'utf8');

  it('uses listingOwnerCapabilities and freezes live Bid normal mutations', () => {
    assert.match(details, /listingOwnerCapabilities\(listing, \{ isOwner \}\)/);
    assert.match(details, /isLiveBidListing/);
    assert.match(details, /canManageLiveBid\(listing\)/);
    assert.match(details, /sellerBid\.liveAuctionLockedBody/);
    assert.match(details, /canListAgain\(listing\)/);
    const liveBlock = details.slice(
      details.indexOf('showManageLiveBid'),
      details.indexOf('showListAgain')
    );
    assert.doesNotMatch(liveBlock, /list-again/);
  });

  it('localizes bid_duration_ended on the status badge', () => {
    assert.match(details, /case 'bid_duration_ended':/);
    assert.match(details, /t\('myListings\.bidDurationEnded'\)/);
    assert.match(details, /label=\{getStatusLabel\(listing\.status\)\}/);
  });

  it('shows a Bid indicator from sale_type without changing Offers', () => {
    assert.match(details, /listing\.sale_type === 'bid'/);
    assert.match(details, /t\('myListings\.bid'\)/);
    assert.match(details, /offers\.makeAnOffer/);
    assert.match(details, /navigation\.push\(\s*'Offers'/);
  });
});
