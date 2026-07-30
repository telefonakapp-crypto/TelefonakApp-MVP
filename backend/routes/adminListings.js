const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { resolveBaseUrl } = require('../utils/baseUrl');
const {
  normalizeMarketplaceSearch,
  buildMarketplaceSearchClause,
} = require('../utils/marketplaceSearch');
const { LISTING_STATUS } = require('../utils/listingStatus');
const { moderateListing } = require('../utils/moderateListing');

const router = express.Router();

const LIST_SELECT = `
  l.id,
  l.price,
  l.status,
  l.created_at,
  l.updated_at,
  l.battery_percentage,
  l.location,
  l.decline_reason,
  m.name AS model_name,
  b.id AS brand_id,
  b.name AS brand_name,
  s.capacity_gb,
  c.name AS color_name,
  cond.name AS condition_name,
  u.id AS seller_id,
  u.first_name AS seller_first_name,
  u.last_name AS seller_last_name,
  u.phone_number AS seller_phone,
  city.name_en AS city_name,
  area.name_en AS area_name,
  (SELECT image_url
   FROM listing_images
   WHERE listing_id = l.id
   ORDER BY display_order
   LIMIT 1) AS thumbnail_image
`;

const LIST_FROM = `
  FROM listings l
  JOIN models m ON l.model_id = m.id
  JOIN brands b ON m.brand_id = b.id
  JOIN storage_options s ON l.storage_id = s.id
  JOIN colors c ON l.color_id = c.id
  JOIN conditions cond ON l.condition_id = cond.id
  JOIN users u ON l.user_id = u.id
  LEFT JOIN cities city ON l.city_id = city.id
  LEFT JOIN areas area ON l.area_id = area.id
`;

function absolutizeImageUrl(baseUrl, imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/')) return `${baseUrl}${imageUrl}`;
  return imageUrl;
}

function sellerDisplayName(row) {
  return `${row.seller_first_name || ''} ${row.seller_last_name || ''}`.trim() || '—';
}

function resolveLocation(row) {
  if (row.area_name && row.city_name) return `${row.area_name}, ${row.city_name}`;
  if (row.city_name) return row.city_name;
  if (row.location) return row.location;
  return null;
}

function mapListItem(row, baseUrl) {
  return {
    id: row.id,
    brand_id: row.brand_id,
    brand_name: row.brand_name,
    model_name: row.model_name,
    price: row.price,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    capacity_gb: row.capacity_gb,
    color_name: row.color_name,
    condition_name: row.condition_name,
    battery_percentage: row.battery_percentage,
    location: resolveLocation(row),
    decline_reason: row.decline_reason,
    seller_id: row.seller_id,
    seller_name: sellerDisplayName(row),
    seller_phone: row.seller_phone,
    thumbnail_image: absolutizeImageUrl(baseUrl, row.thumbnail_image),
  };
}

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * GET /api/admin/listings
 * Paginated moderation queue with search + filters.
 */
router.get('/', verifyAdminAuth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const seller = typeof req.query.seller === 'string' ? req.query.seller.trim() : '';
    const search = normalizeMarketplaceSearch(req.query.search);

    const params = [];
    const where = ["l.status <> 'deleted'"];

    const pushParam = (value) => {
      params.push(value);
      return params.length;
    };

    if (status && status !== 'all') {
      const allowed = Object.values(LISTING_STATUS).filter((s) => s !== LISTING_STATUS.DELETED);
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      where.push(`l.status = $${pushParam(status)}`);
    }

    if (brand) {
      if (/^\d+$/.test(brand)) {
        where.push(`b.id = $${pushParam(parseInt(brand, 10))}`);
      } else {
        where.push(`b.name ILIKE $${pushParam(`%${brand.replace(/[%_\\]/g, '')}%`)}`);
      }
    }

    if (seller) {
      const sellerPattern = `%${seller.replace(/[%_\\]/g, '')}%`;
      const idx = pushParam(sellerPattern);
      where.push(`(
        u.first_name ILIKE $${idx}
        OR u.last_name ILIKE $${idx}
        OR (u.first_name || ' ' || u.last_name) ILIKE $${idx}
        OR u.phone_number ILIKE $${idx}
      )`);
    }

    const searchClause = buildMarketplaceSearchClause(search, pushParam);
    if (searchClause) {
      where.push(searchClause);
    }

    const whereSql = where.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       ${LIST_FROM}
       WHERE ${whereSql}`,
      params
    );

    const totalItems = countResult.rows[0].total;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const limitIdx = pushParam(limit);
    const offsetIdx = pushParam(offset);

    const listResult = await pool.query(
      `SELECT ${LIST_SELECT}
       ${LIST_FROM}
       WHERE ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const baseUrl = resolveBaseUrl(req);

    res.json({
      items: listResult.rows.map((row) => mapListItem(row, baseUrl)),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching admin listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

/**
 * GET /api/admin/listings/brands
 * Brand options for the filter bar.
 */
router.get('/brands', verifyAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM brands ORDER BY name ASC`);
    res.json({ brands: result.rows });
  } catch (error) {
    console.error('Error fetching brands for admin listings:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

/**
 * GET /api/admin/listings/:id
 * Full listing detail for moderation drawer.
 */
router.get('/:id(\\d+)', verifyAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const listingResult = await pool.query(
      `SELECT
         l.*,
         m.name AS model_name,
         m.brand_id AS brand_id,
         m.release_year,
         m.chipset,
         m.screen_size,
         b.name AS brand_name,
         s.capacity_gb,
         c.name AS color_name,
         c.hex_code AS color_hex,
         cond.name AS condition_name,
         sim.name AS sim_configuration_name,
         u.id AS seller_id,
         u.first_name AS seller_first_name,
         u.last_name AS seller_last_name,
         u.phone_number AS seller_phone,
         city.name_en AS city_name,
         area.name_en AS area_name
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
       JOIN users u ON l.user_id = u.id
       LEFT JOIN cities city ON l.city_id = city.id
       LEFT JOIN areas area ON l.area_id = area.id
       WHERE l.id = $1`,
      [id]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const imagesResult = await pool.query(
      `SELECT id, listing_id, image_url, display_order, created_at
       FROM listing_images
       WHERE listing_id = $1
       ORDER BY display_order ASC`,
      [id]
    );

    const row = listingResult.rows[0];
    const baseUrl = resolveBaseUrl(req);
    const description =
      row.description_en || row.description_ar || row.description || null;

    res.json({
      listing: {
        id: row.id,
        brand_id: row.brand_id,
        brand_name: row.brand_name,
        model_name: row.model_name,
        capacity_gb: row.capacity_gb,
        color_name: row.color_name,
        color_hex: row.color_hex,
        condition_name: row.condition_name,
        battery_percentage: row.battery_percentage,
        price: row.price,
        description,
        description_en: row.description_en,
        description_ar: row.description_ar,
        location: resolveLocation(row),
        status: row.status,
        decline_reason: row.decline_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
        sim_configuration_name: row.sim_configuration_name,
        release_year: row.release_year,
        chipset: row.chipset,
        screen_size: row.screen_size,
        seller: {
          id: row.seller_id,
          first_name: row.seller_first_name,
          last_name: row.seller_last_name,
          full_name: sellerDisplayName(row),
          phone_number: row.seller_phone,
        },
      },
      images: imagesResult.rows.map((img) => ({
        ...img,
        image_url: absolutizeImageUrl(baseUrl, img.image_url),
      })),
    });
  } catch (error) {
    console.error('Error fetching admin listing detail:', error);
    res.status(500).json({ error: 'Failed to fetch listing details' });
  }
});

/**
 * POST /api/admin/listings/:id/approve
 * Admin Web approve (JWT from admins table).
 */
router.post('/:id(\\d+)/approve', verifyAdminAuth, (req, res) =>
  moderateListing(req, res, {
    status: LISTING_STATUS.APPROVED,
    message: 'Listing approved successfully',
  })
);

/**
 * POST /api/admin/listings/:id/decline
 * Admin Web decline — reason required and stored on the listing.
 */
router.post('/:id(\\d+)/decline', verifyAdminAuth, (req, res) =>
  moderateListing(req, res, {
    status: LISTING_STATUS.DECLINED,
    message: 'Listing declined successfully',
    requireReason: true,
  })
);

module.exports = router;
