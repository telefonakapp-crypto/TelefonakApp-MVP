'use strict';

/**
 * Bids navigation + My/Received Bids (source).
 * Run: node --test src/screens/BidsScreen.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BIDS = path.resolve(__dirname, 'BidsScreen.js');
const NAV = path.resolve(__dirname, 'HomeScreen/HomeBottomNav.js');
const HOME = path.resolve(__dirname, 'HomeScreen/index.js');
const APP = path.resolve(__dirname, '../../App.js');
const SAVED = path.resolve(__dirname, 'SavedListingsScreen.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');
const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const PLACE_BID = path.resolve(__dirname, 'ListingDetailsScreen.placeBid.test.js');
const SELLER = path.resolve(__dirname, 'ListingDetailsScreen.sellerBid.test.js');
const LIST_AGAIN = path.resolve(__dirname, 'ListingDetailsScreen.listAgain.test.js');

describe('Bids navigation', () => {
  const nav = fs.readFileSync(NAV, 'utf8');
  const home = fs.readFileSync(HOME, 'utf8');
  const app = fs.readFileSync(APP, 'utf8');
  const saved = fs.readFileSync(SAVED, 'utf8');

  it('replaces Saved with Bids in the bottom navigation', () => {
    assert.match(nav, /navigation\.navigate\('Bids'\)/);
    assert.match(nav, /home\.bidsNav/);
    assert.match(nav, /hammer-outline/);
    assert.doesNotMatch(nav, /navigate\('SavedListings'\)/);
    assert.doesNotMatch(nav, /heart-outline/);
    assert.match(home, /Home \| Listings \| Sell \| Offers \| Bids/);
  });

  it('keeps Saved/Favorites via the header heart', () => {
    assert.match(home, /navigate\('SavedListings'\)/);
    assert.match(home, /heart-outline/);
    assert.match(home, /navigate\('Notifications'\)/);
    assert.match(home, /notifications-outline/);
    assert.match(saved, /apiClient\.get\('\/favorites'/);
    assert.match(app, /name="SavedListings"/);
  });

  it('registers BidsScreen on the Bids stack route', () => {
    assert.match(app, /import BidsScreen from '\.\/src\/screens\/BidsScreen'/);
    assert.match(app, /name="Bids" component=\{BidsScreen\}/);
  });
});

describe('Bids screen', () => {
  const bids = fs.readFileSync(BIDS, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
  const details = fs.readFileSync(DETAILS, 'utf8');

  it('defaults to My Bids and switches to Received Bids', () => {
    assert.match(bids, /useState\('my'\)/);
    assert.match(bids, /switchSegment\('received'\)/);
    assert.match(bids, /switchSegment\('my'\)/);
    assert.match(bids, /bids\.myBids/);
    assert.match(bids, /bids\.receivedBids/);
  });

  it('calls GET /bids/my and GET /bids/received with limit/offset and skips guests', () => {
    assert.match(bids, /apiClient\.get\(\s*tab === 'my' \? '\/bids\/my' : '\/bids\/received'/);
    assert.match(bids, /buildBidsQuery\(offset\)/);
    assert.match(bids, /getAuthToken\(\)/);
    assert.match(bids, /if \(!token\)/);
    assert.match(bids, /inFlight\.current\[tab\]/);
    assert.match(bids, /offset: listings\.length/);
    assert.match(bids, /parseBidsPage\(response\.data\)/);
  });

  it('renders live countdown, your bid, highest, ended, cancelled, and listing tap', () => {
    assert.match(bids, /countdownFromEndsAt/);
    assert.match(bids, /auction\.my_highest_bid/);
    assert.match(bids, /auction\.current_highest_bid/);
    assert.match(bids, /auction\.bid_count/);
    assert.match(bids, /isWinningBid\(auction\)/);
    assert.match(bids, /bidRowStatusKey/);
    assert.match(bids, /myListings\.bidDurationEnded/);
    assert.match(bids, /bids\.cancelled/);
    assert.match(bids, /navigate\('ListingDetails', \{ listingId \}\)/);
    assert.match(bids, /navigate\('ReceivedListingBids'/);
    assert.match(bids, /bids\.highestShort/);
    assert.match(bids, /bids\.bidCountWithNumber/);
    assert.match(bids, /bids\.listingsWithReceivedBids/);
    assert.match(bids, /bids\.receivedBidsCount/);
    assert.match(bids, /countdown\.clockLabel/);
    assert.match(bids, /bids\.noBidsYet/);
    assert.match(bids, /bids\.noBidsReceived/);
    assert.match(bids, /HorizontalCardSkeleton/);
    assert.match(bids, /bids\.loadFailed/);
    assert.match(bids, /common\.retry/);
  });

  it('does not expose bidder phones or Phase 4 seller actions', () => {
    assert.doesNotMatch(bids, /phone_number/);
    assert.doesNotMatch(bids, /openPhoneDialer/);
    assert.doesNotMatch(bids, /end-bid/);
    assert.doesNotMatch(bids, /extend-bid/);
    assert.doesNotMatch(bids, /sellerBid\.viewBidders/);
    assert.doesNotMatch(bids, /can_end_bid/);
  });

  it('keeps RTL helpers and EN/AR Bids copy', () => {
    assert.match(bids, /getFlexDirection\(isRTL/);
    assert.match(bids, /getTextAlign\(isRTL/);
    assert.match(translations, /bidsNav: 'Bids'/);
    assert.match(translations, /bidsNav: 'المزايدات'/);
    assert.match(translations, /myBids: 'My Bids'/);
    assert.match(translations, /myBids: 'مزايداتي'/);
    assert.match(translations, /receivedBids: 'Received Bids'/);
    assert.match(translations, /receivedBids: 'المزايدات المستلمة'/);
    assert.match(translations, /noBidsReceived:/);
    assert.match(translations, /loadFailed: 'Failed to load bids'/);
    assert.match(translations, /winningBid: 'You won'/);
  });

  it('does not rewrite Listing Details Phase 3–5 behavior', () => {
    assert.match(details, /canPlaceBidOnListing/);
    assert.match(details, /canManageLiveBid/);
    assert.match(details, /canListAgain/);
    assert.match(details, /shouldShowMakeOffer/);
    assert.equal(fs.existsSync(PLACE_BID), true);
    assert.equal(fs.existsSync(SELLER), true);
    assert.equal(fs.existsSync(LIST_AGAIN), true);
  });
});
