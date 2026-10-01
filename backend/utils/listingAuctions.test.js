'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { freezeCurrentListingRevision } = require('./listingModerationEvents');
const { LISTING_STATUS } = require('./listingStatus');
const {
  AUCTION_DURATION_HOURS,
  MAX_AUCTION_DURATION_HOURS,
  MIN_BID_INCREMENT,
  MAX_BID_MULTIPLIER,
  AUCTION_STATUS,
  AUCTION_COMPLETION_SOURCE,
  LISTING_SALE_TYPE,
  PUBLIC_BID_HISTORY_DEFAULT_LIMIT,
  PUBLIC_BID_HISTORY_MAX_LIMIT,
  parseListingSaleType,
  isBidSaleType,
  parsePublicBidHistoryLimit,
  assertAuctionDurationHours,
  assertAuctionStartingPrice,
  assertBidAmount,
  centsToMoney,
  minimumBidCents,
  maximumBidCents,
  getAuctionByListingId,
  assertAuctionNotLive,
  createPendingAuction,
  createListingAuction,
  startAuction,
  startAuctionIfBidListing,
  expireAuctionIfDue,
  placeBid,
  completeListingAuction,
  listLiveAuctionBids,
  listPublicBidHistory,
  extendAuction,
  dispatchOneHourAuctionNotices,
  listAgain,
} = require('./listingAuctions');

const EXPECTED_DURATIONS = [24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168];

describe('auction domain constants', () => {
  it('duration constants contain exactly the 13 allowed values', () => {
    assert.deepEqual([...AUCTION_DURATION_HOURS], EXPECTED_DURATIONS);
    assert.equal(AUCTION_DURATION_HOURS.length, 13);
    assert.equal(MAX_AUCTION_DURATION_HOURS, 168);
    assert.equal(MIN_BID_INCREMENT, 5);
    assert.equal(MAX_BID_MULTIPLIER, 2);
  });
});

describe('assertAuctionDurationHours', () => {
  it('accepts every allowed integer duration', () => {
    for (const hours of EXPECTED_DURATIONS) {
      assert.equal(assertAuctionDurationHours(hours), hours);
      assert.equal(assertAuctionDurationHours(String(hours)), hours);
    }
  });

  it('rejects invalid durations without rounding', () => {
    const invalid = [23, 25, 169, 24.5, '24.0', '24.5', 0, -24, true, null, {}, '', '  '];
    for (const value of invalid) {
      assert.throws(
        () => assertAuctionDurationHours(value),
        (err) => err && err.statusCode === 400 && err.code === 'INVALID_AUCTION_DURATION'
      );
    }
  });
});

describe('parseListingSaleType', () => {
  it('defaults omitted values to normal and accepts bid', () => {
    assert.equal(parseListingSaleType(undefined), LISTING_SALE_TYPE.NORMAL);
    assert.equal(parseListingSaleType(null), LISTING_SALE_TYPE.NORMAL);
    assert.equal(parseListingSaleType(''), LISTING_SALE_TYPE.NORMAL);
    assert.equal(parseListingSaleType('normal'), LISTING_SALE_TYPE.NORMAL);
    assert.equal(parseListingSaleType('bid'), LISTING_SALE_TYPE.BID);
    assert.equal(isBidSaleType('bid'), true);
    assert.equal(isBidSaleType('normal'), false);
  });

  it('rejects invalid sale types', () => {
    assert.throws(
      () => parseListingSaleType('auction'),
      (err) => err && err.statusCode === 400 && err.code === 'INVALID_SALE_TYPE'
    );
  });
});

describe('parsePublicBidHistoryLimit', () => {
  it('defaults to 4 and caps at 20', () => {
    assert.equal(PUBLIC_BID_HISTORY_DEFAULT_LIMIT, 4);
    assert.equal(PUBLIC_BID_HISTORY_MAX_LIMIT, 20);
    assert.equal(parsePublicBidHistoryLimit(undefined), 4);
    assert.equal(parsePublicBidHistoryLimit(null), 4);
    assert.equal(parsePublicBidHistoryLimit(''), 4);
    assert.equal(parsePublicBidHistoryLimit('abc'), 4);
    assert.equal(parsePublicBidHistoryLimit(0), 4);
    assert.equal(parsePublicBidHistoryLimit(-1), 4);
    assert.equal(parsePublicBidHistoryLimit(4), 4);
    assert.equal(parsePublicBidHistoryLimit('4'), 4);
    assert.equal(parsePublicBidHistoryLimit(20), 20);
    assert.equal(parsePublicBidHistoryLimit(21), 20);
    assert.equal(parsePublicBidHistoryLimit('100'), 20);
  });
});

describe('assertAuctionStartingPrice', () => {
  it('accepts positive DECIMAL values with at most 2 places', () => {
    assert.equal(assertAuctionStartingPrice('1'), '1');
    assert.equal(assertAuctionStartingPrice('0.01'), '0.01');
    assert.equal(assertAuctionStartingPrice('100.50'), '100.50');
    assert.equal(assertAuctionStartingPrice(25), '25');
  });

  it('rejects zero, negative, and over-precise values', () => {
    for (const value of [0, '0', '0.00', -1, '1.234', true, null, {}, '']) {
      assert.throws(
        () => assertAuctionStartingPrice(value),
        (err) => err && err.statusCode === 400 && err.code === 'INVALID_STARTING_PRICE'
      );
    }
  });
});

describe('listingAuctions database domain', { concurrency: 1 }, () => {
  let client;

  async function fixtureIds() {
    const result = await client.query(
      `SELECT
         (SELECT id FROM users ORDER BY id LIMIT 1) AS seller_id,
         (SELECT id FROM users ORDER BY id OFFSET 1 LIMIT 1) AS bidder_id,
         (SELECT id FROM models ORDER BY id LIMIT 1) AS model_id,
         (SELECT id FROM colors ORDER BY id LIMIT 1) AS color_id,
         (SELECT id FROM conditions ORDER BY id LIMIT 1) AS condition_id,
         (SELECT id FROM storage_options ORDER BY id LIMIT 1) AS storage_id`
    );
    const row = result.rows[0];
    assert.ok(row.seller_id && row.model_id && row.color_id && row.condition_id);
    return row;
  }

  async function insertListing() {
    const fx = await fixtureIds();
    const listing = await client.query(
      `INSERT INTO listings
         (user_id, model_id, storage_id, color_id, condition_id, price, status, sale_type)
       VALUES ($1, $2, $3, $4, $5, 100.00, 'pending', 'bid')
       RETURNING id, user_id`,
      [fx.seller_id, fx.model_id, fx.storage_id, fx.color_id, fx.condition_id]
    );
    return { ...listing.rows[0], bidderId: fx.bidder_id, sellerId: fx.seller_id };
  }

  async function insertBidder(sellerId) {
    const fx = await fixtureIds();
    if (fx.bidder_id && fx.bidder_id !== sellerId) return fx.bidder_id;
    const inserted = await client.query(
      `INSERT INTO users (phone_number, first_name, last_name, gender, is_verified)
       VALUES ($1, 'Bid', 'Tester', 'male', TRUE)
       RETURNING id`,
      [`077${String(Date.now()).slice(-7)}`]
    );
    return inserted.rows[0].id;
  }

  async function insertBid(listing, auctionId, amount) {
    const bidderId = await insertBidder(listing.sellerId);
    assert.ok(bidderId !== listing.sellerId);
    const bid = await client.query(
      `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount)
       VALUES ($1, $2, $3, $4, $5::decimal)
       RETURNING id, amount`,
      [listing.id, auctionId, bidderId, listing.sellerId, amount]
    );
    return bid.rows[0];
  }

  before(async () => {
    client = await pool.connect();
    await client.query('BEGIN');
  });

  after(async () => {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
    await pool.end();
  });

  it('creates a pending auction with null clocks', async () => {
    const listing = await insertListing();
    const auction = await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    assert.equal(auction.listing_id, listing.id);
    assert.equal(auction.auction_status, AUCTION_STATUS.PENDING_START);
    assert.equal(auction.starts_at, null);
    assert.equal(auction.original_ends_at, null);
    assert.equal(auction.ends_at, null);
    assert.equal(auction.extension_used, false);
    assert.equal(auction.winning_bid_id, null);
    assert.equal(Number(auction.duration_hours), 24);
  });

  it('does not create a second auction row for the same listing', async () => {
    const listing = await insertListing();
    const first = await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '80.00',
      durationHours: 36,
    });
    const second = await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '80.00',
      durationHours: 36,
    });
    assert.equal(first.id, second.id);
    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM listing_auctions WHERE listing_id = $1',
      [listing.id]
    );
    assert.equal(count.rows[0].n, 1);
  });

  it('rejects a conflicting pending-auction create without overwriting', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '50.00',
      durationHours: 24,
    });
    await assert.rejects(
      () =>
        createPendingAuction(client, {
          listingId: listing.id,
          startingPrice: '75.00',
          durationHours: 24,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'AUCTION_CONFLICT'
    );
    const stored = await getAuctionByListingId(client, listing.id);
    assert.equal(Number(stored.starting_price), 50);
    assert.equal(Number(stored.duration_hours), 24);
  });

  it('starts a pending auction from one CURRENT_TIMESTAMP', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100',
      durationHours: 48,
    });
    const live = await startAuction(client, listing.id);
    assert.equal(live.auction_status, AUCTION_STATUS.LIVE);
    assert.ok(live.starts_at);
    assert.ok(live.original_ends_at);
    assert.ok(live.ends_at);
    assert.equal(live.extension_used, false);
    assert.equal(live.winning_bid_id, null);

    const clocks = await client.query(
      `SELECT
         starts_at = original_ends_at - make_interval(hours => duration_hours) AS start_matches,
         ends_at = original_ends_at AS ends_match
       FROM listing_auctions WHERE id = $1`,
      [live.id]
    );
    assert.equal(clocks.rows[0].start_matches, true);
    assert.equal(clocks.rows[0].ends_match, true);
  });

  it('does not reset the clock when starting an already-live auction', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '90',
      durationHours: 24,
    });
    await startAuction(client, listing.id);
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = TIMESTAMP '2026-01-01 00:00:00',
         original_ends_at = TIMESTAMP '2026-01-02 00:00:00',
         ends_at = TIMESTAMP '2026-01-02 00:00:00'
       WHERE listing_id = $1`,
      [listing.id]
    );
    const again = await startAuction(client, listing.id);
    assert.equal(again.auction_status, AUCTION_STATUS.LIVE);
    const clocks = await client.query(
      `SELECT starts_at, original_ends_at, ends_at
       FROM listing_auctions WHERE listing_id = $1`,
      [listing.id]
    );
    assert.equal(String(clocks.rows[0].starts_at), String(again.starts_at));
    assert.equal(again.starts_at.getFullYear(), 2026);
    assert.equal(again.starts_at.getMonth(), 0);
    assert.equal(again.starts_at.getDate(), 1);
    assert.equal(clocks.rows[0].ends_at.getFullYear(), 2026);
    assert.equal(clocks.rows[0].ends_at.getMonth(), 0);
    assert.equal(clocks.rows[0].ends_at.getDate(), 2);
  });

  it('does not restart ended or cancelled auctions', async () => {
    const endedListing = await insertListing();
    await createPendingAuction(client, {
      listingId: endedListing.id,
      startingPrice: '40',
      durationHours: 24,
    });
    await startAuction(client, endedListing.id);
    await client.query(
      `UPDATE listing_auctions
       SET auction_status = $2
       WHERE listing_id = $1`,
      [endedListing.id, AUCTION_STATUS.ENDED]
    );
    await assert.rejects(
      () => startAuction(client, endedListing.id),
      (err) => err && err.statusCode === 409 && err.code === 'INVALID_AUCTION_STATE'
    );

    const cancelledListing = await insertListing();
    await createPendingAuction(client, {
      listingId: cancelledListing.id,
      startingPrice: '40',
      durationHours: 24,
    });
    await startAuction(client, cancelledListing.id);
    await client.query(
      `UPDATE listing_auctions
       SET auction_status = $2
       WHERE listing_id = $1`,
      [cancelledListing.id, AUCTION_STATUS.CANCELLED]
    );
    await assert.rejects(
      () => startAuction(client, cancelledListing.id),
      (err) => err && err.statusCode === 409 && err.code === 'INVALID_AUCTION_STATE'
    );
  });

  it('leaves a non-due live auction unchanged', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '60',
      durationHours: 72,
    });
    const live = await startAuction(client, listing.id);
    const after = await expireAuctionIfDue(client, live.id);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(after.winning_bid_id, null);
    assert.equal(String(after.ends_at), String(live.ends_at));
  });

  it('expires a due live auction with no bids and leaves winning_bid_id NULL', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '70',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    const completed = await expireAuctionIfDue(client, live.id);
    assert.equal(completed.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(completed.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
    assert.equal(completed.winning_bid_id, null);
    const listingAfter = await client.query(
      'SELECT status, price FROM listings WHERE id = $1',
      [listing.id]
    );
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(listingAfter.rows[0].price), 100);
  });

  it('selects the unique highest bid as the winner', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const lower = await insertBid(listing, live.id, '105.00');
    const higher = await insertBid(listing, live.id, '120.00');
    assert.ok(lower.id !== higher.id);
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    const completed = await expireAuctionIfDue(client, live.id);
    assert.equal(completed.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(completed.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
    assert.equal(completed.winning_bid_id, higher.id);
    const listingAfter = await client.query(
      'SELECT status, price FROM listings WHERE id = $1',
      [listing.id]
    );
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(listingAfter.rows[0].price), 100);
  });

  it('repeated expiration of a completed auction is idempotent', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '55',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const bid = await insertBid(listing, live.id, '80.00');
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    const first = await expireAuctionIfDue(client, live.id);
    const second = await expireAuctionIfDue(client, live.id);
    assert.equal(first.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(second.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(first.winning_bid_id, bid.id);
    assert.equal(second.winning_bid_id, bid.id);
    assert.equal(first.winning_bid_id, second.winning_bid_id);
    const listingAfter = await client.query(
      'SELECT status FROM listings WHERE id = $1',
      [listing.id]
    );
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('tied highest bids abort without completing the auction or listing', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await insertBid(listing, live.id, '120.00');
    await insertBid(listing, live.id, '120.00');
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    await client.query('SAVEPOINT winner_tie');
    await assert.rejects(
      () => expireAuctionIfDue(client, live.id),
      (err) => err && err.statusCode === 409 && err.code === 'AUCTION_WINNER_TIE'
    );
    await client.query('ROLLBACK TO SAVEPOINT winner_tie');
    const after = await getAuctionByListingId(client, listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(after.winning_bid_id, null);
    const listingAfter = await client.query(
      'SELECT status, price FROM listings WHERE id = $1',
      [listing.id]
    );
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.PENDING);
    assert.equal(Number(listingAfter.rows[0].price), 100);
  });

  it('createListingAuction stays pending_start unless start is requested', async () => {
    const listing = await insertListing();
    const pending = await createListingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 36,
      start: false,
    });
    assert.equal(pending.auction_status, AUCTION_STATUS.PENDING_START);
    assert.equal(pending.starts_at, null);

    const live = await createListingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 36,
      start: true,
    });
    assert.equal(live.auction_status, AUCTION_STATUS.LIVE);
    assert.ok(live.starts_at);
  });

  it('startAuctionIfBidListing is a no-op for normal listings', async () => {
    const listing = await insertListing();
    const result = await startAuctionIfBidListing(client, {
      listingId: listing.id,
      saleType: LISTING_SALE_TYPE.NORMAL,
    });
    assert.equal(result, null);
    const auction = await getAuctionByListingId(client, listing.id);
    assert.equal(auction, null);
  });

  it('approval cannot leave a Bid listing approved without a live auction', async () => {
    const listing = await insertListing();
    await client.query('SAVEPOINT approve_missing_auction');
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await assert.rejects(
      () =>
        startAuctionIfBidListing(client, {
          listingId: listing.id,
          saleType: LISTING_SALE_TYPE.BID,
        }),
      (err) => err && err.code === 'AUCTION_NOT_FOUND'
    );
    await client.query('ROLLBACK TO SAVEPOINT approve_missing_auction');
    const row = await client.query('SELECT status FROM listings WHERE id = $1', [listing.id]);
    assert.equal(row.rows[0].status, 'pending');
  });

  it('create+start in one transaction rolls back the listing if start cannot run', async () => {
    const listing = await insertListing();
    await client.query('SAVEPOINT create_start');
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    try {
      await startAuctionIfBidListing(client, {
        listingId: listing.id,
        saleType: LISTING_SALE_TYPE.BID,
      });
      assert.fail('start should fail without an auction row');
    } catch (error) {
      assert.equal(error.code, 'AUCTION_NOT_FOUND');
      await client.query('ROLLBACK TO SAVEPOINT create_start');
    }
    const row = await client.query(
      `SELECT l.status, a.id AS auction_id
       FROM listings l
       LEFT JOIN listing_auctions a ON a.listing_id = l.id
       WHERE l.id = $1`,
      [listing.id]
    );
    assert.equal(row.rows[0].status, 'pending');
    assert.equal(row.rows[0].auction_id, null);
  });

  it('assertAuctionNotLive allows every non-live auction state', async () => {
    const listing = await insertListing();
    assert.equal(await assertAuctionNotLive(client, listing.id), null);

    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const pending = await assertAuctionNotLive(client, listing.id);
    assert.equal(pending.auction_status, AUCTION_STATUS.PENDING_START);

    await startAuction(client, listing.id);
    await assert.rejects(
      () => assertAuctionNotLive(client, listing.id),
      (err) => err && err.statusCode === 409 && err.code === 'LIVE_AUCTION_FROZEN'
    );

    for (const status of [
      AUCTION_STATUS.ENDED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.COMPLETED,
    ]) {
      await client.query(
        `UPDATE listing_auctions SET auction_status = $2 WHERE listing_id = $1`,
        [listing.id, status]
      );
      const allowed = await assertAuctionNotLive(client, listing.id);
      assert.equal(allowed.auction_status, status);
    }
  });

  it('freezeCurrentListingRevision preserves sale_type on Bid snapshots', async () => {
    const listing = await insertListing();
    const snapshot = await freezeCurrentListingRevision(client, listing.id, listing.user_id);
    assert.ok(snapshot);
    assert.notEqual(snapshot.id, listing.id);
    assert.equal(snapshot.sale_type, LISTING_SALE_TYPE.BID);
    const original = await client.query(
      'SELECT sale_type FROM listings WHERE id = $1',
      [listing.id]
    );
    assert.equal(original.rows[0].sale_type, LISTING_SALE_TYPE.BID);
  });

  it('assertBidAmount accepts decimal-safe strings and rejects invalid amounts', () => {
    assert.equal(assertBidAmount('305'), '305');
    assert.equal(assertBidAmount('305.00'), '305.00');
    assert.equal(assertBidAmount('305.50'), '305.50');
    assert.equal(assertBidAmount('306.25'), '306.25');
    assert.equal(assertBidAmount(310), '310');
    for (const value of [undefined, null, '', '  ', true, {}, [], 0, '0', '0.00', -1, '-1', '1.234', 'abc']) {
      assert.throws(
        () => assertBidAmount(value),
        (err) => err && err.statusCode === 400 && err.code === 'INVALID_BID_AMOUNT'
      );
    }
  });

  it('minimum and maximum bid cents use starting price and a +5 increment', () => {
    assert.equal(MIN_BID_INCREMENT, 5);
    assert.equal(MAX_BID_MULTIPLIER, 2);
    assert.equal(centsToMoney(30000n), '300.00');
    assert.equal(minimumBidCents(30000n, null), 30500n);
    assert.equal(minimumBidCents(30000n, 30500n), 31000n);
    assert.equal(minimumBidCents(31000n, 31000n), 31500n);
    assert.equal(maximumBidCents(30000n), 60000n);
    assert.equal(maximumBidCents(12550n), 25100n);
    assert.equal(centsToMoney(25100n), '251.00');
  });

  it('placeBid inserts append-only rows and rejects too-low follow-up bids', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '300.00',
      durationHours: 24,
    });
    await startAuction(client, listing.id);
    const bidderId = await insertBidder(listing.sellerId);

    const first = await placeBid(client, {
      listingId: listing.id,
      bidderId,
      amount: '305',
    });
    assert.equal(first.bid.amount, '305.00');
    assert.equal(first.highest_bid, '305.00');
    assert.equal(first.minimum_next_bid, '310.00');
    assert.equal(first.maximum_bid, '600.00');
    assert.equal(first.auction_status, AUCTION_STATUS.LIVE);

    await assert.rejects(
      () => placeBid(client, { listingId: listing.id, bidderId, amount: '306' }),
      (err) => err && err.statusCode === 409 && err.code === 'BID_TOO_LOW'
    );

    const second = await placeBid(client, {
      listingId: listing.id,
      bidderId,
      amount: '311.25',
    });
    assert.equal(second.bid.amount, '311.25');
    const rows = await client.query(
      'SELECT amount FROM bids WHERE auction_id = $1 ORDER BY id',
      [(await getAuctionByListingId(client, listing.id)).id]
    );
    assert.equal(rows.rows.length, 2);
    assert.equal(Number(rows.rows[0].amount), 305);
    assert.equal(Number(rows.rows[1].amount), 311.25);
  });

  it('placeBid rejects the seller and expired auctions without inserting a bid', async () => {
    const listing = await insertListing();
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await assert.rejects(
      () =>
        placeBid(client, {
          listingId: listing.id,
          bidderId: listing.sellerId,
          amount: '105',
        }),
      (err) => err && err.statusCode === 403 && err.code === 'BID_SELF'
    );

    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    const bidderId = await insertBidder(listing.sellerId);
    await assert.rejects(
      () => placeBid(client, { listingId: listing.id, bidderId, amount: '105' }),
      (err) => err && err.statusCode === 409 && err.code === 'AUCTION_ENDED'
    );
    const after = await getAuctionByListingId(client, listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    const listingAfter = await client.query(
      'SELECT status, price FROM listings WHERE id = $1',
      [listing.id]
    );
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(listingAfter.rows[0].price), 100);
    const count = await client.query('SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1', [
      live.id,
    ]);
    assert.equal(count.rows[0].n, 0);
  });

  it('completeListingAuction sold can select a lower bid', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const lower = await insertBid(listing, live.id, '105.00');
    const higher = await insertBid(listing, live.id, '120.00');
    const result = await completeListingAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      action: 'sold',
      winningBidId: lower.id,
    });
    assert.equal(result.auction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(result.auction.winning_bid_id, lower.id);
    assert.notEqual(result.auction.winning_bid_id, higher.id);
    assert.equal(result.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    const soldAuction = await getAuctionByListingId(client, listing.id);
    assert.equal(soldAuction.completion_source, AUCTION_COMPLETION_SOURCE.SOLD);
    const bids = await client.query(
      'SELECT id, amount FROM bids WHERE auction_id = $1 ORDER BY id',
      [live.id]
    );
    assert.equal(bids.rows.length, 2);
    assert.equal(Number(bids.rows[0].amount), 105);
    assert.equal(Number(bids.rows[1].amount), 120);
  });

  it('completeListingAuction cancel leaves winning_bid_id NULL', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await insertBid(listing, live.id, '110.00');
    const result = await completeListingAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      action: 'cancel',
    });
    assert.equal(result.auction.auction_status, AUCTION_STATUS.CANCELLED);
    assert.equal(result.auction.winning_bid_id, null);
    assert.equal(result.listing.status, LISTING_STATUS.BID_DURATION_ENDED);
    const cancelledAuction = await getAuctionByListingId(client, listing.id);
    assert.equal(cancelledAuction.completion_source, AUCTION_COMPLETION_SOURCE.CANCELLED);
    const count = await client.query('SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1', [
      live.id,
    ]);
    assert.equal(count.rows[0].n, 1);
  });

  it('listLiveAuctionBids returns each bid with bidder name and phone', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    await startAuction(client, listing.id);
    const first = await insertBid(listing, (await getAuctionByListingId(client, listing.id)).id, '105.00');
    const second = await insertBid(listing, (await getAuctionByListingId(client, listing.id)).id, '120.00');
    const result = await listLiveAuctionBids(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
    });
    assert.equal(result.auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(result.auction.current_highest_bid, '120.00');
    assert.equal(result.bids.length, 2);
    assert.equal(result.bids[0].id, second.id);
    assert.equal(result.bids[1].id, first.id);
    assert.equal(result.bids[0].amount, '120.00');
    assert.ok(result.bids[0].bidder.phone_number);
    assert.ok(result.bids[0].bidder.name);
    assert.equal(result.bids[0].bidder.email, undefined);
    assert.equal(result.auction.duration_hours, 24);
    assert.equal(result.auction.winning_bid_id, undefined);
  });

  it('returns owner bids for completed, cancelled, ended, and bid_duration_ended auctions', async () => {
    for (const status of [AUCTION_STATUS.COMPLETED, AUCTION_STATUS.CANCELLED, AUCTION_STATUS.ENDED]) {
      const listing = await insertListing();
      await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
      await createPendingAuction(client, {
        listingId: listing.id,
        startingPrice: '100.00',
        durationHours: 48,
      });
      const live = await startAuction(client, listing.id);
      const lower = await insertBid(listing, live.id, '110.00');
      const higher = await insertBid(listing, live.id, '130.00');
      await client.query(
        `UPDATE listing_auctions SET auction_status = $2 WHERE listing_id = $1`,
        [listing.id, status]
      );
      await client.query(`UPDATE listings SET status = $2 WHERE id = $1`, [
        listing.id,
        LISTING_STATUS.BID_DURATION_ENDED,
      ]);
      const result = await listLiveAuctionBids(client, {
        listingId: listing.id,
        sellerId: listing.sellerId,
      });
      assert.equal(result.auction.auction_status, status);
      assert.equal(result.auction.current_highest_bid, '130.00');
      assert.equal(result.bids.length, 2);
      assert.equal(result.bids[0].id, higher.id);
      assert.equal(result.bids[1].id, lower.id);
      assert.notEqual(result.bids[0].id, result.bids[1].id);
      assert.equal(result.bids[0].bidder.id, result.bids[1].bidder.id);
      assert.ok(result.bids[0].bidder.phone_number);
      assert.equal(result.auction.winning_bid_id, undefined);
      const after = await getAuctionByListingId(client, listing.id);
      assert.equal(after.auction_status, status);
    }
  });

  it('keeps historical bid rows ordered and does not merge the same bidder', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const bidderId = await insertBidder(listing.sellerId);
    await client.query(
      `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount, created_at)
       VALUES
         ($1, $2, $3, $4, 150.00, '2026-01-01 10:00:00'),
         ($1, $2, $3, $4, 150.00, '2026-01-01 11:00:00'),
         ($1, $2, $3, $4, 200.00, '2026-01-01 09:00:00')`,
      [listing.id, live.id, bidderId, listing.sellerId]
    );
    await client.query(
      `UPDATE listing_auctions SET auction_status = 'completed' WHERE id = $1`,
      [live.id]
    );
    const result = await listLiveAuctionBids(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
    });
    assert.deepEqual(
      result.bids.map((bid) => bid.amount),
      ['200.00', '150.00', '150.00']
    );
    assert.ok(result.bids[1].created_at > result.bids[2].created_at);
    assert.equal(result.bids[1].bidder.id, result.bids[2].bidder.id);
    assert.notEqual(result.bids[1].id, result.bids[2].id);
  });

  it('returns an empty historical bid list without inventing rows', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    await startAuction(client, listing.id);
    await client.query(
      `UPDATE listing_auctions SET auction_status = 'cancelled' WHERE listing_id = $1`,
      [listing.id]
    );
    const result = await listLiveAuctionBids(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
    });
    assert.equal(result.auction.auction_status, AUCTION_STATUS.CANCELLED);
    assert.equal(result.bids.length, 0);
    assert.equal(result.auction.current_highest_bid, null);
  });

  it('lazy-expires a due auction before returning the owner bid list', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await insertBid(listing, live.id, '125.00');
    await client.query(
      `UPDATE listing_auctions
       SET starts_at = CURRENT_TIMESTAMP - INTERVAL '25 hours',
           original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
           ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    const result = await listLiveAuctionBids(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
    });
    assert.equal(result.auction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(result.auction.current_highest_bid, '125.00');
    assert.equal(result.bids.length, 1);
    const stored = await getAuctionByListingId(client, listing.id);
    assert.equal(stored.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(stored.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
    const listingRow = await client.query('SELECT status FROM listings WHERE id = $1', [listing.id]);
    assert.equal(listingRow.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
  });

  it('still hides bidder identity from a non-owner and rejects deleted, normal, pending, and missing auctions', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await insertBid(listing, live.id, '110.00');
    await client.query(
      `UPDATE listing_auctions SET auction_status = 'completed' WHERE id = $1`,
      [live.id]
    );
    const bidderId = await insertBidder(listing.sellerId);
    await assert.rejects(
      () => listLiveAuctionBids(client, { listingId: listing.id, sellerId: bidderId }),
      (err) => err && err.statusCode === 403 && err.code === 'END_BID_NOT_OWNER'
    );

    await client.query(`UPDATE listings SET status = 'deleted' WHERE id = $1`, [listing.id]);
    await assert.rejects(
      () => listLiveAuctionBids(client, { listingId: listing.id, sellerId: listing.sellerId }),
      (err) => err && err.statusCode === 409 && err.code === 'LISTING_NOT_BIDDABLE'
    );

    const normal = await insertListing();
    await client.query(`UPDATE listings SET sale_type = 'normal', status = 'approved' WHERE id = $1`, [
      normal.id,
    ]);
    await assert.rejects(
      () => listLiveAuctionBids(client, { listingId: normal.id, sellerId: normal.sellerId }),
      (err) => err && err.statusCode === 409 && err.code === 'END_BID_NOT_AUCTION'
    );

    const pending = await insertListing();
    await createPendingAuction(client, {
      listingId: pending.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    await assert.rejects(
      () => listLiveAuctionBids(client, { listingId: pending.id, sellerId: pending.sellerId }),
      (err) => err && err.statusCode === 409 && err.code === 'AUCTION_NOT_LIVE'
    );

    const missing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [missing.id]);
    await assert.rejects(
      () => listLiveAuctionBids(client, { listingId: missing.id, sellerId: missing.sellerId }),
      (err) => err && err.statusCode === 404 && err.code === 'AUCTION_NOT_FOUND'
    );
  });

  it('listPublicBidHistory returns only amount and created_at in amount DESC order', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const bidderId = await insertBidder(listing.sellerId);
    await client.query(
      `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount, created_at)
       VALUES
         ($1, $2, $3, $4, 150.00, '2026-01-01 10:00:00'),
         ($1, $2, $3, $4, 150.00, '2026-01-01 11:00:00'),
         ($1, $2, $3, $4, 200.00, '2026-01-01 09:00:00'),
         ($1, $2, $3, $4, 140.00, '2026-01-01 12:00:00'),
         ($1, $2, $3, $4, 140.00, '2026-01-01 12:00:00')`,
      [listing.id, live.id, bidderId, listing.sellerId]
    );
    const rows = await listPublicBidHistory(client, {
      listingId: listing.id,
      auctionId: live.id,
      limit: 10,
    });
    assert.deepEqual(
      rows.map((row) => row.amount),
      ['200.00', '150.00', '150.00', '140.00', '140.00']
    );
    assert.ok(rows[1].created_at > rows[2].created_at);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row).sort(), ['amount', 'created_at']);
      assert.equal(row.bidder_id, undefined);
      assert.equal(row.seller_id, undefined);
      assert.equal(row.phone_number, undefined);
      assert.equal(row.name, undefined);
      assert.equal(row.email, undefined);
      assert.equal(row.bidder, undefined);
      assert.equal(row.seller, undefined);
    }
  });

  it('extendAuction adds the selected hours to ends_at without moving starts_at', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const firstBid = await insertBid(listing, live.id, '105.00');
    const result = await extendAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 24,
    });
    assert.equal(result.auction.auction_status, AUCTION_STATUS.LIVE);
    assert.equal(result.auction.extension_used, true);
    assert.equal(result.listing.status, LISTING_STATUS.APPROVED);
    assert.equal(Number(result.listing.price), 100);
    assert.equal(Number(result.auction.duration_hours), 24);

    const clocks = await client.query(
      `SELECT
         starts_at,
         original_ends_at,
         ends_at,
         ends_at = original_ends_at + make_interval(hours => 24) AS ends_extended,
         (ends_at - starts_at) = INTERVAL '48 hours' AS total_duration,
         (ends_at - starts_at) <= INTERVAL '168 hours' AS within_max
       FROM listing_auctions WHERE id = $1`,
      [live.id]
    );
    assert.equal(String(clocks.rows[0].starts_at), String(live.starts_at));
    assert.equal(String(clocks.rows[0].original_ends_at), String(live.original_ends_at));
    assert.equal(String(result.auction.starts_at), String(live.starts_at));
    assert.equal(String(result.auction.original_ends_at), String(live.original_ends_at));
    assert.equal(clocks.rows[0].ends_extended, true);
    assert.equal(clocks.rows[0].total_duration, true);
    assert.equal(clocks.rows[0].within_max, true);

    const bids = await client.query(
      'SELECT id, amount FROM bids WHERE auction_id = $1 ORDER BY id',
      [live.id]
    );
    assert.equal(bids.rows.length, 1);
    assert.equal(bids.rows[0].id, firstBid.id);
    assert.equal(Number(bids.rows[0].amount), 105);
  });

  it('extendAuction rejects used, invalid, and over-capacity durations', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 120,
    });
    await startAuction(client, listing.id);

    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 60,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'EXTENSION_EXCEEDS_MAX'
    );
    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 24.5,
        }),
      (err) => err && err.statusCode === 400 && err.code === 'INVALID_AUCTION_DURATION'
    );

    const extended = await extendAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 48,
    });
    assert.equal(extended.auction.extension_used, true);
    const clocks = await client.query(
      `SELECT (ends_at - starts_at) = INTERVAL '168 hours' AS total_duration
       FROM listing_auctions WHERE listing_id = $1`,
      [listing.id]
    );
    assert.equal(clocks.rows[0].total_duration, true);

    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 24,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'EXTENSION_ALREADY_USED'
    );
  });

  it('extendAuction rejects 144h+36h and a 168h auction, and allows 144h+24h', async () => {
    const over = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [over.id]);
    await createPendingAuction(client, {
      listingId: over.id,
      startingPrice: '100.00',
      durationHours: 144,
    });
    await startAuction(client, over.id);
    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: over.id,
          sellerId: over.sellerId,
          durationHours: 36,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'EXTENSION_EXCEEDS_MAX'
    );
    const allowed = await extendAuction(client, {
      listingId: over.id,
      sellerId: over.sellerId,
      durationHours: 24,
    });
    assert.equal(allowed.auction.extension_used, true);

    const maxed = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [maxed.id]);
    await createPendingAuction(client, {
      listingId: maxed.id,
      startingPrice: '100.00',
      durationHours: 168,
    });
    await startAuction(client, maxed.id);
    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: maxed.id,
          sellerId: maxed.sellerId,
          durationHours: 24,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'EXTENSION_EXCEEDS_MAX'
    );
    const afterMax = await getAuctionByListingId(client, maxed.id);
    assert.equal(afterMax.extension_used, false);
    assert.equal(afterMax.auction_status, AUCTION_STATUS.LIVE);
  });

  it('extendAuction rejects non-live states and lets expiration win when due', async () => {
    const pending = await insertListing();
    await createPendingAuction(client, {
      listingId: pending.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: pending.id,
          sellerId: pending.sellerId,
          durationHours: 24,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'AUCTION_NOT_LIVE'
    );

    for (const status of [
      AUCTION_STATUS.ENDED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.COMPLETED,
    ]) {
      const listing = await insertListing();
      await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
      await createPendingAuction(client, {
        listingId: listing.id,
        startingPrice: '100.00',
        durationHours: 24,
      });
      await startAuction(client, listing.id);
      await client.query(
        `UPDATE listing_auctions SET auction_status = $2 WHERE listing_id = $1`,
        [listing.id, status]
      );
      await assert.rejects(
        () =>
          extendAuction(client, {
            listingId: listing.id,
            sellerId: listing.sellerId,
            durationHours: 24,
          }),
        (err) =>
          err &&
          err.statusCode === 409 &&
          (err.code === 'AUCTION_ENDED' || err.code === 'AUCTION_NOT_LIVE')
      );
      const after = await getAuctionByListingId(client, listing.id);
      assert.equal(after.auction_status, status);
      assert.equal(after.extension_used, false);
    }

    const due = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [due.id]);
    await createPendingAuction(client, {
      listingId: due.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, due.id);
    const winner = await insertBid(due, live.id, '120.00');
    await insertBid(due, live.id, '105.00');
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [live.id]
    );
    await assert.rejects(
      () =>
        extendAuction(client, {
          listingId: due.id,
          sellerId: due.sellerId,
          durationHours: 24,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'AUCTION_ENDED' && err.persistTransaction
    );
    const completed = await getAuctionByListingId(client, due.id);
    assert.equal(completed.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(completed.winning_bid_id, winner.id);
    assert.equal(completed.extension_used, false);
    const listingAfter = await client.query('SELECT status, price FROM listings WHERE id = $1', [
      due.id,
    ]);
    assert.equal(listingAfter.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(Number(listingAfter.rows[0].price), 100);
  });

  async function setRemaining(auctionId, intervalSql) {
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) + (${intervalSql}),
         original_ends_at = CURRENT_TIMESTAMP + (${intervalSql}),
         ends_at = CURRENT_TIMESTAMP + (${intervalSql})
       WHERE id = $1`,
      [auctionId]
    );
  }

  async function noticeCount(listingId, userId) {
    const result = await client.query(
      `SELECT COUNT(*)::int AS n
       FROM notifications
       WHERE related_listing_id = $1
         AND user_id = $2
         AND type = 'bid_one_hour_remaining'`,
      [listingId, userId]
    );
    return result.rows[0].n;
  }

  it('dispatches a one-hour seller notice once for a live Bid in the window', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await insertBid(listing, live.id, '105.00');
    await setRemaining(live.id, `INTERVAL '50 minutes'`);

    const first = await dispatchOneHourAuctionNotices(client);
    assert.equal(first.length, 1);
    assert.equal(first[0].listing_id, listing.id);
    assert.equal(first[0].user_id, listing.sellerId);
    assert.equal(await noticeCount(listing.id, listing.sellerId), 1);
    const stored = await getAuctionByListingId(client, listing.id);
    assert.ok(stored.extension_notice_sent_at);
    assert.equal(stored.auction_status, AUCTION_STATUS.LIVE);

    const second = await dispatchOneHourAuctionNotices(client);
    assert.equal(second.length, 0);
    assert.equal(await noticeCount(listing.id, listing.sellerId), 1);

    const bidderNotes = await client.query(
      `SELECT COUNT(*)::int AS n FROM notifications
       WHERE related_listing_id = $1 AND user_id <> $2`,
      [listing.id, listing.sellerId]
    );
    assert.equal(bidderNotes.rows[0].n, 0);

    const row = await client.query(
      `SELECT type, title, message, related_listing_id, user_id, admin_id
       FROM notifications WHERE id = $1`,
      [first[0].notification_id]
    );
    assert.equal(row.rows[0].type, 'bid_one_hour_remaining');
    assert.equal(row.rows[0].title, 'Bid ending soon');
    assert.match(row.rows[0].message, /1 hour remaining/);
    assert.equal(Number(row.rows[0].related_listing_id), listing.id);
    assert.equal(Number(row.rows[0].user_id), listing.sellerId);
    assert.equal(row.rows[0].admin_id, null);
  });

  it('does not notify outside the one-hour window, non-live states, or after expiry', async () => {
    const far = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [far.id]);
    await createPendingAuction(client, {
      listingId: far.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const farLive = await startAuction(client, far.id);
    await setRemaining(farLive.id, `INTERVAL '90 minutes'`);
    assert.equal((await dispatchOneHourAuctionNotices(client)).length, 0);
    assert.equal((await getAuctionByListingId(client, far.id)).extension_notice_sent_at, null);

    const pending = await insertListing();
    await createPendingAuction(client, {
      listingId: pending.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    assert.equal((await dispatchOneHourAuctionNotices(client)).length, 0);

    for (const status of [
      AUCTION_STATUS.ENDED,
      AUCTION_STATUS.CANCELLED,
      AUCTION_STATUS.COMPLETED,
    ]) {
      const listing = await insertListing();
      await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
      await createPendingAuction(client, {
        listingId: listing.id,
        startingPrice: '100.00',
        durationHours: 24,
      });
      const live = await startAuction(client, listing.id);
      await setRemaining(live.id, `INTERVAL '50 minutes'`);
      await client.query(`UPDATE listing_auctions SET auction_status = $2 WHERE id = $1`, [
        live.id,
        status,
      ]);
      assert.equal((await dispatchOneHourAuctionNotices(client)).length, 0);
      assert.equal((await getAuctionByListingId(client, listing.id)).extension_notice_sent_at, null);
    }

    const due = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [due.id]);
    await createPendingAuction(client, {
      listingId: due.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const dueLive = await startAuction(client, due.id);
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [dueLive.id]
    );
    assert.equal((await dispatchOneHourAuctionNotices(client)).length, 0);
    assert.equal((await getAuctionByListingId(client, due.id)).extension_notice_sent_at, null);
    assert.equal((await getAuctionByListingId(client, due.id)).auction_status, AUCTION_STATUS.LIVE);
  });

  it('evaluates the one-hour window against current ends_at and does not reset after extension', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await setRemaining(live.id, `INTERVAL '50 minutes'`);
    await extendAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 24,
    });
    assert.equal((await dispatchOneHourAuctionNotices(client)).length, 0);
    const afterExtend = await getAuctionByListingId(client, listing.id);
    assert.equal(afterExtend.extension_notice_sent_at, null);
    assert.equal(afterExtend.extension_used, true);

    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - INTERVAL '23 hours 20 minutes',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '20 minutes',
         ends_at = CURRENT_TIMESTAMP + INTERVAL '40 minutes'
       WHERE id = $1`,
      [live.id]
    );
    const sent = await dispatchOneHourAuctionNotices(client);
    assert.equal(sent.length, 1);
    const marked = await getAuctionByListingId(client, listing.id);
    assert.ok(marked.extension_notice_sent_at);
    const sentAt = marked.extension_notice_sent_at;
    await client.query(
      `UPDATE listing_auctions
       SET ends_at = CURRENT_TIMESTAMP + INTERVAL '30 minutes'
       WHERE id = $1`,
      [live.id]
    );
    assert.equal((await dispatchOneHourAuctionNotices(client)).length, 0);
    assert.equal(
      String((await getAuctionByListingId(client, listing.id)).extension_notice_sent_at),
      String(sentAt)
    );
  });

  async function attachImage(listingId) {
    await client.query(
      `INSERT INTO listing_images (listing_id, image_url, display_order)
       VALUES ($1, '/uploads/listing-list-again.jpg', 0)`,
      [listingId]
    );
  }

  async function makeDue(auctionId) {
    await client.query(
      `UPDATE listing_auctions
       SET
         starts_at = CURRENT_TIMESTAMP - make_interval(hours => duration_hours) - INTERVAL '5 seconds',
         original_ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds',
         ends_at = CURRENT_TIMESTAMP - INTERVAL '5 seconds'
       WHERE id = $1`,
      [auctionId]
    );
  }

  async function expireAutomatically(listing, startingPrice = '100.00') {
    await attachImage(listing.id);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice,
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    await makeDue(live.id);
    const completed = await expireAuctionIfDue(client, live.id);
    assert.equal(completed.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(completed.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
    return { live, completed };
  }

  it('listAgain is eligible only for automatically expired auctions', async () => {
    const listing = await insertListing();
    const { completed } = await expireAutomatically(listing);
    const created = await listAgain(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 48,
      publicBaseUrl: 'http://127.0.0.1:3000',
    });
    assert.notEqual(created.listing.id, listing.id);
    assert.equal(created.listing.sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(Number(created.listing.listed_from_listing_id), listing.id);
    assert.equal(Number(created.listing.price), 100);
    assert.equal(created.listing.previous_listing_id, null);
    assert.notEqual(created.auction.id, completed.id);
    assert.equal(created.auction.listing_id, created.listing.id);
    assert.equal(created.auction.extension_used, false);
    assert.equal(created.auction.winning_bid_id, null);
    assert.equal(created.auction.completion_source, null);
    assert.equal(created.auction.extension_notice_sent_at, null);
    assert.equal(Number(created.auction.duration_hours), 48);
    assert.equal(Number(created.auction.starting_price), 100);
    assert.notEqual(String(created.auction.starts_at), String(completed.starts_at));
    assert.notEqual(String(created.auction.ends_at), String(completed.ends_at));
    const original = await client.query(
      `SELECT id, status, sale_type, price FROM listings WHERE id = $1`,
      [listing.id]
    );
    assert.equal(original.rows[0].status, LISTING_STATUS.BID_DURATION_ENDED);
    assert.equal(original.rows[0].sale_type, LISTING_SALE_TYPE.BID);
    assert.equal(Number(original.rows[0].price), 100);
    const originalAuction = await getAuctionByListingId(client, listing.id);
    assert.equal(originalAuction.id, completed.id);
    assert.equal(originalAuction.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(originalAuction.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
    const newBids = await client.query(
      'SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1',
      [created.auction.id]
    );
    assert.equal(newBids.rows[0].n, 0);
  });

  it('listAgain rejects seller-sold completion', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await attachImage(listing.id);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    const live = await startAuction(client, listing.id);
    const bid = await insertBid(listing, live.id, '110.00');
    await completeListingAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      action: 'sold',
      winningBidId: bid.id,
    });
    await assert.rejects(
      () =>
        listAgain(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 48,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'LIST_AGAIN_NOT_ELIGIBLE'
    );
    const after = await getAuctionByListingId(client, listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.COMPLETED);
    assert.equal(after.completion_source, AUCTION_COMPLETION_SOURCE.SOLD);
    assert.equal(after.winning_bid_id, bid.id);
  });

  it('listAgain rejects seller-cancelled auctions', async () => {
    const listing = await insertListing();
    await client.query(`UPDATE listings SET status = 'approved' WHERE id = $1`, [listing.id]);
    await attachImage(listing.id);
    await createPendingAuction(client, {
      listingId: listing.id,
      startingPrice: '100.00',
      durationHours: 24,
    });
    await startAuction(client, listing.id);
    await completeListingAuction(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      action: 'cancel',
    });
    await assert.rejects(
      () =>
        listAgain(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 36,
        }),
      (err) => err && err.statusCode === 409 && err.code === 'LIST_AGAIN_NOT_ELIGIBLE'
    );
    const after = await getAuctionByListingId(client, listing.id);
    assert.equal(after.auction_status, AUCTION_STATUS.CANCELLED);
    assert.equal(after.completion_source, AUCTION_COMPLETION_SOURCE.CANCELLED);
  });

  it('listAgain validates duration and accepts 168 hours', async () => {
    const listing = await insertListing();
    await expireAutomatically(listing);
    await assert.rejects(
      () =>
        listAgain(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 25,
        }),
      (err) => err && err.statusCode === 400 && err.code === 'INVALID_AUCTION_DURATION'
    );
    const created = await listAgain(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 168,
      publicBaseUrl: 'http://127.0.0.1:3000',
    });
    assert.equal(Number(created.auction.duration_hours), 168);
    const original = await getAuctionByListingId(client, listing.id);
    assert.equal(Number(original.duration_hours), 24);
    assert.equal(original.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
  });

  it('listAgain cannot be used twice on the same historical listing', async () => {
    const listing = await insertListing();
    await expireAutomatically(listing);
    await listAgain(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 36,
      publicBaseUrl: 'http://127.0.0.1:3000',
    });
    await assert.rejects(
      () =>
        listAgain(client, {
          listingId: listing.id,
          sellerId: listing.sellerId,
          durationHours: 48,
          publicBaseUrl: 'http://127.0.0.1:3000',
        }),
      (err) => err && err.statusCode === 409 && err.code === 'LIST_AGAIN_ALREADY_USED'
    );
  });

  it('listAgain of a later automatically ended successor is a new listing', async () => {
    const listing = await insertListing();
    await expireAutomatically(listing);
    const first = await listAgain(client, {
      listingId: listing.id,
      sellerId: listing.sellerId,
      durationHours: 24,
      publicBaseUrl: 'http://127.0.0.1:3000',
    });
    if (first.auction.auction_status !== AUCTION_STATUS.LIVE) {
      await startAuction(client, first.listing.id);
    }
    const successorAuction = await getAuctionByListingId(client, first.listing.id);
    await makeDue(successorAuction.id);
    const expiredSuccessor = await expireAuctionIfDue(client, successorAuction.id);
    assert.equal(expiredSuccessor.completion_source, AUCTION_COMPLETION_SOURCE.EXPIRED);
    const second = await listAgain(client, {
      listingId: first.listing.id,
      sellerId: listing.sellerId,
      durationHours: 72,
      publicBaseUrl: 'http://127.0.0.1:3000',
    });
    assert.notEqual(second.listing.id, first.listing.id);
    assert.notEqual(second.listing.id, listing.id);
    assert.equal(Number(second.listing.listed_from_listing_id), first.listing.id);
    assert.equal(Number(second.auction.duration_hours), 72);
  });
});
