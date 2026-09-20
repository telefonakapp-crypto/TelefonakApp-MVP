'use strict';

/**
 * API origin policy for the Telefonak mobile app.
 *
 * Development may fall back to localhost. Release/production builds must set
 * EXPO_PUBLIC_API_URL to an explicit HTTPS origin (no loopback / LAN / HTTP).
 */

const DEV_FALLBACK_API_ORIGIN = 'http://localhost:3000';
const ANDROID_EMULATOR_HOST_ORIGIN = 'http://10.0.2.2:3000';

const FORBIDDEN_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '10.0.2.2',
  '10.0.3.2',
]);

function stripTrailingSlashAndApi(url) {
  let normalized = String(url).trim().replace(/\/+$/, '');
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, -4).replace(/\/+$/, '');
  }
  return normalized;
}

function isPrivateOrLocalHostname(hostname) {
  const host = String(hostname || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();

  if (!host) return true;
  if (FORBIDDEN_HOSTS.has(host)) return true;
  if (host === 'localhost.localdomain') return true;
  if (host.endsWith('.local') || host.endsWith('.localhost')) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return true;
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }

  return false;
}

function parseOrigin(raw) {
  const trimmed = raw == null ? '' : String(raw).trim();
  if (!trimmed) {
    throw new Error('EXPO_PUBLIC_API_URL is missing.');
  }
  const normalized = stripTrailingSlashAndApi(trimmed);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      `EXPO_PUBLIC_API_URL is not a valid URL: ${JSON.stringify(trimmed)}`
    );
  }
  if (!parsed.hostname) {
    throw new Error('EXPO_PUBLIC_API_URL must include a hostname.');
  }
  return { normalized: stripTrailingSlashAndApi(parsed.toString()), parsed };
}

/**
 * True when this process is producing a store/release binary (not Metro --dev).
 */
function shouldEnforceReleaseApiOrigin(env = process.env) {
  const profile = String(env.EAS_BUILD_PROFILE || '').toLowerCase();
  if (profile === 'production') return true;

  const configuration = String(env.CONFIGURATION || '');
  if (configuration === 'Release') return true;

  const gradle = `${env.GRADLE_TASK || ''} ${env.TASKS || ''} ${env.ANDROID_GRADLE_TASKS || ''}`;
  if (/release/i.test(gradle) && /assemble|bundle|install|package/i.test(gradle)) {
    return true;
  }

  if (env.NODE_ENV === 'production') {
    if (env.NODE_TEST_CONTEXT) return false;
    const lifecycle = String(env.npm_lifecycle_event || '');
    if (lifecycle.startsWith('test')) return false;
    return true;
  }

  return false;
}

function assertReleaseApiOrigin(raw) {
  const { normalized, parsed } = parseOrigin(raw);

  if (parsed.protocol !== 'https:') {
    throw new Error(
      'Production EXPO_PUBLIC_API_URL must use https:// (HTTP and localhost are not allowed in store builds).'
    );
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    throw new Error(
      'Production EXPO_PUBLIC_API_URL must not use localhost, loopback, emulator, or private/LAN addresses.'
    );
  }

  return normalized;
}

function rewriteAndroidEmulatorLoopback(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = '10.0.2.2';
      return stripTrailingSlashAndApi(parsed.toString());
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * @param {string|undefined|null} raw
 * @param {{ isDevelopment?: boolean, androidEmulatorRewrite?: boolean }} [options]
 */
function resolveApiOrigin(raw, options = {}) {
  const { isDevelopment = false, androidEmulatorRewrite = false } = options;
  const trimmed = raw == null ? '' : String(raw).trim();

  if (!isDevelopment) {
    return assertReleaseApiOrigin(trimmed);
  }

  const origin = stripTrailingSlashAndApi(trimmed || DEV_FALLBACK_API_ORIGIN);
  if (androidEmulatorRewrite) {
    return rewriteAndroidEmulatorLoopback(origin);
  }
  return origin;
}

function assertReleaseApiOriginFromEnv(env = process.env) {
  if (!shouldEnforceReleaseApiOrigin(env)) {
    return null;
  }
  return assertReleaseApiOrigin(env.EXPO_PUBLIC_API_URL);
}

module.exports = {
  DEV_FALLBACK_API_ORIGIN,
  ANDROID_EMULATOR_HOST_ORIGIN,
  shouldEnforceReleaseApiOrigin,
  assertReleaseApiOrigin,
  assertReleaseApiOriginFromEnv,
  resolveApiOrigin,
  rewriteAndroidEmulatorLoopback,
  isPrivateOrLocalHostname,
};
