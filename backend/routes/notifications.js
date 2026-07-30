const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

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

// Every query below filters on req.user.userId — a user can only ever see their own rows.
router.use(verifyToken);

// GET /api/notifications — newest first, paginated
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // One extra row tells the client whether another page exists.
    const result = await pool.query(
      `SELECT id, user_id, related_listing_id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit + 1, offset]
    );

    const hasMore = result.rows.length > limit;

    res.json({
      notifications: hasMore ? result.rows.slice(0, limit) : result.rows,
      limit,
      offset,
      has_more: hasMore,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.userId]
    );

    res.json({ unread: result.rows[0].unread });
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING id`,
      [req.user.userId]
    );

    res.json({ updated: result.rows.length, unread: 0 });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const notificationId = parseInt(req.params.id, 10);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ error: 'Invalid notification ID' });
  }

  try {
    // Scoping the UPDATE by user means someone else's id simply looks missing.
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, related_listing_id, type, title, message, is_read, created_at`,
      [notificationId, req.user.userId]
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

module.exports = router;
