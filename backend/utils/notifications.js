/**
 * Notification creation. Every notification in the system is written through
 * this module so titles, messages, and type strings stay consistent.
 *
 * Recipients:
 * - Marketplace customers → notifications.user_id (users table)
 * - Admin Web staff → notifications.admin_id (admins table)
 *
 * Same table, same create helpers — no parallel notification store.
 */

const NOTIFICATION_TYPES = {
  LISTING_APPROVED: 'listing_approved',
  LISTING_LIVE: 'listing_live',
  LISTING_SUBMITTED: 'listing_submitted',
  LISTING_RESUBMITTED: 'listing_resubmitted',
  LISTING_UPDATED: 'listing_updated',
  LISTING_REJECTED: 'listing_rejected',
  LISTING_SOLD: 'listing_sold',
  LISTING_HIDDEN: 'listing_hidden',
  LISTING_ACTIVE: 'listing_active',
  NEW_LISTING: 'new_listing',
  OFFER_RECEIVED: 'offer_received',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_REJECTED: 'offer_rejected',
  SYSTEM: 'system',
};

// Rejections were stored as 'listing_declined' before the type set was
// standardized; existing rows keep that value and clients still render it.
const LEGACY_NOTIFICATION_TYPES = ['listing_declined'];

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   userId?: number|null,
 *   adminId?: number|null,
 *   type: string,
 *   title: string,
 *   message: string,
 *   relatedListingId?: number|null
 * }} notification
 * @returns {Promise<object>} the created row
 */
async function createNotification(
  pool,
  { userId = null, adminId = null, type, title, message, relatedListingId = null }
) {
  if (!userId && !adminId) {
    throw new Error('createNotification requires a userId or adminId');
  }
  if (userId && adminId) {
    throw new Error('createNotification accepts only one of userId or adminId');
  }
  if (!type) throw new Error('createNotification requires a type');
  if (!title) throw new Error('createNotification requires a title');
  if (!message) throw new Error('createNotification requires a message');

  const result = await pool.query(
    `INSERT INTO notifications (user_id, admin_id, related_listing_id, type, title, message)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId || null, adminId || null, relatedListingId, type, title, message]
  );

  const row = result.rows[0];

  // Inbox row is the source of truth for in-app Notifications.
  // OS push is best-effort and must not fail the insert. Preference is
  // enforced inside deliverPushForNotification (backend authority).
  if (userId) {
    const { deliverPushForNotification } = require('./pushDelivery');
    deliverPushForNotification(pool, {
      userId,
      title,
      message,
      data: {
        type,
        notification_id: row.id,
        related_listing_id: relatedListingId,
      },
    }).catch((error) => {
      console.error('Push delivery failed:', error.message);
    });
  }

  return row;
}

/**
 * Notifications are never important enough to fail the action that triggered
 * them, so route handlers use this wrapper instead of createNotification.
 */
async function safeCreateNotification(pool, notification) {
  try {
    return await createNotification(pool, notification);
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
}

/** "Apple iPhone 15 Pro", or null when the listing or its catalog rows are gone. */
async function getListingDeviceName(pool, listingId) {
  const { formatListingDeviceName } = require('./listingCustom');
  const result = await pool.query(
    `SELECT COALESCE(b.name, l.custom_brand_name) AS brand_name,
            COALESCE(m.name, l.custom_model_name) AS model_name
     FROM listings l
     LEFT JOIN models m ON l.model_id = m.id
     LEFT JOIN brands b ON m.brand_id = b.id
     WHERE l.id = $1`,
    [listingId]
  );

  if (result.rows.length === 0) return null;
  const { brand_name, model_name } = result.rows[0];
  return formatListingDeviceName(brand_name, model_name);
}

const describeListing = (deviceName) => (deviceName ? `"${deviceName}"` : 'listing');

function notifyListingApproved(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_APPROVED,
    title: 'Listing Approved',
    message: `Your listing ${describeListing(deviceName)} has been approved and is now live.`,
  });
}

/**
 * Auto-approve path: listing was never pending, so avoid "has been approved" copy.
 */
function notifyListingLive(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_LIVE,
    title: 'Listing Live',
    message: `Your listing ${describeListing(deviceName)} is now live.`,
  });
}

/**
 * Manual-moderation path: listing created as pending — tell the seller it awaits review.
 */
function notifyListingSubmitted(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_SUBMITTED,
    title: 'Listing Submitted',
    message: `Your listing ${describeListing(deviceName)} has been submitted and is awaiting approval.`,
  });
}

/**
 * Seller edited a previously declined listing — awaiting another admin review.
 * Distinct from Listing Submitted so first-time and re-review paths stay separate.
 */
function notifyListingResubmitted(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_RESUBMITTED,
    title: 'Listing Resubmitted',
    message: 'Your listing has been resubmitted for review.',
  });
}

/**
 * Seller edited a previously approved listing — awaiting another admin review.
 * Distinct from resubmitted so declined re-submits and live-listing edits stay separate.
 */
function notifyListingUpdated(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_UPDATED,
    title: 'Listing Updated',
    message: 'Your listing has been updated and is awaiting review.',
  });
}

function notifyListingRejected(pool, { userId, listingId, deviceName, reason }) {
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  const reasonText = trimmedReason ? ` Reason: ${trimmedReason}` : '';

  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_REJECTED,
    title: 'Listing Rejected',
    message: `Your listing ${describeListing(deviceName)} was rejected.${reasonText}`,
  });
}

/**
 * Seller notice when an already-live (approved) listing is pulled for policy.
 * Distinct copy from queue rejection — the listing was on the marketplace.
 */
function notifyListingDeclinedFromApproved(pool, { userId, listingId, reason }) {
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  const reasonBlock = trimmedReason ? ` Reason: ${trimmedReason}` : '';

  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_REJECTED,
    title: 'Listing Declined',
    message: `Your listing has been removed from the marketplace because it no longer meets our listing guidelines.${reasonBlock}`,
  });
}

function notifyListingSold(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_SOLD,
    title: 'Listing Sold',
    message: `Congratulations! Your listing ${describeListing(deviceName)} has been marked as sold.`,
  });
}

function notifyListingHidden(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_HIDDEN,
    title: 'Listing Hidden',
    message: `Your listing ${describeListing(deviceName)} has been hidden and is no longer visible to buyers.`,
  });
}

function notifyListingActive(pool, { userId, listingId, deviceName }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.LISTING_ACTIVE,
    title: 'Listing Active',
    message: `Your listing ${describeListing(deviceName)} is visible to buyers again.`,
  });
}

/** "600" for 600.00, "600.50" for 600.50 — prices read better without dead decimals. */
function formatPrice(price) {
  const numeric = Number(price);
  if (!Number.isFinite(numeric)) return String(price);
  return numeric % 1 === 0 ? String(numeric) : numeric.toFixed(2);
}

function notifyOfferReceived(pool, { sellerId, listingId, deviceName, offeredPrice }) {
  return safeCreateNotification(pool, {
    userId: sellerId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.OFFER_RECEIVED,
    title: 'New Offer',
    message: `You received an offer of ${formatPrice(offeredPrice)} JOD for your listing ${describeListing(deviceName)}.`,
  });
}

function notifyOfferAccepted(pool, { buyerId, listingId, deviceName, offeredPrice }) {
  return safeCreateNotification(pool, {
    userId: buyerId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.OFFER_ACCEPTED,
    title: 'Offer Accepted',
    message: `Your offer of ${formatPrice(offeredPrice)} JOD for ${describeListing(deviceName)} has been accepted.`,
  });
}

function notifyOfferRejected(pool, { buyerId, listingId, deviceName, offeredPrice }) {
  return safeCreateNotification(pool, {
    userId: buyerId,
    relatedListingId: listingId,
    type: NOTIFICATION_TYPES.OFFER_REJECTED,
    title: 'Offer Declined',
    message: `Your offer of ${formatPrice(offeredPrice)} JOD for ${describeListing(deviceName)} was declined.`,
  });
}

/** Generic entry point for any future backend code that needs to tell a user something. */
function notifySystem(pool, { userId, title, message, relatedListingId = null }) {
  return safeCreateNotification(pool, {
    userId,
    relatedListingId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title,
    message,
  });
}

function formatSubmittedAt(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return String(value);
  }
}

function buildNewListingAdminMessage({
  listingId,
  sellerName,
  brandName,
  modelName,
  deviceName,
  price,
  submittedAt,
}) {
  const device =
    [brandName, modelName].filter(Boolean).join(' ').trim() ||
    deviceName ||
    null;
  const lines = [`Listing #${listingId} is pending approval.`];

  if (sellerName) lines.push(`Seller: ${sellerName}`);
  if (device) lines.push(`Device: ${device}`);
  if (price !== undefined && price !== null) {
    lines.push(`Price: ${formatPrice(price)} JOD`);
  }
  const when = formatSubmittedAt(submittedAt);
  if (when) lines.push(`Submitted: ${when}`);

  return lines.join('\n');
}

/**
 * Moderation queue heads-up for every active Admin Web staff member.
 * Targets active Admin Web staff (admins.is_active = true).
 * Does not use the legacy mobile OTP admin flag.
 */
async function notifyAdminsOfNewListing(
  pool,
  {
    listingId,
    deviceName,
    brandName,
    modelName,
    price,
    sellerName,
    submittedAt,
    title = 'New Listing Pending Approval',
  }
) {
  try {
    const admins = await pool.query(
      'SELECT id FROM admins WHERE is_active = TRUE'
    );

    if (admins.rows.length === 0) {
      return;
    }

    const message = buildNewListingAdminMessage({
      listingId,
      sellerName,
      brandName,
      modelName,
      deviceName,
      price,
      submittedAt,
    });

    await Promise.all(
      admins.rows.map((admin) =>
        safeCreateNotification(pool, {
          adminId: admin.id,
          relatedListingId: listingId,
          type: NOTIFICATION_TYPES.NEW_LISTING,
          title,
          message,
        })
      )
    );
  } catch (error) {
    console.error('Error creating admin notifications:', error.message);
  }
}

module.exports = {
  NOTIFICATION_TYPES,
  LEGACY_NOTIFICATION_TYPES,
  createNotification,
  safeCreateNotification,
  getListingDeviceName,
  notifyListingApproved,
  notifyListingLive,
  notifyListingSubmitted,
  notifyListingResubmitted,
  notifyListingUpdated,
  notifyListingRejected,
  notifyListingDeclinedFromApproved,
  notifyListingSold,
  notifyListingHidden,
  notifyListingActive,
  notifyOfferReceived,
  notifyOfferAccepted,
  notifyOfferRejected,
  notifySystem,
  notifyAdminsOfNewListing,
  formatPrice,
  buildNewListingAdminMessage,
};
