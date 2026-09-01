/**
 * Battery health input helpers for Create/Edit Listing.
 * Stored/API value is an integer 70–100 (no "%" symbol).
 */

export const BATTERY_MIN = 70;
export const BATTERY_MAX = 100;

/** Keep only digits, max 3 characters (for controlled TextInput). */
export function sanitizeBatteryInput(text) {
  return String(text ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, 3);
}

/**
 * Parse a form string into an API integer, or null if empty.
 * Returns { ok: true, value } or { ok: false, reason: 'empty' | 'range' }.
 */
export function parseBatteryPercentage(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') {
    return { ok: false, reason: 'empty' };
  }
  if (!/^\d{1,3}$/.test(trimmed)) {
    return { ok: false, reason: 'range' };
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(value) || value < BATTERY_MIN || value > BATTERY_MAX) {
    return { ok: false, reason: 'range' };
  }
  return { ok: true, value };
}

export function batteryPercentageToInputValue(saved) {
  if (saved == null || saved === '') return '';
  return String(saved);
}
