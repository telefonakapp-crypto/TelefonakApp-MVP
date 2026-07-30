/**
 * Calendar-date helpers that avoid UTC shifts from Date#toISOString().
 * Use for date-of-birth and other user-selected calendar days.
 */

/** @param {Date} date */
export function formatLocalDateYYYYMMDD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD (or ISO datetime) string into a local Date at local midnight.
 * Falls back to fallbackDate when the value is missing/invalid.
 * @param {string|null|undefined} value
 * @param {Date} [fallbackDate]
 */
export function parseLocalDateYYYYMMDD(value, fallbackDate = new Date(2000, 0, 1)) {
  if (!value || typeof value !== 'string') return fallbackDate;
  const datePart = value.split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return fallbackDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const local = new Date(year, month - 1, day);
  if (Number.isNaN(local.getTime())) return fallbackDate;
  return local;
}

/** Normalize any stored DOB string to local YYYY-MM-DD without UTC conversion. */
export function toLocalDateYYYYMMDD(value) {
  if (!value || typeof value !== 'string') return '';
  const datePart = value.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatLocalDateYYYYMMDD(parsed);
}
