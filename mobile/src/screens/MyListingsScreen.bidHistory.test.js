'use strict';

/**
 * My Listings Active/History + Bid presentation (source).
 * Run: node --test src/screens/MyListingsScreen.bidHistory.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCREEN = path.resolve(__dirname, 'MyListingsScreen.js');
const CARD = path.resolve(__dirname, '../components/MyListingCard.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');
const BADGE = path.resolve(__dirname, '../components/ui/StatusBadge.js');

describe('My Listings Bid history and presentation', () => {
  const screen = fs.readFileSync(SCREEN, 'utf8');
  const card = fs.readFileSync(CARD, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
  const badge = fs.readFileSync(BADGE, 'utf8');

  it('classifies History with partitionOwnerListings instead of sold/deleted only', () => {
    assert.match(screen, /partitionOwnerListings/);
    assert.match(screen, /isHistoryListingStatus/);
    assert.doesNotMatch(screen, /TERMINAL_STATUSES/);
    assert.match(screen, /endedBids: endedBidListings/);
    assert.match(screen, /history: historyListings/);
    assert.match(screen, /myListings\.bidDurationEnded/);
    assert.match(screen, /isLiveBidListing/);
    assert.match(screen, /myListings\.liveBidFrozen/);
  });

  it('localizes bid_duration_ended and never falls through to the raw status', () => {
    assert.match(screen, /case 'bid_duration_ended':/);
    assert.match(screen, /t\('myListings\.bidDurationEnded'\)/);
    const getStatusText = screen.slice(
      screen.indexOf('const getStatusText'),
      screen.indexOf('const handleMarkAsSold')
    );
    assert.doesNotMatch(
      getStatusText.replace("case 'bid_duration_ended':", ''),
      /bid_duration_ended/
    );
    assert.match(translations, /bid: 'Bid'/);
    assert.match(translations, /bid: 'مزايدة'/);
    assert.match(translations, /bidDurationEnded: 'Bid Duration Ended'/);
    assert.match(translations, /bidDurationEnded: 'انتهت مدة المزايدة'/);
  });

  it('passes a Bid chip label only for Bid listings and leaves Normal cards without it', () => {
    assert.match(card, /saleTypeLabel/);
    assert.match(card, /Chip/);
    assert.match(
      screen,
      /listing\.sale_type === 'bid' \? t\('myListings\.bid'\) : null/
    );
    assert.match(card, /\{saleTypeLabel \? \(/);
    assert.match(badge, /bid_duration_ended: 'sold'/);
  });

  it('keeps the listing object including auction.can_list_again', () => {
    assert.match(screen, /setListings\(response\.data\.listings \|\| \[\]\)/);
    assert.match(screen, /listing=\{listing\}/);
    assert.doesNotMatch(screen, /delete listing\.auction/);
    assert.match(screen, /canListAgain\(listing, \{ isOwner: true \}\)/);
    assert.doesNotMatch(card, /listing\.auction\s*=/);
  });

  it('does not add End Bid or Place Bid actions', () => {
    assert.doesNotMatch(screen, /endBid|placeBid/i);
    assert.doesNotMatch(card, /endBid|placeBid/i);
  });
});
