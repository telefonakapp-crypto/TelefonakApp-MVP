'use strict';

/**
 * Auction domain primitives for Bid listings.
 *
 * Callers own transactions. These functions use db.query() only — they never
 * BEGIN/COMMIT/connect except placeListingBid / materializeExpiredAuction /
 * listAgainListing. Pass a transaction client so bid and expiry flows can lock
 * the auction row.
 */

const { LISTING_STATUS, resolveListingModerationStatus } = require('./listingStatus');

const AUCTION_DURATION_HOURS = Object.freeze([
  24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168,
]);

const AUCTION_DURATION_HOURS_SET = new Set(AUCTION_DURATION_HOURS);
const MAX_AUCTION_DURATION_HOURS = AUCTION_DURATION_HOURS[AUCTION_DURATION_HOURS.length - 1];
const ONE_HOUR_NOTICE_INTERVAL_MS = 5 * 60 * 1000;
const ONE_HOUR_NOTICE_TERMINAL_LISTING_STATUSES = Object.freeze([
  LISTING_STATUS.SOLD,
  LISTING_STATUS.DELETED,
  LISTING_STATUS.BID_DURATION_ENDED,
]);

const MIN_BID_INCREMENT = 5;
const MAX_BID_MULTIPLIER = 2;

const AUCTION_STATUS = Object.freeze({
  PENDING_START: 'pending_start',
  LIVE: 'live',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});

const AUCTION_COMPLETION_SOURCE = Object.freeze({
  EXPIRED: 'expired',
  SOLD: 'sold',
  CANCELLED: 'cancelled',
});

const LISTING_SALE_TYPE = Object.freeze({
  NORMAL: 'normal',
  BID: 'bid',
});

const PUBLIC_BID_HISTORY_DEFAULT_LIMIT = 4;
const PUBLIC_BID_HISTORY_MAX_LIMIT = 20;

function auctionError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function assertPositiveInt(value, fieldName) {
  if (typeof value === 'boolean' || value == null || typeof value === 'object') {
    throw auctionError(`Invalid ${fieldName}`, 400, 'INVALID_AUCTION_ARGUMENT');
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) {
      throw auctionError(`Invalid ${fieldName}`, 400, 'INVALID_AUCTION_ARGUMENT');
    }
    return value;
  }
  const raw = String(value).trim();
  if (!/^[1-9]\d*$/.test(raw)) {
    throw auctionError(`Invalid ${fieldName}`, 400, 'INVALID_AUCTION_ARGUMENT');
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw auctionError(`Invalid ${fieldName}`, 400, 'INVALID_AUCTION_ARGUMENT');
  }
  return parsed;
}

/**
 * Duration must be an exact integer from AUCTION_DURATION_HOURS.
 * Does not round (24.5 and "24.0" are rejected).
 */
function assertAuctionDurationHours(value) {
  let hours;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw auctionError(
        'Auction duration must be an integer number of hours',
        400,
        'INVALID_AUCTION_DURATION'
      );
    }
    hours = value;
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (!/^[1-9]\d*$/.test(raw)) {
      throw auctionError(
        'Auction duration must be an integer number of hours',
        400,
        'INVALID_AUCTION_DURATION'
      );
    }
    hours = Number(raw);
  } else {
    throw auctionError(
      'Auction duration must be an integer number of hours',
      400,
      'INVALID_AUCTION_DURATION'
    );
  }

  if (!AUCTION_DURATION_HOURS_SET.has(hours)) {
    throw auctionError(
      `Auction duration must be one of: ${AUCTION_DURATION_HOURS.join(', ')} hours`,
      400,
      'INVALID_AUCTION_DURATION'
    );
  }
  return hours;
}

/**
 * Starting price as a DECIMAL string (max 2 fraction digits). Never rounded.
 * Comparisons use integer cents so JS floats are not used as money.
 */
function moneyToCents(value) {
  const raw = String(value).trim();
  const match = raw.match(/^(-)?(\d+)\.(\d{1,2})$/) || raw.match(/^(-)?(\d+)$/);
  if (!match) {
    throw auctionError('Starting price must be greater than 0', 400, 'INVALID_STARTING_PRICE');
  }
  const sign = match[1] ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fraction = match[3] ? BigInt((match[3] + '00').slice(0, 2)) : 0n;
  return sign * (whole * 100n + fraction);
}

function assertAuctionStartingPrice(value) {
  if (typeof value === 'boolean' || value == null || typeof value === 'object') {
    throw auctionError('Starting price must be greater than 0', 400, 'INVALID_STARTING_PRICE');
  }

  let raw;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw auctionError('Starting price must be greater than 0', 400, 'INVALID_STARTING_PRICE');
    }
    raw = Number.isInteger(value) ? String(value) : String(value);
  } else {
    raw = String(value).trim();
  }

  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(raw)) {
    throw auctionError(
      'Starting price must be greater than 0 with at most 2 decimal places',
      400,
      'INVALID_STARTING_PRICE'
    );
  }

  const cents = moneyToCents(raw);
  if (cents <= 0n) {
    throw auctionError('Starting price must be greater than 0', 400, 'INVALID_STARTING_PRICE');
  }
  return raw;
}

function startingPricesMatch(left, right) {
  return moneyToCents(left) === moneyToCents(right);
}

function centsToMoney(cents) {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${negative ? '-' : ''}${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}

function incrementCents() {
  return BigInt(MIN_BID_INCREMENT) * 100n;
}

function minimumBidCents(startingCents, highestCents) {
  const base = highestCents == null ? startingCents : highestCents;
  return base + incrementCents();
}

function maximumBidCents(startingCents) {
  return startingCents * BigInt(MAX_BID_MULTIPLIER);
}

/**
 * Bid amount as a DECIMAL string (max 2 fraction digits). Never rounded.
 */
function assertBidAmount(value) {
  if (value === undefined || value === null || value === '') {
    throw auctionError('Bid amount is required', 400, 'INVALID_BID_AMOUNT');
  }
  if (typeof value === 'boolean' || typeof value === 'object') {
    throw auctionError('Bid amount must be a valid amount', 400, 'INVALID_BID_AMOUNT');
  }

  let raw;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw auctionError('Bid amount must be a valid amount', 400, 'INVALID_BID_AMOUNT');
    }
    raw = Number.isInteger(value) ? String(value) : String(value);
  } else {
    raw = String(value).trim();
  }

  if (raw === '') {
    throw auctionError('Bid amount is required', 400, 'INVALID_BID_AMOUNT');
  }

  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(raw)) {
    throw auctionError(
      'Bid amount must be greater than 0 with at most 2 decimal places',
      400,
      'INVALID_BID_AMOUNT'
    );
  }

  const cents = moneyToCents(raw);
  if (cents <= 0n) {
    throw auctionError('Bid amount must be greater than 0', 400, 'INVALID_BID_AMOUNT');
  }
  return raw;
}

function parseListingSaleType(value) {
  if (value == null || value === '') return LISTING_SALE_TYPE.NORMAL;
  const raw = String(value).trim().toLowerCase();
  if (raw === LISTING_SALE_TYPE.NORMAL || raw === LISTING_SALE_TYPE.BID) return raw;
  throw auctionError('sale_type must be normal or bid', 400, 'INVALID_SALE_TYPE');
}

function isBidSaleType(value) {
  return value === LISTING_SALE_TYPE.BID;
}

/**
 * Create the pending auction for a Bid listing and start it when the listing
 * is already publicly approved (auto-approve create).
 */
async function createListingAuction(db, { listingId, startingPrice, durationHours, start }) {
  await createPendingAuction(db, { listingId, startingPrice, durationHours });
  if (start) return startAuction(db, listingId);
  return getAuctionByListingId(db, listingId);
}

/**
 * Start the auction when a Bid listing becomes approved.
 * Missing auctions fail closed so the caller can roll back the listing write.
 */
async function startAuctionIfBidListing(db, { listingId, saleType }) {
  if (!isBidSaleType(saleType)) return null;
  return startAuction(db, listingId);
}

/**
 * Keep a pending_start auction aligned with an in-place Bid edit.
 * Live/ended/cancelled rows are left unchanged (Phase 2H freeze).
 */
async function syncPendingAuction(db, { listingId, startingPrice, durationHours }) {
  const id = assertPositiveInt(listingId, 'listingId');
  const hours = assertAuctionDurationHours(durationHours);
  const price = assertAuctionStartingPrice(startingPrice);

  const updated = await db.query(
    `UPDATE listing_auctions
     SET starting_price = $2::decimal,
         duration_hours = $3
     WHERE listing_id = $1
       AND auction_status = $4
     RETURNING id, listing_id, starting_price, duration_hours,
               starts_at, original_ends_at, ends_at, auction_status,
               extension_used, winning_bid_id, extension_notice_sent_at,
               completion_source, created_at, updated_at`,
    [id, price, hours, AUCTION_STATUS.PENDING_START]
  );
  if (updated.rows.length > 0) return updated.rows[0];

  const existing = await getAuctionByListingId(db, id);
  if (!existing) {
    return createPendingAuction(db, {
      listingId: id,
      startingPrice: price,
      durationHours: hours,
    });
  }
  return existing;
}

async function getAuctionByListingId(db, listingId) {
  const id = assertPositiveInt(listingId, 'listingId');
  const result = await db.query(
    `SELECT id, listing_id, starting_price, duration_hours,
            starts_at, original_ends_at, ends_at, auction_status,
            extension_used, winning_bid_id, extension_notice_sent_at,
            completion_source, created_at, updated_at
     FROM listing_auctions
     WHERE listing_id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Seller listing mutations must not run while the auction is live.
 * No auction / pending_start / ended / cancelled / completed are allowed.
 */
async function assertAuctionNotLive(db, listingId) {
  const auction = await getAuctionByListingId(db, listingId);
  if (!auction) return null;
  if (auction.auction_status === AUCTION_STATUS.LIVE) {
    throw auctionError(
      'A live auction listing cannot be changed',
      409,
      'LIVE_AUCTION_FROZEN'
    );
  }
  return auction;
}

/**
 * Insert pending_start auction. Idempotent when the existing row is still
 * pending_start with the same starting price and duration. Never overwrites.
 */
async function createPendingAuction(db, { listingId, startingPrice, durationHours }) {
  const id = assertPositiveInt(listingId, 'listingId');
  const hours = assertAuctionDurationHours(durationHours);
  const price = assertAuctionStartingPrice(startingPrice);

  let inserted;
  try {
    inserted = await db.query(
      `INSERT INTO listing_auctions (
         listing_id, starting_price, duration_hours, auction_status,
         starts_at, original_ends_at, ends_at, extension_used, winning_bid_id
       )
       VALUES ($1, $2::decimal, $3, $4, NULL, NULL, NULL, FALSE, NULL)
       ON CONFLICT (listing_id) DO NOTHING
       RETURNING id, listing_id, starting_price, duration_hours,
                 starts_at, original_ends_at, ends_at, auction_status,
                 extension_used, winning_bid_id, extension_notice_sent_at,
                 completion_source, created_at, updated_at`,
      [id, price, hours, AUCTION_STATUS.PENDING_START]
    );
  } catch (error) {
    if (error && error.code === '23503') {
      throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
    }
    throw error;
  }

  if (inserted.rows.length > 0) {
    return inserted.rows[0];
  }

  const existing = await getAuctionByListingId(db, id);
  if (!existing) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  if (
    existing.auction_status === AUCTION_STATUS.PENDING_START &&
    Number(existing.duration_hours) === hours &&
    startingPricesMatch(existing.starting_price, price)
  ) {
    return existing;
  }

  throw auctionError(
    'An auction already exists for this listing',
    409,
    'AUCTION_CONFLICT'
  );
}

/**
 * pending_start → live using one PostgreSQL CURRENT_TIMESTAMP.
 * Already-live auctions are returned unchanged (clock is not reset).
 */
async function startAuction(db, listingId) {
  const id = assertPositiveInt(listingId, 'listingId');

  const started = await db.query(
    `UPDATE listing_auctions
     SET
       auction_status = $2,
       starts_at = clock.ts,
       original_ends_at = clock.ts + make_interval(hours => listing_auctions.duration_hours),
       ends_at = clock.ts + make_interval(hours => listing_auctions.duration_hours)
     FROM (SELECT CURRENT_TIMESTAMP AS ts) AS clock
     WHERE listing_auctions.listing_id = $1
       AND listing_auctions.auction_status = $3
     RETURNING listing_auctions.id, listing_auctions.listing_id,
               listing_auctions.starting_price, listing_auctions.duration_hours,
               listing_auctions.starts_at, listing_auctions.original_ends_at,
               listing_auctions.ends_at, listing_auctions.auction_status,
               listing_auctions.extension_used, listing_auctions.winning_bid_id,
               listing_auctions.extension_notice_sent_at,
               listing_auctions.completion_source,
               listing_auctions.created_at, listing_auctions.updated_at`,
    [id, AUCTION_STATUS.LIVE, AUCTION_STATUS.PENDING_START]
  );

  if (started.rows.length > 0) {
    return started.rows[0];
  }

  const existing = await getAuctionByListingId(db, id);
  if (!existing) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }
  if (existing.auction_status === AUCTION_STATUS.LIVE) {
    return existing;
  }

  throw auctionError(
    `Auction cannot be started from status '${existing.auction_status}'`,
    409,
    'INVALID_AUCTION_STATE'
  );
}

function uniqueHighestBidId(winnerRows) {
  if (winnerRows.length === 0) return null;
  if (winnerRows.length === 1) return winnerRows[0].id;
  throw auctionError(
    'Auction has multiple bids at the highest amount; winner tie policy is not defined',
    409,
    'AUCTION_WINNER_TIE'
  );
}

/**
 * If a live auction's ends_at is due (PostgreSQL CURRENT_TIMESTAMP), mark
 * completed, record the unique highest bid (or NULL), and move the listing to
 * bid_duration_ended. Already-completed/ended auctions are returned unchanged.
 * Throws AUCTION_WINNER_TIE before any auction/listing write.
 */
async function expireAuctionIfDue(db, auctionId) {
  const id = assertPositiveInt(auctionId, 'auctionId');

  const locked = await db.query(
    `SELECT id, listing_id, starting_price, duration_hours,
            starts_at, original_ends_at, ends_at, auction_status,
            extension_used, winning_bid_id, extension_notice_sent_at,
            completion_source, created_at, updated_at,
            (auction_status = $2 AND ends_at <= CURRENT_TIMESTAMP) AS is_due
     FROM listing_auctions
     WHERE id = $1
     FOR UPDATE`,
    [id, AUCTION_STATUS.LIVE]
  );

  if (locked.rows.length === 0) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  const auction = locked.rows[0];
  const isDue = auction.is_due === true;
  delete auction.is_due;

  if (
    auction.auction_status === AUCTION_STATUS.ENDED ||
    auction.auction_status === AUCTION_STATUS.COMPLETED
  ) {
    return auction;
  }
  if (auction.auction_status !== AUCTION_STATUS.LIVE || !isDue) {
    return auction;
  }

  const winners = await db.query(
    `SELECT id
     FROM bids
     WHERE auction_id = $1
       AND amount = (SELECT MAX(amount) FROM bids WHERE auction_id = $1)`,
    [id]
  );

  const winningBidId = uniqueHighestBidId(winners.rows);

  const updated = await db.query(
    `UPDATE listing_auctions
     SET auction_status = $2,
         winning_bid_id = $3,
         completion_source = $5
     WHERE id = $1
       AND auction_status = $4
     RETURNING id, listing_id, starting_price, duration_hours,
               starts_at, original_ends_at, ends_at, auction_status,
               extension_used, winning_bid_id, extension_notice_sent_at,
               completion_source, created_at, updated_at`,
    [id, AUCTION_STATUS.COMPLETED, winningBidId, AUCTION_STATUS.LIVE, AUCTION_COMPLETION_SOURCE.EXPIRED]
  );

  const completed = updated.rows[0];
  if (!completed) {
    return auction;
  }

  await setListingBidDurationEnded(db, completed.listing_id);
  return completed;
}

async function setListingBidDurationEnded(db, listingId) {
  await db.query(
    `UPDATE listings
     SET status = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND status <> ALL($3::text[])`,
    [
      listingId,
      LISTING_STATUS.BID_DURATION_ENDED,
      [
        LISTING_STATUS.SOLD,
        LISTING_STATUS.DELETED,
        LISTING_STATUS.BID_DURATION_ENDED,
      ],
    ]
  );
}

async function expireAuctionForListing(db, listingId) {
  const auction = await getAuctionByListingId(db, listingId);
  if (!auction) return null;
  return expireAuctionIfDue(db, auction.id);
}

async function lockAuctionByListingId(db, listingId) {
  const id = assertPositiveInt(listingId, 'listingId');
  const result = await db.query(
    `SELECT id, listing_id, starting_price, duration_hours,
            starts_at, original_ends_at, ends_at, auction_status,
            extension_used, winning_bid_id, extension_notice_sent_at,
            completion_source, created_at, updated_at
     FROM listing_auctions
     WHERE listing_id = $1
     FOR UPDATE`,
    [id]
  );
  return result.rows[0] || null;
}

function notLiveBidError(status) {
  const error =
    status === AUCTION_STATUS.ENDED || status === AUCTION_STATUS.COMPLETED
      ? auctionError('This auction has ended', 409, 'AUCTION_ENDED')
      : auctionError('This auction is not accepting bids', 409, 'AUCTION_NOT_LIVE');
  error.persistTransaction = true;
  return error;
}

/**
 * Place an append-only bid. Caller must already be inside a transaction.
 * Locks listing_auctions FOR UPDATE so concurrent bids serialize.
 */
async function placeBid(db, { listingId, bidderId, amount }) {
  const listingIdInt = assertPositiveInt(listingId, 'listingId');
  const bidderIdInt = assertPositiveInt(bidderId, 'bidderId');
  const amountRaw = assertBidAmount(amount);

  let auction = await lockAuctionByListingId(db, listingIdInt);
  if (!auction) {
    const listingExists = await db.query('SELECT id FROM listings WHERE id = $1', [listingIdInt]);
    if (listingExists.rows.length === 0) {
      throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
    }
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  if (Number(auction.listing_id) !== listingIdInt) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  const listingResult = await db.query(
    'SELECT id, user_id, status FROM listings WHERE id = $1',
    [listingIdInt]
  );
  if (listingResult.rows.length === 0) {
    throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
  }

  const listing = listingResult.rows[0];
  const sellerId = Number(listing.user_id);
  if (sellerId === bidderIdInt) {
    throw auctionError('You cannot bid on your own listing', 403, 'BID_SELF');
  }

  if (
    listing.status === LISTING_STATUS.SOLD ||
    listing.status === LISTING_STATUS.DELETED ||
    listing.status === LISTING_STATUS.BID_DURATION_ENDED
  ) {
    throw auctionError('This listing is not accepting bids', 409, 'LISTING_NOT_BIDDABLE');
  }

  auction = await expireAuctionIfDue(db, auction.id);

  if (auction.auction_status !== AUCTION_STATUS.LIVE) {
    throw notLiveBidError(auction.auction_status);
  }

  const highestResult = await db.query(
    'SELECT MAX(amount) AS highest FROM bids WHERE auction_id = $1',
    [auction.id]
  );
  const highest = highestResult.rows[0] ? highestResult.rows[0].highest : null;

  const startingCents = moneyToCents(auction.starting_price);
  const highestCents = highest == null ? null : moneyToCents(highest);
  const amountCents = moneyToCents(amountRaw);
  const minCents = minimumBidCents(startingCents, highestCents);
  const maxCents = maximumBidCents(startingCents);

  if (amountCents < minCents) {
    throw auctionError(
      `Bid must be at least ${centsToMoney(minCents)}`,
      409,
      'BID_TOO_LOW'
    );
  }
  if (amountCents > maxCents) {
    throw auctionError(
      `Bid cannot exceed ${centsToMoney(maxCents)}`,
      400,
      'BID_TOO_HIGH'
    );
  }

  let inserted;
  try {
    inserted = await db.query(
      `INSERT INTO bids (listing_id, auction_id, bidder_id, seller_id, amount)
       VALUES ($1, $2, $3, $4, $5::decimal)
       RETURNING id, amount, created_at`,
      [auction.listing_id, auction.id, bidderIdInt, sellerId, amountRaw]
    );
  } catch (error) {
    if (error && error.code === '23514') {
      throw auctionError('You cannot bid on your own listing', 403, 'BID_SELF');
    }
    if (error && error.code === '23503') {
      throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
    }
    throw error;
  }

  const bid = inserted.rows[0];
  return {
    bid: {
      id: bid.id,
      amount: centsToMoney(amountCents),
      created_at: bid.created_at,
    },
    highest_bid: centsToMoney(amountCents),
    minimum_next_bid: centsToMoney(amountCents + incrementCents()),
    maximum_bid: centsToMoney(maxCents),
    auction_status: auction.auction_status,
    ends_at: auction.ends_at,
  };
}

/**
 * HTTP entry: owns BEGIN/COMMIT. Commits lazy expiry even when the bid is rejected
 * because the auction is no longer live.
 */
async function placeListingBid(pool, args) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await placeBid(client, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (error && error.persistTransaction) {
      try {
        await client.query('COMMIT');
      } catch (commitError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw commitError;
      }
      throw error;
    }
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Own a short transaction so GET listing/detail can materialize completion.
 */
async function materializeExpiredAuction(pool, listingId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await expireAuctionForListing(client, listingId);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

const END_BID_ACTIONS = Object.freeze({
  SOLD: 'sold',
  CANCEL: 'cancel',
});

/**
 * Seller End Bid. Caller must already be inside a transaction.
 * Locks listing_auctions FOR UPDATE first, then the listing row.
 * Due live auctions follow Phase 2E first and then reject.
 */
async function completeListingAuction(db, args) {
  const listingIdInt = assertPositiveInt(args.listingId, 'listingId');
  const sellerIdInt = assertPositiveInt(args.sellerId, 'sellerId');
  const action =
    typeof args.action === 'string' ? args.action.trim() : args.action;

  if (action !== END_BID_ACTIONS.SOLD && action !== END_BID_ACTIONS.CANCEL) {
    throw auctionError('End Bid action must be sold or cancel', 400, 'INVALID_END_BID_ACTION');
  }

  if (action === END_BID_ACTIONS.CANCEL && args.winningBidIdProvided) {
    throw auctionError('Cancel cannot select a winner', 400, 'WINNING_BID_INVALID');
  }

  let auction = await lockAuctionByListingId(db, listingIdInt);

  const listingResult = await db.query(
    `SELECT id, user_id, status, sale_type
     FROM listings
     WHERE id = $1
     FOR UPDATE`,
    [listingIdInt]
  );
  if (listingResult.rows.length === 0) {
    throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
  }

  const listing = listingResult.rows[0];
  if (Number(listing.user_id) !== sellerIdInt) {
    throw auctionError('Not authorized to end this bid', 403, 'END_BID_NOT_OWNER');
  }
  if ((listing.sale_type || LISTING_SALE_TYPE.NORMAL) !== LISTING_SALE_TYPE.BID) {
    throw auctionError('Only Bid listings can be ended this way', 409, 'END_BID_NOT_AUCTION');
  }

  if (!auction || Number(auction.listing_id) !== listingIdInt) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  auction = await expireAuctionIfDue(db, auction.id);

  if (auction.auction_status !== AUCTION_STATUS.LIVE) {
    throw notLiveBidError(auction.auction_status);
  }

  if (
    listing.status === LISTING_STATUS.SOLD ||
    listing.status === LISTING_STATUS.DELETED ||
    listing.status === LISTING_STATUS.BID_DURATION_ENDED
  ) {
    const error = auctionError(
      'This listing is not accepting End Bid',
      409,
      'LISTING_NOT_BIDDABLE'
    );
    error.persistTransaction = true;
    throw error;
  }

  let nextStatus;
  let winningBidId = null;

  if (action === END_BID_ACTIONS.CANCEL) {
    nextStatus = AUCTION_STATUS.CANCELLED;
  } else {
    if (args.winningBidId == null || args.winningBidId === '') {
      throw auctionError('winning_bid_id is required', 400, 'WINNING_BID_REQUIRED');
    }

    let bidId;
    try {
      bidId = assertPositiveInt(args.winningBidId, 'winning_bid_id');
    } catch (error) {
      if (error && error.code === 'INVALID_AUCTION_ARGUMENT') {
        throw auctionError('winning_bid_id is invalid', 400, 'WINNING_BID_INVALID');
      }
      throw error;
    }

    const bidResult = await db.query(
      `SELECT id, listing_id, auction_id, bidder_id, seller_id, amount
       FROM bids
       WHERE id = $1
       FOR UPDATE`,
      [bidId]
    );
    if (bidResult.rows.length === 0) {
      throw auctionError('Winning bid not found', 404, 'WINNING_BID_NOT_FOUND');
    }

    const bid = bidResult.rows[0];
    if (
      Number(bid.auction_id) !== Number(auction.id) ||
      Number(bid.listing_id) !== listingIdInt
    ) {
      throw auctionError(
        'Winning bid does not belong to this auction',
        409,
        'WINNING_BID_WRONG_AUCTION'
      );
    }
    if (
      Number(bid.seller_id) !== Number(listing.user_id) ||
      Number(bid.bidder_id) === Number(listing.user_id)
    ) {
      throw auctionError('Winning bid is not valid for this listing', 409, 'WINNING_BID_INVALID');
    }

    nextStatus = AUCTION_STATUS.COMPLETED;
    winningBidId = bid.id;
  }

  const completionSource =
    nextStatus === AUCTION_STATUS.CANCELLED
      ? AUCTION_COMPLETION_SOURCE.CANCELLED
      : AUCTION_COMPLETION_SOURCE.SOLD;

  const updated = await db.query(
    `UPDATE listing_auctions
     SET auction_status = $2,
         winning_bid_id = $3,
         completion_source = $5
     WHERE id = $1
       AND auction_status = $4
     RETURNING id, listing_id, starting_price, duration_hours,
               starts_at, original_ends_at, ends_at, auction_status,
               extension_used, winning_bid_id, extension_notice_sent_at,
               completion_source, created_at, updated_at`,
    [auction.id, nextStatus, winningBidId, AUCTION_STATUS.LIVE, completionSource]
  );
  const completed = updated.rows[0];
  if (!completed) {
    throw notLiveBidError(auction.auction_status);
  }

  await setListingBidDurationEnded(db, listingIdInt);

  const listingAfter = await db.query(
    'SELECT id, status, price, sale_type FROM listings WHERE id = $1',
    [listingIdInt]
  );

  return {
    listing: listingAfter.rows[0],
    auction: {
      id: completed.id,
      listing_id: completed.listing_id,
      auction_status: completed.auction_status,
      winning_bid_id: completed.winning_bid_id,
      ends_at: completed.ends_at,
    },
  };
}

/**
 * HTTP entry: owns BEGIN/COMMIT. Commits lazy 2E expiry when End Bid is rejected
 * because the auction is no longer live.
 */
async function endListingAuction(pool, args) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await completeListingAuction(client, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (error && error.persistTransaction) {
      try {
        await client.query('COMMIT');
      } catch (commitError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw commitError;
      }
      throw error;
    }
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seller extend Bid. Caller must already be inside a transaction.
 * Locks listing_auctions FOR UPDATE first, then the listing row.
 * Due live auctions follow Phase 2E first and then reject.
 */
async function extendAuction(db, args) {
  const listingIdInt = assertPositiveInt(args.listingId, 'listingId');
  const sellerIdInt = assertPositiveInt(args.sellerId, 'sellerId');

  let auction = await lockAuctionByListingId(db, listingIdInt);

  const listingResult = await db.query(
    `SELECT id, user_id, status, sale_type, price
     FROM listings
     WHERE id = $1
     FOR UPDATE`,
    [listingIdInt]
  );
  if (listingResult.rows.length === 0) {
    throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
  }

  const listing = listingResult.rows[0];
  if (Number(listing.user_id) !== sellerIdInt) {
    throw auctionError('Not authorized to extend this bid', 403, 'END_BID_NOT_OWNER');
  }
  if ((listing.sale_type || LISTING_SALE_TYPE.NORMAL) !== LISTING_SALE_TYPE.BID) {
    throw auctionError('Only Bid listings can be extended this way', 409, 'END_BID_NOT_AUCTION');
  }

  if (!auction || Number(auction.listing_id) !== listingIdInt) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  auction = await expireAuctionIfDue(db, auction.id);

  if (auction.auction_status !== AUCTION_STATUS.LIVE) {
    throw notLiveBidError(auction.auction_status);
  }

  const listingAfterExpire = await db.query('SELECT status FROM listings WHERE id = $1', [
    listingIdInt,
  ]);
  const listingStatus = listingAfterExpire.rows[0] && listingAfterExpire.rows[0].status;
  if (
    listingStatus === LISTING_STATUS.SOLD ||
    listingStatus === LISTING_STATUS.DELETED ||
    listingStatus === LISTING_STATUS.BID_DURATION_ENDED
  ) {
    const error = auctionError(
      'This listing is not accepting extensions',
      409,
      'LISTING_NOT_BIDDABLE'
    );
    error.persistTransaction = true;
    throw error;
  }

  if (auction.extension_used === true) {
    throw auctionError('This auction has already been extended', 409, 'EXTENSION_ALREADY_USED');
  }

  const hours = assertAuctionDurationHours(args.durationHours);

  const schedule = await db.query(
    `SELECT
       ends_at + make_interval(hours => $2) AS new_ends_at,
       (ends_at + make_interval(hours => $2)
          <= starts_at + make_interval(hours => $3)) AS within_max
     FROM listing_auctions
     WHERE id = $1`,
    [auction.id, hours, MAX_AUCTION_DURATION_HOURS]
  );
  if (!schedule.rows[0] || schedule.rows[0].within_max !== true) {
    throw auctionError(
      'Extension would exceed the 168 hour maximum',
      409,
      'EXTENSION_EXCEEDS_MAX'
    );
  }

  let updated;
  try {
    updated = await db.query(
      `UPDATE listing_auctions
       SET
         ends_at = listing_auctions.ends_at + make_interval(hours => $2),
         extension_used = TRUE
       WHERE id = $1
         AND auction_status = $3
         AND extension_used = FALSE
         AND ends_at > CURRENT_TIMESTAMP
         AND listing_auctions.ends_at + make_interval(hours => $2)
             <= listing_auctions.starts_at + make_interval(hours => $4)
       RETURNING id, listing_id, starting_price, duration_hours,
                 starts_at, original_ends_at, ends_at, auction_status,
                 extension_used, winning_bid_id, extension_notice_sent_at,
                 completion_source, created_at, updated_at`,
      [auction.id, hours, AUCTION_STATUS.LIVE, MAX_AUCTION_DURATION_HOURS]
    );
  } catch (error) {
    if (error && error.code === '23514') {
      throw auctionError(
        'Extension would exceed the 168 hour maximum',
        409,
        'EXTENSION_EXCEEDS_MAX'
      );
    }
    throw error;
  }

  const extended = updated.rows[0];
  if (!extended) {
    const current = await getAuctionByListingId(db, listingIdInt);
    if (!current || current.auction_status !== AUCTION_STATUS.LIVE) {
      throw notLiveBidError(current && current.auction_status);
    }
    if (current.extension_used === true) {
      throw auctionError('This auction has already been extended', 409, 'EXTENSION_ALREADY_USED');
    }
    throw auctionError(
      'Extension would exceed the 168 hour maximum',
      409,
      'EXTENSION_EXCEEDS_MAX'
    );
  }

  const listingAfter = await db.query(
    'SELECT id, status, price, sale_type FROM listings WHERE id = $1',
    [listingIdInt]
  );

  return {
    listing: listingAfter.rows[0],
    auction: {
      id: extended.id,
      listing_id: extended.listing_id,
      auction_status: extended.auction_status,
      starting_price: extended.starting_price,
      duration_hours: extended.duration_hours,
      starts_at: extended.starts_at,
      original_ends_at: extended.original_ends_at,
      ends_at: extended.ends_at,
      extension_used: extended.extension_used,
      winning_bid_id: extended.winning_bid_id,
    },
  };
}

/**
 * HTTP entry: owns BEGIN/COMMIT. Commits lazy 2E expiry when extension is
 * rejected because the auction is no longer live.
 */
async function extendListingAuction(pool, args) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await extendAuction(client, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (error && error.persistTransaction) {
      try {
        await client.query('COMMIT');
      } catch (commitError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw commitError;
      }
      throw error;
    }
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

function bidderDisplayName(firstName, lastName) {
  return `${firstName || ''} ${lastName || ''}`.trim();
}

const SELLER_BID_LIST_STATUSES = new Set([
  AUCTION_STATUS.LIVE,
  AUCTION_STATUS.COMPLETED,
  AUCTION_STATUS.ENDED,
  AUCTION_STATUS.CANCELLED,
]);

/**
 * Owner bidder list for a live or historical auction.
 * Caller must already be inside a transaction.
 * Locks the auction so a due live auction is completed before any
 * bidder phones are returned. Reading history does not revive the auction.
 */
async function listLiveAuctionBids(db, { listingId, sellerId }) {
  const listingIdInt = assertPositiveInt(listingId, 'listingId');
  const sellerIdInt = assertPositiveInt(sellerId, 'sellerId');

  const listingResult = await db.query(
    `SELECT id, user_id, status, sale_type
     FROM listings
     WHERE id = $1`,
    [listingIdInt]
  );
  if (listingResult.rows.length === 0) {
    throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
  }

  const listing = listingResult.rows[0];
  if (Number(listing.user_id) !== sellerIdInt) {
    throw auctionError('Not authorized to view these bids', 403, 'END_BID_NOT_OWNER');
  }
  if ((listing.sale_type || LISTING_SALE_TYPE.NORMAL) !== LISTING_SALE_TYPE.BID) {
    throw auctionError('Only Bid listings have auction bids', 409, 'END_BID_NOT_AUCTION');
  }

  let auction = await lockAuctionByListingId(db, listingIdInt);
  if (!auction || Number(auction.listing_id) !== listingIdInt) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }

  auction = await expireAuctionIfDue(db, auction.id);

  const listingAfter = await db.query('SELECT status FROM listings WHERE id = $1', [
    listingIdInt,
  ]);
  const listingStatus = listingAfter.rows[0] && listingAfter.rows[0].status;
  if (listingStatus === LISTING_STATUS.DELETED) {
    const error = auctionError(
      'This listing is not accepting bids',
      409,
      'LISTING_NOT_BIDDABLE'
    );
    error.persistTransaction = true;
    throw error;
  }

  if (!SELLER_BID_LIST_STATUSES.has(auction.auction_status)) {
    throw notLiveBidError(auction.auction_status);
  }

  if (
    auction.auction_status === AUCTION_STATUS.LIVE &&
    (listingStatus === LISTING_STATUS.SOLD ||
      listingStatus === LISTING_STATUS.BID_DURATION_ENDED)
  ) {
    const error = auctionError(
      'This listing is not accepting bids',
      409,
      'LISTING_NOT_BIDDABLE'
    );
    error.persistTransaction = true;
    throw error;
  }

  const bidRows = await db.query(
    `SELECT b.id, b.amount, b.created_at, b.bidder_id,
            u.first_name, u.last_name, u.phone_number
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.auction_id = $1
       AND b.listing_id = $2
     ORDER BY b.amount DESC, b.created_at DESC, b.id DESC`,
    [auction.id, listingIdInt]
  );

  const bids = bidRows.rows.map((row) => ({
    id: row.id,
    amount: centsToMoney(moneyToCents(row.amount)),
    created_at: row.created_at,
    bidder: {
      id: row.bidder_id,
      name: bidderDisplayName(row.first_name, row.last_name),
      phone_number: row.phone_number,
    },
  }));

  return {
    listing_id: listingIdInt,
    auction: {
      id: auction.id,
      auction_status: auction.auction_status,
      starting_price: centsToMoney(moneyToCents(auction.starting_price)),
      duration_hours: Number(auction.duration_hours),
      starts_at: auction.starts_at,
      original_ends_at: auction.original_ends_at,
      ends_at: auction.ends_at,
      extension_used: auction.extension_used === true,
      current_highest_bid: bids.length > 0 ? bids[0].amount : null,
    },
    bids,
  };
}

async function listListingBids(pool, args) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await listLiveAuctionBids(client, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (error && error.persistTransaction) {
      try {
        await client.query('COMMIT');
      } catch (commitError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw commitError;
      }
      throw error;
    }
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

function parsePublicBidHistoryLimit(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return PUBLIC_BID_HISTORY_DEFAULT_LIMIT;
  }
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return PUBLIC_BID_HISTORY_DEFAULT_LIMIT;
  }
  return Math.min(parsed, PUBLIC_BID_HISTORY_MAX_LIMIT);
}

/**
 * Buyer-safe public bid history. Selects only amount and created_at.
 * Does not join users and does not return bidder identity.
 */
async function listPublicBidHistory(db, { listingId, auctionId, limit }) {
  const listingIdInt = assertPositiveInt(listingId, 'listingId');
  const auctionIdInt = assertPositiveInt(auctionId, 'auctionId');
  const take = assertPositiveInt(limit, 'limit');
  const result = await db.query(
    `SELECT b.amount, b.created_at
     FROM bids b
     WHERE b.listing_id = $1
       AND b.auction_id = $2
     ORDER BY b.amount DESC, b.created_at DESC, b.id DESC
     LIMIT $3`,
    [listingIdInt, auctionIdInt, take]
  );
  return result.rows.map((row) => ({
    amount: centsToMoney(moneyToCents(row.amount)),
    created_at: row.created_at,
  }));
}

async function expireDueAuctionsForOwner(pool, userId) {
  const ownerId = assertPositiveInt(userId, 'userId');
  const due = await pool.query(
    `SELECT a.listing_id
     FROM listing_auctions a
     JOIN listings l ON l.id = a.listing_id
     WHERE l.user_id = $1
       AND a.auction_status = $2
       AND a.ends_at <= CURRENT_TIMESTAMP`,
    [ownerId, AUCTION_STATUS.LIVE]
  );
  for (const row of due.rows) {
    try {
      await materializeExpiredAuction(pool, row.listing_id);
    } catch (error) {
      if (!error || error.code !== 'AUCTION_WINNER_TIE') {
        throw error;
      }
    }
  }
}

async function expireDueAuctionsForBidder(pool, bidderId) {
  const userId = assertPositiveInt(bidderId, 'bidderId');
  const due = await pool.query(
    `SELECT DISTINCT a.listing_id
     FROM listing_auctions a
     JOIN bids b ON b.auction_id = a.id AND b.listing_id = a.listing_id
     WHERE b.bidder_id = $1
       AND a.auction_status = $2
       AND a.ends_at <= CURRENT_TIMESTAMP`,
    [userId, AUCTION_STATUS.LIVE]
  );
  for (const row of due.rows) {
    try {
      await materializeExpiredAuction(pool, row.listing_id);
    } catch (error) {
      if (!error || error.code !== 'AUCTION_WINNER_TIE') {
        throw error;
      }
    }
  }
}

function listAgainNotEligible(message) {
  return auctionError(message || 'This listing cannot be listed again', 409, 'LIST_AGAIN_NOT_ELIGIBLE');
}

/**
 * Create a NEW Bid listing from an automatically duration-ended historical listing.
 * Caller must already be inside a transaction. Locks auction then listing.
 */
async function listAgain(db, { listingId, sellerId, durationHours, publicBaseUrl }) {
  const listingIdInt = assertPositiveInt(listingId, 'listingId');
  const sellerIdInt = assertPositiveInt(sellerId, 'sellerId');
  const hours = assertAuctionDurationHours(durationHours);
  const {
    copyLocalListingImageFile,
    recordListingImageUpload,
    listingImageFilename,
  } = require('./listingImageAuth');

  const auction = await lockAuctionByListingId(db, listingIdInt);
  const listingResult = await db.query(
    `SELECT id, user_id, status, sale_type, price,
            model_id, storage_id, color_id, model_storage_id, model_color_id,
            sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
            condition_id, battery_percentage, description, description_en, description_ar,
            description_ar_is_auto_translated, location, city_id, area_id,
            category_id, listing_source, custom_brand_name, custom_model_name,
            custom_storage, custom_color_name, custom_sim_configuration,
            custom_case_size, custom_connectivity
     FROM listings
     WHERE id = $1
     FOR UPDATE`,
    [listingIdInt]
  );
  if (listingResult.rows.length === 0) {
    throw auctionError('Listing not found', 404, 'AUCTION_LISTING_NOT_FOUND');
  }

  const listing = listingResult.rows[0];
  if (Number(listing.user_id) !== sellerIdInt) {
    throw auctionError('Not authorized to list this again', 403, 'LIST_AGAIN_NOT_OWNER');
  }
  if ((listing.sale_type || LISTING_SALE_TYPE.NORMAL) !== LISTING_SALE_TYPE.BID) {
    throw auctionError('Only Bid listings can be listed again', 409, 'LIST_AGAIN_NOT_AUCTION');
  }
  if (!auction || Number(auction.listing_id) !== listingIdInt) {
    throw auctionError('Auction not found', 404, 'AUCTION_NOT_FOUND');
  }
  if (listing.status !== LISTING_STATUS.BID_DURATION_ENDED) {
    throw listAgainNotEligible();
  }
  if (
    auction.auction_status !== AUCTION_STATUS.COMPLETED ||
    auction.completion_source !== AUCTION_COMPLETION_SOURCE.EXPIRED
  ) {
    throw listAgainNotEligible();
  }

  const alreadyListed = await db.query(
    `SELECT id FROM listings WHERE listed_from_listing_id = $1`,
    [listingIdInt]
  );
  if (alreadyListed.rows.length > 0) {
    throw auctionError(
      'This listing has already been listed again',
      409,
      'LIST_AGAIN_ALREADY_USED'
    );
  }

  const images = await db.query(
    `SELECT image_url, display_order
     FROM listing_images
     WHERE listing_id = $1
     ORDER BY display_order ASC, id ASC`,
    [listingIdInt]
  );
  if (images.rows.length === 0) {
    throw auctionError('At least one image is required', 400, 'LIST_AGAIN_NO_IMAGES');
  }

  const initialStatus = await resolveListingModerationStatus(db);
  const startingPrice = assertAuctionStartingPrice(auction.starting_price);

  let inserted;
  try {
    inserted = await db.query(
      `INSERT INTO listings (
         user_id, model_id, storage_id, color_id, model_storage_id, model_color_id,
         sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
         condition_id, battery_percentage, price, description, description_en, description_ar,
         description_ar_is_auto_translated, location, city_id, area_id, status,
         decline_reason, approved_or_rejected_at, moderated_by_admin_id, resubmitted_at,
         previous_listing_id, category_id, listing_source, custom_brand_name, custom_model_name,
         custom_storage, custom_color_name, custom_sim_configuration, custom_case_size,
         custom_connectivity, sale_type, listed_from_listing_id
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::decimal, $13, $14, $15, $16,
         $17, $18, $19, $20, NULL,
         CASE WHEN $20::varchar = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
         NULL, NULL, NULL, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
       )
       RETURNING *`,
      [
        sellerIdInt,
        listing.model_id,
        listing.storage_id,
        listing.color_id,
        listing.model_storage_id,
        listing.model_color_id,
        listing.sim_configuration_id,
        listing.model_watch_case_size_id,
        listing.model_watch_connectivity_id,
        listing.condition_id,
        listing.battery_percentage,
        startingPrice,
        listing.description,
        listing.description_en,
        listing.description_ar,
        listing.description_ar_is_auto_translated,
        listing.location,
        listing.city_id,
        listing.area_id,
        initialStatus,
        listing.category_id,
        listing.listing_source,
        listing.custom_brand_name,
        listing.custom_model_name,
        listing.custom_storage,
        listing.custom_color_name,
        listing.custom_sim_configuration,
        listing.custom_case_size,
        listing.custom_connectivity,
        LISTING_SALE_TYPE.BID,
        listingIdInt,
      ]
    );
  } catch (error) {
    if (error && error.code === '23505') {
      throw auctionError(
        'This listing has already been listed again',
        409,
        'LIST_AGAIN_ALREADY_USED'
      );
    }
    throw error;
  }

  const created = inserted.rows[0];
  for (let i = 0; i < images.rows.length; i++) {
    const copiedUrl = copyLocalListingImageFile(images.rows[i].image_url, publicBaseUrl);
    const copiedFilename = listingImageFilename(copiedUrl);
    if (copiedFilename) {
      await recordListingImageUpload(sellerIdInt, copiedFilename);
    }
    await db.query(
      `INSERT INTO listing_images (listing_id, image_url, display_order)
       VALUES ($1, $2, $3)`,
      [created.id, copiedUrl, i]
    );
  }

  const newAuction = await createListingAuction(db, {
    listingId: created.id,
    startingPrice,
    durationHours: hours,
    start: created.status === LISTING_STATUS.APPROVED,
  });

  const originalAfter = await db.query(
    `SELECT id, user_id, status, sale_type, price, views, listed_from_listing_id
     FROM listings WHERE id = $1`,
    [listingIdInt]
  );

  return {
    listing: created,
    auction: newAuction,
    original: originalAfter.rows[0],
  };
}

async function listAgainListing(pool, args) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await listAgain(client, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

const ONE_HOUR_NOTICE_CANDIDATE_SQL = `
  SELECT a.id
  FROM listing_auctions a
  JOIN listings l ON l.id = a.listing_id
  WHERE a.auction_status = $1
    AND a.extension_notice_sent_at IS NULL
    AND l.sale_type = $2
    AND l.status <> ALL($3::text[])
    AND a.ends_at > CURRENT_TIMESTAMP
    AND a.ends_at <= CURRENT_TIMESTAMP + INTERVAL '1 hour'
  ORDER BY a.ends_at ASC, a.id ASC
`;

const ONE_HOUR_NOTICE_CLAIM_SQL = `
  UPDATE listing_auctions a
  SET extension_notice_sent_at = CURRENT_TIMESTAMP
  FROM listings l
  WHERE a.listing_id = l.id
    AND a.id = $1
    AND a.auction_status = $2
    AND a.extension_notice_sent_at IS NULL
    AND l.sale_type = $3
    AND l.status <> ALL($4::text[])
    AND a.ends_at > CURRENT_TIMESTAMP
    AND a.ends_at <= CURRENT_TIMESTAMP + INTERVAL '1 hour'
  RETURNING a.id, a.listing_id, l.user_id
`;

function parseOneHourNoticeIntervalMs(raw) {
  if (raw == null || raw === '') return ONE_HOUR_NOTICE_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return ONE_HOUR_NOTICE_INTERVAL_MS;
  return parsed;
}

/**
 * Atomically claim live Bid auctions in the one-hour window, then write the
 * seller inbox row through the existing notification helper.
 *
 * Claim-before-inbox is required so two ticks cannot both send. If inbox
 * insert fails, extension_notice_sent_at is cleared so the next tick retries.
 * Expo push stays best-effort after a successful inbox insert (same as every
 * other customer notification).
 */
async function dispatchOneHourAuctionNotices(db) {
  const { notifyAuctionOneHourRemaining, getListingDeviceName } = require('./notifications');

  const candidates = await db.query(ONE_HOUR_NOTICE_CANDIDATE_SQL, [
    AUCTION_STATUS.LIVE,
    LISTING_SALE_TYPE.BID,
    ONE_HOUR_NOTICE_TERMINAL_LISTING_STATUSES,
  ]);

  const sent = [];
  for (const candidate of candidates.rows) {
    const claimed = await db.query(ONE_HOUR_NOTICE_CLAIM_SQL, [
      candidate.id,
      AUCTION_STATUS.LIVE,
      LISTING_SALE_TYPE.BID,
      ONE_HOUR_NOTICE_TERMINAL_LISTING_STATUSES,
    ]);
    const row = claimed.rows[0];
    if (!row) continue;

    const deviceName = await getListingDeviceName(db, row.listing_id);
    const notification = await notifyAuctionOneHourRemaining(db, {
      userId: row.user_id,
      listingId: row.listing_id,
      deviceName,
    });
    if (!notification) {
      await db.query(
        `UPDATE listing_auctions
         SET extension_notice_sent_at = NULL
         WHERE id = $1
           AND extension_notice_sent_at IS NOT NULL`,
        [row.id]
      );
      continue;
    }
    sent.push({
      auction_id: row.id,
      listing_id: row.listing_id,
      user_id: row.user_id,
      notification_id: notification.id,
    });
  }
  return sent;
}

function startAuctionOneHourNoticeScheduler(pool, options = {}) {
  const intervalMs = Object.prototype.hasOwnProperty.call(options, 'intervalMs')
    ? Number(options.intervalMs)
    : parseOneHourNoticeIntervalMs(process.env.AUCTION_ONE_HOUR_NOTICE_INTERVAL_MS);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return { stop() {} };
  }

  let inFlight = false;
  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await dispatchOneHourAuctionNotices(pool);
    } catch (error) {
      console.error('[auction-notice]', error && error.message ? error.message : error);
    } finally {
      inFlight = false;
    }
  };

  tick().catch(() => {});
  const interval = setInterval(tick, intervalMs);
  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  AUCTION_DURATION_HOURS,
  MAX_AUCTION_DURATION_HOURS,
  ONE_HOUR_NOTICE_INTERVAL_MS,
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
  moneyToCents,
  centsToMoney,
  minimumBidCents,
  maximumBidCents,
  getAuctionByListingId,
  assertAuctionNotLive,
  createPendingAuction,
  createListingAuction,
  startAuction,
  startAuctionIfBidListing,
  syncPendingAuction,
  expireAuctionIfDue,
  expireAuctionForListing,
  placeBid,
  placeListingBid,
  completeListingAuction,
  endListingAuction,
  extendAuction,
  extendListingAuction,
  listLiveAuctionBids,
  listListingBids,
  listPublicBidHistory,
  materializeExpiredAuction,
  expireDueAuctionsForOwner,
  expireDueAuctionsForBidder,
  listAgain,
  listAgainListing,
  dispatchOneHourAuctionNotices,
  startAuctionOneHourNoticeScheduler,
};
