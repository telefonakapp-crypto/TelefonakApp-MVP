const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const {
  normalizeMarketplaceSearch,
  buildMarketplaceSearchClause,
} = require('../utils/marketplaceSearch');
const { recordListingView, resolveClientIp } = require('../utils/listingViews');
const {
  getListingDeviceName,
  notifyListingSold,
  notifyListingHidden,
  notifyListingActive,
  notifyAdminsOfNewListing,
} = require('../utils/notifications');
const {
  LISTING_STATUS,
  PUBLIC_LISTING_STATUSES,
  TERMINAL_LISTING_STATUSES,
  isPublicListingStatus,
  isTerminalListingStatus,
} = require('../utils/listingStatus');

const MAX_LISTING_IMAGES = 10;

/**
 * Resolve a catalog model_storage_id to the legacy listings.storage_id FK.
 * Catalog capacities (e.g. 16 / 32 GB) may not yet exist in storage_options;
 * create the missing row so create/edit do not reject valid catalog choices.
 */
async function resolveLegacyStorageId(modelStorageId) {
  const msResult = await pool.query(
    `SELECT ms.id, ms.model_id, sc.capacity_gb, so.id AS storage_id
     FROM   model_storages ms
     JOIN   storage_capacities sc ON sc.id = ms.storage_capacity_id
     LEFT JOIN storage_options so ON so.capacity_gb = sc.capacity_gb
     WHERE  ms.id = $1`,
    [modelStorageId]
  );

  if (msResult.rows.length === 0) {
    return { error: 'Invalid storage option' };
  }

  const row = msResult.rows[0];
  if (row.storage_id) {
    return { model_id: row.model_id, storage_id: row.storage_id };
  }

  const inserted = await pool.query(
    `INSERT INTO storage_options (capacity_gb)
     VALUES ($1)
     ON CONFLICT (capacity_gb) DO UPDATE SET capacity_gb = EXCLUDED.capacity_gb
     RETURNING id`,
    [row.capacity_gb]
  );

  return { model_id: row.model_id, storage_id: inserted.rows[0].id };
}

// The view counter is seller-only data, so it is stripped from any payload
// that can reach someone other than the listing owner.
const withoutViewCount = ({ views, ...listing }) => listing;

// Best-effort deletion of a locally stored listing image file
const deleteLocalListingImageFile = (imageUrl) => {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    let pathname = imageUrl;
    try {
      pathname = new URL(imageUrl).pathname;
    } catch {
      // Relative paths like /uploads/... are fine as-is
    }
    const filename = path.basename(pathname);
    // Only delete files we created for listings (never touch ad images or arbitrary paths)
    if (!filename.startsWith('listing-')) return;
    const filePath = path.join(__dirname, '../uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Could not delete listing image file:', err.message);
  }
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Attaches req.user when a valid token is present, otherwise continues as a guest
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      // An unusable token simply means "treat this request as a guest"
    }
  }

  next();
};

/**
 * The token carries no role, so moderation access needs a lookup. It only runs
 * on the rare path where a signed-in non-owner asks for a non-public listing.
 */
const isAdminUser = async (userId) => {
  const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.is_admin === true;
};

// Get all brands (optional ?category_id — only brands with models in that category)
router.get('/brands', async (req, res) => {
  try {
    const { category_id } = req.query;
    let result;

    if (category_id && String(category_id).trim()) {
      const categoryId = parseInt(category_id, 10);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: 'Invalid category ID' });
      }
      result = await pool.query(
        `SELECT DISTINCT b.*
         FROM brands b
         JOIN models m ON m.brand_id = b.id
         WHERE m.category_id = $1
         ORDER BY b.name`,
        [categoryId]
      );
    } else {
      result = await pool.query('SELECT * FROM brands ORDER BY name');
    }

    res.json({ brands: result.rows });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Get models by brand (optional ?category_id filter)
router.get('/brands/:brandId/models', async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }
    const { category_id } = req.query;

    let query  = 'SELECT * FROM models WHERE brand_id = $1';
    const params = [brandId];

    // Filter by category when provided, but still return models that have no
    // category yet so existing brands remain selectable during the transition.
    if (category_id && category_id.trim()) {
      query += ' AND (category_id = $2 OR category_id IS NULL)';
      params.push(parseInt(category_id));
    }

    query += ' ORDER BY release_year DESC, name';

    const result = await pool.query(query, params);
    res.json({ models: result.rows });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Get storage options
router.get('/storage', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM storage_options ORDER BY capacity_gb');
    res.json({ storage: result.rows });
  } catch (error) {
    console.error('Error fetching storage:', error);
    res.status(500).json({ error: 'Failed to fetch storage options' });
  }
});

// Get conditions
router.get('/conditions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM conditions ORDER BY id');
    res.json({ conditions: result.rows });
  } catch (error) {
    console.error('Error fetching conditions:', error);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

// Get cities
router.get('/cities', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, slug, name_en, name_ar, sort_order
       FROM cities
       WHERE is_active = TRUE
       ORDER BY sort_order, name_en`
    );
    res.json({ cities: result.rows });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Get areas for a city
router.get('/cities/:cityId/areas', async (req, res) => {
  try {
    const cityId = parseInt(req.params.cityId, 10);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return res.status(400).json({ error: 'Invalid city ID' });
    }
    const result = await pool.query(
      `SELECT id, city_id, slug, name_en, name_ar, sort_order
       FROM areas
       WHERE city_id = $1 AND is_active = TRUE
       ORDER BY sort_order, name_en`,
      [cityId]
    );
    res.json({ areas: result.rows });
  } catch (error) {
    console.error('Error fetching areas:', error);
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

// Create listing (status defaults to 'pending' for admin approval)
router.post('/listings', verifyToken,
  [
    body('model_id').isInt().withMessage('Model ID is required'),
    body('model_storage_id').isInt().withMessage('Storage is required'),
    body('model_color_id').isInt().withMessage('Color is required'),
    body('sim_configuration_id').isInt().withMessage('SIM configuration is required'),
    body('condition_id').isInt().withMessage('Condition ID is required'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('battery_percentage').optional().isInt({ min: 70, max: 100 }).withMessage('Battery percentage must be between 70 and 100'),
    body('description').optional().isString(),
    body('location').optional().isString(),
    body('city_id').optional({ nullable: true }).isInt().withMessage('Invalid city'),
    body('area_id').optional({ nullable: true }).isInt().withMessage('Invalid area'),
    body('images')
      .isArray({ min: 1 })
      .withMessage('At least one image is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { model_id, model_storage_id, model_color_id, sim_configuration_id, condition_id, battery_percentage, price, description, location, city_id, area_id, images } = req.body;
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      const imageUrls = Array.isArray(images)
        ? images.filter((url) => typeof url === 'string' && url.trim())
        : [];

      if (imageUrls.length === 0) {
        return res.status(400).json({ error: 'At least one image is required' });
      }

      if (imageUrls.length > MAX_LISTING_IMAGES) {
        return res.status(400).json({ error: `You can have up to ${MAX_LISTING_IMAGES} images per listing` });
      }

      // Validate model_storage_id belongs to model_id and fetch derived storage_id
      const storageResolved = await resolveLegacyStorageId(model_storage_id);
      if (storageResolved.error) {
        return res.status(400).json({ error: storageResolved.error });
      }
      if (storageResolved.model_id !== parseInt(model_id, 10)) {
        return res.status(400).json({ error: 'Storage option does not belong to this model' });
      }
      const storage_id = storageResolved.storage_id;

      // Validate model_color_id belongs to model_id and fetch derived color_id
      const mcResult = await pool.query(
        `SELECT mc.id, mc.model_id, mc.color_id
         FROM   model_colors mc
         WHERE  mc.id = $1`,
        [model_color_id]
      );
      if (mcResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid color option' });
      }
      if (mcResult.rows[0].model_id !== parseInt(model_id)) {
        return res.status(400).json({ error: 'Color option does not belong to this model' });
      }
      const color_id = mcResult.rows[0].color_id;

      // Validate SIM configuration exists and is active
      const simResult = await pool.query(
        'SELECT id FROM sim_configurations WHERE id = $1 AND is_active = TRUE',
        [sim_configuration_id]
      );
      if (simResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid SIM configuration' });
      }

      let resolvedCityId = city_id ? parseInt(city_id, 10) : null;
      let resolvedAreaId = area_id ? parseInt(area_id, 10) : null;
      let resolvedLocation = location || null;

      if (resolvedAreaId) {
        const areaRes = await pool.query(
          `SELECT a.id, a.city_id, a.name_en, c.name_en AS city_name
           FROM areas a JOIN cities c ON c.id = a.city_id
           WHERE a.id = $1 AND a.is_active = TRUE`,
          [resolvedAreaId]
        );
        if (areaRes.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid area' });
        }
        resolvedCityId = areaRes.rows[0].city_id;
        if (!resolvedLocation) {
          resolvedLocation = `${areaRes.rows[0].name_en}, ${areaRes.rows[0].city_name}`;
        }
      } else if (resolvedCityId) {
        const cityRes = await pool.query(
          'SELECT id, name_en FROM cities WHERE id = $1 AND is_active = TRUE',
          [resolvedCityId]
        );
        if (cityRes.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid city' });
        }
        if (!resolvedLocation) {
          resolvedLocation = cityRes.rows[0].name_en;
        }
      }

      // Create listing (status defaults to 'pending' for admin approval)
      const listingResult = await pool.query(
        `INSERT INTO listings
           (user_id, model_id, storage_id, color_id, model_storage_id, model_color_id,
            sim_configuration_id, condition_id, battery_percentage, price, description, location,
            city_id, area_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
         RETURNING *`,
        [userId, model_id, storage_id, color_id, model_storage_id, model_color_id,
         sim_configuration_id, condition_id, battery_percentage || null, price, description || null,
         resolvedLocation, resolvedCityId, resolvedAreaId]
      );

      const listing = listingResult.rows[0];

      // Insert required listing images (public URLs from the upload endpoint)
      for (let i = 0; i < imageUrls.length; i++) {
        await pool.query(
          'INSERT INTO listing_images (listing_id, image_url, display_order) VALUES ($1, $2, $3)',
          [listing.id, imageUrls[i], i]
        );
      }

      // Fetch full listing with relations
      const fullListing = await pool.query(
        `SELECT 
          l.*,
          m.name as model_name,
          b.name as brand_name,
          s.capacity_gb,
          c.name as color_name,
          c.hex_code as color_hex,
          cond.name as condition_name,
          sim.name as sim_configuration_name
         FROM listings l
         JOIN models m ON l.model_id = m.id
         JOIN brands b ON m.brand_id = b.id
         JOIN storage_options s ON l.storage_id = s.id
         JOIN colors c ON l.color_id = c.id
         JOIN conditions cond ON l.condition_id = cond.id
         LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
         WHERE l.id = $1`,
        [listing.id]
      );

      // Notify all admins about the new listing (never fails the creation)
      const listingDetails = fullListing.rows[0];
      await notifyAdminsOfNewListing(pool, {
        listingId: listing.id,
        deviceName: `${listingDetails.brand_name} ${listingDetails.model_name}`,
        price: listingDetails.price,
      });

      res.json({
        message: 'Listing created successfully',
        listing: fullListing.rows[0]
      });
    } catch (error) {
      console.error('Error creating listing:', error);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  }
);

// Get all listings with marketplace filtering
router.get('/listings', async (req, res) => {
  try {
    const {
      status = LISTING_STATUS.APPROVED,
      limit = 50,
      offset = 0,
      search = '',
      category_id = '',
      brand_id = '',
      model_id = '',
      model_storage_id = '',
      model_color_id = '',
      storage_id = '',
      color_id = '',
      condition_id = '',
      min_price = '',
      max_price = '',
      min_battery = '',
      max_battery = '',
      city_id = '',
      area_id = '',
      sort = 'newest',
    } = req.query;

    // This endpoint is unauthenticated, so it may only ever serve public
    // statuses. Hidden, pending, declined, and deleted listings are reachable
    // through the owner's My Listings or the admin routes instead.
    if (!isPublicListingStatus(status)) {
      return res.status(400).json({
        error: `status must be one of: ${PUBLIC_LISTING_STATUSES.join(', ')}`,
      });
    }

    try {
      let whereConditions = ['l.status = $1'];
      let queryParams = [status];
      let paramIndex = 2;

      const pushParam = (value) => {
        queryParams.push(value);
        const idx = paramIndex;
        paramIndex += 1;
        return idx;
      };

      if (search && String(search).trim()) {
        const normalizedSearch = normalizeMarketplaceSearch(search);
        const searchClause = buildMarketplaceSearchClause(normalizedSearch, pushParam);
        if (searchClause) {
          whereConditions.push(searchClause);
        }
      }

      if (category_id && String(category_id).trim()) {
        const i = pushParam(parseInt(category_id, 10));
        whereConditions.push(`m.category_id = $${i}`);
      }

      if (brand_id && String(brand_id).trim()) {
        const i = pushParam(parseInt(brand_id, 10));
        whereConditions.push(`b.id = $${i}`);
      }

      if (model_id && String(model_id).trim()) {
        const i = pushParam(parseInt(model_id, 10));
        whereConditions.push(`m.id = $${i}`);
      }

      // Catalog-aware storage filter (preferred)
      if (model_storage_id && String(model_storage_id).trim()) {
        const i = pushParam(parseInt(model_storage_id, 10));
        whereConditions.push(`(
          l.model_storage_id = $${i}
          OR (
            l.model_storage_id IS NULL
            AND l.storage_id = (
              SELECT so.id
              FROM model_storages ms
              JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
              JOIN storage_options so ON so.capacity_gb = sc.capacity_gb
              WHERE ms.id = $${i}
            )
          )
        )`);
      } else if (storage_id && String(storage_id).trim()) {
        const i = pushParam(parseInt(storage_id, 10));
        whereConditions.push(`l.storage_id = $${i}`);
      }

      // Catalog-aware color filter (preferred)
      if (model_color_id && String(model_color_id).trim()) {
        const i = pushParam(parseInt(model_color_id, 10));
        whereConditions.push(`(
          l.model_color_id = $${i}
          OR (
            l.model_color_id IS NULL
            AND l.color_id = (SELECT mc.color_id FROM model_colors mc WHERE mc.id = $${i})
          )
        )`);
      } else if (color_id && String(color_id).trim()) {
        const i = pushParam(parseInt(color_id, 10));
        whereConditions.push(`l.color_id = $${i}`);
      }

      if (condition_id && String(condition_id).trim()) {
        const i = pushParam(parseInt(condition_id, 10));
        whereConditions.push(`l.condition_id = $${i}`);
      }

      if (min_price !== undefined && String(min_price).trim() !== '') {
        const i = pushParam(parseFloat(min_price));
        whereConditions.push(`l.price >= $${i}`);
      }

      if (max_price !== undefined && String(max_price).trim() !== '') {
        const i = pushParam(parseFloat(max_price));
        whereConditions.push(`l.price <= $${i}`);
      }

      if (min_battery !== undefined && String(min_battery).trim() !== '') {
        const i = pushParam(parseInt(min_battery, 10));
        whereConditions.push(`l.battery_percentage IS NOT NULL AND l.battery_percentage >= $${i}`);
      }

      if (max_battery !== undefined && String(max_battery).trim() !== '') {
        const i = pushParam(parseInt(max_battery, 10));
        whereConditions.push(`l.battery_percentage IS NOT NULL AND l.battery_percentage <= $${i}`);
      }

      if (city_id && String(city_id).trim()) {
        const i = pushParam(parseInt(city_id, 10));
        whereConditions.push(`(
          l.city_id = $${i}
          OR (
            l.city_id IS NULL
            AND EXISTS (
              SELECT 1 FROM cities ci
              WHERE ci.id = $${i}
                AND (
                  l.location ILIKE '%' || ci.name_en || '%'
                  OR (ci.name_ar IS NOT NULL AND l.location ILIKE '%' || ci.name_ar || '%')
                )
            )
          )
        )`);
      }

      if (area_id && String(area_id).trim()) {
        const i = pushParam(parseInt(area_id, 10));
        whereConditions.push(`(
          l.area_id = $${i}
          OR (
            l.area_id IS NULL
            AND EXISTS (
              SELECT 1 FROM areas ar
              WHERE ar.id = $${i}
                AND (
                  l.location ILIKE '%' || ar.name_en || '%'
                  OR (ar.name_ar IS NOT NULL AND l.location ILIKE '%' || ar.name_ar || '%')
                )
            )
          )
        )`);
      }

      const sortKey = String(sort || 'newest').toLowerCase();
      const orderByMap = {
        newest: 'l.created_at DESC',
        oldest: 'l.created_at ASC',
        price_asc: 'l.price ASC, l.created_at DESC',
        price_desc: 'l.price DESC, l.created_at DESC',
        lowest_price: 'l.price ASC, l.created_at DESC',
        highest_price: 'l.price DESC, l.created_at DESC',
      };
      const orderBy = orderByMap[sortKey] || orderByMap.newest;

      const whereClause = whereConditions.join(' AND ');
      const limitIdx = pushParam(parseInt(limit, 10));
      const offsetIdx = pushParam(parseInt(offset, 10));

      const result = await pool.query(
        `SELECT
          l.*,
          m.name as model_name,
          m.category_id,
          b.name as brand_name,
          s.capacity_gb,
          c.name as color_name,
          c.hex_code as color_hex,
          cond.name as condition_name,
          u.first_name,
          u.last_name,
          city.name_en as city_name,
          area.name_en as area_name,
          (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) as thumbnail_image
         FROM listings l
         JOIN models m ON l.model_id = m.id
         JOIN brands b ON m.brand_id = b.id
         JOIN storage_options s ON l.storage_id = s.id
         JOIN colors c ON l.color_id = c.id
         JOIN conditions cond ON l.condition_id = cond.id
         JOIN users u ON l.user_id = u.id
         LEFT JOIN cities city ON l.city_id = city.id
         LEFT JOIN areas area ON l.area_id = area.id
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        queryParams
      );

      res.json({ listings: result.rows.map(withoutViewCount) });
    } catch (dbError) {
      if (dbError.message && dbError.message.includes('does not exist')) {
        console.warn('Listings tables not found. Please run database initialization.');
        return res.json({ listings: [] });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({
      error: 'Failed to fetch listings',
      details: error.message,
    });
  }
});

// Get user's listings (must be registered before /listings/:id)
// Every status is returned, including the terminal ones: the owner's screen
// groups them into active, sold, and deleted sections.
router.get('/listings/user/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        m.name as model_name,
        b.name as brand_name,
        s.capacity_gb,
        c.name as color_name,
        cond.name as condition_name,
        (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) as thumbnail_image
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [userId]
    );

    res.json({ listings: result.rows });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ error: 'Failed to fetch user listings' });
  }
});

// Get listing details (auth is optional; it only decides whether the view count is included)
router.get('/listings/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get listing details
    const listingResult = await pool.query(
      `SELECT 
        l.*,
        m.name as model_name,
        m.brand_id as brand_id,
        m.release_year,
        m.chipset,
        m.screen_size,
        b.name as brand_name,
        s.capacity_gb,
        c.name as color_name,
        c.hex_code as color_hex,
        cond.name as condition_name,
        sim.name as sim_configuration_name,
        u.first_name,
        u.last_name,
        u.phone_number
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [id]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get listing images
    const imagesResult = await pool.query(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
      [id]
    );

    const listing = listingResult.rows[0];
    const isOwner = Boolean(req.user?.userId) && listing.user_id === req.user.userId;

    // A hidden (or pending/declined/deleted) listing exists only for its owner
    // and for moderation. Everyone else gets the same answer as a missing id.
    if (!isPublicListingStatus(listing.status) && !isOwner) {
      const canModerate = req.user?.userId ? await isAdminUser(req.user.userId) : false;
      if (!canModerate) {
        return res.status(404).json({ error: 'Listing not found' });
      }
    }

    res.json({
      // is_owner saves the client a separate profile request to decide what to show
      listing: { ...(isOwner ? listing : withoutViewCount(listing)), is_owner: isOwner },
      images: imagesResult.rows
    });
  } catch (error) {
    console.error('Error fetching listing details:', error);
    res.status(500).json({ error: 'Failed to fetch listing details' });
  }
});

// Register a view for a listing
router.post('/listings/:id/view', optionalAuth, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const userId = req.user?.userId || null;
    const result = await recordListingView(pool, {
      listingId,
      userId,
      ipAddress: userId ? null : resolveClientIp(req),
    });

    if (!result.found) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const payload = { listing_id: listingId, counted: result.counted };
    // Only the seller learns the actual number.
    if (result.isOwner) {
      payload.views = result.views;
    }

    res.json(payload);
  } catch (error) {
    console.error('Error registering listing view:', error);
    res.status(500).json({ error: 'Failed to register listing view' });
  }
});

// Mark listing as sold
router.put('/listings/:id/mark-sold', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    // Check if listing belongs to user
    const checkResult = await pool.query(
      'SELECT user_id, status FROM listings WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to mark this listing as sold' });
    }

    // A terminal listing is a wrong-state conflict rather than a bad request,
    // and is reported the same way by every transition in this file.
    const currentStatus = checkResult.rows[0].status;
    if (isTerminalListingStatus(currentStatus)) {
      return res.status(409).json({ error: `A ${currentStatus} listing can no longer be changed` });
    }

    // Only allow marking approved listings as sold
    if (currentStatus !== LISTING_STATUS.APPROVED) {
      return res.status(400).json({ error: 'Only approved listings can be marked as sold' });
    }

    // Selling is terminal and one-way: re-checking the status keeps two
    // concurrent requests from both reporting a fresh sale. Only the status
    // column changes, so views, favorites, offers, and images are untouched.
    const result = await pool.query(
      `UPDATE listings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND status = $3
       RETURNING *`,
      [LISTING_STATUS.SOLD, id, LISTING_STATUS.APPROVED]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Listing status changed, please try again' });
    }

    await notifyListingSold(pool, {
      userId,
      listingId: result.rows[0].id,
      deviceName: await getListingDeviceName(pool, result.rows[0].id),
    });

    res.json({ 
      message: 'Listing marked as sold successfully',
      listing: result.rows[0] 
    });
  } catch (error) {
    console.error('Error marking listing as sold:', error);
    res.status(500).json({ error: 'Failed to mark listing as sold' });
  }
});

/**
 * Hide and unhide are one owner-driven status flip in opposite directions,
 * so both share this transition. Nothing but listings.status changes, which
 * is what keeps every listing query and all listing data reusable as-is.
 */
const setListingVisibility = async (req, res, { from, to, notify }) => {
  const listingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'User ID not found in token' });
  }

  try {
    const existing = await pool.query('SELECT user_id, status FROM listings WHERE id = $1', [listingId]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (existing.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to change this listing' });
    }

    if (isTerminalListingStatus(existing.rows[0].status)) {
      return res.status(409).json({
        error: `A ${existing.rows[0].status} listing can no longer be changed`,
      });
    }

    if (existing.rows[0].status !== from) {
      return res.status(409).json({
        error: to === LISTING_STATUS.HIDDEN
          ? 'Only approved listings can be hidden'
          : 'Only hidden listings can be unhidden',
      });
    }

    // Re-checking the status here makes two concurrent requests safe: the
    // second one updates nothing and is reported as a conflict.
    const result = await pool.query(
      `UPDATE listings
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3 AND status = $4
       RETURNING *`,
      [to, listingId, userId, from]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Listing status changed, please try again' });
    }

    await notify(pool, {
      userId,
      listingId,
      deviceName: await getListingDeviceName(pool, listingId),
    });

    res.json({ listing: result.rows[0] });
  } catch (error) {
    console.error(`Error setting listing status to ${to}:`, error);
    res.status(500).json({ error: 'Failed to update listing visibility' });
  }
};

// PATCH /api/listings/:id/hide — approved → hidden
router.patch('/listings/:id/hide', verifyToken, (req, res) =>
  setListingVisibility(req, res, {
    from: LISTING_STATUS.APPROVED,
    to: LISTING_STATUS.HIDDEN,
    notify: notifyListingHidden,
  })
);

// PATCH /api/listings/:id/unhide — hidden → approved
router.patch('/listings/:id/unhide', verifyToken, (req, res) =>
  setListingVisibility(req, res, {
    from: LISTING_STATUS.HIDDEN,
    to: LISTING_STATUS.APPROVED,
    notify: notifyListingActive,
  })
);

// Update listing (owner only). Editing sends the listing back to moderation.
router.put('/listings/:id', verifyToken,
  [
    body('model_id').isInt().withMessage('Model ID is required'),
    body('model_storage_id').isInt().withMessage('Storage is required'),
    body('model_color_id').isInt().withMessage('Color is required'),
    body('sim_configuration_id').isInt().withMessage('SIM configuration is required'),
    body('condition_id').isInt().withMessage('Condition ID is required'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('battery_percentage').optional({ nullable: true }).isInt({ min: 70, max: 100 }).withMessage('Battery percentage must be between 70 and 100'),
    body('description').optional().isString(),
    body('location').optional().isString(),
    body('city_id').optional({ nullable: true }).isInt().withMessage('Invalid city'),
    body('area_id').optional({ nullable: true }).isInt().withMessage('Invalid area'),
    body('images').optional().isArray().withMessage('Images must be an array'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      // Verify the listing exists and belongs to the current user
      const checkResult = await pool.query(
        'SELECT user_id, status FROM listings WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (checkResult.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this listing' });
      }

      // Terminal listings (sold, deleted) can no longer be edited
      const currentStatus = checkResult.rows[0].status;
      if (isTerminalListingStatus(currentStatus)) {
        return res.status(400).json({ error: 'This listing can no longer be edited' });
      }

      const { model_id, model_storage_id, model_color_id, sim_configuration_id, condition_id, battery_percentage, price, description, location, city_id, area_id, images } = req.body;

      if (Array.isArray(images) && images.length > MAX_LISTING_IMAGES) {
        return res.status(400).json({ error: `You can have up to ${MAX_LISTING_IMAGES} images per listing` });
      }

      // When the client sends an images array, require at least one image
      if (Array.isArray(images)) {
        const finalUrls = images.filter((url) => typeof url === 'string' && url.trim());
        if (finalUrls.length === 0) {
          return res.status(400).json({ error: 'At least one image is required' });
        }
      }

      // Validate model_storage_id and derive legacy storage_id
      const storageResolved = await resolveLegacyStorageId(model_storage_id);
      if (storageResolved.error) {
        return res.status(400).json({ error: storageResolved.error });
      }
      if (storageResolved.model_id !== parseInt(model_id, 10)) {
        return res.status(400).json({ error: 'Storage option does not belong to this model' });
      }
      const storage_id = storageResolved.storage_id;

      // Validate model_color_id and derive legacy color_id
      const mcResult = await pool.query(
        `SELECT mc.id, mc.model_id, mc.color_id
         FROM   model_colors mc
         WHERE  mc.id = $1`,
        [model_color_id]
      );
      if (mcResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid color option' });
      }
      if (mcResult.rows[0].model_id !== parseInt(model_id)) {
        return res.status(400).json({ error: 'Color option does not belong to this model' });
      }
      const color_id = mcResult.rows[0].color_id;

      // Validate SIM configuration exists and is active
      const simResult = await pool.query(
        'SELECT id FROM sim_configurations WHERE id = $1 AND is_active = TRUE',
        [sim_configuration_id]
      );
      if (simResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid SIM configuration' });
      }

      let resolvedCityId = city_id ? parseInt(city_id, 10) : null;
      let resolvedAreaId = area_id ? parseInt(area_id, 10) : null;
      let resolvedLocation = location || null;

      if (resolvedAreaId) {
        const areaRes = await pool.query(
          `SELECT a.id, a.city_id, a.name_en, c.name_en AS city_name
           FROM areas a JOIN cities c ON c.id = a.city_id
           WHERE a.id = $1 AND a.is_active = TRUE`,
          [resolvedAreaId]
        );
        if (areaRes.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid area' });
        }
        resolvedCityId = areaRes.rows[0].city_id;
        if (!resolvedLocation) {
          resolvedLocation = `${areaRes.rows[0].name_en}, ${areaRes.rows[0].city_name}`;
        }
      } else if (resolvedCityId) {
        const cityRes = await pool.query(
          'SELECT id, name_en FROM cities WHERE id = $1 AND is_active = TRUE',
          [resolvedCityId]
        );
        if (cityRes.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid city' });
        }
        if (!resolvedLocation) {
          resolvedLocation = cityRes.rows[0].name_en;
        }
      }

      // Any edit re-enters moderation as 'pending'. Ownership and created_at are preserved.
      await pool.query(
        `UPDATE listings
         SET model_id              = $1,
             storage_id            = $2,
             color_id              = $3,
             model_storage_id      = $4,
             model_color_id        = $5,
             sim_configuration_id  = $6,
             condition_id          = $7,
             battery_percentage    = $8,
             price                 = $9,
             description           = $10,
             location              = $11,
             city_id               = $12,
             area_id               = $13,
             status                = 'pending',
             updated_at            = CURRENT_TIMESTAMP
         WHERE id = $14`,
        [model_id, storage_id, color_id, model_storage_id, model_color_id,
         sim_configuration_id, condition_id, battery_percentage || null, price, description || null,
         resolvedLocation, resolvedCityId, resolvedAreaId, id]
      );

      // Sync images when the client sends a final image URL list.
      // Omitted `images` leaves existing images unchanged.
      if (Array.isArray(images)) {
        const existingResult = await pool.query(
          'SELECT id, image_url FROM listing_images WHERE listing_id = $1',
          [id]
        );
        const existingByUrl = new Map(
          existingResult.rows.map((row) => [row.image_url, row])
        );
        const finalUrls = images.filter((url) => typeof url === 'string' && url.trim());
        const finalUrlSet = new Set(finalUrls);

        // Remove images the seller deleted (DB row + local file)
        for (const row of existingResult.rows) {
          if (!finalUrlSet.has(row.image_url)) {
            await pool.query('DELETE FROM listing_images WHERE id = $1', [row.id]);
            deleteLocalListingImageFile(row.image_url);
          }
        }

        // Keep existing URLs (update order) and insert only newly added URLs
        for (let i = 0; i < finalUrls.length; i++) {
          const url = finalUrls[i];
          const existing = existingByUrl.get(url);
          if (existing) {
            await pool.query(
              'UPDATE listing_images SET display_order = $1 WHERE id = $2',
              [i, existing.id]
            );
          } else {
            await pool.query(
              'INSERT INTO listing_images (listing_id, image_url, display_order) VALUES ($1, $2, $3)',
              [id, url, i]
            );
          }
        }
      }

      // Return the full listing with relations so the client can refresh immediately
      const fullListing = await pool.query(
        `SELECT 
          l.*,
          m.name as model_name,
          m.brand_id as brand_id,
          b.name as brand_name,
          s.capacity_gb,
          c.name as color_name,
          c.hex_code as color_hex,
          cond.name as condition_name,
          sim.name as sim_configuration_name
         FROM listings l
         JOIN models m ON l.model_id = m.id
         JOIN brands b ON m.brand_id = b.id
         JOIN storage_options s ON l.storage_id = s.id
         JOIN colors c ON l.color_id = c.id
         JOIN conditions cond ON l.condition_id = cond.id
         LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
         WHERE l.id = $1`,
        [id]
      );

      const imagesResult = await pool.query(
        'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
        [id]
      );

      res.json({
        message: 'Listing updated successfully',
        listing: fullListing.rows[0],
        images: imagesResult.rows,
      });
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  }
);

/**
 * Delete listing — soft delete, owner only.
 *
 * Only listings.status changes, so offers, favorites, views, view history,
 * images, and notifications all keep their rows. Deleting is terminal and
 * cannot run on a listing that already reached a terminal state, which is what
 * stops a completed sale from being erased and makes a second delete a conflict
 * rather than a silent no-op.
 */
router.delete('/listings/:id', verifyToken, async (req, res) => {
  const listingId = parseInt(req.params.id, 10);

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const existing = await pool.query(
      'SELECT user_id, status FROM listings WHERE id = $1',
      [listingId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (existing.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    const currentStatus = existing.rows[0].status;
    if (isTerminalListingStatus(currentStatus)) {
      return res.status(409).json({
        error: currentStatus === LISTING_STATUS.DELETED
          ? 'This listing is already deleted'
          : `A ${currentStatus} listing can no longer be deleted`,
      });
    }

    // Excluding terminal statuses in the UPDATE as well keeps two concurrent
    // requests safe: the second one changes nothing and reports a conflict.
    const result = await pool.query(
      `UPDATE listings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3 AND status <> ALL($4::text[])
       RETURNING id, status`,
      [LISTING_STATUS.DELETED, listingId, userId, TERMINAL_LISTING_STATUSES]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Listing status changed, please try again' });
    }

    res.json({ message: 'Listing deleted successfully', listing: result.rows[0] });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;

