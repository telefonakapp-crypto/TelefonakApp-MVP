/**
 * User-facing API error helpers.
 * Keep technical Axios / raw transport details out of Alerts; log them in __DEV__.
 */

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

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

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

/**
 * Log full API failure details for developers (never shown in UI).
 */
export function logApiError(context, error) {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (!isDev) return;
  const payload = {
    context,
    status: error?.response?.status,
    data: error?.response?.data,
    message: error?.message,
  };
  console.error(`[API] ${context}`, payload);
}

/**
 * Prefer meaningful API body messages; never fall through to Axios status strings.
 *
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = DEFAULT_FALLBACK) {
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
    if (isMeaningfulUserMessage(candidate)) {
      return candidate;
    }
  }

  return safeFallback;
}
