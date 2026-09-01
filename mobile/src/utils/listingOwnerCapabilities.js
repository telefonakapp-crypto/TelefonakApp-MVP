/**
 * Owner-action availability for My Listings and Listing Details.
 * Pure flags only — screens own labels, Alerts, and HTTP.
 *
 * canEdit and canResubmit are separate so declined listings can keep
 * screen-specific presentation (Update on My Listings, Edit on Details).
 */

const TERMINAL_STATUSES = ['sold', 'deleted'];

const EDITABLE_STATUSES = [
  'pending',
  'resubmitted',
  'updated',
  'approved',
  'hidden',
];

const NONE = Object.freeze({
  canEdit: false,
  canResubmit: false,
  canHide: false,
  canUnhide: false,
  canMarkSold: false,
  canDelete: false,
});

export function listingOwnerCapabilities(listing, { isOwner } = {}) {
  if (!isOwner || listing == null) return NONE;

  const status = listing.status;
  if (TERMINAL_STATUSES.includes(status)) return NONE;

  return {
    canEdit: EDITABLE_STATUSES.includes(status),
    canResubmit: status === 'declined',
    canHide: status === 'approved',
    canUnhide: status === 'hidden',
    canMarkSold: status === 'approved',
    canDelete: true,
  };
}
