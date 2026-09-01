/**
 * Closed listing SELECT helpers.
 *
 * Each function has fixed SELECT/FROM/JOIN/WHERE semantics.
 * Do not add a generic scope switch or caller-supplied SQL.
 * Catalog join/name fragments come from listingCatalog.js — do not copy them here.
 */

const {
  LISTING_WATCH_SELECT_FIELDS,
  LISTING_WATCH_JOINS,
  LISTING_STORAGE_JOIN,
  LISTING_COLOR_SELECT_FIELDS,
  LISTING_COLOR_JOINS,
  LISTING_IDENTITY_JOINS,
  LISTING_BRAND_NAME_SQL,
  LISTING_MODEL_NAME_SQL,
  LISTING_STORAGE_DISPLAY_SQL,
  LISTING_SIM_NAME_SQL,
} = require('./listingCatalog');
const {
  LISTING_STATUS,
  PUBLIC_LISTING_STATUSES,
  LISTING_IS_TIP_SQL,
  isPublicListingStatus,
} = require('./listingStatus');
const {
  normalizeMarketplaceSearch,
  buildMarketplaceSearchClause,
} = require('./marketplaceSearch');

const THUMBNAIL_SQL = `(SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1)`;

const MARKETPLACE_ORDER_BY = {
  newest: 'l.created_at DESC',
  oldest: 'l.created_at ASC',
  price_asc: 'l.price ASC, l.created_at DESC',
  price_desc: 'l.price DESC, l.created_at DESC',
  lowest_price: 'l.price ASC, l.created_at DESC',
  highest_price: 'l.price DESC, l.created_at DESC',
};

const ADMIN_LIST_SELECT = `
  l.id,
  l.price,
  l.status,
  l.created_at,
  l.updated_at,
  l.battery_percentage,
  l.location,
  l.decline_reason,
  l.approved_or_rejected_at,
  l.moderated_by_admin_id,
  l.resubmitted_at,
  l.previous_listing_id,
  l.revision_number,
  l.root_listing_id,
  moderator.full_name AS moderated_by_admin_name,
  ${LISTING_MODEL_NAME_SQL} AS model_name,
  b.id AS brand_id,
  ${LISTING_BRAND_NAME_SQL} AS brand_name,
  s.capacity_gb,
  ${LISTING_STORAGE_DISPLAY_SQL} AS storage_display,
  ${LISTING_COLOR_SELECT_FIELDS},
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

const ADMIN_LIST_FROM = `
  FROM listings l
  ${LISTING_IDENTITY_JOINS}
  ${LISTING_STORAGE_JOIN}
  ${LISTING_COLOR_JOINS}
  JOIN conditions cond ON l.condition_id = cond.id
  JOIN users u ON l.user_id = u.id
  LEFT JOIN cities city ON l.city_id = city.id
  LEFT JOIN areas area ON l.area_id = area.id
  LEFT JOIN admins moderator ON l.moderated_by_admin_id = moderator.id
`;

function pushParam(queryParams, value) {
  queryParams.push(value);
  return queryParams.length;
}

/**
 * P1 — public marketplace cards.
 * Status must already be a public listing status (route validates).
 * Filter values are structured query fields, not raw SQL.
 */
async function fetchMarketplaceListings(pool, filters = {}) {
  const status = filters.status;
  if (!isPublicListingStatus(status)) {
    throw new Error('fetchMarketplaceListings only accepts public listing statuses');
  }

  const search = filters.search ?? '';
  const category_id = filters.category_id ?? '';
  const brand_id = filters.brand_id ?? '';
  const model_id = filters.model_id ?? '';
  const model_storage_id = filters.model_storage_id ?? '';
  const model_color_id = filters.model_color_id ?? '';
  const model_watch_case_size_id = filters.model_watch_case_size_id ?? '';
  const model_watch_connectivity_id = filters.model_watch_connectivity_id ?? '';
  const storage_id = filters.storage_id ?? '';
  const color_id = filters.color_id ?? '';
  const condition_id = filters.condition_id ?? '';
  const min_price = filters.min_price ?? '';
  const max_price = filters.max_price ?? '';
  const min_battery = filters.min_battery ?? '';
  const max_battery = filters.max_battery ?? '';
  const city_id = filters.city_id ?? '';
  const area_id = filters.area_id ?? '';
  const sort = filters.sort ?? 'newest';
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const whereConditions = ['l.status = $1', LISTING_IS_TIP_SQL];
  const queryParams = [status];

  const add = (value) => pushParam(queryParams, value);

  if (search && String(search).trim()) {
    const normalizedSearch = normalizeMarketplaceSearch(search);
    const searchClause = buildMarketplaceSearchClause(normalizedSearch, add);
    if (searchClause) {
      whereConditions.push(searchClause);
    }
  }

  if (category_id && String(category_id).trim()) {
    const i = add(parseInt(category_id, 10));
    whereConditions.push(`COALESCE(l.category_id, m.category_id) = $${i}`);
  }

  if (brand_id && String(brand_id).trim()) {
    const i = add(parseInt(brand_id, 10));
    whereConditions.push(`b.id = $${i}`);
  }

  if (model_id && String(model_id).trim()) {
    const i = add(parseInt(model_id, 10));
    whereConditions.push(`m.id = $${i}`);
  }

  // Catalog-aware storage filter (preferred).
  // INNER JOIN storage_options here only resolves the chosen filter's
  // capacity to a storage_options.id. It does not join listings, so
  // smartwatches with NULL storage_id remain visible unless this filter
  // is applied.
  if (model_storage_id && String(model_storage_id).trim()) {
    const i = add(parseInt(model_storage_id, 10));
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
    const i = add(parseInt(storage_id, 10));
    whereConditions.push(`l.storage_id = $${i}`);
  }

  // Catalog-aware color filter (preferred)
  if (model_color_id && String(model_color_id).trim()) {
    const i = add(parseInt(model_color_id, 10));
    whereConditions.push(`(
          l.model_color_id = $${i}
          OR (
            l.model_color_id IS NULL
            AND l.color_id = (SELECT mc.color_id FROM model_colors mc WHERE mc.id = $${i})
          )
        )`);
  } else if (color_id && String(color_id).trim()) {
    const i = add(parseInt(color_id, 10));
    whereConditions.push(`l.color_id = $${i}`);
  }

  if (model_watch_case_size_id && String(model_watch_case_size_id).trim()) {
    const i = add(parseInt(model_watch_case_size_id, 10));
    whereConditions.push(`l.model_watch_case_size_id = $${i}`);
  }

  if (model_watch_connectivity_id && String(model_watch_connectivity_id).trim()) {
    const i = add(parseInt(model_watch_connectivity_id, 10));
    whereConditions.push(`l.model_watch_connectivity_id = $${i}`);
  }

  if (condition_id && String(condition_id).trim()) {
    const i = add(parseInt(condition_id, 10));
    whereConditions.push(`l.condition_id = $${i}`);
  }

  if (min_price !== undefined && String(min_price).trim() !== '') {
    const i = add(parseFloat(min_price));
    whereConditions.push(`l.price >= $${i}`);
  }

  if (max_price !== undefined && String(max_price).trim() !== '') {
    const i = add(parseFloat(max_price));
    whereConditions.push(`l.price <= $${i}`);
  }

  if (min_battery !== undefined && String(min_battery).trim() !== '') {
    const i = add(parseInt(min_battery, 10));
    whereConditions.push(`l.battery_percentage IS NOT NULL AND l.battery_percentage >= $${i}`);
  }

  if (max_battery !== undefined && String(max_battery).trim() !== '') {
    const i = add(parseInt(max_battery, 10));
    whereConditions.push(`l.battery_percentage IS NOT NULL AND l.battery_percentage <= $${i}`);
  }

  if (city_id && String(city_id).trim()) {
    const i = add(parseInt(city_id, 10));
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
    const i = add(parseInt(area_id, 10));
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
  const orderBy = MARKETPLACE_ORDER_BY[sortKey] || MARKETPLACE_ORDER_BY.newest;

  const whereClause = whereConditions.join(' AND ');
  const limitIdx = add(parseInt(limit, 10));
  const offsetIdx = add(parseInt(offset, 10));

  return pool.query(
    `SELECT
          l.*,
          ${LISTING_MODEL_NAME_SQL} as model_name,
          m.category_id,
          ${LISTING_BRAND_NAME_SQL} as brand_name,
          s.capacity_gb,
          ${LISTING_STORAGE_DISPLAY_SQL} as storage_display,
          ${LISTING_COLOR_SELECT_FIELDS},
          cond.name as condition_name,
          ${LISTING_WATCH_SELECT_FIELDS},
          u.first_name,
          u.last_name,
          city.name_en as city_name,
          area.name_en as area_name,
          ${THUMBNAIL_SQL} as thumbnail_image
         FROM listings l
         ${LISTING_IDENTITY_JOINS}
         ${LISTING_STORAGE_JOIN}
         ${LISTING_COLOR_JOINS}
         JOIN conditions cond ON l.condition_id = cond.id
         ${LISTING_WATCH_JOINS}
         JOIN users u ON l.user_id = u.id
         LEFT JOIN cities city ON l.city_id = city.id
         LEFT JOIN areas area ON l.area_id = area.id
         WHERE ${whereClause}
         ORDER BY ${orderBy}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    queryParams
  );
}

/**
 * P2 — authenticated owner's listings (all statuses, revision tips only).
 */
function fetchOwnerMyListings(pool, userId) {
  return pool.query(
    `SELECT 
        l.*,
        ${LISTING_MODEL_NAME_SQL} as model_name,
        ${LISTING_BRAND_NAME_SQL} as brand_name,
        s.capacity_gb,
          ${LISTING_STORAGE_DISPLAY_SQL} as storage_display,
        ${LISTING_COLOR_SELECT_FIELDS},
        cond.name as condition_name,
        ${LISTING_WATCH_SELECT_FIELDS},
        ${THUMBNAIL_SQL} as thumbnail_image
       FROM listings l
       ${LISTING_IDENTITY_JOINS}
       ${LISTING_STORAGE_JOIN}
       ${LISTING_COLOR_JOINS}
       JOIN conditions cond ON l.condition_id = cond.id
       ${LISTING_WATCH_JOINS}
       WHERE l.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM listings child
           WHERE child.previous_listing_id = l.id
         )
       ORDER BY l.created_at DESC`,
    [userId]
  );
}

/**
 * F1 — current user's saved public listings.
 */
function fetchFavoriteListings(pool, userId, { limit, offset } = {}) {
  const safeLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  return pool.query(
    `SELECT
         l.*,
         f.created_at AS favorited_at,
         ${LISTING_MODEL_NAME_SQL}  AS model_name,
         COALESCE(l.category_id, m.category_id) AS category_id,
         ${LISTING_BRAND_NAME_SQL}  AS brand_name,
         s.capacity_gb,
         ${LISTING_COLOR_SELECT_FIELDS},
         cond.name AS condition_name,
         ${LISTING_WATCH_SELECT_FIELDS},
         u.first_name,
         u.last_name,
         city.name_en AS city_name,
         area.name_en AS area_name,
         ${THUMBNAIL_SQL} AS thumbnail_image
       FROM favorites f
       JOIN listings l ON l.id = f.listing_id
       ${LISTING_IDENTITY_JOINS}
       ${LISTING_STORAGE_JOIN}
       ${LISTING_COLOR_JOINS}
       JOIN conditions cond ON l.condition_id = cond.id
       ${LISTING_WATCH_JOINS}
       JOIN users u ON l.user_id = u.id
       LEFT JOIN cities city ON l.city_id = city.id
       LEFT JOIN areas area ON l.area_id = area.id
       WHERE f.user_id = $1
         AND l.status = ANY($2::text[])
         AND ${LISTING_IS_TIP_SQL}
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
    [userId, PUBLIC_LISTING_STATUSES, safeLimit, safeOffset]
  );
}

/**
 * P3 — single listing row by id. No status/owner WHERE.
 * The route retains the public-vs-owner visibility gate.
 */
function fetchListingRowById(pool, id) {
  return pool.query(
    `SELECT 
        l.*,
        ${LISTING_MODEL_NAME_SQL} as model_name,
        m.brand_id as brand_id,
        m.release_year,
        m.chipset,
        m.screen_size,
        cat.slug as category_slug,
        ${LISTING_BRAND_NAME_SQL} as brand_name,
        s.capacity_gb,
          ${LISTING_STORAGE_DISPLAY_SQL} as storage_display,
        ${LISTING_COLOR_SELECT_FIELDS},
        cond.name as condition_name,
        ${LISTING_SIM_NAME_SQL} as sim_configuration_name,
        ${LISTING_WATCH_SELECT_FIELDS},
        u.first_name,
        u.last_name,
        u.phone_number,
        city.name_en AS city_name_en,
        city.name_ar AS city_name_ar,
        area.name_en AS area_name_en,
        area.name_ar AS area_name_ar
       FROM listings l
       ${LISTING_IDENTITY_JOINS}
       ${LISTING_STORAGE_JOIN}
       ${LISTING_COLOR_JOINS}
       JOIN conditions cond ON l.condition_id = cond.id
       LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
       ${LISTING_WATCH_JOINS}
       JOIN users u ON l.user_id = u.id
       LEFT JOIN cities city ON l.city_id = city.id
       LEFT JOIN areas area ON l.area_id = area.id
       WHERE l.id = $1`,
    [id]
  );
}

/**
 * W1/W2/W3 — listing row after create/update.
 * Closed options only: withSellerNames, withBrandId.
 */
function fetchListingRowAfterWrite(pool, id, options = {}) {
  const withSellerNames = options.withSellerNames === true;
  const withBrandId = options.withBrandId === true;

  const brandIdSql = withBrandId ? `m.brand_id as brand_id,\n          ` : '';
  const sellerSelectSql = withSellerNames
    ? `,
          u.first_name as seller_first_name,
          u.last_name as seller_last_name`
    : '';
  const sellerJoinSql = withSellerNames ? `\n         JOIN users u ON u.id = l.user_id` : '';

  return pool.query(
    `SELECT 
          l.*,
          ${LISTING_MODEL_NAME_SQL} as model_name,
          ${brandIdSql}${LISTING_BRAND_NAME_SQL} as brand_name,
          s.capacity_gb,
          ${LISTING_STORAGE_DISPLAY_SQL} as storage_display,
          ${LISTING_COLOR_SELECT_FIELDS},
          cond.name as condition_name,
          ${LISTING_SIM_NAME_SQL} as sim_configuration_name,
          ${LISTING_WATCH_SELECT_FIELDS}${sellerSelectSql}
         FROM listings l
         ${LISTING_IDENTITY_JOINS}
         ${LISTING_STORAGE_JOIN}
         ${LISTING_COLOR_JOINS}
         JOIN conditions cond ON l.condition_id = cond.id
         LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
         ${LISTING_WATCH_JOINS}${sellerJoinSql}
         WHERE l.id = $1`,
    [id]
  );
}

/**
 * A1 — admin current-listing list + count.
 * Always excludes deleted rows and non-tips. Never for customer routes.
 */
async function fetchAdminListingList(pool, filters = {}) {
  const status = typeof filters.status === 'string' ? filters.status.trim() : '';
  const brand = typeof filters.brand === 'string' ? filters.brand.trim() : '';
  const seller = typeof filters.seller === 'string' ? filters.seller.trim() : '';
  const search = normalizeMarketplaceSearch(filters.search);
  const limit = filters.limit;
  const offset = filters.offset;

  const params = [];
  const where = ["l.status <> 'deleted'", LISTING_IS_TIP_SQL];

  const add = (value) => pushParam(params, value);

  if (status && status !== 'all') {
    where.push(`l.status = $${add(status)}`);
  }

  if (brand) {
    if (/^\d+$/.test(brand)) {
      where.push(`b.id = $${add(parseInt(brand, 10))}`);
    } else {
      where.push(`b.name ILIKE $${add(`%${brand.replace(/[%_\\]/g, '')}%`)}`);
    }
  }

  if (seller) {
    const sellerPattern = `%${seller.replace(/[%_\\]/g, '')}%`;
    const idx = add(sellerPattern);
    where.push(`(
        u.first_name ILIKE $${idx}
        OR u.last_name ILIKE $${idx}
        OR (u.first_name || ' ' || u.last_name) ILIKE $${idx}
        OR u.phone_number ILIKE $${idx}
      )`);
  }

  const searchClause = buildMarketplaceSearchClause(search, add);
  if (searchClause) {
    where.push(searchClause);
  }

  const whereSql = where.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
       ${ADMIN_LIST_FROM}
       WHERE ${whereSql}`,
    params
  );

  const totalItems = countResult.rows[0].total;
  const limitIdx = add(limit);
  const offsetIdx = add(offset);

  const isAllStatuses = !status || status === 'all';
  const orderBySql = isAllStatuses
    ? `ORDER BY l.created_at DESC, l.id DESC`
    : status === LISTING_STATUS.RESUBMITTED
      ? `ORDER BY COALESCE(l.resubmitted_at, l.created_at) DESC NULLS LAST, l.id DESC`
      : status === LISTING_STATUS.UPDATED
        ? `ORDER BY COALESCE(l.updated_at, l.created_at) DESC NULLS LAST, l.id DESC`
        : `ORDER BY COALESCE(l.approved_or_rejected_at, l.updated_at, l.created_at) DESC NULLS LAST, l.id DESC`;

  const listResult = await pool.query(
    `SELECT ${ADMIN_LIST_SELECT}
       ${ADMIN_LIST_FROM}
       WHERE ${whereSql}
       ${orderBySql}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return { rows: listResult.rows, totalItems };
}

/**
 * A2 — admin listing detail row by id. No customer visibility gate.
 */
function fetchAdminListingRowById(pool, id) {
  return pool.query(
    `SELECT
         l.*,
         ${LISTING_MODEL_NAME_SQL} AS model_name,
         m.brand_id AS brand_id,
         m.release_year,
         m.chipset,
         m.screen_size,
         cat.slug AS category_slug,
         ${LISTING_BRAND_NAME_SQL} AS brand_name,
         s.capacity_gb,
         ${LISTING_STORAGE_DISPLAY_SQL} AS storage_display,
         ${LISTING_COLOR_SELECT_FIELDS},
         cond.name AS condition_name,
         ${LISTING_SIM_NAME_SQL} AS sim_configuration_name,
         ${LISTING_WATCH_SELECT_FIELDS},
         u.id AS seller_id,
         u.first_name AS seller_first_name,
         u.last_name AS seller_last_name,
         u.phone_number AS seller_phone,
         city.name_en AS city_name,
         area.name_en AS area_name,
         moderator.full_name AS moderated_by_admin_name
       FROM listings l
       ${LISTING_IDENTITY_JOINS}
       ${LISTING_STORAGE_JOIN}
       ${LISTING_COLOR_JOINS}
       JOIN conditions cond ON l.condition_id = cond.id
       LEFT JOIN sim_configurations sim ON l.sim_configuration_id = sim.id
       ${LISTING_WATCH_JOINS}
       JOIN users u ON l.user_id = u.id
       LEFT JOIN cities city ON l.city_id = city.id
       LEFT JOIN areas area ON l.area_id = area.id
       LEFT JOIN admins moderator ON l.moderated_by_admin_id = moderator.id
       WHERE l.id = $1`,
    [id]
  );
}

module.exports = {
  fetchMarketplaceListings,
  fetchOwnerMyListings,
  fetchFavoriteListings,
  fetchListingRowById,
  fetchListingRowAfterWrite,
  fetchAdminListingList,
  fetchAdminListingRowById,
};
