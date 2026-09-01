/**
 * Marketplace contact settings from Admin Dashboard (settings table).
 * Fetched from GET /api/settings/public; cached in memory + AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

const CACHE_KEY = 'publicContactSettings';

const DEFAULTS = Object.freeze({
  contact_email: 'support@telefonak.com',
  contact_phone: '+962700000000',
  marketplace_name: 'Telefonak',
});

/** @type {{ contact_email: string, contact_phone: string, marketplace_name: string }} */
let memoryCache = { ...DEFAULTS };
let inflight = null;

function normalizeSettings(raw) {
  const email =
    typeof raw?.contact_email === 'string' && raw.contact_email.trim()
      ? raw.contact_email.trim()
      : DEFAULTS.contact_email;
  const phone =
    typeof raw?.contact_phone === 'string' && raw.contact_phone.trim()
      ? raw.contact_phone.trim()
      : DEFAULTS.contact_phone;
  const name =
    typeof raw?.marketplace_name === 'string' && raw.marketplace_name.trim()
      ? raw.marketplace_name.trim()
      : DEFAULTS.marketplace_name;
  return {
    contact_email: email,
    contact_phone: phone,
    marketplace_name: name,
  };
}

export function getCachedContactSettings() {
  return memoryCache;
}

export function getSupportEmail() {
  return memoryCache.contact_email;
}

export function getSupportPhone() {
  return memoryCache.contact_phone;
}

async function persistCache(settings) {
  memoryCache = settings;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    // ignore persistence failures
  }
}

/** Load last-known values from disk (call early on cold start). */
export async function hydrateContactSettingsCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return memoryCache;
    memoryCache = normalizeSettings(JSON.parse(raw));
  } catch {
    // keep defaults
  }
  return memoryCache;
}

/**
 * Refresh from the backend. Concurrent callers share one request.
 * @returns {Promise<{ contact_email: string, contact_phone: string, marketplace_name: string }>}
 */
export async function refreshContactSettings() {
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/settings/public`, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      });
      const next = normalizeSettings(data?.settings);
      await persistCache(next);
      return next;
    } catch (error) {
      // Keep cached / default values so Contact Us still works offline.
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[contactSettings] refresh failed', error?.message);
      }
      return memoryCache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
