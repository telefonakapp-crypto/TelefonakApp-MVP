const rateLimit = require('express-rate-limit');
const { MemoryStore } = rateLimit;
const { getOtpConfig } = require('../config/otp');
const { clientIpKey } = require('../utils/rateLimitIdentity');

/**
 * In-memory IP rate limiters for sensitive HTTP endpoints.
 *
 * This limiter is process-local and is suitable for a single backend instance.
 * If Telefonak is deployed across multiple API instances, the limiter must be
 * replaced with a shared store such as Redis.
 *
 * Do not set Express `trust proxy` to `true` (that would honor arbitrary
 * X-Forwarded-For). Production behind nginx should set TRUST_PROXY=1 so
 * Express trusts a single hop and `req.ip` is the real client.
 *
 * OTP request limiting is two-layered:
 * 1) Per-phone budgets in utils/otp.js (canonical 07XXXXXXXX, cooldown + hourly quota)
 * 2) Per-IP budget here (higher threshold) to stop multi-number SMS abuse
 *
 * OTP request, OTP verification, and admin login each use a separate MemoryStore
 * so their counters never share or reset each other.
 *
 * MemoryStore keeps at most two windows of keys and drops expired entries on a
 * single interval per limiter (not per request).
 */

const otpConfig = getOtpConfig();

const ipLimiterOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  // Custom keyGenerator uses req.ip only. Disable the default XFF warning/throw
  // so a client header cannot crash or bypass the limiter when TRUST_PROXY is off.
  validate: { xForwardedForHeader: false },
};

const otpRequestStore = new MemoryStore();
const otpVerifyStore = new MemoryStore();
const adminLoginStore = new MemoryStore();
const uploadStore = new MemoryStore();

const adminLoginLimiter = rateLimit({
  ...ipLimiterOptions,
  windowMs: 15 * 60 * 1000,
  max: 20,
  store: adminLoginStore,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const otpRequestLimiter = rateLimit({
  ...ipLimiterOptions,
  windowMs: otpConfig.ipWindowMs,
  max: otpConfig.ipMaxRequestsPerWindow,
  store: otpRequestStore,
  message: { error: 'Too many OTP requests. Please try again later.' },
});

const otpVerifyLimiter = rateLimit({
  ...ipLimiterOptions,
  windowMs: 15 * 60 * 1000,
  max: 60,
  store: otpVerifyStore,
  message: { error: 'Too many OTP verification attempts. Please try again later.' },
});

// Production stays tight. Development Testing Mode must allow consecutive
// security-suite runs (suites 08/11/15/17 share one IP and one window).
const uploadLimiter = rateLimit({
  ...ipLimiterOptions,
  windowMs: 15 * 60 * 1000,
  max: otpConfig.isDevMode ? 500 : 60,
  store: uploadStore,
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
