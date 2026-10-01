'use strict';

/**
 * Seller specific-listing Received Bids (source).
 * Run: node --test src/screens/ReceivedListingBidsScreen.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCREEN = path.resolve(__dirname, 'ReceivedListingBidsScreen.js');
const BIDS = path.resolve(__dirname, 'BidsScreen.js');
const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const APP = path.resolve(__dirname, '../../App.js');
const PUBLIC_UI = path.resolve(__dirname, '../utils/listingBidUi.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');

describe('Received listing bids screen', () => {
  const screen = fs.readFileSync(SCREEN, 'utf8');
  const bids = fs.readFileSync(BIDS, 'utf8');
  const details = fs.readFileSync(DETAILS, 'utf8');
  const app = fs.readFileSync(APP, 'utf8');
  const publicUi = fs.readFileSync(PUBLIC_UI, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
  const recent = details.slice(
    details.indexOf('styles.recentBidsBlock'),
    details.indexOf('titleRow')
  );

  it('registers one screen and both seller paths open it', () => {
    assert.match(app, /ReceivedListingBidsScreen/);
    assert.match(app, /name="ReceivedListingBids"/);
    assert.match(bids, /navigate\('ReceivedListingBids'/);
    assert.match(bids, /brandName: item\.brand_name/);
    assert.match(details, /navigate\('ReceivedListingBids'/);
    assert.match(details, /onPress=\{openReceivedBids\}/);
    assert.doesNotMatch(details, /sellerSheet === 'bidders'/);
  });

  it('loads seller bids from GET /listings/:id/bids in API order', () => {
    assert.match(screen, /apiClient\.get\(`\/listings\/\$\{listingId\}\/bids`\)/);
    assert.match(screen, /receivedBidRecords\(response\.data\?\.bids\)/);
    assert.match(screen, /getAuthToken\(\)/);
    assert.doesNotMatch(screen, /\.sort\(/);
    assert.doesNotMatch(screen, /new Set\(/);
    assert.doesNotMatch(screen, /bid-history/);
    assert.doesNotMatch(screen, /\/bids\/received/);
  });

  it('renders bidder name, amount, time, Highest Bid, and Call without a phone label', () => {
    assert.match(screen, /item\.bidder\?\.name/);
    assert.match(screen, /formatJod\(item\.amount\)/);
    assert.match(screen, /formatReceivedBidTimestamp\(item\.created_at/);
    assert.match(screen, /bids\.highestBid/);
    assert.match(screen, /highestReceivedBidId/);
    assert.match(screen, /sellerBid\.call/);
    assert.match(screen, /openPhoneDialer\(phoneNumber/);
    assert.match(screen, /callBidder\(item\.bidder\?\.phone_number\)/);
    assert.doesNotMatch(screen, /\{item\.bidder\?\.phone_number\}/);
    assert.doesNotMatch(screen, /\{bid\.bidder\?\.phone_number\}/);
    assert.doesNotMatch(screen, /bidder\.id/);
    assert.doesNotMatch(screen, /WhatsApp/);
    assert.doesNotMatch(screen, /Accept Bid/);
    assert.doesNotMatch(screen, /Choose Winner/);
    assert.doesNotMatch(screen, /Winner/);
    assert.doesNotMatch(screen, /end-bid/);
    assert.doesNotMatch(screen, /extend-bid/);
  });

  it('shows the live countdown from ends_at and an empty state with no fabricated rows', () => {
    const ui = fs.readFileSync(path.resolve(__dirname, '../utils/receivedBidsUi.js'), 'utf8');
    assert.match(screen, /receivedAuctionHeader\(auction\)/);
    assert.match(screen, /header\.showCountdown/);
    assert.match(screen, /countdownFromEndsAt\(auction\.ends_at, nowMs\)/);
    assert.match(screen, /t\(header\.labelKey\)/);
    assert.match(screen, /t\(header\.valueKey\)/);
    assert.match(screen, /countdown\.clockLabel/);
    assert.match(ui, /status === 'live'/);
    assert.match(ui, /status === 'cancelled'/);
    assert.match(ui, /showCountdown: true/);
    assert.match(ui, /labelKey: 'bids\.completed'/);
    assert.match(ui, /labelKey: 'bids\.cancelled'/);
    assert.match(ui, /valueKey: 'bids\.auctionEnded'/);
    assert.match(ui, /valueKey: 'sellerBid\.bidCancelled'/);
    assert.doesNotMatch(ui, /Winner/);
    assert.match(screen, /bids\.noBidsYet/);
    assert.match(screen, /bids\.totalBids/);
    assert.match(screen, /bids\.bidCountWithNumber/);
    assert.match(screen, /bids\.length/);
    assert.match(screen, /loadError/);
    assert.match(screen, /ActivityIndicator/);
    assert.doesNotMatch(screen, /setInterval\(\(\) => setNowMs[\s\S]*countdownFromEndsAt/);
    assert.doesNotMatch(screen, /Accept Bid/);
    assert.doesNotMatch(screen, /Choose Winner/);
    assert.doesNotMatch(screen, /Go to Listing/);
  });

  it('keeps the overview free of bidder identity and My Bids on Listing Details', () => {
    const received = bids.slice(bids.indexOf('const renderReceivedItem'), bids.indexOf('const renderItem'));
    assert.match(received, /auction\.bid_count/);
    assert.match(received, /bidCountWithNumber/);
    assert.doesNotMatch(received, /phone_number/);
    assert.doesNotMatch(received, /bidder/);
    assert.doesNotMatch(received, /openPhoneDialer/);
    assert.match(bids, /navigate\('ListingDetails', \{ listingId \}\)/);
    assert.match(bids, /useState\('my'\)/);
  });

  it('does not put bidder identity on buyer public bid history', () => {
    assert.doesNotMatch(recent, /phone_number/);
    assert.doesNotMatch(recent, /bid\.bidder/);
    assert.match(publicUi, /amount: String\(row\.amount\)/);
    assert.match(publicUi, /created_at: row\.created_at/);
    assert.doesNotMatch(publicUi, /phone_number/);
    assert.match(details, /canPlaceBidOnListing\(listing\)/);
    assert.match(details, /shouldShowMakeOffer\(listing, isOwner\)/);
  });

  it('uses theme tokens, RTL helpers, and EN/AR copy', () => {
    assert.match(screen, /useTheme\(\)/);
    assert.match(screen, /colors\.primary/);
    assert.match(screen, /colors\.background/);
    assert.match(screen, /colors\.surface/);
    assert.match(screen, /getFlexDirection\(isRTL/);
    assert.match(screen, /getTextAlign\(isRTL/);
    assert.match(screen, /isRTL \? 'arrow-forward' : 'arrow-back'/);
    assert.doesNotMatch(screen, /#[0-9A-Fa-f]{3,8}/);
    assert.match(translations, /highestBid: 'Highest Bid'/);
    assert.match(translations, /highestBid: 'أعلى مزايدة'/);
    assert.match(translations, /bidTimeToday: 'Today, \{time\}'/);
    assert.match(translations, /bidTimeToday: 'اليوم، \{time\}'/);
    assert.match(translations, /listingsWithReceivedBids: '\{count\} listings with received bids'/);
    assert.match(translations, /receivedBidsCount: 'Received Bids \{count\}'/);
    assert.match(translations, /viewBiddersWithCount: 'View Bids \(\{count\}\)'/);
    assert.match(translations, /viewBiddersWithCount: 'عرض المزايدات \(\{count\}\)'/);
  });
});
