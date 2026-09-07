const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../utils/adminAuth');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { LISTING_STATUS, LISTING_IS_TIP_SQL } = require('../utils/listingStatus');
const {
  LISTING_IDENTITY_JOINS,
  LISTING_BRAND_NAME_SQL,
  LISTING_MODEL_NAME_SQL,
} = require('../utils/listingCatalog');
const { writeAuditLog } = require('../utils/auditLog');
const { ADMIN_DEACTIVATION_REASON } = require('../utils/deactivateUser');

const router = express.Router();

router.use(verifyAdminAuth);

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function fullName(row) {
  return `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—';
}

function absolutizeImageUrl(baseUrl, imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/')) return `${baseUrl}${imageUrl}`;
  return imageUrl;
}

function mapUserListItem(row) {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: fullName(row),
    phone_number: row.phone_number,
    email: row.email,
    is_active: row.is_active !== false,
    is_verified: row.is_verified,
    created_at: row.created_at,
    deactivated_at: row.deactivated_at || null,
    deactivation_reason: row.deactivation_reason || null,
    total_listings: Number(row.total_listings) || 0,
  };
}

/**
 * GET /api/admin/users
 */
router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'newest';

    const params = [];
    const where = [];

    const pushParam = (value) => {
      params.push(value);
      return params.length;
    };

    if (search) {
      const pattern = `%${search.replace(/[%_\\]/g, '')}%`;
      const idx = pushParam(pattern);
      where.push(`(
        u.first_name ILIKE $${idx}
        OR u.last_name ILIKE $${idx}
        OR (u.first_name || ' ' || u.last_name) ILIKE $${idx}
        OR u.phone_number ILIKE $${idx}
      )`);
    }

    if (status === 'active') {
      where.push('u.is_active = TRUE');
    } else if (status === 'disabled') {
      where.push('u.is_active = FALSE');
    } else if (status && status !== 'all') {
      return res.status(400).json({
        error: 'Invalid status filter. Allowed: active, disabled',
      });
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderByMap = {
      newest: 'u.created_at DESC',
      oldest: 'u.created_at ASC',
      most_listings: 'total_listings DESC, u.created_at DESC',
    };
    const orderBy = orderByMap[sort] || orderByMap.newest;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM users u
       ${whereSql}`,
      params
    );
    const totalItems = countResult.rows[0].total;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const deletedStatusIdx = pushParam(LISTING_STATUS.DELETED);

    const limitIdx = pushParam(limit);
    const offsetIdx = pushParam(offset);

    const listResult = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.phone_number,
         u.email,
         u.is_active,
         u.is_verified,
         u.created_at,
         u.deactivated_at,
         u.deactivation_reason,
         (
           SELECT COUNT(*)::int
           FROM listings l
           WHERE l.user_id = u.id
             AND l.status <> $${deletedStatusIdx}
             AND ${LISTING_IS_TIP_SQL}
         ) AS total_listings
       FROM users u
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    res.json({
      items: listResult.rows.map(mapUserListItem),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:id
 */
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const { id } = req.params;

    const userResult = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.phone_number,
         u.email,
         u.gender,
         u.city,
         u.is_active,
         u.is_verified,
         u.created_at,
         u.updated_at,
         u.deactivated_at,
         u.deactivation_reason,
         COALESCE(ls.total_listings, 0) AS total_listings,
         COALESCE(ls.active_listings, 0) AS active_listings,
         COALESCE(ls.sold_listings, 0) AS sold_listings,
         COALESCE(ls.pending_listings, 0) AS pending_listings,
         COALESCE(ls.declined_listings, 0) AS declined_listings,
         COALESCE(fc.favorites_count, 0) AS favorites_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (WHERE l.status <> $2)::int AS total_listings,
           COUNT(*) FILTER (WHERE l.status = $3)::int AS active_listings,
           COUNT(*) FILTER (WHERE l.status = $4)::int AS sold_listings,
           COUNT(*) FILTER (WHERE l.status = $5)::int AS pending_listings,
           COUNT(*) FILTER (WHERE l.status = $6)::int AS declined_listings
         FROM listings l
         WHERE l.user_id = u.id
           AND ${LISTING_IS_TIP_SQL}
       ) ls ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS favorites_count
         FROM favorites f
         WHERE f.user_id = u.id
       ) fc ON TRUE
       WHERE u.id = $1`,
      [
        id,
        LISTING_STATUS.DELETED,
        LISTING_STATUS.APPROVED,
        LISTING_STATUS.SOLD,
        LISTING_STATUS.PENDING,
        LISTING_STATUS.DECLINED,
      ]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = userResult.rows[0];
    const listingsResult = await pool.query(
      `SELECT
         l.id,
         l.price,
         l.status,
         l.created_at,
         ${LISTING_BRAND_NAME_SQL} AS brand_name,
         ${LISTING_MODEL_NAME_SQL} AS model_name,
         (SELECT image_url
          FROM listing_images
          WHERE listing_id = l.id
          ORDER BY display_order
          LIMIT 1) AS thumbnail_image
       FROM listings l
       ${LISTING_IDENTITY_JOINS}
       WHERE l.user_id = $1 AND l.status <> $2
         AND ${LISTING_IS_TIP_SQL}
       ORDER BY l.created_at DESC
       LIMIT 20`,
      [id, LISTING_STATUS.DELETED]
    );

    const baseUrl = resolveBaseUrl(req);

    res.json({
      user: {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: fullName(row),
        phone_number: row.phone_number,
        email: row.email,
        gender: row.gender,
        city: row.city,
        is_active: row.is_active !== false,
        is_verified: row.is_verified,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deactivated_at: row.deactivated_at || null,
        deactivation_reason: row.deactivation_reason || null,
        total_listings: Number(row.total_listings) || 0,
        active_listings: Number(row.active_listings) || 0,
        sold_listings: Number(row.sold_listings) || 0,
        pending_listings: Number(row.pending_listings) || 0,
        declined_listings: Number(row.declined_listings) || 0,
        favorites_count: Number(row.favorites_count) || 0,
      },
      listings: listingsResult.rows.map((listing) => ({
        id: listing.id,
        brand_name: listing.brand_name,
        model_name: listing.model_name,
        price: listing.price,
        status: listing.status,
        created_at: listing.created_at,
        thumbnail_image: absolutizeImageUrl(baseUrl, listing.thumbnail_image),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin user detail:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * PUT /api/admin/users/:id/status
 */
router.put(
  '/:id(\\d+)/status',
  requirePermission(PERMISSIONS.USERS_WRITE),
  async (req, res) => {
  try {
    const { id } = req.params;

    if (typeof req.body?.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active (boolean) is required' });
    }

    const { is_active } = req.body;

    const result = await pool.query(
      is_active
        ? `UPDATE users
           SET is_active = TRUE,
               deactivated_at = NULL,
               deactivation_reason = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id, first_name, last_name, phone_number, email, is_active,
                     is_verified, created_at, updated_at, deactivated_at, deactivation_reason`
        : `UPDATE users
           SET is_active = FALSE,
               deactivated_at = COALESCE(deactivated_at, CURRENT_TIMESTAMP),
               deactivation_reason = COALESCE(deactivation_reason, $2),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id, first_name, last_name, phone_number, email, is_active,
                     is_verified, created_at, updated_at, deactivated_at, deactivation_reason`,
      is_active ? [id] : [id, ADMIN_DEACTIVATION_REASON]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    await writeAuditLog({
      adminId: req.admin.id,
      action: is_active ? 'user.enable' : 'user.disable',
      entityType: 'user',
      entityId: row.id,
      metadata: {
        phone_number: row.phone_number,
        full_name: fullName(row),
        is_active: row.is_active,
        deactivation_reason: row.deactivation_reason,
        deactivated_at: row.deactivated_at,
      },
      req,
    });

    res.json({
      message: is_active ? 'User enabled successfully' : 'User disabled successfully',
      user: {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: fullName(row),
        phone_number: row.phone_number,
        email: row.email,
        is_active: row.is_active,
        is_verified: row.is_verified,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deactivated_at: row.deactivated_at || null,
        deactivation_reason: row.deactivation_reason || null,
      },
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;
