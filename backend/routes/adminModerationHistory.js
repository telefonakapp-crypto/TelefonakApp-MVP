const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { EVENT_TYPE, parseMonthRange } = require('../utils/listingModerationEvents');
const {
  LISTING_BRAND_NAME_SQL,
  LISTING_MODEL_NAME_SQL,
} = require('../utils/listingCatalog');

const router = express.Router();

const HISTORY_TYPES = [EVENT_TYPE.RESUBMITTED, EVENT_TYPE.UPDATED];

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function absolutizeImageUrl(baseUrl, imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  if (imageUrl.startsWith('/')) return `${baseUrl}${imageUrl}`;
  return imageUrl;
}

/**
 * GET /api/admin/moderation-history
 * Paginated historical resubmission / update events (not current status).
 */
router.get('/', verifyAdminAuth, async (req, res) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : EVENT_TYPE.RESUBMITTED;
    if (!HISTORY_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${HISTORY_TYPES.join(', ')}`,
      });
    }

    const { startDate, month } = parseMonthRange(req.query.month);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;

    const params = [type, startDate];
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM listing_moderation_events e
       WHERE e.event_type = $1
         AND e.occurred_at >= $2::date
         AND e.occurred_at < ($2::date + INTERVAL '1 month')`,
      params
    );

    const totalItems = countResult.rows[0].total;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const listResult = await pool.query(
      `SELECT
         e.id,
         e.event_type,
         e.occurred_at,
         e.previous_status,
         e.new_status,
         e.price AS event_price,
         e.listing_id,
         e.previous_listing_id,
         e.root_listing_id,
         e.user_id,
         e.decline_reason,
         e.moderated_by_admin_id,
         live.status AS current_status,
         live.price AS current_price,
         live.revision_number,
         COALESCE(b.name, live.custom_brand_name) AS brand_name,
         COALESCE(m.name, live.custom_model_name) AS model_name,
         COALESCE(cat.slug, live_cat.slug) AS category_slug,
         u.first_name AS seller_first_name,
         u.last_name AS seller_last_name,
         prev.price AS previous_price,
         prev.status AS previous_revision_status,
         prev.revision_number AS previous_revision_number,
         (SELECT image_url FROM listing_images WHERE listing_id = e.listing_id ORDER BY display_order LIMIT 1) AS thumbnail_image
       FROM listing_moderation_events e
       JOIN listings live ON live.id = e.listing_id
       LEFT JOIN models m ON live.model_id = m.id
       LEFT JOIN brands b ON m.brand_id = b.id
       LEFT JOIN categories cat ON cat.id = m.category_id
       LEFT JOIN categories live_cat ON live_cat.id = live.category_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN listings prev ON prev.id = e.previous_listing_id
       WHERE e.event_type = $1
         AND e.occurred_at >= $2::date
         AND e.occurred_at < ($2::date + INTERVAL '1 month')
       ORDER BY e.occurred_at DESC, e.id DESC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset]
    );

    const baseUrl = resolveBaseUrl(req);
    const items = listResult.rows.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      occurred_at: row.occurred_at,
      previous_status: row.previous_status,
      new_status: row.new_status,
      event_price: row.event_price,
      current_status: row.current_status,
      current_price: row.current_price,
      previous_price: row.previous_price,
      previous_revision_status: row.previous_revision_status,
      listing_id: row.listing_id,
      previous_listing_id: row.previous_listing_id,
      root_listing_id: row.root_listing_id,
      revision_number: row.revision_number,
      previous_revision_number: row.previous_revision_number,
      brand_name: row.brand_name,
      model_name: row.model_name,
      category_slug: row.category_slug,
      seller_name: `${row.seller_first_name || ''} ${row.seller_last_name || ''}`.trim() || '—',
      seller_id: row.user_id,
      thumbnail_image: absolutizeImageUrl(baseUrl, row.thumbnail_image),
    }));

    res.json({
      month,
      type,
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching moderation history:', error);
    res.status(500).json({ error: 'Failed to fetch moderation history' });
  }
});

module.exports = router;
