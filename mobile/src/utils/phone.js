/**
 * Jordanian phone number helpers shared by every screen that takes a number
 * (login, sign up, change phone number) so the input behaves identically.
 */

export const PHONE_NUMBER_LENGTH = 10; // 07XXXXXXXX

/** Coerce whatever the user types into the local 07XXXXXXXX form. */
export const formatPhoneNumber = (text) => {
  const cleaned = String(text ?? '').replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    return cleaned.slice(0, PHONE_NUMBER_LENGTH);
  }
  if (cleaned.startsWith('962')) {
    return `0${cleaned.slice(3)}`.slice(0, PHONE_NUMBER_LENGTH);
  }
  if (cleaned.startsWith('7')) {
    return `0${cleaned}`.slice(0, PHONE_NUMBER_LENGTH);
  }
  return cleaned;
};

/** Mirrors the backend rule so the user gets feedback before a request is sent. */
export const isValidPhoneNumber = (value) => /^07[789]\d{7}$/.test(String(value ?? ''));
