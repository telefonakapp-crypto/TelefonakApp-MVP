// Only listings that are live in the marketplace accumulate views.
const { PUBLIC_LISTING_STATUSES: VIEWABLE_LISTING_STATUSES } = require('./listingStatus');

// A viewer can only add one view to the same listing within this window.
const VIEW_COOLDOWN_MINUTES = 30;

/**
 * Registers a view for a listing, honouring the per-viewer cooldown.
 *
 * Viewers are identified by user id when authenticated and by IP otherwise.
 * The listing owner never inflates their own counter.
 *
 * @param {import('pg').Pool} pool
 * @param {{ listingId: number, userId?: number|null, ipAddress?: string|null }} params
 * @returns {Promise<{ found: boolean, isOwner?: boolean, counted?: boolean, views?: number }>}
 */
async function recordListingView(pool, { listingId, userId = null, ipAddress = null }) {
  const listingResult = await pool.query(
    `SELECT id, user_id, status, views,
            EXISTS (
              SELECT 1 FROM listings child WHERE child.previous_listing_id = listings.id
            ) AS is_superseded
     FROM listings WHERE id = $1`,
    [listingId]
  );

  if (listingResult.rows.length === 0) {
    return { found: false };
  }

  const listing = listingResult.rows[0];
  const isOwner = userId !== null && listing.user_id === userId;
  const canCount =
    VIEWABLE_LISTING_STATUSES.includes(listing.status) &&
    !listing.is_superseded &&
    !isOwner &&
    (userId !== null || Boolean(ipAddress));

  if (!canCount) {
    return { found: true, isOwner, counted: false, views: listing.views };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // The upsert only reports a row when the viewer is outside the cooldown,
    // which makes "should this view count" a single atomic decision.
    const cooldownArgs = [listingId, userId !== null ? userId : ipAddress, VIEW_COOLDOWN_MINUTES];
    const marker =
      userId !== null
        ? await client.query(
            `INSERT INTO listing_views (listing_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (listing_id, user_id) WHERE user_id IS NOT NULL
             DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
             WHERE listing_views.viewed_at < CURRENT_TIMESTAMP - make_interval(mins => $3::int)
             RETURNING id`,
            cooldownArgs
          )
        : await client.query(
            `INSERT INTO listing_views (listing_id, ip_address)
             VALUES ($1, $2)
             ON CONFLICT (listing_id, ip_address) WHERE user_id IS NULL
             DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
             WHERE listing_views.viewed_at < CURRENT_TIMESTAMP - make_interval(mins => $3::int)
             RETURNING id`,
            cooldownArgs
          );

    if (marker.rows.length === 0) {
      await client.query('COMMIT');
      return { found: true, isOwner: false, counted: false, views: listing.views };
    }

    const updated = await client.query(
      'UPDATE listings SET views = views + 1 WHERE id = $1 RETURNING views',
      [listingId]
    );

    await client.query('COMMIT');
    return { found: true, isOwner: false, counted: true, views: updated.rows[0].views };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Best-effort client IP for guest cooldowns. X-Forwarded-For is only trusted
 * when TRUST_PROXY is enabled, since clients can set that header themselves.
 */
function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    process.env.TRUST_PROXY === 'true' && typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req.ip || req.socket?.remoteAddress || '';

  // Normalize IPv4-mapped IPv6 (::ffff:127.0.0.1) and fit the column width.
  const normalized = String(raw).trim().replace(/^::ffff:/i, '').slice(0, 45);
  return normalized || null;
}

module.exports = {
  recordListingView,
  resolveClientIp,
  VIEWABLE_LISTING_STATUSES,
  VIEW_COOLDOWN_MINUTES,
};
