'use strict';

/**
 * Phase 8 Bid localization + notification copy.
 * Run: node --test src/utils/__tests__/bidLocalization.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const BID_LEAF_KEYS = [
  'startingPrice',
  'currentHighestBid',
  'noBidsYet',
  'minimumNextBid',
  'maximumBid',
  'timeRemaining',
  'endingIn',
  'minNextBid',
  'yourHighestBid',
  'youAreHighest',
  'youAreOutbid',
      'bidCountWithNumber',
  'recentBids',
  'viewAllBids',
  'justNow',
  'minuteAgo',
  'minutesAgo',
  'hourAgo',
  'hoursAgo',
  'dayAgo',
  'daysAgo',
  'placeBid',
  'yourBid',
  'bidHistory',
  'yourBids',
  'highest',
  'amountRequired',
  'invalidAmount',
  'tooLow',
  'tooHigh',
  'auctionEnded',
  'auctionNotLive',
  'cannotBidOwn',
  'cannotBidListing',
  'placeBidFailed',
  'pendingStart',
  'auctionUnavailable',
  'bidPlaced',
  'noOwnBids',
  'bidCount',
  'amountLabel',
  'viewYourBids',
  'myBids',
  'receivedBids',
  'receivedBidsCount',
  'listingsWithReceivedBids',
  'highestShort',
  'highestBid',
  'totalBids',
  'bidTimeToday',
  'bidTimeYesterday',
  'bidTimeOn',
  'endsToday',
  'endsTomorrow',
  'endsOn',
  'noBidsReceived',
  'loadFailed',
  'winningBid',
  'live',
  'cancelled',
  'completed',
];

const SELLER_LEAF_KEYS = [
  'viewBidders',
  'viewBiddersWithCount',
  'liveAuction',
  'yourLiveAuction',
  'liveAuctionLockedTitle',
  'liveAuctionLockedBody',
  'bidders',
  'extendBid',
  'extendBidDuration',
  'endBid',
  'endBidEarly',
  'soldToBidder',
  'noLongerSell',
  'selectBidder',
  'confirmSale',
  'confirmCancel',
  'sellConfirm',
  'cancelConfirm',
  'bidder',
  'bidAmount',
  'bidTime',
  'call',
  'noBiddersYet',
  'extension',
  'selectExtension',
  'extensionUsed',
  'bidExtended',
  'bidEnded',
  'bidCancelled',
  'loadBiddersFailed',
  'endFailed',
  'extendFailed',
  'selectBid',
  'invalidBid',
  'notOwner',
  'cannotManage',
  'extensionExceedsMax',
  'listAgain',
  'selectDuration',
  'confirmListAgain',
  'listAgainSuccessTitle',
  'listAgainSuccess',
  'listAgainFailed',
  'listAgainNotEligible',
  'listAgainAlreadyUsed',
];

const CREATE_LEAF_KEYS = [
  'startingPriceRequired',
  'pleaseSelectDuration',
  'invalidAuctionDuration',
  'saleType',
  'saleTypeNormal',
  'saleTypeBid',
  'startingPrice',
  'duration',
  'bidDuration',
  'selectDuration',
  'listingSubtitle',
  'listingSubtitleBid',
  'bidCreateHelper',
  'bidCreateHelperApproved',
];

async function loadTranslations() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'translations.js')).href;
  const mod = await import(moduleUrl);
  return mod.translations;
}

function assertLeaf(enNode, arNode, key) {
  assert.equal(typeof enNode[key], 'string', `missing EN ${key}`);
  assert.equal(typeof arNode[key], 'string', `missing AR ${key}`);
  assert.notEqual(enNode[key].trim(), '', `empty EN ${key}`);
  assert.notEqual(arNode[key].trim(), '', `empty AR ${key}`);
  assert.notEqual(arNode[key], key);
}

describe('Bid EN/AR localization', () => {
  it('has matching Bid UI keys in English and Arabic', async () => {
    const translations = await loadTranslations();
    BID_LEAF_KEYS.forEach((key) => assertLeaf(translations.en.bids, translations.ar.bids, key));
    SELLER_LEAF_KEYS.forEach((key) =>
      assertLeaf(translations.en.sellerBid, translations.ar.sellerBid, key)
    );
    CREATE_LEAF_KEYS.forEach((key) =>
      assertLeaf(translations.en.createListing, translations.ar.createListing, key)
    );
    assert.equal(translations.en.home.bidsNav, 'Bids');
    assert.equal(translations.ar.home.bidsNav, 'المزايدات');
    assert.equal(translations.en.myListings.bidDurationEnded, 'Bid Duration Ended');
    assert.equal(typeof translations.ar.myListings.bidDurationEnded, 'string');
    assert.equal(typeof translations.ar.myListings.liveBidFrozen, 'string');
  });

  it('localizes Bid one-hour notification labels without rewriting EN stored copy', async () => {
    const translations = await loadTranslations();
    const en = translations.en.notifications.types.bidOneHourRemaining;
    const ar = translations.ar.notifications.types.bidOneHourRemaining;
    assert.equal(en.title, 'Bid ending soon');
    assert.match(en.message, /1 hour remaining/);
    assert.equal(ar.title, 'المزايدة تنتهي قريباً');
    assert.match(ar.message, /\{listing\}/);
    assert.equal(/[A-Za-z]{4,}/.test(ar.title), false);
  });

  it('keeps Bid error strings Bid-termed rather than leftover Auction wording', async () => {
    const translations = await loadTranslations();
    assert.equal(translations.en.bids.auctionEnded, 'Bid has ended');
    assert.equal(translations.en.bids.auctionNotLive, 'This Bid is not live');
    assert.equal(translations.en.bids.auctionUnavailable, 'Bid details are unavailable.');
    assert.equal(
      translations.en.createListing.invalidAuctionDuration,
      'Please choose a valid Bid duration.'
    );
    assert.equal(translations.ar.bids.auctionEnded, 'انتهت المزايدة');
    assert.equal(translations.ar.bids.placeBid, 'قدّم مزايدة');
    assert.equal(translations.ar.sellerBid.viewBidders, 'عرض المزايدات');
    assert.equal(translations.ar.sellerBid.listAgain, 'عرض مرة أخرى');
  });
});
