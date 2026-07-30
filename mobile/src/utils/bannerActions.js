/**
 * Marketing banner action architecture.
 * Supported action_type values (must match DB CHECK):
 *   - none     → no tap action
 *   - url      → open external URL (action_value)
 *   - screen   → navigate to an internal screen (action_value = screen key)
 *   - listing  → open a listing (action_value = listing id)
 *
 * Only wire destinations that are ready; others no-op safely.
 */

export const BANNER_ACTION_TYPES = Object.freeze({
  NONE: 'none',
  URL: 'url',
  SCREEN: 'screen',
  LISTING: 'listing',
});

/** Known internal screen keys for future Admin Panel destinations. */
const INTERNAL_SCREENS = Object.freeze({
  home: { name: 'Home' },
  createListing: { name: 'CreateListing' },
  myListings: { name: 'MyListings' },
  profile: { name: 'Profile' },
  notifications: { name: 'Notifications' },
});

function normalizeExternalUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * @param {object} banner
 * @param {{ navigation: object, Linking: object, Alert?: object }} deps
 */
export async function handleBannerAction(banner, { navigation, Linking, Alert } = {}) {
  if (!banner) return;

  const type = (banner.action_type || BANNER_ACTION_TYPES.NONE).toLowerCase();
  const value = banner.action_value;

  try {
    switch (type) {
      case BANNER_ACTION_TYPES.NONE:
        return;

      case BANNER_ACTION_TYPES.URL: {
        const url = normalizeExternalUrl(value);
        if (!url || !Linking) return;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else if (Alert) {
          Alert.alert('Error', 'Unable to open this link');
        }
        return;
      }

      case BANNER_ACTION_TYPES.LISTING: {
        if (!navigation || value === undefined || value === null || value === '') return;
        const listingId = Number(value);
        if (!Number.isFinite(listingId) || listingId <= 0) return;
        navigation.navigate('ListingDetails', { listingId });
        return;
      }

      case BANNER_ACTION_TYPES.SCREEN: {
        if (!navigation || !value) return;
        const target = INTERNAL_SCREENS[String(value)];
        if (!target) {
          // Architecture reserved for future destinations — ignore unknown keys.
          return;
        }
        navigation.navigate(target.name, target.params);
        return;
      }

      default:
        return;
    }
  } catch (error) {
    console.error('Banner action failed:', error);
    if (Alert) {
      Alert.alert('Error', 'Failed to open banner');
    }
  }
}
