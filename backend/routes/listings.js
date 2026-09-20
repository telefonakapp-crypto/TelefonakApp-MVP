const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { recordListingView, resolveClientIp } = require('../utils/listingViews');
const {
  getListingDeviceName,
  notifyListingSold,
  notifyListingHidden,
  notifyListingActive,
  notifyListingLive,
  notifyListingSubmitted,
  notifyListingResubmitted,
  notifyListingUpdated,
  notifyAdminsOfNewListing,
} = require('../utils/notifications');
const {
  LISTING_STATUS,
  PUBLIC_LISTING_STATUSES,
  TERMINAL_LISTING_STATUSES,
  isPublicListingStatus,
  isTerminalListingStatus,
  resolveListingModerationStatus,
  resolveSellerEditNextStatus,
} = require('../utils/listingStatus');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { assertListingPriceWithinLimits } = require('../utils/listingPrice');
const {
  deleteLocalListingImageFile,
  copyLocalListingImageFile,
  recordListingImageUpload,
  validateListingImageUrls,
  listingImageFilename,
} = require('../utils/listingImageAuth');
const {
  validateListingIdentityAttributes,
  formatListingDeviceName,
} = require('../utils/listingCustom');
const {
  fetchMarketplaceListings,
  fetchOwnerMyListings,
  fetchListingRowById,
  fetchListingRowAfterWrite,
} = require('../utils/listingQueries');
const {
  recordListingModerationEvent,
  freezeCurrentListingRevision,
  EVENT_TYPE,
} = require('../utils/listingModerationEvents');

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

// Middleware to verify JWT token (rejects disabled marketplace accounts)
const verifyToken = require('../middleware/verifyToken');

// Attaches req.user when a valid customer JWT is present, otherwise continues as a guest
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const { verifyCustomerToken } = require('../utils/customerAuth');
      const decoded = verifyCustomerToken(token);
      // Ignore Admin Web staff tokens on customer listing routes.
      if (!decoded.adminId && decoded.typ !== 'admin') {
        req.user = decoded;
      }
    } catch (error) {
      // An unusable token simply means "treat this request as a guest"
    }
  }

  next();
};

/**
 * Customer JWTs carry no staff role. Non-public listings are owner-only;
 * staff moderation uses Admin Web APIs under /api/admin/listings.
 */

// Create listing — status from live `auto_approve_listings` setting (pending | approved)
router.post('/listings', verifyToken,
  [
    body('listing_source').optional({ nullable: true }).isIn(['catalog', 'custom']).withMessage('Invalid listing source'),
    body('category_id').optional({ nullable: true }).isInt().withMessage('Invalid category'),
    body('model_id').optional({ nullable: true }).isInt().withMessage('Invalid model ID'),
    body('custom_brand_name').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('custom_model_name').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('custom_storage').optional({ nullable: true }).isString().isLength({ max: 40 }),
    body('custom_color_name').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('custom_sim_configuration').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('custom_case_size').optional({ nullable: true }).isString().isLength({ max: 40 }),
    body('custom_connectivity').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('model_storage_id').optional({ nullable: true }).isInt().withMessage('Invalid storage option'),
    body('model_color_id').optional({ nullable: true }).isInt().withMessage('Invalid color option'),
    body('sim_configuration_id').optional({ nullable: true }).isInt().withMessage('Invalid SIM configuration'),
    body('model_watch_case_size_id').optional({ nullable: true }).isInt().withMessage('Invalid case size'),
    body('model_watch_connectivity_id').optional({ nullable: true }).isInt().withMessage('Invalid connectivity option'),
    body('condition_id').isInt().withMessage('Condition ID is required'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    // Mobile sends null for optional empties (New condition has no battery, blank description/location).
    // express-validator optional() skips undefined only unless nullable: true.
    body('battery_percentage').optional({ nullable: true }).isInt({ min: 70, max: 100 }).withMessage('Battery percentage must be between 70 and 100'),
    body('description').optional({ nullable: true }).isString(),
    body('location').optional({ nullable: true }).isString().isLength({ max: 100 }),
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

      try {
        await assertListingPriceWithinLimits(req.body.price);
      } catch (error) {
        if (error.statusCode === 400) {
          return res.status(400).json({ error: error.message });
        }
        throw error;
      }

      const { condition_id, battery_percentage, price, description, location, city_id, area_id, images } = req.body;
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      const rawImageUrls = Array.isArray(images)
        ? images.filter((url) => typeof url === 'string' && url.trim())
        : [];

      if (rawImageUrls.length === 0) {
        return res.status(400).json({ error: 'At least one image is required' });
      }

      if (rawImageUrls.length > MAX_LISTING_IMAGES) {
        return res.status(400).json({ error: `You can have up to ${MAX_LISTING_IMAGES} images per listing` });
      }

      const imageCheck = await validateListingImageUrls({
        userId,
        imageUrls: rawImageUrls,
      });
      if (!imageCheck.ok) {
        return res.status(400).json({ error: imageCheck.error });
      }
      const imageUrls = imageCheck.urls;

      const catalogFields = await validateListingIdentityAttributes(pool, req.body, {
        resolveLegacyStorageId,
      });
      if (catalogFields.error) {
        return res.status(400).json({ error: catalogFields.error });
      }

      const {
        listing_source,
        category_id: listingCategoryId,
        model_id,
        storage_id,
        color_id,
        model_storage_id,
        model_color_id,
        sim_configuration_id,
        model_watch_case_size_id,
        model_watch_connectivity_id,
        custom_brand_name,
        custom_model_name,
        custom_storage,
        custom_color_name,
        custom_sim_configuration,
        custom_case_size,
        custom_connectivity,
      } = catalogFields;

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

      // Live Admin setting — no restart required when toggled.
      const initialStatus = await resolveListingModerationStatus();

      const listingResult = await pool.query(
        `INSERT INTO listings
           (user_id, model_id, storage_id, color_id, model_storage_id, model_color_id,
            sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
            condition_id, battery_percentage, price, description, location,
            city_id, area_id, status, decline_reason, approved_or_rejected_at, moderated_by_admin_id,
            category_id, listing_source, custom_brand_name, custom_model_name, custom_storage,
            custom_color_name, custom_sim_configuration, custom_case_size, custom_connectivity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NULL,
                 CASE WHEN $17::varchar = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
                 NULL, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         RETURNING *`,
        [userId, model_id, storage_id, color_id, model_storage_id, model_color_id,
         sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
         condition_id, battery_percentage || null, price, description || null,
         resolvedLocation, resolvedCityId, resolvedAreaId, initialStatus,
         listingCategoryId, listing_source, custom_brand_name, custom_model_name, custom_storage,
         custom_color_name, custom_sim_configuration, custom_case_size, custom_connectivity]
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
      const fullListing = await fetchListingRowAfterWrite(pool, listing.id, {
        withSellerNames: true,
      });

      const listingDetails = fullListing.rows[0];
      const deviceName = formatListingDeviceName(
        listingDetails.brand_name,
        listingDetails.model_name
      );

      // Manual moderation: notify admins + tell the seller it awaits review.
      // Auto-approve: only the "Listing Live" owner notification (never both).
      if (listing.status === LISTING_STATUS.PENDING) {
        const sellerName = `${listingDetails.seller_first_name || ''} ${listingDetails.seller_last_name || ''}`.trim();
        await notifyAdminsOfNewListing(pool, {
          listingId: listing.id,
          deviceName,
          brandName: listingDetails.brand_name,
          modelName: listingDetails.model_name,
          price: listingDetails.price,
          sellerName: sellerName || null,
          submittedAt: listingDetails.created_at,
        });
        await notifyListingSubmitted(pool, {
          userId,
          listingId: listing.id,
          deviceName,
        });
      } else if (listing.status === LISTING_STATUS.APPROVED) {
        await notifyListingLive(pool, {
          userId,
          listingId: listing.id,
          deviceName,
        });
      }

      // Keep the create response shape stable for mobile (omit seller_* join fields).
      const listingResponse = { ...listingDetails };
      delete listingResponse.seller_first_name;
      delete listingResponse.seller_last_name;

      res.json({
        message: 'Listing created successfully',
        listing: listingResponse,
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
      model_watch_case_size_id = '',
      model_watch_connectivity_id = '',
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
      const result = await fetchMarketplaceListings(pool, {
        status,
        search,
        category_id,
        brand_id,
        model_id,
        model_storage_id,
        model_color_id,
        model_watch_case_size_id,
        model_watch_connectivity_id,
        storage_id,
        color_id,
        condition_id,
        min_price,
        max_price,
        min_battery,
        max_battery,
        city_id,
        area_id,
        sort,
        limit,
        offset,
      });

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
    });
  }
});

// Get user's listings (must be registered before /listings/:id)
// Every status is returned, including the terminal ones: the owner's screen
// groups them into active, sold, and deleted sections.
// Only revision tips are returned — superseded declined snapshots stay in DB
// for admin history / reporting but must not duplicate My Listings cards.
router.get('/listings/user/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const result = await fetchOwnerMyListings(pool, userId);

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
    const listingResult = await fetchListingRowById(pool, id);

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

    const childResult = await pool.query(
      'SELECT id FROM listings WHERE previous_listing_id = $1 LIMIT 1',
      [id]
    );
    const isSuperseded = childResult.rows.length > 0;

    // A hidden (or pending/declined/deleted) listing exists only for its owner.
    // Frozen approved snapshots are not marketplace listings.
    // Everyone else gets the same answer as a missing id.
    if ((!isPublicListingStatus(listing.status) || isSuperseded) && !isOwner) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Public marketplace contact: seller phone is intentional Call Seller data on
    // approved listings visible to any viewer who can open this listing.
    // (Non-public listings are owner-only above; guests never reach this path.)

    // Owner dashboard metrics — buyers never receive these counts.
    if (isOwner) {
      const metricsResult = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM favorites WHERE listing_id = $1) AS favorites_count,
           (SELECT COUNT(*)::int FROM offers WHERE listing_id = $1) AS offers_count`,
        [id]
      );
      listing.favorites_count = metricsResult.rows[0]?.favorites_count ?? 0;
      listing.offers_count = metricsResult.rows[0]?.offers_count ?? 0;
    }

    // Buyer-private offer summary — never for owners, guests, or other buyers.
    let buyerOfferFields = {
      has_my_offer: false,
      my_offer: null,
      my_offer_status: null,
      my_offer_amount: null,
      my_offer_created_at: null,
    };

    if (req.user?.userId && !isOwner) {
      const myOfferResult = await pool.query(
        `SELECT id, listing_id, offered_price, status, created_at, updated_at
         FROM offers
         WHERE listing_id = $1 AND buyer_id = $2
         ORDER BY
           CASE status
             WHEN 'pending' THEN 0
             WHEN 'accepted' THEN 1
             WHEN 'rejected' THEN 2
             WHEN 'withdrawn' THEN 3
             ELSE 4
           END,
           created_at DESC
         LIMIT 1`,
        [id, req.user.userId]
      );

      if (myOfferResult.rows.length > 0) {
        const myOffer = myOfferResult.rows[0];
        buyerOfferFields = {
          has_my_offer: true,
          my_offer: myOffer,
          my_offer_status: myOffer.status,
          my_offer_amount: myOffer.offered_price,
          my_offer_created_at: myOffer.created_at,
        };
      }
    }

    res.json({
      // is_owner saves the client a separate profile request to decide what to show
      listing: {
        ...(isOwner ? listing : withoutViewCount(listing)),
        is_owner: isOwner,
        ...buyerOfferFields,
      },
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
       WHERE id = $2 AND user_id = $3 AND status = $4
       RETURNING *`,
      [LISTING_STATUS.SOLD, id, userId, LISTING_STATUS.APPROVED]
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
    body('listing_source').optional({ nullable: true }).isIn(['catalog', 'custom']).withMessage('Invalid listing source'),
    body('category_id').optional({ nullable: true }).isInt().withMessage('Invalid category'),
    body('model_id').optional({ nullable: true }).isInt().withMessage('Invalid model ID'),
    body('custom_brand_name').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('custom_model_name').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('custom_storage').optional({ nullable: true }).isString().isLength({ max: 40 }),
    body('custom_color_name').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('custom_sim_configuration').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('custom_case_size').optional({ nullable: true }).isString().isLength({ max: 40 }),
    body('custom_connectivity').optional({ nullable: true }).isString().isLength({ max: 80 }),
    body('model_storage_id').optional({ nullable: true }).isInt().withMessage('Invalid storage option'),
    body('model_color_id').optional({ nullable: true }).isInt().withMessage('Invalid color option'),
    body('sim_configuration_id').optional({ nullable: true }).isInt().withMessage('Invalid SIM configuration'),
    body('model_watch_case_size_id').optional({ nullable: true }).isInt().withMessage('Invalid case size'),
    body('model_watch_connectivity_id').optional({ nullable: true }).isInt().withMessage('Invalid connectivity option'),
    body('condition_id').isInt().withMessage('Condition ID is required'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('battery_percentage').optional({ nullable: true }).isInt({ min: 70, max: 100 }).withMessage('Battery percentage must be between 70 and 100'),
    body('description').optional({ nullable: true }).isString(),
    body('location').optional({ nullable: true }).isString().isLength({ max: 100 }),
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

      try {
        await assertListingPriceWithinLimits(req.body.price);
      } catch (error) {
        if (error.statusCode === 400) {
          return res.status(400).json({ error: error.message });
        }
        throw error;
      }

      const { id } = req.params;
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      // Verify the listing exists and belongs to the current user
      const checkResult = await pool.query(
        `SELECT user_id, status, revision_number, root_listing_id, previous_listing_id
         FROM listings WHERE id = $1`,
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (checkResult.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this listing' });
      }

      // Terminal listings (sold, deleted) can no longer be edited
      const currentListing = checkResult.rows[0];
      const currentStatus = currentListing.status;
      if (isTerminalListingStatus(currentStatus)) {
        return res.status(400).json({ error: 'This listing can no longer be edited' });
      }

      // Superseded snapshots (already have a child revision) are immutable.
      const childResult = await pool.query(
        `SELECT id FROM listings WHERE previous_listing_id = $1 LIMIT 1`,
        [id]
      );
      if (childResult.rows.length > 0) {
        const tipResult = await pool.query(
          `SELECT tip.id
           FROM listings tip
           WHERE tip.root_listing_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM listings child
               WHERE child.previous_listing_id = tip.id
             )
           ORDER BY tip.revision_number DESC
           LIMIT 1`,
          [currentListing.root_listing_id || id]
        );
        return res.status(409).json({
          error: 'This listing has been superseded by a newer revision',
          tip_listing_id: tipResult.rows[0]?.id || childResult.rows[0].id,
        });
      }

      const { condition_id, battery_percentage, price, description, location, city_id, area_id, images } = req.body;

      if (Array.isArray(images) && images.length > MAX_LISTING_IMAGES) {
        return res.status(400).json({ error: `You can have up to ${MAX_LISTING_IMAGES} images per listing` });
      }

      // When the client sends an images array, require at least one image and
      // that every URL is an owned Telefonak upload (or already on this listing).
      let validatedEditImages = null;
      if (Array.isArray(images)) {
        const finalUrls = images.filter((url) => typeof url === 'string' && url.trim());
        if (finalUrls.length === 0) {
          return res.status(400).json({ error: 'At least one image is required' });
        }
        const imageCheck = await validateListingImageUrls({
          userId,
          imageUrls: finalUrls,
          listingId: parseInt(id, 10),
        });
        if (!imageCheck.ok) {
          return res.status(400).json({ error: imageCheck.error });
        }
        validatedEditImages = imageCheck.urls;
      }

      const catalogFields = await validateListingIdentityAttributes(pool, req.body, {
        resolveLegacyStorageId,
      });
      if (catalogFields.error) {
        return res.status(400).json({ error: catalogFields.error });
      }

      const {
        listing_source,
        category_id: listingCategoryId,
        model_id,
        storage_id,
        color_id,
        model_storage_id,
        model_color_id,
        sim_configuration_id,
        model_watch_case_size_id,
        model_watch_connectivity_id,
        custom_brand_name,
        custom_model_name,
        custom_storage,
        custom_color_name,
        custom_sim_configuration,
        custom_case_size,
        custom_connectivity,
      } = catalogFields;

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

      const listingFieldValues = [
        model_id,
        storage_id,
        color_id,
        model_storage_id,
        model_color_id,
        sim_configuration_id,
        model_watch_case_size_id,
        model_watch_connectivity_id,
        condition_id,
        battery_percentage || null,
        price,
        description || null,
        resolvedLocation,
        resolvedCityId,
        resolvedAreaId,
        listingCategoryId,
        listing_source,
        custom_brand_name,
        custom_model_name,
        custom_storage,
        custom_color_name,
        custom_sim_configuration,
        custom_case_size,
        custom_connectivity,
      ];

      // Declined tip → INSERT immutable snapshot revision (parent never mutates).
      // Already-resubmitted / already-updated tip → in-place UPDATE, same queue status.
      // Approved tip → in-place UPDATE to updated (awaiting moderation).
      // All other editable statuses → in-place UPDATE via auto-approve / pending.
      if (currentStatus === LISTING_STATUS.DECLINED) {
        const client = await pool.connect();
        let newListingId;
        try {
          await client.query('BEGIN');

          const insertResult = await client.query(
            `INSERT INTO listings
               (user_id, model_id, storage_id, color_id, model_storage_id, model_color_id,
                sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
                condition_id, battery_percentage, price, description, location,
                city_id, area_id, category_id, listing_source, custom_brand_name, custom_model_name,
                custom_storage, custom_color_name, custom_sim_configuration, custom_case_size,
                custom_connectivity, status, decline_reason, approved_or_rejected_at, moderated_by_admin_id,
                resubmitted_at, previous_listing_id, revision_number, root_listing_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                     $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                     NULL, NULL, NULL, CURRENT_TIMESTAMP, $27, $28, $29)
             RETURNING *`,
            [
              userId,
              ...listingFieldValues,
              LISTING_STATUS.RESUBMITTED,
              parseInt(id, 10),
              (currentListing.revision_number || 1) + 1,
              currentListing.root_listing_id || parseInt(id, 10),
            ]
          );

          newListingId = insertResult.rows[0].id;
          const publicBaseUrl = resolveBaseUrl(req);

          let sourceUrls;
          if (validatedEditImages) {
            sourceUrls = validatedEditImages;
          } else {
            const parentImages = await client.query(
              `SELECT image_url FROM listing_images
               WHERE listing_id = $1 ORDER BY display_order ASC`,
              [id]
            );
            sourceUrls = parentImages.rows.map((row) => row.image_url);
          }

          if (sourceUrls.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'At least one image is required' });
          }

          for (let i = 0; i < sourceUrls.length; i++) {
            const copiedUrl = copyLocalListingImageFile(sourceUrls[i], publicBaseUrl);
            const copiedFilename = listingImageFilename(copiedUrl);
            if (copiedFilename) {
              await recordListingImageUpload(userId, copiedFilename);
            }
            await client.query(
              `INSERT INTO listing_images (listing_id, image_url, display_order)
               VALUES ($1, $2, $3)`,
              [newListingId, copiedUrl, i]
            );
          }

          await client.query('COMMIT');
        } catch (txError) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // ignore rollback errors
          }
          throw txError;
        } finally {
          client.release();
        }

        const fullListing = await fetchListingRowAfterWrite(pool, newListingId, {
          withSellerNames: true,
          withBrandId: true,
        });

        const imagesResult = await pool.query(
          'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
          [newListingId]
        );

        const listingDetails = fullListing.rows[0];
        const deviceName = formatListingDeviceName(
          listingDetails.brand_name,
          listingDetails.model_name
        );
        const sellerName = `${listingDetails.seller_first_name || ''} ${listingDetails.seller_last_name || ''}`.trim();

        await notifyListingResubmitted(pool, {
          userId,
          listingId: newListingId,
          deviceName,
        });

        await notifyAdminsOfNewListing(pool, {
          listingId: newListingId,
          deviceName,
          brandName: listingDetails.brand_name,
          modelName: listingDetails.model_name,
          price: listingDetails.price,
          sellerName: sellerName || null,
          submittedAt: listingDetails.resubmitted_at || listingDetails.created_at,
          title: 'Listing Resubmitted for Review',
        });

        await recordListingModerationEvent(pool, {
          eventType: EVENT_TYPE.RESUBMITTED,
          listingId: newListingId,
          previousListingId: parseInt(id, 10),
          rootListingId: listingDetails.root_listing_id || parseInt(id, 10),
          userId,
          previousStatus: LISTING_STATUS.DECLINED,
          newStatus: LISTING_STATUS.RESUBMITTED,
          price: listingDetails.price,
        });

        const listingResponse = { ...listingDetails };
        delete listingResponse.seller_first_name;
        delete listingResponse.seller_last_name;

        return res.json({
          message: 'Listing resubmitted successfully',
          listing: listingResponse,
          images: imagesResult.rows,
        });
      }

      let nextStatus;
      const sellerEditStatus = resolveSellerEditNextStatus(currentStatus);
      if (sellerEditStatus && currentStatus !== LISTING_STATUS.DECLINED) {
        nextStatus = sellerEditStatus;
      } else {
        nextStatus = await resolveListingModerationStatus();
      }

      const isQueueStayEdit =
        currentStatus === LISTING_STATUS.RESUBMITTED ||
        currentStatus === LISTING_STATUS.UPDATED;

      if (currentStatus === LISTING_STATUS.APPROVED) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const snapshot = await freezeCurrentListingRevision(client, parseInt(id, 10), userId);
          if (!snapshot) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Listing not found' });
          }

          const publicBaseUrl = resolveBaseUrl(req);
          const parentImages = await client.query(
            `SELECT image_url FROM listing_images
             WHERE listing_id = $1 ORDER BY display_order ASC`,
            [id]
          );
          for (let i = 0; i < parentImages.rows.length; i++) {
            const copiedUrl = copyLocalListingImageFile(parentImages.rows[i].image_url, publicBaseUrl);
            const copiedFilename = listingImageFilename(copiedUrl);
            if (copiedFilename) {
              await recordListingImageUpload(userId, copiedFilename);
            }
            await client.query(
              `INSERT INTO listing_images (listing_id, image_url, display_order)
               VALUES ($1, $2, $3)`,
              [snapshot.id, copiedUrl, i]
            );
          }

          await client.query(
            `UPDATE listings
             SET model_id              = $1,
                 storage_id            = $2,
                 color_id              = $3,
                 model_storage_id      = $4,
                 model_color_id        = $5,
                 sim_configuration_id  = $6,
                 model_watch_case_size_id = $7,
                 model_watch_connectivity_id = $8,
                 condition_id          = $9,
                 battery_percentage    = $10,
                 price                 = $11,
                 description           = $12,
                 location              = $13,
                 city_id               = $14,
                 area_id               = $15,
                 category_id           = $16,
                 listing_source        = $17,
                 custom_brand_name     = $18,
                 custom_model_name     = $19,
                 custom_storage        = $20,
                 custom_color_name     = $21,
                 custom_sim_configuration = $22,
                 custom_case_size      = $23,
                 custom_connectivity   = $24,
                 status                = $25,
                 decline_reason        = NULL,
                 approved_or_rejected_at = NULL,
                 moderated_by_admin_id = NULL,
                 resubmitted_at        = NULL,
                 previous_listing_id   = $26,
                 revision_number       = $27,
                 updated_at            = CURRENT_TIMESTAMP
             WHERE id = $28 AND user_id = $29`,
            [
              ...listingFieldValues,
              LISTING_STATUS.UPDATED,
              snapshot.id,
              (currentListing.revision_number || 1) + 1,
              id,
              userId,
            ]
          );

          await recordListingModerationEvent(client, {
            eventType: EVENT_TYPE.UPDATED,
            listingId: parseInt(id, 10),
            previousListingId: snapshot.id,
            rootListingId: currentListing.root_listing_id || parseInt(id, 10),
            userId,
            previousStatus: LISTING_STATUS.APPROVED,
            newStatus: LISTING_STATUS.UPDATED,
            price,
          });

          await client.query('COMMIT');
        } catch (txError) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // ignore
          }
          throw txError;
        } finally {
          client.release();
        }
      } else if (currentStatus === LISTING_STATUS.RESUBMITTED) {
        await pool.query(
          `UPDATE listings
           SET model_id              = $1,
               storage_id            = $2,
               color_id              = $3,
               model_storage_id      = $4,
               model_color_id        = $5,
               sim_configuration_id  = $6,
               model_watch_case_size_id = $7,
               model_watch_connectivity_id = $8,
               condition_id          = $9,
               battery_percentage    = $10,
               price                 = $11,
               description           = $12,
               location              = $13,
               city_id               = $14,
               area_id               = $15,
               category_id           = $16,
               listing_source        = $17,
               custom_brand_name     = $18,
               custom_model_name     = $19,
               custom_storage        = $20,
               custom_color_name     = $21,
               custom_sim_configuration = $22,
               custom_case_size      = $23,
               custom_connectivity   = $24,
               status                = $25,
               resubmitted_at        = CURRENT_TIMESTAMP,
               updated_at            = CURRENT_TIMESTAMP
           WHERE id = $26 AND user_id = $27`,
          [...listingFieldValues, nextStatus, id, userId]
        );
      } else if (isQueueStayEdit) {
        await pool.query(
          `UPDATE listings
           SET model_id              = $1,
               storage_id            = $2,
               color_id              = $3,
               model_storage_id      = $4,
               model_color_id        = $5,
               sim_configuration_id  = $6,
               model_watch_case_size_id = $7,
               model_watch_connectivity_id = $8,
               condition_id          = $9,
               battery_percentage    = $10,
               price                 = $11,
               description           = $12,
               location              = $13,
               city_id               = $14,
               area_id               = $15,
               category_id           = $16,
               listing_source        = $17,
               custom_brand_name     = $18,
               custom_model_name     = $19,
               custom_storage        = $20,
               custom_color_name     = $21,
               custom_sim_configuration = $22,
               custom_case_size      = $23,
               custom_connectivity   = $24,
               status                = $25,
               decline_reason        = NULL,
               approved_or_rejected_at = NULL,
               moderated_by_admin_id = NULL,
               resubmitted_at        = NULL,
               updated_at            = CURRENT_TIMESTAMP
           WHERE id = $26 AND user_id = $27`,
          [...listingFieldValues, nextStatus, id, userId]
        );
      } else {
        await pool.query(
          `UPDATE listings
           SET model_id              = $1,
               storage_id            = $2,
               color_id              = $3,
               model_storage_id      = $4,
               model_color_id        = $5,
               sim_configuration_id  = $6,
               model_watch_case_size_id = $7,
               model_watch_connectivity_id = $8,
               condition_id          = $9,
               battery_percentage    = $10,
               price                 = $11,
               description           = $12,
               location              = $13,
               city_id               = $14,
               area_id               = $15,
               category_id           = $16,
               listing_source        = $17,
               custom_brand_name     = $18,
               custom_model_name     = $19,
               custom_storage        = $20,
               custom_color_name     = $21,
               custom_sim_configuration = $22,
               custom_case_size      = $23,
               custom_connectivity   = $24,
               status                = $25,
               decline_reason        = NULL,
               approved_or_rejected_at = CASE
                 WHEN $25::varchar = 'approved' THEN CURRENT_TIMESTAMP
                 ELSE NULL
               END,
               moderated_by_admin_id = NULL,
               resubmitted_at        = NULL,
               updated_at            = CURRENT_TIMESTAMP
           WHERE id = $26 AND user_id = $27`,
          [...listingFieldValues, nextStatus, id, userId]
        );
      }

      // Sync images when the client sends a final image URL list.
      // Omitted `images` leaves existing images unchanged.
      if (validatedEditImages) {
        const existingResult = await pool.query(
          'SELECT id, image_url FROM listing_images WHERE listing_id = $1',
          [id]
        );
        const existingByUrl = new Map(
          existingResult.rows.map((row) => [row.image_url, row])
        );
        const finalUrls = validatedEditImages;
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
      const fullListing = await fetchListingRowAfterWrite(pool, id, {
        withBrandId: true,
      });

      const imagesResult = await pool.query(
        'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
        [id]
      );

      if (currentStatus === LISTING_STATUS.RESUBMITTED) {
        await notifyListingResubmitted(pool, {
          userId,
          listingId: parseInt(id, 10),
          deviceName: await getListingDeviceName(pool, id),
        });
      } else if (nextStatus === LISTING_STATUS.UPDATED) {
        const listingDetails = fullListing.rows[0];
        const deviceName = await getListingDeviceName(pool, id);
        await notifyListingUpdated(pool, {
          userId,
          listingId: parseInt(id, 10),
          deviceName,
        });
        await notifyAdminsOfNewListing(pool, {
          listingId: parseInt(id, 10),
          deviceName,
          brandName: listingDetails.brand_name,
          modelName: listingDetails.model_name,
          price: listingDetails.price,
          submittedAt: listingDetails.updated_at || listingDetails.created_at,
          title: 'Listing Updated — Awaiting Review',
        });
      }

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

