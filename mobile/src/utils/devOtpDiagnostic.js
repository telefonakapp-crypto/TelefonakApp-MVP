'use strict';

/**
 * TFK-M4 — Development-only OTP diagnostic.
 *
 * Production/release builds (__DEV__ === false) must never display or log an
 * OTP from an API response, even if the backend accidentally includes `otp`.
 */

function isDevClient() {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

function readResponseOtp(data) {
  if (!data || typeof data !== 'object') return '';
  const raw = data.otp;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

/**
 * @param {unknown} data
 * @param {{ isDev?: boolean, title?: string }} [options]
 * @returns {{ title: string, message: string } | null}
 */
function getDevOtpAlert(data, options = {}) {
  const isDev = Object.prototype.hasOwnProperty.call(options, 'isDev')
    ? options.isDev === true
    : isDevClient();

  if (!isDev) {
    return null;
  }

  const otp = readResponseOtp(data);
  if (!otp) {
    return null;
  }

  return {
    title: options.title || 'OTP Sent',
    message: `Your OTP is: ${otp} (Development mode)`,
  };
}

/**
 * Shows the existing development OTP Alert. No-op in production builds.
 * @param {unknown} data
 * @param {string} [title]
 * @returns {boolean}
 */
function showDevOtpAlert(data, title) {
  if (!isDevClient()) {
    return false;
  }

  const diagnostic = getDevOtpAlert(data, { isDev: true, title });
  if (!diagnostic) {
    return false;
  }

  const { Alert } = require('react-native');
  Alert.alert(diagnostic.title, diagnostic.message);
  return true;
}

module.exports = {
  isDevClient,
  getDevOtpAlert,
  showDevOtpAlert,
};
