/**
 * Owner-action availability for My Listings and Listing Details.
 * Pure flags only — screens own labels, Alerts, and HTTP.
 *
 * canEdit and canResubmit are separate so declined listings can keep
 * screen-specific presentation (Update on My Listings, Edit on Details).
 */

export const HISTORY_LISTING_STATUSES = Object.freeze([
  'sold',
  'deleted',
  'bid_duration_ended',
]);

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

export function isHistoryListingStatus(status) {
  return HISTORY_LISTING_STATUSES.includes(status);
}

export function isBidListing(listing) {
  return listing?.sale_type === 'bid';
}

export function isLiveBidListing(listing) {
  return (
    isBidListing(listing) &&
    listing?.auction?.auction_status === 'live'
  );
}

export function listingOwnerCapabilities(listing, { isOwner } = {}) {
  if (!isOwner || listing == null) return NONE;

  const status = listing.status;
  if (isHistoryListingStatus(status)) return NONE;
  if (isLiveBidListing(listing)) return NONE;

  return {
    canEdit: EDITABLE_STATUSES.includes(status),
    canResubmit: status === 'declined',
    canHide: status === 'approved',
    canUnhide: status === 'hidden',
    canMarkSold: status === 'approved',
    canDelete: true,
  };
}

export function partitionOwnerListings(listings) {
  const active = [];
  const sold = [];
  const endedBids = [];
  const deleted = [];

  for (const listing of listings || []) {
    if (listing.status === 'sold') sold.push(listing);
    else if (listing.status === 'bid_duration_ended') endedBids.push(listing);
    else if (listing.status === 'deleted') deleted.push(listing);
    else active.push(listing);
  }

  return {
    active,
    sold,
    endedBids,
    deleted,
    history: [...sold, ...endedBids, ...deleted],
  };
}
