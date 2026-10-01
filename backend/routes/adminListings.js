const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../utils/adminAuth');
const { resolveBaseUrl } = require('../utils/baseUrl');
const { LISTING_STATUS, listingIsTipSql } = require('../utils/listingStatus');
const { moderateListing } = require('../utils/moderateListing');
const { writeAuditLog } = require('../utils/auditLog');
const {
  fetchAdminListingList,
  fetchAdminListingRowById,
} = require('../utils/listingQueries');
const { attachAuctionSummary } = require('../utils/listingAuctionSummary');
const { centsToMoney, moneyToCents } = require('../utils/listingAuctions');

const router = express.Router();

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
  if (row.location) return row.location;
  if (row.city_name) return row.city_name;
  return null;
}

/** Display label for who moderated; "Auto Approval" when approved with no admin. */
function resolveModeratedBy(row) {
  if (!row.approved_or_rejected_at) return null;
  if (row.moderated_by_admin_name) return row.moderated_by_admin_name;
  if (row.status === LISTING_STATUS.APPROVED && !row.moderated_by_admin_id) {
    return 'Auto Approval';
  }
  return null;
}

function auctionForAdmin(row) {
  const summary = attachAuctionSummary(
    { ...row, sale_type: row.sale_type || 'normal' },
    { role: 'guest' }
  );
  if (!summary.auction) return null;
  const auction = { ...summary.auction };
  if (row.admin_winning_bid_amount != null && row.admin_winning_bid_amount !== '') {
    auction.winning_bid_amount = centsToMoney(moneyToCents(row.admin_winning_bid_amount));
  }
  return auction;
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
    approved_or_rejected_at: row.approved_or_rejected_at || null,
    moderated_by_admin_id: row.moderated_by_admin_id || null,
    moderated_by: resolveModeratedBy(row),
    resubmitted_at: row.resubmitted_at || null,
    previous_listing_id: row.previous_listing_id || null,
    revision_number: row.revision_number || 1,
    root_listing_id: row.root_listing_id || row.id,
    seller_id: row.seller_id,
    seller_name: sellerDisplayName(row),
    seller_phone: row.seller_phone,
    thumbnail_image: absolutizeImageUrl(baseUrl, row.thumbnail_image),
    sale_type: row.sale_type || 'normal',
    auction: auctionForAdmin(row),
  };
}

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function parseOptionalSellerId(value) {
  if (value == null) return { ok: true, value: null };
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^[1-9]\d*$/.test(trimmed)) return { ok: false };
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false };
  return { ok: true, value: n };
}

/**
 * GET /api/admin/listings
 * Paginated listing browser with search + filters.
 * "All statuses" (no status / status=all) returns every non-deleted *current*
 * listing (revision tips only). Frozen historical snapshots stay out of this
 * table and its counts; open them from revision / moderation history.
 * Pending, Resubmitted, and Updated filters are the moderation queues.
 */
router.get('/', verifyAdminAuth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const seller = typeof req.query.seller === 'string' ? req.query.seller.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const sellerIdParsed = parseOptionalSellerId(req.query.seller_id);
    const saleType = typeof req.query.sale_type === 'string' ? req.query.sale_type.trim() : '';

    if (!sellerIdParsed.ok) {
      return res.status(400).json({
        error: 'Invalid seller_id. Must be a positive integer.',
      });
    }

    if (saleType && saleType !== 'all' && saleType !== 'normal' && saleType !== 'bid') {
      return res.status(400).json({ error: 'Invalid sale_type filter' });
    }

    if (status && status !== 'all') {
      const allowed = Object.values(LISTING_STATUS).filter((s) => s !== LISTING_STATUS.DELETED);
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
    }

    const { rows, totalItems } = await fetchAdminListingList(pool, {
      status,
      brand,
      seller,
      sellerId: sellerIdParsed.value,
      search,
      saleType: saleType === 'normal' || saleType === 'bid' ? saleType : '',
      limit,
      offset,
    });

    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
    const baseUrl = resolveBaseUrl(req);

    res.json({
      items: rows.map((row) => mapListItem(row, baseUrl)),
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

    const listingResult = await fetchAdminListingRowById(pool, id);

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
    const rootId = row.root_listing_id || row.id;

    const historyResult = await pool.query(
      `SELECT
         h.id,
         h.revision_number,
         h.price,
         h.status,
         h.created_at,
         h.resubmitted_at,
         h.decline_reason,
         h.approved_or_rejected_at,
         h.moderated_by_admin_id,
         moderator.full_name AS moderated_by_admin_name,
         ${listingIsTipSql('h')} AS is_current
       FROM listings h
       LEFT JOIN admins moderator ON h.moderated_by_admin_id = moderator.id
       WHERE h.root_listing_id = $1
         AND h.status <> 'deleted'
       ORDER BY h.revision_number DESC`,
      [rootId]
    );

    let previousListing = null;
    if (row.previous_listing_id) {
      const parentResult = await pool.query(
        `SELECT
           p.id,
           p.revision_number,
           p.price,
           p.status,
           p.created_at,
           p.decline_reason,
           p.approved_or_rejected_at,
           p.moderated_by_admin_id,
           moderator.full_name AS moderated_by_admin_name
         FROM listings p
         LEFT JOIN admins moderator ON p.moderated_by_admin_id = moderator.id
         WHERE p.id = $1`,
        [row.previous_listing_id]
      );
      if (parentResult.rows.length > 0) {
        const parent = parentResult.rows[0];
        previousListing = {
          id: parent.id,
          revision_number: parent.revision_number || 1,
          status: parent.status,
          price: parent.price,
          created_at: parent.created_at,
          decline_reason: parent.decline_reason || null,
          approved_or_rejected_at: parent.approved_or_rejected_at || null,
          moderated_by_admin_id: parent.moderated_by_admin_id || null,
          moderated_by: resolveModeratedBy(parent),
        };
      }
    }

    const baseUrl = resolveBaseUrl(req);
    const description =
      row.description_en || row.description_ar || row.description || null;

    const revisionHistory = historyResult.rows.map((h) => ({
      id: h.id,
      revision_number: h.revision_number || 1,
      status: h.status,
      price: h.price,
      created_at: h.created_at,
      resubmitted_at: h.resubmitted_at || null,
      is_current: Boolean(h.is_current),
      is_historical_snapshot: !h.is_current,
      decline_reason: h.decline_reason || null,
      approved_or_rejected_at: h.approved_or_rejected_at || null,
      moderated_by_admin_id: h.moderated_by_admin_id || null,
      moderated_by: resolveModeratedBy(h),
    }));

    res.json({
      listing: {
        id: row.id,
        brand_id: row.brand_id,
        brand_name: row.brand_name,
        model_name: row.model_name,
        category_slug: row.category_slug || null,
        listing_source: row.listing_source || 'catalog',
        capacity_gb: row.capacity_gb,
        storage_display: row.storage_display || null,
        custom_brand_name: row.custom_brand_name || null,
        custom_model_name: row.custom_model_name || null,
        color_name: row.color_name,
        color_display_name: row.color_display_name || row.color_name || null,
        color_hex: row.color_hex,
        case_size_label: row.case_size_label || null,
        watch_connectivity_name: row.watch_connectivity_name || null,
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
        approved_or_rejected_at: row.approved_or_rejected_at || null,
        moderated_by_admin_id: row.moderated_by_admin_id || null,
        moderated_by: resolveModeratedBy(row),
        resubmitted_at: row.resubmitted_at || null,
        previous_listing_id: row.previous_listing_id || null,
        revision_number: row.revision_number || 1,
        root_listing_id: rootId,
        sale_type: row.sale_type || 'normal',
        auction: auctionForAdmin(row),
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
        previous_listing: previousListing,
        revision_history: revisionHistory,
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
router.post(
  '/:id(\\d+)/approve',
  verifyAdminAuth,
  requirePermission(PERMISSIONS.LISTINGS_MODERATE),
  (req, res) =>
    moderateListing(req, res, {
      status: LISTING_STATUS.APPROVED,
      message: 'Listing approved successfully',
    })
);

/**
 * POST /api/admin/listings/:id/decline
 * Admin Web decline — reason required and stored on the listing.
 */
router.post(
  '/:id(\\d+)/decline',
  verifyAdminAuth,
  requirePermission(PERMISSIONS.LISTINGS_MODERATE),
  (req, res) =>
    moderateListing(req, res, {
      status: LISTING_STATUS.DECLINED,
      message: 'Listing declined successfully',
      requireReason: true,
    })
);

/**
 * POST /api/admin/listings/:id/delete
 * Soft-delete an approved listing (status → deleted). Removes it from the
 * marketplace without creating a revision.
 */
router.post(
  '/:id(\\d+)/delete',
  verifyAdminAuth,
  requirePermission(PERMISSIONS.LISTINGS_MODERATE),
  async (req, res) => {
  const { id } = req.params;

  try {
    const current = await pool.query('SELECT id, status FROM listings WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const previousStatus = current.rows[0].status;
    if (previousStatus !== LISTING_STATUS.APPROVED
      && previousStatus !== LISTING_STATUS.PENDING
      && previousStatus !== LISTING_STATUS.RESUBMITTED
      && previousStatus !== LISTING_STATUS.UPDATED) {
      return res.status(409).json({
        error: `Only pending, resubmitted, updated, or approved listings can be deleted from Admin (current: ${previousStatus})`,
      });
    }

    const result = await pool.query(
      `UPDATE listings
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = $3
       RETURNING *`,
      [LISTING_STATUS.DELETED, id, previousStatus]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Listing status changed, please try again' });
    }

    const listing = result.rows[0];

    if (req.adminId) {
      await writeAuditLog({
        adminId: req.adminId,
        action: 'listing.delete',
        entityType: 'listing',
        entityId: listing.id,
        metadata: {
          previous_status: previousStatus,
          new_status: listing.status,
        },
        req,
      });
    }

    res.json({ message: 'Listing deleted successfully', listing });
  } catch (error) {
    console.error('Error deleting listing as admin:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
