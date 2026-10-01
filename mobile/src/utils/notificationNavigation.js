/**
 * Where a notification row should open. Navigation only — does not mark
 * read, fetch data, or change offer/listing behavior.
 *
 * New Offer rows are type `offer_received` (stored title "New Offer").
 * The API payload has related_listing_id; it does not include an offer id.
 */

function hasPositiveId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0;
}

export function isNewOfferNotification(item) {
  const type = String(item?.type || '');
  const title = String(item?.title || '');
  return type === 'offer_received' || title === 'New Offer';
}

/**
 * @returns {{ name: string, params: object, method: 'push' | 'navigate' } | null}
 */
export function resolveNotificationDestination(item) {
  if (!item) return null;

  if (isNewOfferNotification(item)) {
    const params = { initialSegment: 'received' };
    if (hasPositiveId(item.related_listing_id)) {
      params.listingId = Number(item.related_listing_id);
    }
    return { name: 'Offers', params, method: 'push' };
  }

  // Existing behavior for every other type: open the listing when one is linked.
  // Bid one-hour (and other listing-linked types) open Listing Details.
  // Listing Details refetches current state — notification copy is not auction state.
  if (hasPositiveId(item.related_listing_id)) {
    return {
      name: 'ListingDetails',
      params: { listingId: Number(item.related_listing_id) },
      method: 'navigate',
    };
  }

  return null;
}
