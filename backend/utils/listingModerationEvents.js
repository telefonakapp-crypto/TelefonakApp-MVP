/**
 * Append-only listing moderation activity.
 * Current listings.status is independent of these rows.
 */
const { LISTING_STATUS } = require('./listingStatus');

const EVENT_TYPE = {
  CREATED: 'created',
  PENDING: 'pending',
  DECLINED: 'declined',
  RESUBMITTED: 'resubmitted',
  APPROVED: 'approved',
  UPDATED: 'updated',
};

async function recordListingModerationEvent(clientOrPool, event) {
  const {
    eventType,
    listingId,
    previousListingId = null,
    rootListingId,
    userId,
    previousStatus = null,
    newStatus,
    price = null,
    declineReason = null,
    moderatedByAdminId = null,
    occurredAt = null,
    metadata = {},
  } = event;

  if (!eventType || !listingId || !rootListingId || !userId || !newStatus) {
    throw new Error('recordListingModerationEvent missing required fields');
  }

  const result = await clientOrPool.query(
    `INSERT INTO listing_moderation_events (
       event_type, listing_id, previous_listing_id, root_listing_id, user_id,
       previous_status, new_status, price, decline_reason, moderated_by_admin_id,
       occurred_at, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       COALESCE($11::timestamp, CURRENT_TIMESTAMP),
       $12::jsonb
     )
     RETURNING *`,
    [
      eventType,
      listingId,
      previousListingId,
      rootListingId,
      userId,
      previousStatus,
      newStatus,
      price,
      declineReason,
      moderatedByAdminId,
      occurredAt,
      JSON.stringify(metadata || {}),
    ]
  );

  return result.rows[0];
}

/**
 * Freeze the current listing row as an immutable revision snapshot.
 * The original id stays the live tip; the returned row is the previous version.
 */
async function freezeCurrentListingRevision(client, listingId, userId) {
  const result = await client.query(
    `INSERT INTO listings (
       user_id, model_id, storage_id, color_id, model_storage_id, model_color_id,
       sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
       condition_id, battery_percentage, price, description, description_en, description_ar,
       description_ar_is_auto_translated, location, city_id, area_id, status, decline_reason,
       approved_or_rejected_at, moderated_by_admin_id, resubmitted_at,
       previous_listing_id, revision_number, root_listing_id, views, created_at, updated_at,
       category_id, listing_source, custom_brand_name, custom_model_name, custom_storage,
       custom_color_name, custom_sim_configuration, custom_case_size, custom_connectivity
     )
     SELECT
       user_id, model_id, storage_id, color_id, model_storage_id, model_color_id,
       sim_configuration_id, model_watch_case_size_id, model_watch_connectivity_id,
       condition_id, battery_percentage, price, description, description_en, description_ar,
       description_ar_is_auto_translated, location, city_id, area_id, status, decline_reason,
       approved_or_rejected_at, moderated_by_admin_id, resubmitted_at,
       previous_listing_id, revision_number, root_listing_id, views, created_at, updated_at,
       category_id, listing_source, custom_brand_name, custom_model_name, custom_storage,
       custom_color_name, custom_sim_configuration, custom_case_size, custom_connectivity
     FROM listings
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [listingId, userId]
  );

  return result.rows[0] || null;
}

function parseMonthRange(monthParam) {
  const now = new Date();
  let year = now.getFullYear();
  let monthNumber = now.getMonth() + 1;

  if (typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam.trim())) {
    const [y, m] = monthParam.trim().split('-').map((part) => parseInt(part, 10));
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
      year = y;
      monthNumber = m;
    }
  }

  const month = `${year}-${String(monthNumber).padStart(2, '0')}`;
  const startDate = `${month}-01`;
  return { month, startDate, year, monthNumber };
}

module.exports = {
  EVENT_TYPE,
  LISTING_STATUS,
  recordListingModerationEvent,
  freezeCurrentListingRevision,
  parseMonthRange,
};
