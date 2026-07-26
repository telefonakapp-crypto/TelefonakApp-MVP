const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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

// Approve listing
router.post('/listings/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    // Update listing status
    const result = await pool.query(
      `UPDATE listings 
       SET status = 'approved', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = result.rows[0];

    // Get full listing details for notification
    const fullListing = await pool.query(
      `SELECT m.name as model_name, b.name as brand_name 
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       WHERE l.id = $1`,
      [id]
    );

    const listingDetails = fullListing.rows[0];

    // Create notification for user
    await pool.query(
      `INSERT INTO notifications (user_id, listing_id, type, title, message)
       VALUES ($1, $2, 'listing_approved', 'Listing Approved', 
       $3)`,
      [
        listing.user_id, 
        listing.id,
        `Your listing for ${listingDetails.brand_name} ${listingDetails.model_name} has been approved and is now live!`
      ]
    );

    res.json({ 
      message: 'Listing approved successfully',
      listing: listing 
    });
  } catch (error) {
    console.error('Error approving listing:', error);
    res.status(500).json({ error: 'Failed to approve listing' });
  }
});

// Decline listing
router.post('/listings/:id/decline', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Update listing status
    const result = await pool.query(
      `UPDATE listings 
       SET status = 'declined', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = result.rows[0];

    // Get full listing details for notification
    const fullListing = await pool.query(
      `SELECT m.name as model_name, b.name as brand_name 
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       WHERE l.id = $1`,
      [id]
    );

    const listingDetails = fullListing.rows[0];
    const reasonText = reason ? ` Reason: ${reason}` : '';

    // Create notification for user
    await pool.query(
      `INSERT INTO notifications (user_id, listing_id, type, title, message)
       VALUES ($1, $2, 'listing_declined', 'Listing Declined', 
       'Your listing for ${listingDetails.brand_name} ${listingDetails.model_name} has been declined.${reasonText}')`,
      [listing.user_id, listing.id]
    );

    res.json({ 
      message: 'Listing declined successfully',
      listing: listing 
    });
  } catch (error) {
    console.error('Error declining listing:', error);
    res.status(500).json({ error: 'Failed to decline listing' });
  }
});

// Get unread notification count
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Get notifications for current user
router.get('/notifications', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;

