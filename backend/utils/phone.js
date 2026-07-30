const { body } = require('express-validator');

/**
 * Jordanian phone number rules, shared by every flow that accepts a number
 * (login, registration, phone change) so validation never drifts apart.
 */

const LOCAL_LENGTH = 10; // 07XXXXXXXX

/**
 * Reduce a number to the local 07XXXXXXXX form used as the canonical value.
 * Returns null when the input is not a Jordanian mobile number.
 */
function normalizePhoneNumber(raw) {
  if (typeof raw !== 'string') return null;

  const digits = raw.replace(/\D/g, '');
  let local = digits;

  if (digits.startsWith('00962')) local = `0${digits.slice(5)}`;
  else if (digits.startsWith('962')) local = `0${digits.slice(3)}`;
  else if (digits.startsWith('7')) local = `0${digits}`;

  return /^07[789]\d{7}$/.test(local) ? local : null;
}

/**
 * Every stored spelling of the same number. Accounts created before
 * normalization may hold the +962 form, so duplicate checks compare against all
 * of them in a single indexed lookup.
 */
function phoneNumberVariants(raw) {
  const local = normalizePhoneNumber(raw);
  if (!local) return [];

  const withoutLeadingZero = local.slice(1);
  return [local, `+962${withoutLeadingZero}`, `962${withoutLeadingZero}`, `00962${withoutLeadingZero}`];
}

const isSamePhoneNumber = (a, b) => {
  const normalizedA = normalizePhoneNumber(a);
  return normalizedA !== null && normalizedA === normalizePhoneNumber(b);
};

/**
 * express-validator chain for a phone number field, matching the rule the auth
 * routes have always used.
 */
const phoneNumberValidator = (field) =>
  body(field)
    .isMobilePhone('ar-JO')
    .withMessage('Invalid Jordanian phone number')
    .bail()
    .custom((value) => normalizePhoneNumber(value) !== null)
    .withMessage('Invalid Jordanian phone number');

module.exports = {
  LOCAL_LENGTH,
  normalizePhoneNumber,
  phoneNumberVariants,
  isSamePhoneNumber,
  phoneNumberValidator,
};
