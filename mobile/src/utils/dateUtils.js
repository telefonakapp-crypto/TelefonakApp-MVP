/**
 * Calendar-date helpers for date-only values such as date of birth.
 *
 * A birthday has no time and no timezone. The native DateTimePicker, however,
 * works with Date instants and (on iOS Fabric) displays them in the *device
 * local* timezone: its `timeZoneOffsetInMinutes` default is 0, and that value
 * is a no-op against the same default, so the picker is never actually pinned
 * to GMT.
 *
 * Reading UTC components (getUTCDate / Date.UTC / toISOString) of a local
 * picker Date is what produces the ±1 day shift. We therefore:
 *   - parse YYYY-MM-DD into local calendar components (never `new Date("YYYY-MM-DD")`)
 *   - construct the picker Date at local noon so an offset cannot cross midnight
 *   - format with getFullYear / getMonth / getDate (the components the spinner shows)
 */

const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value) {
  return String(value).padStart(2, '0');
}

/** Local noon on the given calendar day. Month is 1-based. */
export function calendarDateAtLocalNoon(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Format a picker Date as YYYY-MM-DD using its local calendar components.
 * @param {Date} date
 */
export function formatPickerDateYYYYMMDD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD (or ISO datetime prefix) into the Date the picker expects:
 * local noon of that exact calendar day.
 * @param {string|null|undefined} value
 * @param {Date} [fallbackDate]
 */
export function parsePickerDateYYYYMMDD(
  value,
  fallbackDate = calendarDateAtLocalNoon(2000, 1, 1)
) {
  if (!value || typeof value !== 'string') return fallbackDate;
  const match = CALENDAR_DATE_RE.exec(value.split('T')[0]);
  if (!match) return fallbackDate;
  const parsed = calendarDateAtLocalNoon(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );
  return Number.isNaN(parsed.getTime()) ? fallbackDate : parsed;
}

/** Today as a picker Date, for `maximumDate` on a date-only picker. */
export function todayAsPickerDate() {
  const now = new Date();
  return calendarDateAtLocalNoon(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
}

/**
 * Device IANA timezone for DateTimePicker's `timeZoneName` prop.
 * Setting this explicitly makes Fabric apply the local zone (empty/default
 * does not). Do not pass `timeZoneOffsetInMinutes={0}` — that is GMT, and
 * on Fabric it is also a no-op against the default.
 */
export function deviceTimeZoneName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalize a stored/API date-only value to YYYY-MM-DD.
 * The backend sends a bare calendar date; take it verbatim with no Date parsing.
 * @param {string|null|undefined} value
 */
export function toCalendarDateYYYYMMDD(value) {
  if (!value || typeof value !== 'string') return '';
  const datePart = value.split('T')[0];
  return CALENDAR_DATE_RE.test(datePart) ? datePart : '';
}
