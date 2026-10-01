'use strict';

/**
 * Seller received-bid presentation helpers.
 * Run: node --test src/utils/__tests__/receivedBidsUi.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'receivedBidsUi.js')).href;
  return import(moduleUrl);
}

const t = (key) =>
  ({
    'bids.bidTimeToday': 'Today, {time}',
    'bids.bidTimeYesterday': 'Yesterday, {time}',
    'bids.bidTimeOn': '{day}, {time}',
  })[key] || key;

describe('receivedBidsUi', () => {
  it('marks only a unique highest bid', async () => {
    const { highestReceivedBidId, receivedBidRecords } = await load();
    const bids = [
      { id: 4, amount: '350.00', bidder: { name: 'Ahmed Khalil' } },
      { id: 3, amount: '340.00', bidder: { name: 'Omar Nabulsi' } },
      { id: 2, amount: '330.00', bidder: { name: 'Ahmed Khalil' } },
    ];
    assert.equal(highestReceivedBidId(bids, '350.00'), 4);
    assert.equal(highestReceivedBidId(bids, '330.00'), 2);
    assert.equal(
      highestReceivedBidId(
        [
          { id: 4, amount: '350.00' },
          { id: 5, amount: '350.00' },
        ],
        '350.00'
      ),
      null
    );
    assert.equal(highestReceivedBidId(bids, null), null);
    assert.equal(highestReceivedBidId([], '350.00'), null);
    const records = receivedBidRecords(bids);
    assert.equal(records.length, 3);
    assert.equal(records[0].bidder.name, 'Ahmed Khalil');
    assert.equal(records[2].bidder.name, 'Ahmed Khalil');
    assert.deepEqual(receivedBidRecords(null), []);
  });

  it('keeps separate records when the same bidder appears twice', async () => {
    const { receivedBidRecords, highestReceivedBidId } = await load();
    const bids = receivedBidRecords([
      { id: 9, amount: '350.00', bidder: { id: 7, name: 'Ahmed Khalil' } },
      { id: 8, amount: '330.00', bidder: { id: 7, name: 'Ahmed Khalil' } },
    ]);
    assert.equal(bids.length, 2);
    assert.equal(highestReceivedBidId(bids, '350.00'), 9);
    assert.notEqual(highestReceivedBidId(bids, '350.00'), 8);
  });

  it('formats today and yesterday without inventing a phone or winner', async () => {
    const { formatReceivedBidTimestamp, bidderInitial } = await load();
    const now = new Date(2026, 8, 29, 16, 0, 0).getTime();
    const today = new Date(2026, 8, 29, 15, 42, 0).toISOString();
    const yesterday = new Date(2026, 8, 28, 20, 20, 0).toISOString();
    assert.equal(formatReceivedBidTimestamp(today, t, now, 'en'), 'Today, 3:42 PM');
    assert.equal(formatReceivedBidTimestamp(yesterday, t, now, 'en'), 'Yesterday, 8:20 PM');
    assert.equal(formatReceivedBidTimestamp('', t, now, 'en'), '');
    assert.equal(bidderInitial('Ahmed Khalil'), 'A');
    assert.equal(bidderInitial('عمر'), 'ع');
    assert.equal(bidderInitial(''), '');
  });

  it('shows a countdown only for a live auction', async () => {
    const { receivedAuctionHeader } = await load();
    const live = receivedAuctionHeader({ auction_status: 'live', ends_at: '2026-09-29T18:00:00.000Z' });
    assert.equal(live.mode, 'live');
    assert.equal(live.showCountdown, true);
    assert.equal(live.labelKey, 'sellerBid.liveAuction');

    const completed = receivedAuctionHeader({
      auction_status: 'completed',
      ends_at: '2026-09-29T18:00:00.000Z',
    });
    assert.equal(completed.mode, 'completed');
    assert.equal(completed.showCountdown, false);
    assert.equal(completed.labelKey, 'bids.completed');
    assert.equal(completed.valueKey, 'bids.auctionEnded');

    const ended = receivedAuctionHeader({ auction_status: 'ended', ends_at: '2026-09-29T18:00:00.000Z' });
    assert.equal(ended.showCountdown, false);
    assert.equal(ended.labelKey, 'bids.completed');

    const cancelled = receivedAuctionHeader({
      auction_status: 'cancelled',
      ends_at: '2026-09-29T18:00:00.000Z',
    });
    assert.equal(cancelled.mode, 'cancelled');
    assert.equal(cancelled.showCountdown, false);
    assert.equal(cancelled.labelKey, 'bids.cancelled');
    assert.equal(cancelled.valueKey, 'sellerBid.bidCancelled');
    assert.equal(JSON.stringify(cancelled).includes('Winner'), false);
    assert.equal(JSON.stringify(completed).includes('Winner'), false);

    const pending = receivedAuctionHeader({ auction_status: 'pending_start' });
    assert.equal(pending.showCountdown, false);
    assert.equal(receivedAuctionHeader(null).showCountdown, false);
    assert.equal(receivedAuctionHeader({ auction_status: 'live' }).showCountdown, false);
  });
});
