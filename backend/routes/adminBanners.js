const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../utils/adminAuth');
const {
  ALLOWED_ACTION_TYPES,
  mapBannerRow,
  deriveBannerStatus,
  isValidHttpUrl,
  parseOptionalTimestamp,
  assertValidDateRange,
  resolveBaseUrl,
} = require('../utils/bannerHelpers');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();

function withStatus(banner) {
  return {
    ...banner,
    status: deriveBannerStatus(banner),
    cta_link:
      banner.action_type === 'url'
        ? banner.action_value
        : banner.action_type && banner.action_type !== 'none'
          ? banner.action_value
          : null,
  };
}

function resolveActionFromBody(body, current = null) {
  const hasCtaLink = Object.prototype.hasOwnProperty.call(body, 'cta_link');
  const hasActionType = Object.prototype.hasOwnProperty.call(body, 'action_type');
  const hasActionValue = Object.prototype.hasOwnProperty.call(body, 'action_value');

  // Admin Web form prefers cta_link → url action.
  if (hasCtaLink) {
    const link = typeof body.cta_link === 'string' ? body.cta_link.trim() : '';
    if (link) {
      if (!isValidHttpUrl(link)) {
        const error = new Error('CTA link must be a valid http(s) URL');
        error.statusCode = 400;
        throw error;
      }
      return { action_type: 'url', action_value: link };
    }
    // Cleared link: preserve non-url mobile actions when editing
    if (current && current.action_type && current.action_type !== 'url') {
      return {
        action_type: current.action_type,
        action_value: current.action_value,
      };
    }
    return { action_type: 'none', action_value: null };
  }

  if (hasActionType || hasActionValue) {
    const actionType = hasActionType
      ? body.action_type
      : current?.action_type || 'none';
    if (!ALLOWED_ACTION_TYPES.has(actionType)) {
      const error = new Error('Invalid action_type. Allowed: none, url, screen, listing');
      error.statusCode = 400;
      throw error;
    }
    let actionValue = hasActionValue ? body.action_value : current?.action_value;
    if (actionType === 'none') actionValue = null;
    if (actionType === 'url' && actionValue && !isValidHttpUrl(String(actionValue))) {
      const error = new Error('CTA link must be a valid http(s) URL');
      error.statusCode = 400;
      throw error;
    }
    return { action_type: actionType, action_value: actionValue ?? null };
  }

  if (current) {
    return {
      action_type: current.action_type,
      action_value: current.action_value,
    };
  }

  return { action_type: 'none', action_value: null };
}

function statusFilterSql(status) {
  switch (status) {
    case 'active':
      return `(
        is_active = TRUE
        AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
        AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
      )`;
    case 'scheduled':
      return `(
        is_active = TRUE
        AND starts_at IS NOT NULL
        AND starts_at > CURRENT_TIMESTAMP
      )`;
    case 'expired':
      return `(
        is_active = TRUE
        AND ends_at IS NOT NULL
        AND ends_at <= CURRENT_TIMESTAMP
      )`;
    case 'disabled':
      return `is_active = FALSE`;
    default:
      return null;
  }
}

/**
 * GET /api/admin/banners
 * Optional: search, status (active|scheduled|expired|disabled)
 */
router.get('/', verifyAdminAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

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
        title ILIKE $${idx}
        OR COALESCE(subtitle, '') ILIKE $${idx}
        OR COALESCE(cta_text, '') ILIKE $${idx}
        OR COALESCE(action_value, '') ILIKE $${idx}
      )`);
    }

    if (status && status !== 'all') {
      const allowed = new Set(['active', 'scheduled', 'expired', 'disabled']);
      if (!allowed.has(status)) {
        return res.status(400).json({
          error: 'Invalid status filter. Allowed: active, scheduled, expired, disabled',
        });
      }
      const clause = statusFilterSql(status);
      if (clause) where.push(clause);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT *
       FROM banners
       ${whereSql}
       ORDER BY display_order ASC, created_at DESC`,
      params
    );

    const baseUrl = resolveBaseUrl(req);
    res.json({
      banners: result.rows.map((row) => withStatus(mapBannerRow(row, baseUrl))),
    });
  } catch (error) {
    console.error('Error fetching admin banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

/**
 * POST /api/admin/banners
 */
router.post('/', verifyAdminAuth, requirePermission(PERMISSIONS.BANNERS_WRITE), async (req, res) => {
  try {
    const {
      title,
      subtitle = null,
      image_url,
      cta_text = null,
      display_order = 0,
      is_active = true,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!image_url || !String(image_url).trim()) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const starts = parseOptionalTimestamp(req.body.starts_at, 'starts_at');
    const ends = parseOptionalTimestamp(req.body.ends_at, 'ends_at');
    assertValidDateRange(starts.value ?? null, ends.value ?? null);

    const action = resolveActionFromBody(req.body);

    const result = await pool.query(
      `INSERT INTO banners (
         title, subtitle, image_url, cta_text,
         action_type, action_value,
         display_order, is_active, starts_at, ends_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        String(title).trim(),
        subtitle ? String(subtitle).trim() : null,
        String(image_url).trim(),
        cta_text ? String(cta_text).trim() : null,
        action.action_type,
        action.action_value,
        display_order || 0,
        is_active !== false,
        starts.value ?? null,
        ends.value ?? null,
      ]
    );

    const baseUrl = resolveBaseUrl(req);
    const banner = withStatus(mapBannerRow(result.rows[0], baseUrl));
    await writeAuditLog({
      adminId: req.admin.id,
      action: 'banner.create',
      entityType: 'banner',
      entityId: banner.id,
      metadata: { title: banner.title, is_active: banner.is_active },
      req,
    });
    res.status(201).json({ banner });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating admin banner:', error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

/**
 * PUT /api/admin/banners/:id
 */
router.put('/:id', verifyAdminAuth, requirePermission(PERMISSIONS.BANNERS_WRITE), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM banners WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const current = existing.rows[0];
    const title =
      req.body.title !== undefined ? String(req.body.title || '').trim() : current.title;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const imageUrl =
      req.body.image_url !== undefined
        ? String(req.body.image_url || '').trim()
        : current.image_url;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const subtitle =
      req.body.subtitle !== undefined
        ? req.body.subtitle
          ? String(req.body.subtitle).trim()
          : null
        : current.subtitle;

    const ctaText =
      req.body.cta_text !== undefined
        ? req.body.cta_text
          ? String(req.body.cta_text).trim()
          : null
        : current.cta_text;

    const starts = Object.prototype.hasOwnProperty.call(req.body, 'starts_at')
      ? parseOptionalTimestamp(req.body.starts_at, 'starts_at')
      : { provided: false, value: current.starts_at };

    const ends = Object.prototype.hasOwnProperty.call(req.body, 'ends_at')
      ? parseOptionalTimestamp(req.body.ends_at, 'ends_at')
      : { provided: false, value: current.ends_at };

    const nextStarts = starts.provided ? starts.value : current.starts_at;
    const nextEnds = ends.provided ? ends.value : current.ends_at;
    assertValidDateRange(nextStarts, nextEnds);

    const action = resolveActionFromBody(req.body, current);

    const displayOrder =
      req.body.display_order !== undefined
        ? req.body.display_order
        : current.display_order;

    const isActive =
      req.body.is_active !== undefined ? req.body.is_active !== false : current.is_active;

    const result = await pool.query(
      `UPDATE banners
       SET title = $1,
           subtitle = $2,
           image_url = $3,
           cta_text = $4,
           action_type = $5,
           action_value = $6,
           display_order = $7,
           is_active = $8,
           starts_at = $9,
           ends_at = $10
       WHERE id = $11
       RETURNING *`,
      [
        title,
        subtitle,
        imageUrl,
        ctaText,
        action.action_type,
        action.action_value,
        displayOrder || 0,
        isActive,
        nextStarts,
        nextEnds,
        id,
      ]
    );

    const baseUrl = resolveBaseUrl(req);
    const banner = withStatus(mapBannerRow(result.rows[0], baseUrl));
    await writeAuditLog({
      adminId: req.admin.id,
      action: 'banner.update',
      entityType: 'banner',
      entityId: banner.id,
      metadata: { title: banner.title, is_active: banner.is_active },
      req,
    });
    res.json({ banner });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error updating admin banner:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

/**
 * DELETE /api/admin/banners/:id
 */
router.delete(
  '/:id',
  verifyAdminAuth,
  requirePermission(PERMISSIONS.BANNERS_WRITE),
  async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM banners WHERE id = $1 RETURNING id, title',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    await writeAuditLog({
      adminId: req.admin.id,
      action: 'banner.delete',
      entityType: 'banner',
      entityId: result.rows[0].id,
      metadata: { title: result.rows[0].title },
      req,
    });

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin banner:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

module.exports = router;
