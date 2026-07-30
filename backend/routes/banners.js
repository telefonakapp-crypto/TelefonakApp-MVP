const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { resolveBaseUrl } = require('../utils/baseUrl');

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

// GET /api/banners — public: active + in-schedule only (mobile marketplace)
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

module.exports = router;
