'use strict';

/**
 * My Listings List Again (source).
 * Run: node --test src/screens/MyListingsScreen.listAgain.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCREEN = path.resolve(__dirname, 'MyListingsScreen.js');
const CARD = path.resolve(__dirname, '../components/MyListingCard.js');
const DURATION = path.resolve(__dirname, '../utils/auctionDuration.js');

describe('My Listings List Again', () => {
  const screen = fs.readFileSync(SCREEN, 'utf8');
  const card = fs.readFileSync(CARD, 'utf8');
  const duration = fs.readFileSync(DURATION, 'utf8');
  const submit = screen.slice(
    screen.indexOf('const submitListAgain'),
    screen.indexOf('const confirmListAgain')
  );

  it('shows List Again on history cards only through canListAgain', () => {
    assert.match(screen, /canListAgain\(listing, \{ isOwner: true \}\)/);
    assert.match(screen, /showListAgain=\{showListAgain\}/);
    assert.match(card, /showListAgain/);
    assert.match(card, /onListAgain/);
    assert.match(screen, /sellerBid\.listAgain/);
    assert.doesNotMatch(screen, /can_list_again === true \|\| true/);
  });

  it('posts the original listing id with duration_hours from auctionDuration.js', () => {
    assert.match(screen, /\/listings\/\$\{listingId\}\/list-again/);
    assert.match(screen, /buildListAgainBody\(hours\)/);
    assert.match(screen, /auctionDurationOptions\(\)/);
    assert.match(screen, /DEFAULT_AUCTION_DURATION_HOURS/);
    assert.match(duration, /24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168/);
    assert.doesNotMatch(submit, /starting_price/);
    assert.doesNotMatch(submit, /auction_id/);
    assert.doesNotMatch(submit, /bidder_id/);
  });

  it('confirms, blocks duplicate POST, and refreshes without mutating the old listing', () => {
    assert.match(screen, /confirmListAgain/);
    assert.match(screen, /listAgainSubmitting/);
    assert.match(submit, /if \(listAgainSubmitting\) return/);
    assert.match(submit, /fetchListings\(\)/);
    assert.match(submit, /bidErrorShouldCloseListAgain/);
    assert.match(submit, /sellerBid\.listAgainSuccess/);
    assert.doesNotMatch(submit, /setListings\(/);
    assert.doesNotMatch(submit, /status: 'approved'/);
    assert.doesNotMatch(submit, /auction_status: 'live'/);
  });
});
