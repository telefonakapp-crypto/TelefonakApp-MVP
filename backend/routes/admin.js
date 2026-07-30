const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  getListingDeviceName,
  notifyListingApproved,
  notifyListingRejected,
} = require('../utils/notifications');
const { TERMINAL_LISTING_STATUSES } = require('../utils/listingStatus');

// Middleware to verify JWT token and check admin role
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;

    // Check if user is admin
    const userResult = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all pending listings
router.get('/listings/pending', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        l.*,
        m.name as model_name,
        b.name as brand_name,
        s.capacity_gb,
        c.name as color_name,
        cond.name as condition_name,
        u.first_name,
        u.last_name,
        u.phone_number,
        (SELECT COUNT(*) FROM listing_images WHERE listing_id = l.id) as image_count,
        (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) as thumbnail_image
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       JOIN users u ON l.user_id = u.id
       WHERE l.status = 'pending'
       ORDER BY l.created_at DESC`
    );

    res.json({ listings: result.rows });
  } catch (error) {
    console.error('Error fetching pending listings:', error);
    res.status(500).json({ error: 'Failed to fetch pending listings' });
  }
});

// Get all listings (for admin dashboard)
router.get('/listings/all', verifyAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      whereClause += ` AND l.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        m.name as model_name,
        b.name as brand_name,
        s.capacity_gb,
        c.name as color_name,
        cond.name as condition_name,
        u.first_name,
        u.last_name,
        u.phone_number,
        (SELECT COUNT(*) FROM listing_images WHERE listing_id = l.id) as image_count,
        (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) as thumbnail_image
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       JOIN users u ON l.user_id = u.id
       WHERE ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({ listings: result.rows });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

/**
 * Approve and decline are the same moderation write with a different target
 * status and notification. Terminal statuses are excluded so moderation can
 * never reopen a completed sale or restore a deleted listing.
 */
const moderateListing = async (req, res, { status, notify, message }) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT status FROM listings WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (TERMINAL_LISTING_STATUSES.includes(existing.rows[0].status)) {
      return res.status(409).json({
        error: `A ${existing.rows[0].status} listing can no longer be moderated`,
      });
    }

    const result = await pool.query(
      `UPDATE listings
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status <> ALL($3::text[])
       RETURNING *`,
      [status, id, TERMINAL_LISTING_STATUSES]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Listing status changed, please try again' });
    }

    const listing = result.rows[0];

    await notify(pool, {
      userId: listing.user_id,
      listingId: listing.id,
      deviceName: await getListingDeviceName(pool, listing.id),
      reason: req.body?.reason,
    });

    res.json({ message, listing });
  } catch (error) {
    console.error(`Error setting listing status to ${status}:`, error);
    res.status(500).json({ error: `Failed to ${status === 'approved' ? 'approve' : 'decline'} listing` });
  }
};

// Approve listing
router.post('/listings/:id/approve', verifyAdmin, (req, res) =>
  moderateListing(req, res, {
    status: 'approved',
    notify: notifyListingApproved,
    message: 'Listing approved successfully',
  })
);

// Decline listing
router.post('/listings/:id/decline', verifyAdmin, (req, res) =>
  moderateListing(req, res, {
    status: 'declined',
    notify: notifyListingRejected,
    message: 'Listing declined successfully',
  })
);

// Notification reading and mark-as-read now live in routes/notifications.js (/api/notifications),
// since they are per-user endpoints rather than admin operations.

module.exports = router;

