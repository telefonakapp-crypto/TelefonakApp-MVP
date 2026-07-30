const rateLimit = require('express-rate-limit');

/**
 * Shared rate limiters for sensitive endpoints.
 * Uses default in-memory store (single-instance). For multi-instance
 * production, swap to a Redis store.
 */

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please try again later.' },
});

module.exports = {
  adminLoginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  uploadLimiter,
};
