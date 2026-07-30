/**
 * Single source of truth for the Telefonak backend URL in the mobile app.
 *
 * Set EXPO_PUBLIC_API_URL to the server origin (no trailing slash, /api optional).
 * Examples:
 *   iOS Simulator:     http://localhost:3000
 *   Android Emulator:  http://10.0.2.2:3000
 *   Physical device:   http://192.168.x.x:3000
 *   Production:        https://api.telefonak.com
 *
 * When unset, defaults to http://localhost:3000 (existing local simulator behavior).
 */

const DEFAULT_API_ORIGIN = 'http://localhost:3000';

function normalizeApiOrigin(raw) {
  let url = (raw || DEFAULT_API_ORIGIN).trim();
  if (!url) url = DEFAULT_API_ORIGIN;
  url = url.replace(/\/+$/, '');
  if (url.endsWith('/api')) {
    url = url.slice(0, -4);
  }
  return url;
}

/** Server origin, e.g. http://localhost:3000 */
export const API_ORIGIN = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL);

/** REST API base, e.g. http://localhost:3000/api */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/**
 * Resolve a media/upload URL for Image components.
 * - Relative /uploads/... paths → absolute against API_ORIGIN
 * - Absolute localhost/127.0.0.1 URLs → rewritten to API_ORIGIN (device-safe)
 * - file:/content:/data: and other absolute URLs pass through
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return url;

  if (
    url.startsWith('file:') ||
    url.startsWith('content:') ||
    url.startsWith('data:') ||
    url.startsWith('ph://') ||
    url.startsWith('assets-library:')
  ) {
    return url;
  }

  if (url.startsWith('/')) {
    return `${API_ORIGIN}${url}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${API_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Not a valid absolute URL — return as-is
  }

  return url;
}
