'use strict';

/**
 * Run: node --test src/utils/__tests__/bidListUi.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'bidListUi.js')).href;
  return import(moduleUrl);
}

describe('bidListUi', () => {
  it('parses paginated bids responses and default page size 50', async () => {
    const { parseBidsPage, BIDS_PAGE_SIZE, buildBidsQuery } = await load();
    assert.equal(BIDS_PAGE_SIZE, 50);
    assert.deepEqual(buildBidsQuery(0), { params: { limit: 50, offset: 0 } });
    assert.deepEqual(buildBidsQuery(50), { params: { limit: 50, offset: 50 } });
    const page = parseBidsPage({
      listings: [{ id: 1 }],
      limit: 50,
      offset: 0,
      has_more: true,
    });
    assert.equal(page.listings[0].id, 1);
    assert.equal(page.hasMore, true);
    assert.deepEqual(parseBidsPage(null), {
      listings: [],
      limit: 50,
      offset: 0,
      hasMore: false,
    });
  });

  it('maps live/completed/cancelled/expired/sold/hidden without inventing a winner', async () => {
    const { bidRowStatusKey, isWinningBid, isCurrentlyHighest, isLiveBidRow } = await load();
    assert.equal(
      bidRowStatusKey({
        status: 'approved',
        auction: { auction_status: 'live' },
      }),
      'live'
    );
    assert.equal(isLiveBidRow({ auction: { auction_status: 'live' } }), true);
    assert.equal(
      bidRowStatusKey({
        status: 'bid_duration_ended',
        auction: { auction_status: 'completed', completion_source: 'expired' },
      }),
      'bidDurationEnded'
    );
    assert.equal(
      bidRowStatusKey({
        status: 'bid_duration_ended',
        auction: { auction_status: 'completed', completion_source: 'sold' },
      }),
      'sold'
    );
    assert.equal(
      bidRowStatusKey({
        status: 'bid_duration_ended',
        auction: { auction_status: 'cancelled', completion_source: 'cancelled' },
      }),
      'cancelled'
    );
    assert.equal(
      bidRowStatusKey({
        status: 'hidden',
        auction: { auction_status: 'live' },
      }),
      'hidden'
    );
    assert.equal(isWinningBid({ is_winner: true }), true);
    assert.equal(isWinningBid({ is_winner: false, my_highest_bid: '400.00' }), false);
    assert.equal(
      isCurrentlyHighest({
        auction_status: 'live',
        my_highest_bid: '315.00',
        current_highest_bid: '315.00',
      }),
      true
    );
    assert.equal(
      isCurrentlyHighest({
        auction_status: 'live',
        my_highest_bid: '310.00',
        current_highest_bid: '315.00',
      }),
      false
    );
  });
});
