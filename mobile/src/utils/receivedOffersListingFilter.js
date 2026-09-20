/**
 * Client-side filter for the existing /offers/received payload.
 * Does not change fetch URLs, offer status, or accept/reject behavior.
 */
export function filterReceivedOffersByListingId(offers, listingId) {
  const id = Number(listingId);
  if (!Number.isFinite(id) || id <= 0) return offers;
  return (offers || []).filter((item) => Number(item.listing_id) === id);
}
