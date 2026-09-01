const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { LISTING_STATUS, LISTING_IS_TIP_SQL } = require('../utils/listingStatus');
const {
  LISTING_IDENTITY_JOINS,
  LISTING_BRAND_NAME_SQL,
  LISTING_MODEL_NAME_SQL,
} = require('../utils/listingCatalog');

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
    const [usersResult, adminsResult, listingStatusResult, revisionMetricsResult, bannersResult, recentResult] =
      await Promise.all([
        pool.query('SELECT COUNT(*)::int AS count FROM users'),
        pool.query('SELECT COUNT(*)::int AS count FROM admins'),
        pool.query(
          `SELECT status, COUNT(*)::int AS count
           FROM listings l
           WHERE ${LISTING_IS_TIP_SQL}
           GROUP BY status`
        ),
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE event_type = 'resubmitted')::int AS resubmissions_received,
             COUNT(*) FILTER (
               WHERE event_type = 'resubmitted'
                 AND occurred_at >= date_trunc('month', CURRENT_TIMESTAMP)
                 AND occurred_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
             )::int AS resubmissions_received_this_month,
             COUNT(*) FILTER (WHERE event_type = 'updated')::int AS updates_received,
             COUNT(*) FILTER (
               WHERE event_type = 'updated'
                 AND occurred_at >= date_trunc('month', CURRENT_TIMESTAMP)
                 AND occurred_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
             )::int AS updates_received_this_month
           FROM listing_moderation_events`
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
             ${LISTING_BRAND_NAME_SQL} AS brand_name,
             ${LISTING_MODEL_NAME_SQL} AS model_name,
             u.first_name AS seller_first_name,
             u.last_name AS seller_last_name,
             (SELECT image_url
              FROM listing_images
              WHERE listing_id = l.id
              ORDER BY display_order
              LIMIT 1) AS thumbnail_image
           FROM listings l
           ${LISTING_IDENTITY_JOINS}
           JOIN users u ON u.id = l.user_id
           WHERE ${LISTING_IS_TIP_SQL}
             AND l.status <> 'deleted'
           ORDER BY l.created_at DESC
           LIMIT 5`
        ),
      ]);

    const statusRows = listingStatusResult.rows;
    const approvedListings = countByStatus(statusRows, LISTING_STATUS.APPROVED);
    const revisionMetrics = revisionMetricsResult.rows[0];
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
        // Current re-review queues
        resubmittedListings: countByStatus(statusRows, LISTING_STATUS.RESUBMITTED),
        updatedListings: countByStatus(statusRows, LISTING_STATUS.UPDATED),
        // Durable month-end: revision rows created this month (survives later approve)
        resubmissionsReceivedThisMonth: revisionMetrics.resubmissions_received_this_month,
        resubmissionsReceived: revisionMetrics.resubmissions_received,
        updatesReceivedThisMonth: revisionMetrics.updates_received_this_month,
        updatesReceived: revisionMetrics.updates_received,
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
