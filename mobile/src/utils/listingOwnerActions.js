import { Share } from 'react-native';
import apiClient from './api';
import { getListingDisplayName } from './listingDisplayName';

const VISIBILITY_ACTIONS = new Set(['hide', 'unhide']);

export function markListingSold(listingId) {
  return apiClient.put(`/listings/${listingId}/mark-sold`);
}

export function setListingVisibility(listingId, action) {
  if (!VISIBILITY_ACTIONS.has(action)) {
    return Promise.reject(
      new Error(`Invalid listing visibility action: ${action}`)
    );
  }
  return apiClient.patch(`/listings/${listingId}/${action}`);
}

export function deleteListing(listingId) {
  return apiClient.delete(`/listings/${listingId}`);
}

export function shareListing(listing, t) {
  const title = getListingDisplayName(listing.brand_name, listing.model_name);
  return Share.share({
    message: `${t('listingDetails.shareMessage')} ${title} — ${listing.price} JOD`,
  });
}
