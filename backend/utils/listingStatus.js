/**
 * The listing status set, matching the CHECK constraint in
 * database/standardize_listing_status.sql.
 *
 * Lifecycle:
 *   pending → approved → sold | deleted
 *   pending → declined | deleted
 *   approved ⇄ hidden   (seller hides / unhides their own listing)
 *
 * sold and deleted are terminal: nothing moves a listing out of them, which is
 * what makes "mark as sold" permanent.
 *
 * PUBLIC_LISTING_STATUSES is the one definition of "a buyer may see this",
 * so a new status is invisible to the marketplace, search, favorites, view
 * counting, and listing details until it is deliberately listed here.
 */

const LISTING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
  SOLD: 'sold',
  HIDDEN: 'hidden',
  DELETED: 'deleted',
};

// A live listing is the only thing a buyer may reach. Sold listings leave the
// marketplace for good and stay readable to their owner as selling history.
const PUBLIC_LISTING_STATUSES = [LISTING_STATUS.APPROVED];

// Statuses no transition may leave. Guards moderation against reopening a deal.
const TERMINAL_LISTING_STATUSES = [LISTING_STATUS.SOLD, LISTING_STATUS.DELETED];

const isPublicListingStatus = (status) => PUBLIC_LISTING_STATUSES.includes(status);

const isTerminalListingStatus = (status) => TERMINAL_LISTING_STATUSES.includes(status);

module.exports = {
  LISTING_STATUS,
  PUBLIC_LISTING_STATUSES,
  TERMINAL_LISTING_STATUSES,
  isPublicListingStatus,
  isTerminalListingStatus,
};
