const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');

const router = express.Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

router.use(verifyAdminAuth);

/**
 * GET /api/admin/notifications
 * Staff inbox for the current Admin Web admin (admins table recipient).
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const unreadOnly = String(req.query.unread_only || '') === 'true';

    const params = [req.adminId, limit + 1, offset];
    let where = 'admin_id = $1';
    if (unreadOnly) {
      where += ' AND is_read = FALSE';
    }

    const result = await pool.query(
      `SELECT
         id,
         admin_id,
         related_listing_id,
         type,
         title,
         message,
         is_read,
         created_at
       FROM notifications
       WHERE ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    const hasMore = result.rows.length > limit;

    res.json({
      items: hasMore ? result.rows.slice(0, limit) : result.rows,
      pagination: {
        limit,
        offset,
        has_more: hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/admin/notifications/unread-count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread
       FROM notifications
       WHERE admin_id = $1 AND is_read = FALSE`,
      [req.adminId]
    );

    res.json({ unread: result.rows[0].unread });
  } catch (error) {
    console.error('Error fetching admin unread notification count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * PATCH /api/admin/notifications/read-all
 */
router.patch('/read-all', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE admin_id = $1 AND is_read = FALSE
       RETURNING id`,
      [req.adminId]
    );

    res.json({ updated: result.rows.length, unread: 0 });
  } catch (error) {
    console.error('Error marking all admin notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

/**
 * PATCH /api/admin/notifications/:id/read
 */
router.patch('/:id(\\d+)/read', async (req, res) => {
  const notificationId = parseInt(req.params.id, 10);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ error: 'Invalid notification ID' });
  }

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND admin_id = $2
       RETURNING
         id,
         admin_id,
         related_listing_id,
         type,
         title,
         message,
         is_read,
         created_at`,
      [notificationId, req.adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Error marking admin notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;
