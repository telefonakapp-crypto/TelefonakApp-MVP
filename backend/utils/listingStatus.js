/**
 * The listing status set, matching the CHECK constraint in
 * database/listing_updated_status.sql (supersedes standardize + resubmitted).
 *
 * Lifecycle (per snapshot row):
 *   pending → approved → sold | deleted | declined | updated
 *   pending → declined | deleted
 *   resubmitted → approved | declined
 *   updated → approved | declined
 *   approved → declined   (admin policy revoke; same row, no revision)
 *   approved → updated    (seller edits a live listing; awaits moderation)
 *   approved → bid_duration_ended  (automatic Bid auction duration completion)
 *   approved ⇄ hidden   (seller hides / unhides their own listing)
 *
 * Declined is terminal for that snapshot. Editing a declined tip inserts a new
 * listing row (status = resubmitted) linked via previous_listing_id /
 * root_listing_id / revision_number — the declined parent is never mutated.
 *
 * Seller-edit next status is always derived from the CURRENT moderation status:
 *   declined → resubmitted
 *   approved → updated
 *   resubmitted stays resubmitted (in-place)
 *   updated stays updated (in-place)
 *
 * sold, deleted, and bid_duration_ended are terminal: nothing moves a listing
 * out of them, which is what makes "mark as sold" and automatic Bid completion
 * historical rather than editable.
 *
 * PUBLIC_LISTING_STATUSES is the one definition of "a buyer may see this",
 * so a new status is invisible to the marketplace, search, favorites, view
 * counting, and listing details until it is deliberately listed here.
 */

const { getSetting } = require('./settings');

const LISTING_STATUS = {
  PENDING: 'pending',
  RESUBMITTED: 'resubmitted',
  UPDATED: 'updated',
  APPROVED: 'approved',
  DECLINED: 'declined',
  SOLD: 'sold',
  HIDDEN: 'hidden',
  DELETED: 'deleted',
  BID_DURATION_ENDED: 'bid_duration_ended',
};

// A live listing is the only thing a buyer may reach. Sold listings leave the
// marketplace for good and stay readable to their owner as selling history.
const PUBLIC_LISTING_STATUSES = [LISTING_STATUS.APPROVED];

// Statuses no transition may leave. Guards moderation against reopening a deal.
const TERMINAL_LISTING_STATUSES = [
  LISTING_STATUS.SOLD,
  LISTING_STATUS.DELETED,
  LISTING_STATUS.BID_DURATION_ENDED,
];

// Awaiting admin review (brand-new, declined re-submit, or approved edit).
const MODERATION_QUEUE_STATUSES = [
  LISTING_STATUS.RESUBMITTED,
  LISTING_STATUS.UPDATED,
  LISTING_STATUS.PENDING,
];

const isPublicListingStatus = (status) => PUBLIC_LISTING_STATUSES.includes(status);

const isTerminalListingStatus = (status) => TERMINAL_LISTING_STATUSES.includes(status);

const isModerationQueueStatus = (status) => MODERATION_QUEUE_STATUSES.includes(status);

/**
 * SQL fragment: listing `alias` is the live/current tip.
 * Historical snapshots (including frozen approved-edit copies) have a newer
 * row whose previous_listing_id points at them and must not appear in
 * current listing lists, counts, marketplace, or favorites.
 */
function listingIsTipSql(alias = 'l') {
  return `NOT EXISTS (
  SELECT 1 FROM listings child WHERE child.previous_listing_id = ${alias}.id
)`;
}

const LISTING_IS_TIP_SQL = listingIsTipSql('l');

/**
 * Next listing status after a seller submits an edit, based on current status.
 *
 * Returns null for statuses that still use auto-approve / pending
 * (new pending edits, hidden, etc.).
 *
 * @param {string} previousStatus
 * @returns {string|null}
 */
function resolveSellerEditNextStatus(previousStatus) {
  if (previousStatus === LISTING_STATUS.DECLINED) {
    return LISTING_STATUS.RESUBMITTED;
  }
  if (previousStatus === LISTING_STATUS.APPROVED) {
    return LISTING_STATUS.UPDATED;
  }
  if (previousStatus === LISTING_STATUS.RESUBMITTED) {
    return LISTING_STATUS.RESUBMITTED;
  }
  if (previousStatus === LISTING_STATUS.UPDATED) {
    return LISTING_STATUS.UPDATED;
  }
  return null;
}

/**
 * Initial / post-edit moderation status from the live Admin setting.
 * Reads settings on every call so toggles apply without a server restart.
 *
 * Note: editing a declined tip always creates a new resubmitted snapshot
 * (never auto-approved). Editing an approved listing always becomes updated
 * (never auto-approved). In-place edits of resubmitted/updated tips keep
 * that queue status. Other edits use this helper.
 *
 * @returns {Promise<'pending'|'approved'>}
 */
async function resolveListingModerationStatus(client) {
  const autoApprove = await getSetting('auto_approve_listings', client);
  return autoApprove === true
    ? LISTING_STATUS.APPROVED
    : LISTING_STATUS.PENDING;
}

module.exports = {
  LISTING_STATUS,
  PUBLIC_LISTING_STATUSES,
  TERMINAL_LISTING_STATUSES,
  MODERATION_QUEUE_STATUSES,
  isPublicListingStatus,
  isTerminalListingStatus,
  isModerationQueueStatus,
  listingIsTipSql,
  LISTING_IS_TIP_SQL,
  resolveSellerEditNextStatus,
  resolveListingModerationStatus,
};
