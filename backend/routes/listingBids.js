'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const verifyToken = require('../middleware/verifyToken').requireUserId;
const { placeListingBid, endListingAuction, listListingBids, listPublicBidHistory, extendListingAuction, listAgainListing, materializeExpiredAuction, expireDueAuctionsForOwner, expireDueAuctionsForBidder, getAuctionByListingId, parsePublicBidHistoryLimit, LISTING_SALE_TYPE, centsToMoney, moneyToCents } = require('../utils/listingAuctions');
const { resolveBaseUrl } = require('../utils/baseUrl');
const {
  fetchListingRowAfterWrite,
  fetchCustomerMyBids,
  fetchCustomerReceivedBids,
} = require('../utils/listingQueries');
const { formatListingDeviceName } = require('../utils/listingCustom');
const { LISTING_STATUS, isPublicListingStatus } = require('../utils/listingStatus');
const {
  notifyListingLive,
  notifyListingSubmitted,
  notifyAdminsOfNewListing,
} = require('../utils/notifications');
const {
  attachOwnerAuction,
  attachMyBidsAuction,
  receivedManagementFlags,
  parseCustomerListPaging,
} = require('../utils/listingAuctionSummary');

const withoutViewCount = ({ views, ...listing }) => listing;

function paginatedListings(rows, limit, offset) {
  const hasMore = rows.length > limit;
  return {
    listings: hasMore ? rows.slice(0, limit) : rows,
    limit,
    offset,
    has_more: hasMore,
  };
}

router.get('/listings/:id/my-bids', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }

  try {
    const listingResult = await pool.query(
      `SELECT id, user_id, status, sale_type
       FROM listings
       WHERE id = $1`,
      [listingId]
    );
    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult.rows[0];
    if (listing.status === LISTING_STATUS.DELETED) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.sale_type !== LISTING_SALE_TYPE.BID) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (listing.user_id === userId) {
      return res.status(403).json({
        error: 'Sellers cannot use buyer bid history',
        code: 'SELLER_CANNOT_USE_MY_BIDS',
      });
    }

    try {
      await materializeExpiredAuction(pool, listingId);
    } catch (expireError) {
      if (!expireError || expireError.code !== 'AUCTION_WINNER_TIE') {
        throw expireError;
      }
    }

    const bidsResult = await pool.query(
      `SELECT
         b.id,
         b.amount,
         b.created_at,
         (
           b.id = (
             SELECT hb.id
             FROM bids hb
             WHERE hb.auction_id = b.auction_id
               AND hb.listing_id = b.listing_id
             ORDER BY hb.amount DESC, hb.id ASC
             LIMIT 1
           )
         ) AS is_highest
       FROM bids b
       WHERE b.listing_id = $1
         AND b.bidder_id = $2
       ORDER BY b.created_at DESC, b.id DESC`,
      [listingId, userId]
    );

    if (bidsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    return res.json({
      listing_id: listingId,
      bids: bidsResult.rows.map((row) => ({
        id: row.id,
        amount: centsToMoney(moneyToCents(row.amount)),
        created_at: row.created_at,
        is_highest: row.is_highest === true,
      })),
    });
  } catch (error) {
    console.error('Error listing my bids:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to list bids' });
  }
});

router.get('/listings/:id/bid-history', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }

  const limit = parsePublicBidHistoryLimit(req.query.limit);

  try {
    const listingResult = await pool.query(
      `SELECT id, user_id, status, sale_type
       FROM listings
       WHERE id = $1`,
      [listingId]
    );
    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    let listing = listingResult.rows[0];
    if (listing.sale_type !== LISTING_SALE_TYPE.BID) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    try {
      await materializeExpiredAuction(pool, listing.id);
    } catch (expireError) {
      if (!expireError || expireError.code !== 'AUCTION_WINNER_TIE') {
        throw expireError;
      }
    }

    const refreshed = await pool.query(
      `SELECT id, user_id, status, sale_type
       FROM listings
       WHERE id = $1`,
      [listingId]
    );
    if (refreshed.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    listing = refreshed.rows[0];
    if (listing.sale_type !== LISTING_SALE_TYPE.BID) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const isOwner = Number(listing.user_id) === Number(userId);
    const childResult = await pool.query(
      'SELECT id FROM listings WHERE previous_listing_id = $1 LIMIT 1',
      [listingId]
    );
    const isSuperseded = childResult.rows.length > 0;
    if ((!isPublicListingStatus(listing.status) || isSuperseded) && !isOwner) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const auction = await getAuctionByListingId(pool, listingId);
    if (!auction) {
      return res.status(404).json({
        error: 'Auction not found',
        code: 'AUCTION_NOT_FOUND',
      });
    }

    const rows = await listPublicBidHistory(pool, {
      listingId,
      auctionId: auction.id,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    return res.json({
      bids: hasMore ? rows.slice(0, limit) : rows,
      limit,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error listing public bid history:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to list bid history' });
  }
});

router.get('/listings/:id/bids', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const result = await listListingBids(pool, {
      listingId,
      sellerId: req.user.userId,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error listing bids:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to list bids' });
  }
});

router.post('/listings/:id/bids', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const result = await placeListingBid(pool, {
      listingId,
      bidderId: req.user.userId,
      amount: req.body ? req.body.amount : undefined,
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error placing bid:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to place bid' });
  }
});

router.post('/listings/:id/end-bid', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const result = await endListingAuction(pool, {
      listingId,
      sellerId: req.user.userId,
      action: body.action,
      winningBidId: body.winning_bid_id,
      winningBidIdProvided: Object.prototype.hasOwnProperty.call(body, 'winning_bid_id'),
    });
    return res.json(result);
  } catch (error) {
    console.error('Error ending bid:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to end bid' });
  }
});

router.post('/listings/:id/extend-bid', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const result = await extendListingAuction(pool, {
      listingId,
      sellerId: req.user.userId,
      durationHours: body.duration_hours,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error extending bid:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to extend bid' });
  }
});

router.post('/listings/:id/list-again', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const created = await listAgainListing(pool, {
      listingId,
      sellerId: req.user.userId,
      durationHours: body.duration_hours,
      publicBaseUrl: resolveBaseUrl(req),
    });

    const fullListing = await fetchListingRowAfterWrite(pool, created.listing.id, {
      withSellerNames: true,
    });
    const listingDetails = fullListing.rows[0];
    const deviceName = formatListingDeviceName(
      listingDetails.brand_name,
      listingDetails.model_name
    );

    if (created.listing.status === LISTING_STATUS.PENDING) {
      const sellerName = `${listingDetails.seller_first_name || ''} ${listingDetails.seller_last_name || ''}`.trim();
      await notifyAdminsOfNewListing(pool, {
        listingId: created.listing.id,
        deviceName,
        brandName: listingDetails.brand_name,
        modelName: listingDetails.model_name,
        price: listingDetails.price,
        sellerName: sellerName || null,
        submittedAt: listingDetails.created_at,
      });
      await notifyListingSubmitted(pool, {
        userId: req.user.userId,
        listingId: created.listing.id,
        deviceName,
      });
    } else if (created.listing.status === LISTING_STATUS.APPROVED) {
      await notifyListingLive(pool, {
        userId: req.user.userId,
        listingId: created.listing.id,
        deviceName,
      });
    }

    const listingResponse = attachOwnerAuction({ ...listingDetails });
    delete listingResponse.seller_first_name;
    delete listingResponse.seller_last_name;

    return res.status(201).json({
      listing: listingResponse,
      auction: {
        id: created.auction.id,
        listing_id: created.auction.listing_id,
        auction_status: created.auction.auction_status,
        starting_price: created.auction.starting_price,
        duration_hours: created.auction.duration_hours,
        starts_at: created.auction.starts_at,
        original_ends_at: created.auction.original_ends_at,
        ends_at: created.auction.ends_at,
        extension_used: created.auction.extension_used,
        winning_bid_id: created.auction.winning_bid_id,
        completion_source: created.auction.completion_source,
      },
    });
  } catch (error) {
    console.error('Error listing again:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to list again' });
  }
});

router.get('/bids/my', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }

  const paging = parseCustomerListPaging(req.query);

  try {
    await expireDueAuctionsForBidder(pool, userId);
    const result = await fetchCustomerMyBids(pool, userId, paging);
    const listings = result.rows.map((row) => withoutViewCount(attachMyBidsAuction(row)));
    return res.json(paginatedListings(listings, result.limit, result.offset));
  } catch (error) {
    console.error('Error listing my bids:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to list bids' });
  }
});

router.get('/bids/received', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }

  const paging = parseCustomerListPaging(req.query);

  try {
    await expireDueAuctionsForOwner(pool, userId);
    const result = await fetchCustomerReceivedBids(pool, userId, paging);
    const listings = result.rows.map((row) => {
      const listing = attachOwnerAuction(row);
      return {
        ...listing,
        ...receivedManagementFlags(listing),
      };
    });
    return res.json(paginatedListings(listings, result.limit, result.offset));
  } catch (error) {
    console.error('Error listing received bids:', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    return res.status(500).json({ error: 'Failed to list bids' });
  }
});

module.exports = router;
