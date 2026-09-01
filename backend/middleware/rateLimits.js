const rateLimit = require('express-rate-limit');
const { getOtpConfig } = require('../config/otp');

/**
 * Shared rate limiters for sensitive endpoints.
 * Uses default in-memory store (single-instance). For multi-instance
 * production, swap to a Redis store.
 *
 * OTP request limiting is two-layered:
 * 1) Per-phone budgets in utils/otp.js (cooldown + rolling hourly quota)
 * 2) Per-IP budget here (higher threshold) to stop multi-number SMS abuse
 *    from one network without making phones share each other's quota.
 *
 * IP thresholds come from config/otp.js (production vs Development Testing Mode).
 */

const otpConfig = getOtpConfig();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const otpRequestLimiter = rateLimit({
  windowMs: otpConfig.ipWindowMs,
  max: otpConfig.ipMaxRequestsPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please try again later.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP verification attempts. Please try again later.' },
});

// Production stays tight. Development Testing Mode must allow consecutive
// security-suite runs (suites 08/11/15/17 share one IP and one window).
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: otpConfig.isDevMode ? 500 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please try again later.' },
});

module.exports = {
  adminLoginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  uploadLimiter,
  get OTP_IP_WINDOW_MS() {
    return getOtpConfig().ipWindowMs;
  },
  get OTP_IP_MAX_REQUESTS_PER_WINDOW() {
    return getOtpConfig().ipMaxRequestsPerWindow;
  },
};
