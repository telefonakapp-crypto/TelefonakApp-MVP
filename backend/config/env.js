/**
 * Central environment loading + startup validation.
 * Call validateEnv() once before accepting traffic.
 */
require('dotenv').config();

const WEAK_JWT_SECRETS = new Set([
  '',
  'your-secret-key',
  'your_jwt_secret_key_here',
  'change-me',
  'secret',
]);

const CUSTOMER_JWT_ISS = 'telefonak-customer';
const CUSTOMER_JWT_AUD = 'telefonak-mobile';
const ADMIN_JWT_ISS = 'telefonak-admin';
const ADMIN_JWT_AUD = 'telefonak-admin-api';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

const warnedFallback = new Set();

function resolveSecret(primaryEnv, fallbackEnv, label) {
  const primary = process.env[primaryEnv] || '';
  if (primary && !WEAK_JWT_SECRETS.has(primary) && primary.length >= 16) {
    return primary;
  }

  const fallback = process.env[fallbackEnv] || '';
  if (fallback && !WEAK_JWT_SECRETS.has(fallback) && fallback.length >= 16) {
    const key = `${primaryEnv}->${fallbackEnv}`;
    if (!isProduction() && !warnedFallback.has(key)) {
      warnedFallback.add(key);
      console.warn(
        `[security] ${primaryEnv} unset — falling back to ${fallbackEnv} for ${label} (set dedicated secrets before production)`
      );
    }
    return fallback;
  }

  if (isProduction()) {
    throw new Error(
      `${primaryEnv} (or strong ${fallbackEnv}) must be set for ${label} in production`
    );
  }

  const weakKey = `weak-${label}`;
  if (!warnedFallback.has(weakKey)) {
    warnedFallback.add(weakKey);
    console.warn(
      `[security] ${primaryEnv}/${fallbackEnv} missing or weak — using insecure development fallback for ${label}`
    );
  }
  return `dev-only-insecure-${label}-secret`;
}

/** Customer marketplace JWT signing secret (SEC-013). */
function getCustomerJwtSecret() {
  return resolveSecret('JWT_CUSTOMER_SECRET', 'JWT_SECRET', 'customer');
}

/** Admin Web JWT signing secret (SEC-013). */
function getAdminJwtSecret() {
  return resolveSecret('JWT_ADMIN_SECRET', 'JWT_SECRET', 'admin');
}

/**
 * @deprecated Prefer getCustomerJwtSecret / getAdminJwtSecret.
 * Kept for scripts that still expect a single getter (defaults to customer).
 */
function getJwtSecret() {
  return getCustomerJwtSecret();
}

/** Pepper for hashing OTP codes at rest (SEC-014). */
function getOtpPepper() {
  const pepper = process.env.OTP_PEPPER || '';
  if (pepper && pepper.length >= 16) return pepper;
  return getCustomerJwtSecret();
}

/**
 * Fail fast on missing critical configuration.
 */
function validateEnv() {
  const missing = [];

  if (!process.env.DB_NAME) missing.push('DB_NAME');
  if (!process.env.DB_USER) missing.push('DB_USER');

  if (isProduction()) {
    const hasCustomer =
      (process.env.JWT_CUSTOMER_SECRET &&
        !WEAK_JWT_SECRETS.has(process.env.JWT_CUSTOMER_SECRET) &&
        process.env.JWT_CUSTOMER_SECRET.length >= 16) ||
      (process.env.JWT_SECRET &&
        !WEAK_JWT_SECRETS.has(process.env.JWT_SECRET) &&
        process.env.JWT_SECRET.length >= 16);
    const hasAdmin =
      (process.env.JWT_ADMIN_SECRET &&
        !WEAK_JWT_SECRETS.has(process.env.JWT_ADMIN_SECRET) &&
        process.env.JWT_ADMIN_SECRET.length >= 16) ||
      (process.env.JWT_SECRET &&
        !WEAK_JWT_SECRETS.has(process.env.JWT_SECRET) &&
        process.env.JWT_SECRET.length >= 16);

    if (!hasCustomer) missing.push('JWT_CUSTOMER_SECRET or JWT_SECRET');
    if (!hasAdmin) missing.push('JWT_ADMIN_SECRET or JWT_SECRET');
    if (!process.env.BASE_URL) missing.push('BASE_URL');
    if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Touch secrets early so misconfiguration fails at boot, not on first request.
  getCustomerJwtSecret();
  getAdminJwtSecret();
}

module.exports = {
  isProduction,
  getJwtSecret,
  getCustomerJwtSecret,
  getAdminJwtSecret,
  getOtpPepper,
  validateEnv,
  CUSTOMER_JWT_ISS,
  CUSTOMER_JWT_AUD,
  ADMIN_JWT_ISS,
  ADMIN_JWT_AUD,
};
