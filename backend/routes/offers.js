const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  getListingDeviceName,
  notifyOfferReceived,
  notifyOfferAccepted,
  notifyOfferRejected,
} = require('../utils/notifications');

// Offers are only meaningful while a listing is live in the marketplace,
// so hiding a listing also stops new offers.
const { LISTING_STATUS } = require('../utils/listingStatus');
const OFFERABLE_LISTING_STATUS = LISTING_STATUS.APPROVED;

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (!decoded.userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const parsePositiveInt = (raw) => {
  const value = parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
};

// Every query is filtered by the caller's id as buyer or seller.
router.use(verifyToken);

// POST /api/offers/:listingId — create an offer, or update the buyer's pending one
router.post('/:listingId', async (req, res) => {
  const listingId = parsePositiveInt(req.params.listingId);
  if (!listingId) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const offeredPrice = Number(req.body?.offered_price);
  if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) {
    return res.status(400).json({ error: 'Offered price must be greater than 0' });
  }
  if (offeredPrice > 99999999.99) {
    return res.status(400).json({ error: 'Offered price is too large' });
  }

  try {
    const buyerId = req.user.userId;
    const listingResult = await pool.query(
      'SELECT id, user_id, status FROM listings WHERE id = $1',
      [listingId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingResult.rows[0];

    if (listing.user_id === buyerId) {
      return res.status(403).json({ error: 'You cannot make an offer on your own listing' });
    }

    if (listing.status !== OFFERABLE_LISTING_STATUS) {
      return res.status(409).json({ error: 'This listing is not accepting offers' });
    }

    // An accepted offer is a closed deal — a new one would be meaningless.
    const accepted = await pool.query(
      `SELECT id FROM offers
       WHERE listing_id = $1 AND buyer_id = $2 AND status = 'accepted'`,
      [listingId, buyerId]
    );
    if (accepted.rows.length > 0) {
      return res.status(409).json({ error: 'Your offer for this listing was already accepted' });
    }

    // The partial unique index on pending offers makes this the whole
    // "update instead of duplicate" rule, with no read-then-write race.
    const result = await pool.query(
      `INSERT INTO offers (listing_id, buyer_id, seller_id, offered_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (listing_id, buyer_id) WHERE status = 'pending'
       DO UPDATE SET offered_price = EXCLUDED.offered_price,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [listingId, buyerId, listing.user_id, offeredPrice]
    );

    const offer = result.rows[0];
    // Both timestamps default to the transaction time on insert.
    const wasUpdated = offer.created_at.getTime() !== offer.updated_at.getTime();

    await notifyOfferReceived(pool, {
      sellerId: listing.user_id,
      listingId,
      deviceName: await getListingDeviceName(pool, listingId),
      offeredPrice: offer.offered_price,
    });

    res.status(wasUpdated ? 200 : 201).json({ offer, updated: wasUpdated });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to submit offer' });
  }
});

// GET /api/offers/received — offers on the current user's listings
router.get('/received', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         o.*,
         b.name  AS brand_name,
         m.name  AS model_name,
         l.price AS listing_price,
         l.status AS listing_status,
         buyer.first_name AS buyer_first_name,
         buyer.last_name  AS buyer_last_name,
         (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) AS thumbnail_image
       FROM offers o
       JOIN listings l ON l.id = o.listing_id
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN users buyer ON buyer.id = o.buyer_id
       WHERE o.seller_id = $1
       ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC`,
      [req.user.userId]
    );

    res.json({ offers: result.rows });
  } catch (error) {
    console.error('Error fetching received offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// GET /api/offers/sent — offers the current user has made
router.get('/sent', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         o.*,
         b.name  AS brand_name,
         m.name  AS model_name,
         l.price AS listing_price,
         l.status AS listing_status,
         seller.first_name AS seller_first_name,
         seller.last_name  AS seller_last_name,
         -- The seller's number is only useful, and only shared, once the deal is on.
         CASE WHEN o.status = 'accepted' THEN seller.phone_number END AS seller_phone_number,
         (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) AS thumbnail_image
       FROM offers o
       JOIN listings l ON l.id = o.listing_id
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN users seller ON seller.id = o.seller_id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.userId]
    );

    res.json({ offers: result.rows });
  } catch (error) {
    console.error('Error fetching sent offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

/**
 * Accept and reject differ only in the resulting status and who gets told,
 * so both share this transition. Scoping the UPDATE by seller_id means a
 * buyer (or anyone else) simply cannot move an offer.
 */
const resolveOffer = async (req, res, { status, notify }) => {
  const offerId = parsePositiveInt(req.params.offerId);
  if (!offerId) {
    return res.status(400).json({ error: 'Invalid offer ID' });
  }

  try {
    const existing = await pool.query(
      `SELECT o.id, o.status, o.listing_id, o.buyer_id, o.offered_price, l.status AS listing_status
       FROM offers o
       JOIN listings l ON l.id = o.listing_id
       WHERE o.id = $1 AND o.seller_id = $2`,
      [offerId, req.user.userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    if (existing.rows[0].status !== 'pending') {
      return res.status(409).json({ error: `This offer is already ${existing.rows[0].status}` });
    }

    const updated = await pool.query(
      `UPDATE offers
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND seller_id = $3 AND status = 'pending'
       RETURNING *`,
      [status, offerId, req.user.userId]
    );

    if (updated.rows.length === 0) {
      return res.status(409).json({ error: 'This offer is no longer pending' });
    }

    const offer = updated.rows[0];

    await notify(pool, {
      buyerId: offer.buyer_id,
      listingId: offer.listing_id,
      deviceName: await getListingDeviceName(pool, offer.listing_id),
      offeredPrice: offer.offered_price,
    });

    res.json({ offer });
  } catch (error) {
    console.error(`Error setting offer to ${status}:`, error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
};

// PATCH /api/offers/:offerId/accept
router.patch('/:offerId/accept', (req, res) =>
  resolveOffer(req, res, { status: 'accepted', notify: notifyOfferAccepted })
);

// PATCH /api/offers/:offerId/reject
router.patch('/:offerId/reject', (req, res) =>
  resolveOffer(req, res, { status: 'rejected', notify: notifyOfferRejected })
);

module.exports = router;
