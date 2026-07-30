const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { LISTING_STATUS } = require('../utils/listingStatus');

const router = express.Router();

const ACTIVE_BANNERS_WHERE = `
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
  AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
`;

function countByStatus(rows, status) {
  const match = rows.find((row) => row.status === status);
  return match ? Number(match.count) : 0;
}

/**
 * GET /api/admin/dashboard
 * Aggregated marketplace overview for Admin Web.
 * Protected by Admin Web JWT (verifyAdminAuth) — admins table only.
 */
router.get('/', verifyAdminAuth, async (req, res) => {
  let databaseStatus = 'online';

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    databaseStatus = 'offline';
    console.error('Dashboard DB health check failed:', error);
    return res.status(503).json({
      error: 'Database unavailable',
      stats: null,
      recentListings: [],
      systemHealth: {
        database: 'offline',
        api: 'online',
      },
    });
  }

  try {
    const [usersResult, adminsResult, listingStatusResult, bannersResult, recentResult] =
      await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM users'),
        pool.query('SELECT COUNT(*)::int AS count FROM admins'),
        pool.query(
          `SELECT status, COUNT(*)::int AS count
           FROM listings
           GROUP BY status`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM banners
           WHERE ${ACTIVE_BANNERS_WHERE}`
        ),
        pool.query(
          `SELECT
             l.id,
             l.price,
             l.status,
             l.created_at,
             b.name AS brand_name,
             m.name AS model_name,
             u.first_name AS seller_first_name,
             u.last_name AS seller_last_name,
             (SELECT image_url
              FROM listing_images
              WHERE listing_id = l.id
              ORDER BY display_order
              LIMIT 1) AS thumbnail_image
           FROM listings l
           JOIN models m ON m.id = l.model_id
           JOIN brands b ON b.id = m.brand_id
           JOIN users u ON u.id = l.user_id
           ORDER BY l.created_at DESC
           LIMIT 5`
        ),
      ]);

    const statusRows = listingStatusResult.rows;
    const approvedListings = countByStatus(statusRows, LISTING_STATUS.APPROVED);
    const baseUrl = resolveBaseUrl(req);

    const recentListings = recentResult.rows.map((row) => ({
      id: row.id,
      brand_name: row.brand_name,
      model_name: row.model_name,
      price: row.price,
      status: row.status,
      created_at: row.created_at,
      seller_name: `${row.seller_first_name || ''} ${row.seller_last_name || ''}`.trim() || '—',
      thumbnail_image: row.thumbnail_image
        ? row.thumbnail_image.startsWith('/')
          ? `${baseUrl}${row.thumbnail_image}`
          : row.thumbnail_image
        : null,
    }));

    res.json({
      stats: {
        totalUsers: usersResult.rows[0].count,
        totalAdmins: adminsResult.rows[0].count,
        activeListings: approvedListings,
        pendingListings: countByStatus(statusRows, LISTING_STATUS.PENDING),
        approvedListings,
        declinedListings: countByStatus(statusRows, LISTING_STATUS.DECLINED),
        soldListings: countByStatus(statusRows, LISTING_STATUS.SOLD),
        hiddenListings: countByStatus(statusRows, LISTING_STATUS.HIDDEN),
        activeBanners: bannersResult.rows[0].count,
      },
      recentListings,
      systemHealth: {
        database: databaseStatus,
        api: 'online',
      },
    });
  } catch (error) {
    console.error('Error building admin dashboard:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
