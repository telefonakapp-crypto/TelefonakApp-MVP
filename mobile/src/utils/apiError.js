/**
 * User-facing API error helpers.
 * Keep technical Axios / raw transport details out of Alerts; log them in __DEV__.
 */

import { ignoreIfMaintenance } from './maintenance';

const TECHNICAL_PATTERNS = [
  /^request failed with status code/i,
  /^axioserror/i,
  /^network error$/i,
  /^timeout of \d+ms exceeded$/i,
  /^failed to fetch$/i,
  /^network request failed$/i,
  /^error:\s*request failed/i,
];

/** express-validator / generic backend messages that are not helpful to end users */
const MEANINGLESS_MESSAGES = new Set([
  'invalid value',
  'invalid',
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'internal server error',
  'error',
]);

/** Map known backend errors to polished customer copy */
const FRIENDLY_MESSAGE_BY_ERROR = {
  'Phone number not verified':
    'Phone number not verified.\n\nPlease verify your phone number before completing registration.',
};

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

/** Handled client/API outcomes — never escalate to RN red error overlays */
const HANDLED_STATUS_CODES = new Set([400, 401, 403, 404, 409, 422, 429]);

function normalizeMessage(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function isTechnicalMessage(message) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));
}

function isMeaningfulUserMessage(message) {
  if (!message) return false;
  if (isTechnicalMessage(message)) return false;
  if (MEANINGLESS_MESSAGES.has(message.toLowerCase())) return false;
  // Avoid dumping JSON / stack-like noise
  if (message.startsWith('{') || message.startsWith('[')) return false;
  if (message.includes('\n    at ')) return false;
  return true;
}

function collectCandidateMessages(data) {
  if (!data || typeof data !== 'object') return [];

  const candidates = [];

  const topError = normalizeMessage(data.error);
  if (topError) candidates.push(topError);

  const topMessage = normalizeMessage(data.message);
  if (topMessage) candidates.push(topMessage);

  if (Array.isArray(data.errors)) {
    for (const item of data.errors) {
      if (typeof item === 'string') {
        const msg = normalizeMessage(item);
        if (msg) candidates.push(msg);
        continue;
      }
      if (item && typeof item === 'object') {
        const msg = normalizeMessage(item.msg || item.message);
        if (msg) candidates.push(msg);
      }
    }
  }

  return candidates;
}

function isHandledClientError(error) {
  const status = error?.response?.status;
  return HANDLED_STATUS_CODES.has(status);
}

/** No HTTP response — backend down, simulator race, offline, timeout. */
export function isNetworkError(error) {
  if (!error || error.response) return false;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  const message = String(error.message || '');
  return /network error|network request failed|timeout|failed to fetch/i.test(message);
}

/**
 * Log full API failure details for developers (never shown in UI).
 * Handled 4xx + transient network errors use console.log so LogBox never shows a red overlay.
 */
function isSilentMaintenanceError(error) {
  return ignoreIfMaintenance(error);
}

export function logApiError(context, error) {
  // Maintenance is an expected controlled state — never log or LogBox it.
  if (isSilentMaintenanceError(error)) return;

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (!isDev) return;

  const payload = {
    context,
    status: error?.response?.status,
    data: error?.response?.data,
    message: error?.message,
    code: error?.code,
    url: error?.config?.url,
    baseURL: error?.config?.baseURL,
  };

  if (isHandledClientError(error) || isNetworkError(error)) {
    // Metro/terminal only — not a redbox / customer-visible failure.
    console.log(`[API] ${context}`, payload);
    return;
  }

  console.error(`[API] ${context}`, payload);
}

/** Retry once after a short delay when the backend is still starting. */
export async function withNetworkRetry(fn, { retries = 1, delayMs = 800 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isNetworkError(error) || attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Prefer meaningful API body messages; never fall through to Axios status strings.
 *
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = DEFAULT_FALLBACK) {
  if (isSilentMaintenanceError(error)) {
    return '';
  }

  const safeFallback =
    normalizeMessage(fallback) && !isTechnicalMessage(fallback)
      ? fallback.trim()
      : DEFAULT_FALLBACK;

  // No HTTP response → connectivity / timeout style issue
  if (error && !error.response) {
    if (error.message && /network|timeout|failed to fetch/i.test(String(error.message))) {
      return 'Please check your internet connection and try again.';
    }
    return safeFallback;
  }

  const data = error?.response?.data;
  const candidates = collectCandidateMessages(data);

  for (const candidate of candidates) {
    if (FRIENDLY_MESSAGE_BY_ERROR[candidate]) {
      return FRIENDLY_MESSAGE_BY_ERROR[candidate];
    }
    if (isMeaningfulUserMessage(candidate)) {
      return candidate;
    }
  }

  return safeFallback;
}
