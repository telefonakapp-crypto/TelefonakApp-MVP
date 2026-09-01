/**
 * Central OTP configuration.
 *
 * Development Testing Mode is active only when:
 *   - NODE_ENV=development, OR
 *   - OTP_DEV_MODE=true
 * and is NEVER active when NODE_ENV=production (even if OTP_DEV_MODE is set).
 */

const { isProduction } = require('./env');

const PRODUCTION_OTP = Object.freeze({
  resendCooldownSeconds: 60,
  otpTtlMinutes: 5,
  phoneWindowMinutes: 60,
  phoneMaxRequestsPerWindow: 5,
  ipWindowMs: 60 * 60 * 1000,
  ipMaxRequestsPerWindow: 50,
  maxVerifyAttempts: 5,
  otpLength: 4,
});

const DEVELOPMENT_OTP = Object.freeze({
  ...PRODUCTION_OTP,
  resendCooldownSeconds: 5,
  phoneMaxRequestsPerWindow: 100,
  ipMaxRequestsPerWindow: 500,
});

/**
 * @returns {boolean}
 */
function isOtpDevMode() {
  // Hard stop — production security must never be relaxed by env mistakes.
  if (isProduction()) {
    return false;
  }
  if (process.env.OTP_DEV_MODE === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'development';
}

let hasLoggedDevMode = false;

/**
 * Active OTP limits for this process.
 * @returns {{
 *   isDevMode: boolean,
 *   resendCooldownSeconds: number,
 *   otpTtlMinutes: number,
 *   phoneWindowMinutes: number,
 *   phoneMaxRequestsPerWindow: number,
 *   ipWindowMs: number,
 *   ipMaxRequestsPerWindow: number,
 *   maxVerifyAttempts: number,
 *   otpLength: number,
 * }}
 */
function getOtpConfig() {
  const isDevMode = isOtpDevMode();
  const base = isDevMode ? DEVELOPMENT_OTP : PRODUCTION_OTP;

  if (isDevMode && !hasLoggedDevMode) {
    hasLoggedDevMode = true;
    console.log(
      '[otp] Development Testing Mode active — ' +
        `phone ${base.phoneMaxRequestsPerWindow}/${base.phoneWindowMinutes}m, ` +
        `IP ${base.ipMaxRequestsPerWindow}/hour, ` +
        `resend ${base.resendCooldownSeconds}s, ` +
        `ttl ${base.otpTtlMinutes}m`
    );
  }

  return {
    isDevMode,
    ...base,
  };
}

module.exports = {
  isOtpDevMode,
  getOtpConfig,
  PRODUCTION_OTP,
  DEVELOPMENT_OTP,
};
