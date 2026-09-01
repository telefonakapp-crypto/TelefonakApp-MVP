/**
 * Customer auth session helpers (Phase 3).
 *
 * Access + refresh tokens live in expo-secure-store (not AsyncStorage).
 * Legacy AsyncStorage `authToken` is migrated once, then removed.
 *
 * SecureStore is required lazily so a missing native module cannot leave this
 * file half-initialized (which previously made setAuthSession undefined and
 * caused OTP verify to surface a misleading "Invalid or expired OTP" error).
 *
 * Backend contracts consumed here:
 * - Login / register / phone-change: { token, refresh_token?, ... }
 * - Registration gate (new user): { token } only (no refresh_token)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** @deprecated Legacy AsyncStorage key — migrated away on first read. */
export const AUTH_TOKEN_KEY = 'authToken';

const SECURE_ACCESS_KEY = 'telefonak_access_token';
const SECURE_REFRESH_KEY = 'telefonak_refresh_token';

let SecureStoreModule = null;
let secureStoreLoadError = null;

function getSecureStore() {
  if (SecureStoreModule) return SecureStoreModule;
  if (secureStoreLoadError) {
    throw secureStoreLoadError;
  }
  try {
    // Lazy require: a missing native module must not break named exports.
    // eslint-disable-next-line global-require
    SecureStoreModule = require('expo-secure-store');
    if (!SecureStoreModule?.getItemAsync || !SecureStoreModule?.setItemAsync) {
      throw new Error('expo-secure-store native API unavailable');
    }
    return SecureStoreModule;
  } catch (error) {
    secureStoreLoadError = new Error(
      'Secure storage is unavailable. Use Expo Go (SDK 54+) or rebuild the native app after installing expo-secure-store.'
    );
    throw secureStoreLoadError;
  }
}

/**
 * @param {string|null|undefined} token
 * @returns {Record<string, unknown>|null}
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    if (typeof globalThis.atob !== 'function') return null;
    return JSON.parse(globalThis.atob(padded));
  } catch {
    return null;
  }
}

function isExpiredPayload(payload) {
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 <= Date.now();
}

/**
 * @param {string|null|undefined} token
 * @returns {'none'|'customer'|'registration'}
 */
export function classifyAuthToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return 'none';
  if (payload.adminId || payload.typ === 'admin') return 'none';
  if (isExpiredPayload(payload)) return 'none';
  if (payload.userId) return 'customer';
  if (payload.verified === true && payload.phoneNumber) return 'registration';
  return 'none';
}

async function secureGet(key) {
  const SecureStore = getSecureStore();
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key, value) {
  const SecureStore = getSecureStore();
  if (!value) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

/**
 * One-time migration: AsyncStorage authToken → SecureStore, then delete legacy key.
 * Never logs the token value.
 */
async function migrateLegacyAsyncStorageToken() {
  let legacy = null;
  try {
    legacy = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return;
  }
  if (!legacy) return;

  const kind = classifyAuthToken(legacy);
  if (kind === 'none') {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore
    }
    return;
  }

  try {
    const existingSecure = await secureGet(SECURE_ACCESS_KEY);
    if (!existingSecure) {
      await secureSet(SECURE_ACCESS_KEY, legacy);
    }
  } catch {
    // SecureStore unavailable — still drop the legacy plaintext copy rather than
    // keeping credentials in AsyncStorage.
  }

  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

let migrationPromise = null;
function ensureMigrated() {
  if (!migrationPromise) {
    migrationPromise = migrateLegacyAsyncStorageToken().catch(() => {});
  }
  return migrationPromise;
}

async function removeLegacyAsyncStorageToken() {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Read the access JWT from SecureStore. */
export async function getAuthToken() {
  await ensureMigrated();
  return secureGet(SECURE_ACCESS_KEY);
}

/** Read the opaque refresh token from SecureStore. */
export async function getRefreshToken() {
  await ensureMigrated();
  return secureGet(SECURE_REFRESH_KEY);
}

/**
 * Persist access token (and optional refresh). Primary credential store is SecureStore only.
 * Pass refreshToken explicitly as null to clear refresh (e.g. registration gate).
 */
export async function setAuthToken(token, refreshToken) {
  await ensureMigrated();
  await secureSet(SECURE_ACCESS_KEY, token || null);
  if (refreshToken !== undefined) {
    await secureSet(SECURE_REFRESH_KEY, refreshToken || null);
  }
  await removeLegacyAsyncStorageToken();
}

/**
 * Store a full session from auth API responses (`token` + optional `refresh_token`).
 * If refresh_token is omitted (registration gate), clear any prior refresh.
 *
 * @param {{ token?: string, refresh_token?: string }|null|undefined} payload
 */
export async function setAuthSession(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Auth session payload missing');
  }
  const access = typeof payload.token === 'string' ? payload.token : null;
  if (!access) {
    throw new Error('Auth session missing access token');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'refresh_token')) {
    const refresh =
      typeof payload.refresh_token === 'string' && payload.refresh_token
        ? payload.refresh_token
        : null;
    await setAuthToken(access, refresh);
    return;
  }
  await setAuthToken(access, null);
}

/** Clear access + refresh from SecureStore (and any legacy AsyncStorage copy). */
export async function clearAuthToken() {
  await ensureMigrated();
  try {
    await secureSet(SECURE_ACCESS_KEY, null);
    await secureSet(SECURE_REFRESH_KEY, null);
  } catch {
    // Still wipe legacy AsyncStorage even if SecureStore is unavailable.
  }
  await removeLegacyAsyncStorageToken();
}

/** Alias — preferred name for Phase 3 call sites. */
export async function clearAuthSession() {
  return clearAuthToken();
}

/**
 * @returns {Promise<{ token: string|null, refreshToken: string|null, kind: 'none'|'customer'|'registration' }>}
 */
export async function getAuthSession() {
  return resolveStoredSession();
}

/**
 * Read + classify the stored session. Clears expired access tokens so cold starts
 * do not briefly treat them as authenticated. Refresh may still exist for renewal.
 *
 * @returns {Promise<{ token: string|null, kind: 'none'|'customer'|'registration', refreshToken: string|null }>}
 */
export async function resolveStoredSession() {
  await ensureMigrated();
  let token = null;
  let refreshToken = null;
  try {
    token = await getAuthToken();
    refreshToken = await getRefreshToken();
  } catch {
    return { token: null, kind: 'none', refreshToken: null };
  }
  const kind = classifyAuthToken(token);

  if (token && kind === 'none') {
    // Access expired/malformed — keep refresh if present so api interceptor can renew.
    try {
      await secureSet(SECURE_ACCESS_KEY, null);
    } catch {
      // ignore
    }
    if (!refreshToken) {
      await clearAuthToken();
      return { token: null, kind: 'none', refreshToken: null };
    }
    // Treat as customer if refresh exists (will refresh on first API call).
    return { token: null, kind: 'customer', refreshToken };
  }

  return { token, kind, refreshToken };
}

/**
 * Read Authorization from an Axios request config without throwing.
 * @param {import('axios').InternalAxiosRequestConfig} config
 * @returns {string|undefined}
 */
export function getRequestAuthorization(config) {
  const headers = config?.headers;
  if (!headers) return undefined;

  if (typeof headers.get === 'function') {
    return headers.get('Authorization') || headers.get('authorization') || undefined;
  }

  return headers.Authorization || headers.authorization || undefined;
}
