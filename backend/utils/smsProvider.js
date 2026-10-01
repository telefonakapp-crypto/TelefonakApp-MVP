'use strict';

const { normalizePhoneNumber } = require('./phone');

/**
 * Convert Telefonak's canonical 07XXXXXXXX number to the SMS provider's
 * 9627XXXXXXXX form. Validation and stored numbers stay unchanged.
 */
function toProviderMno(phoneNumber) {
  const local = normalizePhoneNumber(phoneNumber);
  if (!local) return null;
  return `962${local.slice(1)}`;
}

function otpSmsText(code) {
  return `Your Telefonak verification code is: ${code}`;
}

/** Gateway message ids are numeric. Error text in Response is not an id. */
function isProviderMessageReference(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return true;
  return typeof value === 'string' && /^\d+$/.test(value.trim());
}

function providerSubmissionAccepted(body) {
  const ids = body && body.Response;
  if (!Array.isArray(ids) || ids.length === 0) return false;
  return ids.every(isProviderMessageReference);
}

/**
 * GET the configured SMS API. Success is HTTP ok plus a numeric Response id.
 * Errors never include the request URL, because the password is a query parameter.
 */
async function deliverSms(config, { phoneNumber, text }, fetchImpl) {
  const fetchFn = typeof fetchImpl === 'function' ? fetchImpl : globalThis.fetch;
  const mno = toProviderMno(phoneNumber);
  if (!mno || typeof fetchFn !== 'function') {
    throw new Error('SMS delivery failed');
  }

  const url = new URL(config.apiUrl);
  url.searchParams.set('user', config.username);
  url.searchParams.set('pass', config.password);
  url.searchParams.set('sid', config.senderId);
  url.searchParams.set('mno', mno);
  url.searchParams.set('type', String(config.type));
  url.searchParams.set('text', text);
  url.searchParams.set('respformat', 'json');

  let response;
  try {
    response = await fetchFn(url);
  } catch (_error) {
    throw new Error('SMS delivery failed');
  }

  if (!response || response.ok !== true) {
    throw new Error('SMS delivery failed');
  }

  let body;
  try {
    body = await response.json();
  } catch (_error) {
    throw new Error('SMS delivery failed');
  }

  if (!providerSubmissionAccepted(body)) {
    throw new Error('SMS delivery failed');
  }
}

module.exports = {
  toProviderMno,
  otpSmsText,
  deliverSms,
};
