/**
 * Single source of truth for the Telefonak backend URL in the mobile app.
 *
 * Set EXPO_PUBLIC_API_URL to the server origin (no trailing slash, /api optional).
 * Examples:
 *   iOS Simulator:     http://localhost:3000
 *   Android Emulator:  http://10.0.2.2:3000
 *   Physical device:   http://192.168.x.x:3000
 *   Production:        HTTPS origin via EXPO_PUBLIC_API_URL (required for store builds)
 *
 * Development: when unset, defaults to http://localhost:3000.
 * Production/release: missing, HTTP, localhost, or LAN URLs fail the build/bundle.
 *
 * Expo inlines EXPO_PUBLIC_* from `.env` at bundle time, so a CLI override cannot
 * safely change Android without also changing iOS. On Android development only,
 * loopback origins are rewritten to the emulator host alias 10.0.2.2 at runtime.
 */

import { Platform } from 'react-native';
import { resolveApiOrigin } from './apiOriginPolicy';

function isDevelopmentRuntime() {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return process.env.NODE_ENV !== 'production';
}

const isDevelopment = isDevelopmentRuntime();

/** Server origin, e.g. http://localhost:3000 (iOS dev) or https://… (release) */
export const API_ORIGIN = resolveApiOrigin(process.env.EXPO_PUBLIC_API_URL, {
  isDevelopment,
  androidEmulatorRewrite: isDevelopment && Platform.OS === 'android',
});

/** REST API base, e.g. http://localhost:3000/api */
export const API_BASE_URL = `${API_ORIGIN}/api`;

if (isDevelopment) {
  console.log('[apiConfig] API_ORIGIN', API_ORIGIN);
}

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
