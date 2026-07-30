const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const ALLOWED_ACTION_TYPES = new Set(['none', 'url', 'screen', 'listing']);

const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userResult = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

function resolveBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

function absolutizeImageUrl(imageUrl, baseUrl) {
  if (!imageUrl) return imageUrl;
  if (imageUrl.startsWith('/')) return `${baseUrl}${imageUrl}`;
  return imageUrl;
}

function mapBannerRow(row, baseUrl) {
  return {
    ...row,
    image_url: absolutizeImageUrl(row.image_url, baseUrl),
  };
}

const ACTIVE_BANNERS_WHERE = `
  is_active = TRUE
  AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
  AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
`;

// GET /api/banners — public: active + in-schedule only
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id, title, image_url, action_type, action_value,
         display_order, starts_at, ends_at
       FROM banners
       WHERE ${ACTIVE_BANNERS_WHERE}
       ORDER BY display_order ASC, created_at DESC`
    );

    const baseUrl = resolveBaseUrl(req);
    res.json({
      banners: result.rows.map((row) => mapBannerRow(row, baseUrl)),
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// GET /api/banners/all — admin: full list for future Admin Panel
router.get('/all', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM banners
       ORDER BY display_order ASC, created_at DESC`
    );
    const baseUrl = resolveBaseUrl(req);
    res.json({
      banners: result.rows.map((row) => mapBannerRow(row, baseUrl)),
    });
  } catch (error) {
    console.error('Error fetching all banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// POST /api/banners — admin create (Admin Panel will use this later)
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      image_url,
      action_type = 'none',
      action_value = null,
      display_order = 0,
      is_active = true,
      starts_at = null,
      ends_at = null,
    } = req.body;

    if (!title || !image_url) {
      return res.status(400).json({ error: 'Title and image_url are required' });
    }

    if (!ALLOWED_ACTION_TYPES.has(action_type)) {
      return res.status(400).json({
        error: 'Invalid action_type. Allowed: none, url, screen, listing',
      });
    }

    if (action_type === 'none' && action_value) {
      // Normalize: no-action banners should not carry a destination
    }

    const result = await pool.query(
      `INSERT INTO banners (
         title, image_url, action_type, action_value,
         display_order, is_active, starts_at, ends_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        title,
        image_url,
        action_type,
        action_type === 'none' ? null : action_value,
        display_order || 0,
        is_active !== false,
        starts_at || null,
        ends_at || null,
      ]
    );

    const baseUrl = resolveBaseUrl(req);
    res.status(201).json({ banner: mapBannerRow(result.rows[0], baseUrl) });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

// PUT /api/banners/:id — admin update
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      image_url,
      action_type,
      action_value,
      display_order,
      is_active,
      starts_at,
      ends_at,
    } = req.body;

    if (action_type !== undefined && !ALLOWED_ACTION_TYPES.has(action_type)) {
      return res.status(400).json({
        error: 'Invalid action_type. Allowed: none, url, screen, listing',
      });
    }

    const existing = await pool.query('SELECT * FROM banners WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const current = existing.rows[0];
    const nextActionType = action_type !== undefined ? action_type : current.action_type;
    let nextActionValue =
      action_value !== undefined ? action_value : current.action_value;
    if (nextActionType === 'none') nextActionValue = null;

    const result = await pool.query(
      `UPDATE banners
       SET title = COALESCE($1, title),
           image_url = COALESCE($2, image_url),
           action_type = $3,
           action_value = $4,
           display_order = COALESCE($5, display_order),
           is_active = COALESCE($6, is_active),
           starts_at = CASE WHEN $7::boolean THEN $8 ELSE starts_at END,
           ends_at = CASE WHEN $9::boolean THEN $10 ELSE ends_at END
       WHERE id = $11
       RETURNING *`,
      [
        title ?? null,
        image_url ?? null,
        nextActionType,
        nextActionValue,
        display_order ?? null,
        is_active ?? null,
        Object.prototype.hasOwnProperty.call(req.body, 'starts_at'),
        starts_at ?? null,
        Object.prototype.hasOwnProperty.call(req.body, 'ends_at'),
        ends_at ?? null,
        id,
      ]
    );

    const baseUrl = resolveBaseUrl(req);
    res.json({ banner: mapBannerRow(result.rows[0], baseUrl) });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

// DELETE /api/banners/:id — admin delete
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM banners WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

module.exports = router;
