'use strict';

/** Stable age-group order for the Reports bar chart. En-dashes match the product labels. */
const AGE_GROUP_ORDER = ['18–24', '25–34', '35–44', '45–54', '55+', 'Unknown'];

/**
 * Current registered-user age buckets. AGE() uses the current date and whether
 * the birthday has occurred this year. Invalid / missing DOB → Unknown.
 * Under-18 (valid age, no product bucket) also maps to Unknown so totals match.
 */
const AGE_GROUPS_SQL = `
SELECT
  CASE
    WHEN date_of_birth IS NULL THEN 'Unknown'
    WHEN date_of_birth > CURRENT_DATE THEN 'Unknown'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) BETWEEN 18 AND 24 THEN '18–24'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) BETWEEN 25 AND 34 THEN '25–34'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) BETWEEN 35 AND 44 THEN '35–44'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) BETWEEN 45 AND 54 THEN '45–54'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 55 THEN '55+'
    ELSE 'Unknown'
  END AS label,
  COUNT(*)::int AS count
FROM users
GROUP BY 1
`;

const GENDER_SQL = `
SELECT
  CASE
    WHEN gender IS NULL OR BTRIM(gender) = '' THEN 'Unknown'
    WHEN LOWER(BTRIM(gender)) = 'male' THEN 'Male'
    WHEN LOWER(BTRIM(gender)) = 'female' THEN 'Female'
    ELSE BTRIM(gender)
  END AS label,
  COUNT(*)::int AS count
FROM users
GROUP BY 1
ORDER BY count DESC, label ASC
`;

const CITY_SQL = `
SELECT
  CASE
    WHEN city IS NULL OR BTRIM(city) = '' THEN 'Unknown'
    ELSE BTRIM(city)
  END AS label,
  COUNT(*)::int AS count
FROM users
GROUP BY 1
ORDER BY count DESC, label ASC
`;

function parseIsoDateOnly(value) {
  if (value == null) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toDateParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }
  return parseIsoDateOnly(value);
}

/**
 * Whole years old on `today`, matching PostgreSQL
 * EXTRACT(YEAR FROM AGE(today, dob)) including birthday-has-occurred.
 */
function ageInYears(dateOfBirth, today) {
  const dob = toDateParts(dateOfBirth);
  const now = toDateParts(today);
  if (!dob || !now) return null;
  const dobDate = new Date(dob.year, dob.month - 1, dob.day);
  if (
    dobDate.getFullYear() !== dob.year ||
    dobDate.getMonth() + 1 !== dob.month ||
    dobDate.getDate() !== dob.day
  ) {
    return null;
  }
  if (
    dob.year > now.year ||
    (dob.year === now.year && dob.month > now.month) ||
    (dob.year === now.year && dob.month === now.month && dob.day > now.day)
  ) {
    return null;
  }
  let years = now.year - dob.year;
  if (now.month < dob.month || (now.month === dob.month && now.day < dob.day)) {
    years -= 1;
  }
  if (years < 0) return null;
  return years;
}

function ageGroupForYears(years) {
  if (years == null || !Number.isFinite(years)) return 'Unknown';
  if (years >= 18 && years <= 24) return '18–24';
  if (years >= 25 && years <= 34) return '25–34';
  if (years >= 35 && years <= 44) return '35–44';
  if (years >= 45 && years <= 54) return '45–54';
  if (years >= 55) return '55+';
  return 'Unknown';
}

function ageGroupForDob(dateOfBirth, today) {
  const years = ageInYears(dateOfBirth, today);
  return ageGroupForYears(years);
}

function fillAgeGroups(rows) {
  const map = new Map(AGE_GROUP_ORDER.map((label) => [label, 0]));
  for (const row of rows || []) {
    const label = String(row.label);
    const count = Number(row.count) || 0;
    if (map.has(label)) {
      map.set(label, count);
    } else {
      map.set('Unknown', (map.get('Unknown') || 0) + count);
    }
  }
  return AGE_GROUP_ORDER.map((label) => ({
    label,
    count: map.get(label) || 0,
  }));
}

function toLabeledCounts(rows) {
  return (rows || []).map((row) => ({
    label: String(row.label),
    count: Number(row.count) || 0,
  }));
}

module.exports = {
  AGE_GROUP_ORDER,
  AGE_GROUPS_SQL,
  GENDER_SQL,
  CITY_SQL,
  ageInYears,
  ageGroupForYears,
  ageGroupForDob,
  fillAgeGroups,
  toLabeledCounts,
};
