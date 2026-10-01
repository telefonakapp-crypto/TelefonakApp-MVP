'use strict';

/**
 * Run: node --test src/utils/__tests__/listingBidUi.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadUi() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'listingBidUi.js')).href;
  return import(moduleUrl);
}

async function loadErrors() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'bidApiErrors.js')).href;
  return import(moduleUrl);
}

const liveBid = {
  sale_type: 'bid',
  status: 'approved',
  is_owner: false,
  auction: {
    auction_status: 'live',
    starting_price: '300.00',
    current_highest_bid: null,
    minimum_next_bid: '305.00',
    maximum_bid: '600.00',
    ends_at: '2026-06-01T12:00:00.000Z',
    bid_count: 0,
    has_my_bids: false,
  },
};

describe('listingBidUi Make Offer vs Place Bid', () => {
  it('Normal approved still shows Make Offer', async () => {
    const { shouldShowMakeOffer, canPlaceBidOnListing } = await loadUi();
    const listing = { sale_type: 'normal', status: 'approved', has_my_offer: false };
    assert.equal(shouldShowMakeOffer(listing, false), true);
    assert.equal(canPlaceBidOnListing(listing), false);
  });

  it('Bid approved/live hides Make Offer and allows Place Bid for buyers', async () => {
    const { shouldShowMakeOffer, canPlaceBidOnListing } = await loadUi();
    assert.equal(shouldShowMakeOffer(liveBid, false), false);
    assert.equal(canPlaceBidOnListing(liveBid), true);
  });

  it('owner Bid does not show Place Bid or Make Offer', async () => {
    const { shouldShowMakeOffer, canPlaceBidOnListing } = await loadUi();
    const owner = { ...liveBid, is_owner: true };
    assert.equal(shouldShowMakeOffer(owner, true), false);
    assert.equal(canPlaceBidOnListing(owner), false);
  });

  it('pending, completed, cancelled, and missing auction cannot Place Bid', async () => {
    const { canPlaceBidOnListing } = await loadUi();
    assert.equal(
      canPlaceBidOnListing({
        ...liveBid,
        auction: { ...liveBid.auction, auction_status: 'pending_start' },
      }),
      false
    );
    assert.equal(
      canPlaceBidOnListing({
        ...liveBid,
        auction: { ...liveBid.auction, auction_status: 'completed' },
      }),
      false
    );
    assert.equal(
      canPlaceBidOnListing({
        ...liveBid,
        auction: { ...liveBid.auction, auction_status: 'cancelled' },
      }),
      false
    );
    assert.equal(
      canPlaceBidOnListing({
        ...liveBid,
        auction: { ...liveBid.auction, auction_status: 'ended' },
      }),
      false
    );
    assert.equal(canPlaceBidOnListing({ ...liveBid, auction: null }), false);
    assert.equal(
      canPlaceBidOnListing({
        ...liveBid,
        auction: { ...liveBid.auction, minimum_next_bid: null },
      }),
      false
    );
  });

  it('no bids is empty; Place Bid still uses backend minimum_next_bid', async () => {
    const { auctionHasBids, canPlaceBidOnListing } = await loadUi();
    assert.equal(auctionHasBids(liveBid.auction), false);
    assert.equal(canPlaceBidOnListing(liveBid), true);
  });

  it('highest/outbid display uses stored my_highest vs current_highest only', async () => {
    const { isViewerHighestBidder, isViewerOutbid } = await loadUi();
    const leading = {
      has_my_bids: true,
      current_highest_bid: '350.00',
      my_highest_bid: '350.00',
    };
    const behind = {
      has_my_bids: true,
      current_highest_bid: '350.00',
      my_highest_bid: '340.00',
    };
    assert.equal(isViewerHighestBidder(leading), true);
    assert.equal(isViewerOutbid(leading), false);
    assert.equal(isViewerHighestBidder(behind), false);
    assert.equal(isViewerOutbid(behind), true);
    assert.equal(isViewerHighestBidder({ has_my_bids: false, current_highest_bid: '350.00' }), false);
    assert.equal(isViewerOutbid({ has_my_bids: false, current_highest_bid: '350.00' }), false);
  });

  it('bid amount keeps the typed string and rejects empty/invalid', async () => {
    const { bidAmountIssue } = await loadUi();
    assert.equal(bidAmountIssue(''), 'amountRequired');
    assert.equal(bidAmountIssue('305'), null);
    assert.equal(bidAmountIssue('305.50'), null);
    assert.equal(bidAmountIssue('310.25'), null);
    assert.equal(bidAmountIssue('305.555'), 'invalidAmount');
    assert.equal(bidAmountIssue('abc'), 'invalidAmount');
  });

  it('successful bid payload updates auction fields without inventing ends_at', async () => {
    const { applyPlaceBidToListing } = await loadUi();
    const next = applyPlaceBidToListing(liveBid, {
      bid: { id: 9, amount: '310.00' },
      highest_bid: '310.00',
      minimum_next_bid: '315.00',
      maximum_bid: '600.00',
      auction_status: 'live',
      ends_at: '2026-06-01T12:00:00.000Z',
    });
    assert.equal(next.auction.current_highest_bid, '310.00');
    assert.equal(next.auction.minimum_next_bid, '315.00');
    assert.equal(next.auction.has_my_bids, true);
    assert.equal(next.auction.my_highest_bid, '310.00');
    assert.equal(next.auction.ends_at, liveBid.auction.ends_at);
  });
});

describe('listingBidUi List Again eligibility', () => {
  const expiredOwner = {
    sale_type: 'bid',
    status: 'bid_duration_ended',
    is_owner: true,
    auction: {
      auction_status: 'completed',
      completion_source: 'expired',
      can_list_again: true,
    },
  };

  it('shows List Again only for eligible expired Bid owners', async () => {
    const { canListAgain, canManageLiveBid, canPlaceBidOnListing, shouldShowMakeOffer } =
      await loadUi();
    assert.equal(canListAgain(expiredOwner), true);
    assert.equal(canListAgain(expiredOwner, { isOwner: true }), true);
    assert.equal(canManageLiveBid(expiredOwner), false);
    assert.equal(canPlaceBidOnListing(expiredOwner), false);

    assert.equal(
      canListAgain({ ...expiredOwner, auction: { ...expiredOwner.auction, can_list_again: false } }),
      false
    );
    const missingFlag = {
      ...expiredOwner,
      auction: {
        auction_status: 'completed',
        completion_source: 'expired',
      },
    };
    assert.equal(canListAgain(missingFlag), false);
    assert.equal(
      canListAgain({ sale_type: 'normal', is_owner: true, status: 'sold', auction: { can_list_again: true } }),
      false
    );
    assert.equal(
      canListAgain({
        ...liveBid,
        is_owner: true,
        auction: { ...liveBid.auction, can_list_again: false },
      }),
      false
    );
    assert.equal(
      canListAgain({
        ...liveBid,
        is_owner: true,
        status: 'approved',
        auction: { auction_status: 'pending_start', can_list_again: false },
      }),
      false
    );
    assert.equal(
      canListAgain({
        ...expiredOwner,
        auction: {
          auction_status: 'cancelled',
          completion_source: 'cancelled',
          can_list_again: false,
        },
      }),
      false
    );
    assert.equal(
      canListAgain({
        ...expiredOwner,
        auction: {
          auction_status: 'completed',
          completion_source: 'sold',
          can_list_again: false,
        },
      }),
      false
    );
    assert.equal(
      canListAgain({
        ...expiredOwner,
        auction: {
          auction_status: 'completed',
          completion_source: 'sold',
          can_list_again: true,
        },
      }),
      false
    );
    assert.equal(canListAgain({ ...expiredOwner, is_owner: false }), false);
    assert.equal(canListAgain(expiredOwner, { isOwner: false }), false);
    assert.equal(shouldShowMakeOffer({ sale_type: 'normal', status: 'approved', has_my_offer: false }, false), true);
  });
});

describe('listingBidUi seller management', () => {
  it('shows End/View Bidders only for live Bid owners', async () => {
    const { canManageLiveBid, canExtendLiveBid, canPlaceBidOnListing } = await loadUi();
    const ownerLive = { ...liveBid, is_owner: true };
    assert.equal(canManageLiveBid(ownerLive), true);
    assert.equal(canExtendLiveBid(ownerLive), true);
    assert.equal(canPlaceBidOnListing(ownerLive), false);
    assert.equal(canManageLiveBid(liveBid), false);
    assert.equal(
      canManageLiveBid({ sale_type: 'normal', is_owner: true, status: 'approved' }),
      false
    );
    assert.equal(
      canManageLiveBid({
        ...ownerLive,
        auction: { ...ownerLive.auction, auction_status: 'pending_start' },
      }),
      false
    );
    assert.equal(
      canManageLiveBid({
        ...ownerLive,
        auction: { ...ownerLive.auction, auction_status: 'completed' },
      }),
      false
    );
  });

  it('hides Extend when extension_used is true', async () => {
    const { canExtendLiveBid, canManageLiveBid, applyExtendToListing } = await loadUi();
    const ownerLive = { ...liveBid, is_owner: true };
    assert.equal(canExtendLiveBid(ownerLive), true);
    const used = {
      ...ownerLive,
      auction: { ...ownerLive.auction, extension_used: true },
    };
    assert.equal(canManageLiveBid(used), true);
    assert.equal(canExtendLiveBid(used), false);
    const extended = applyExtendToListing(ownerLive, {
      auction: {
        ends_at: '2026-06-02T12:00:00.000Z',
        extension_used: true,
        auction_status: 'live',
      },
    });
    assert.equal(extended.auction.extension_used, true);
    assert.equal(extended.auction.ends_at, '2026-06-02T12:00:00.000Z');
    assert.equal(canExtendLiveBid(extended), false);
  });

  it('builds End Bid and Extend bodies without extra winner fields', async () => {
    const {
      buildSoldEndBidBody,
      buildCancelEndBidBody,
      buildExtendBidBody,
      buildListAgainBody,
      fillTemplate,
    } = await loadUi();
    const sold = buildSoldEndBidBody(44);
    assert.deepEqual(sold, { action: 'sold', winning_bid_id: 44 });
    assert.equal(Object.prototype.hasOwnProperty.call(sold, 'bidder_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(sold, 'amount'), false);
    const cancel = buildCancelEndBidBody();
    assert.deepEqual(cancel, { action: 'cancel' });
    assert.equal(Object.prototype.hasOwnProperty.call(cancel, 'winning_bid_id'), false);
    assert.deepEqual(buildExtendBidBody(24), { duration_hours: 24 });
    assert.deepEqual(buildListAgainBody(48), { duration_hours: 48 });
    assert.equal(Object.prototype.hasOwnProperty.call(buildListAgainBody(48), 'starting_price'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(buildListAgainBody(48), 'auction_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(buildListAgainBody(48), 'bidder_id'), false);
    assert.equal(
      fillTemplate('Sell to {name} for {amount} JOD?', { name: 'Ada', amount: '315.00' }),
      'Sell to Ada for 315.00 JOD?'
    );
  });
});

describe('bidApiErrors', () => {
  it('maps known codes and flags refresh for too-low and ended/not-live', async () => {
    const { bidErrorI18nKey, bidErrorNeedsRefresh, bidErrorShouldCloseSheet } =
      await loadErrors();
    const err = (code) => ({ response: { data: { code } } });
    assert.equal(bidErrorI18nKey(err('BID_TOO_LOW')), 'bids.tooLow');
    assert.equal(bidErrorI18nKey(err('BID_TOO_HIGH')), 'bids.tooHigh');
    assert.equal(bidErrorI18nKey(err('AUCTION_ENDED')), 'bids.auctionEnded');
    assert.equal(bidErrorI18nKey(err('AUCTION_NOT_LIVE')), 'bids.auctionNotLive');
    assert.equal(bidErrorI18nKey(err('BID_SELF')), 'bids.cannotBidOwn');
    assert.equal(bidErrorI18nKey(err('UNKNOWN')), null);
    assert.equal(bidErrorNeedsRefresh(err('BID_TOO_LOW')), true);
    assert.equal(bidErrorNeedsRefresh(err('AUCTION_ENDED')), true);
    assert.equal(bidErrorNeedsRefresh(err('AUCTION_NOT_LIVE')), true);
    assert.equal(bidErrorNeedsRefresh(err('BID_TOO_HIGH')), false);
    assert.equal(bidErrorShouldCloseSheet(err('AUCTION_ENDED')), true);
    assert.equal(bidErrorShouldCloseSheet(err('BID_TOO_LOW')), false);
    const {
      bidErrorShouldCloseSellerUi,
      isInvalidWinningBidError,
      bidErrorI18nKey: mapKey,
    } = await loadErrors();
    assert.equal(bidErrorShouldCloseSellerUi(err('AUCTION_ENDED')), true);
    assert.equal(bidErrorShouldCloseSellerUi(err('AUCTION_NOT_LIVE')), true);
    assert.equal(bidErrorShouldCloseSellerUi(err('EXTENSION_EXCEEDS_MAX')), false);
    assert.equal(isInvalidWinningBidError(err('WINNING_BID_NOT_FOUND')), true);
    assert.equal(isInvalidWinningBidError(err('BID_TOO_LOW')), false);
    assert.equal(mapKey(err('EXTENSION_ALREADY_USED')), 'sellerBid.extensionUsed');
    assert.equal(mapKey(err('EXTENSION_EXCEEDS_MAX')), 'sellerBid.extensionExceedsMax');
    const { bidErrorShouldCloseListAgain } = await loadErrors();
    assert.equal(mapKey(err('LIST_AGAIN_NOT_ELIGIBLE')), 'sellerBid.listAgainNotEligible');
    assert.equal(mapKey(err('LIST_AGAIN_ALREADY_USED')), 'sellerBid.listAgainAlreadyUsed');
    assert.equal(mapKey(err('INVALID_AUCTION_DURATION')), 'createListing.invalidAuctionDuration');
    assert.equal(mapKey(err('INVALID_BID_AMOUNT')), 'bids.invalidAmount');
    assert.equal(mapKey(err('LISTING_NOT_BIDDABLE')), 'bids.cannotBidListing');
    assert.equal(mapKey(err('AUCTION_LISTING_NOT_FOUND')), 'bids.cannotBidListing');
    assert.equal(mapKey(err('AUCTION_NOT_FOUND')), 'bids.cannotBidListing');
    assert.equal(mapKey(err('LIST_AGAIN_NOT_OWNER')), 'sellerBid.notOwner');
    assert.equal(mapKey(err('LIST_AGAIN_NOT_AUCTION')), 'sellerBid.cannotManage');
    assert.equal(mapKey(err('LIST_AGAIN_NO_IMAGES')), 'sellerBid.listAgainFailed');
    assert.equal(bidErrorShouldCloseListAgain(err('LIST_AGAIN_NOT_ELIGIBLE')), true);
    assert.equal(bidErrorShouldCloseListAgain(err('LIST_AGAIN_ALREADY_USED')), true);
    assert.equal(bidErrorShouldCloseListAgain(err('INVALID_AUCTION_DURATION')), false);
  });
});

describe('listingBidUi public bid history', () => {
  it('fetches public history only for non-owner Bid listings', async () => {
    const { shouldFetchPublicBidHistory } = await loadUi();
    assert.equal(shouldFetchPublicBidHistory(liveBid), true);
    assert.equal(shouldFetchPublicBidHistory({ ...liveBid, is_owner: true }), false);
    assert.equal(
      shouldFetchPublicBidHistory({ sale_type: 'normal', status: 'approved', is_owner: false }),
      false
    );
    assert.equal(shouldFetchPublicBidHistory(null), false);
  });

  it('keeps API order and copies only amount and created_at', async () => {
    const { sanitizePublicBidHistory } = await loadUi();
    const sanitized = sanitizePublicBidHistory({
      bids: [
        {
          amount: '350.00',
          created_at: '2026-09-29T12:00:00.000Z',
          bidder_id: 9,
          seller_id: 1,
          phone_number: '0790000000',
          bidder: { name: 'Hidden' },
        },
        { amount: '340.00', created_at: '2026-09-29T11:00:00.000Z' },
        { amount: '325.00', created_at: '2026-09-29T10:00:00.000Z' },
      ],
      has_more: true,
      limit: 4,
    });
    assert.deepEqual(
      sanitized.bids.map((row) => row.amount),
      ['350.00', '340.00', '325.00']
    );
    assert.deepEqual(Object.keys(sanitized.bids[0]).sort(), ['amount', 'created_at']);
    assert.equal(sanitized.bids[0].bidder_id, undefined);
    assert.equal(sanitized.bids[0].seller_id, undefined);
    assert.equal(sanitized.bids[0].phone_number, undefined);
    assert.equal(sanitized.bids[0].bidder, undefined);
    assert.equal(sanitized.has_more, true);
  });

  it('formats relative bid timestamps without parseFloat', async () => {
    const { formatBidTimeAgo } = await loadUi();
    const labels = {
      'bids.justNow': 'Just now',
      'bids.minuteAgo': '1 min ago',
      'bids.minutesAgo': '{n} mins ago',
      'bids.hourAgo': '1 hour ago',
      'bids.hoursAgo': '{n} hours ago',
      'bids.dayAgo': '1 day ago',
      'bids.daysAgo': '{n} days ago',
    };
    const t = (key) => labels[key] || key;
    const now = Date.parse('2026-09-29T12:00:00.000Z');
    assert.equal(formatBidTimeAgo('2026-09-29T11:48:00.000Z', now, t), '12 mins ago');
    assert.equal(formatBidTimeAgo('2026-09-29T11:25:00.000Z', now, t), '35 mins ago');
    assert.equal(formatBidTimeAgo('2026-09-29T11:00:00.000Z', now, t), '1 hour ago');
    assert.equal(formatBidTimeAgo('2026-09-29T10:00:00.000Z', now, t), '2 hours ago');
    assert.equal(formatBidTimeAgo('2026-09-29T11:59:30.000Z', now, t), 'Just now');
    assert.equal(formatBidTimeAgo(null, now, t), '—');
  });
});
