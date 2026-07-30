const express = require('express');
const router = express.Router();
const pool = require('../config/database');
// Sold and hidden listings drop out of favorites through this list, while the
// favorite rows themselves are kept.
const { PUBLIC_LISTING_STATUSES: VISIBLE_LISTING_STATUSES } = require('../utils/listingStatus');

// Saved listings belong to other sellers, so their view counter stays hidden.
const withoutViewCount = ({ views, ...listing }) => listing;

const verifyToken = require('../middleware/verifyToken').requireUserId;

const parseListingId = (raw) => {
  const listingId = parseInt(raw, 10);
  return Number.isInteger(listingId) && listingId > 0 ? listingId : null;
};

// Every favorites route is scoped to the authenticated user.
router.use(verifyToken);

// GET /api/favorites — the current user's saved listings
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const result = await pool.query(
      `SELECT
         l.*,
         f.created_at AS favorited_at,
         m.name  AS model_name,
         m.category_id,
         b.name  AS brand_name,
         s.capacity_gb,
         c.name  AS color_name,
         c.hex_code AS color_hex,
         cond.name AS condition_name,
         u.first_name,
         u.last_name,
         city.name_en AS city_name,
         area.name_en AS area_name,
         (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) AS thumbnail_image
       FROM favorites f
       JOIN listings l ON l.id = f.listing_id
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       JOIN users u ON l.user_id = u.id
       LEFT JOIN cities city ON l.city_id = city.id
       LEFT JOIN areas area ON l.area_id = area.id
       WHERE f.user_id = $1
         AND l.status = ANY($2::text[])
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.userId, VISIBLE_LISTING_STATUSES, limit, offset]
    );

    res.json({ listings: result.rows.map(withoutViewCount) });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// GET /api/favorites/ids — lightweight id list so cards can render state without per-card requests
router.get('/ids', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.listing_id
       FROM favorites f
       JOIN listings l ON l.id = f.listing_id
       WHERE f.user_id = $1
         AND l.status = ANY($2::text[])`,
      [req.user.userId, VISIBLE_LISTING_STATUSES]
    );

    res.json({ listing_ids: result.rows.map((row) => row.listing_id) });
  } catch (error) {
    console.error('Error fetching favorite ids:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// GET /api/favorites/:listingId — is this listing favorited by the current user
router.get('/:listingId', async (req, res) => {
  const listingId = parseListingId(req.params.listingId);
  if (!listingId) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const result = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND listing_id = $2',
      [req.user.userId, listingId]
    );

    res.json({ listing_id: listingId, is_favorite: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking favorite:', error);
    res.status(500).json({ error: 'Failed to check favorite' });
  }
});

// POST /api/favorites/:listingId — save a listing (idempotent)
router.post('/:listingId', async (req, res) => {
  const listingId = parseListingId(req.params.listingId);
  if (!listingId) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const listingResult = await pool.query(
      'SELECT id, status FROM listings WHERE id = $1',
      [listingId]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (!VISIBLE_LISTING_STATUSES.includes(listingResult.rows[0].status)) {
      return res.status(400).json({ error: 'Listing is not available' });
    }

    // The UNIQUE (user_id, listing_id) constraint prevents duplicates;
    // an existing row simply yields no insert.
    const inserted = await pool.query(
      `INSERT INTO favorites (user_id, listing_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING
       RETURNING id, user_id, listing_id, created_at`,
      [req.user.userId, listingId]
    );

    if (inserted.rows.length === 0) {
      return res.status(200).json({
        listing_id: listingId,
        is_favorite: true,
        already_favorited: true,
      });
    }

    res.status(201).json({
      listing_id: listingId,
      is_favorite: true,
      favorite: inserted.rows[0],
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// DELETE /api/favorites/:listingId — remove a saved listing
router.delete('/:listingId', async (req, res) => {
  const listingId = parseListingId(req.params.listingId);
  if (!listingId) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2 RETURNING id',
      [req.user.userId, listingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ listing_id: listingId, is_favorite: false });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

module.exports = router;
