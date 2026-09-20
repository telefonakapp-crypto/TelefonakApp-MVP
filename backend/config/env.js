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

function readEnvSecret(name) {
  const raw = process.env[name];
  if (raw == null) return '';
  return String(raw).trim();
}

function isStrongSecret(value) {
  return Boolean(value) && value.length >= 16 && !WEAK_JWT_SECRETS.has(value);
}

/**
 * Production: dedicated secret only — never JWT_SECRET.
 * Development: dedicated secret, then JWT_SECRET, then an insecure distinct fallback.
 */
function resolveJwtSecret(dedicatedEnv, label) {
  const dedicated = readEnvSecret(dedicatedEnv);
  if (isStrongSecret(dedicated)) {
    return dedicated;
  }

  if (isProduction()) {
    if (!dedicated) {
      throw new Error(
        `${dedicatedEnv} must be set for ${label} authentication in production`
      );
    }
    throw new Error(
      `${dedicatedEnv} is too weak for ${label} authentication in production (min 16 characters; placeholder values are not allowed)`
    );
  }

  const shared = readEnvSecret('JWT_SECRET');
  if (isStrongSecret(shared)) {
    const key = `${dedicatedEnv}->JWT_SECRET`;
    if (!warnedFallback.has(key)) {
      warnedFallback.add(key);
      console.warn(
        `[security] ${dedicatedEnv} unset — falling back to JWT_SECRET for ${label} (development only; set dedicated secrets before production)`
      );
    }
    return shared;
  }

  const weakKey = `weak-${label}`;
  if (!warnedFallback.has(weakKey)) {
    warnedFallback.add(weakKey);
    console.warn(
      `[security] ${dedicatedEnv}/JWT_SECRET missing or weak — using insecure development fallback for ${label}`
    );
  }
  return `dev-only-insecure-${label}-secret`;
}

/** Customer marketplace JWT signing secret (SEC-013). */
function getCustomerJwtSecret() {
  return resolveJwtSecret('JWT_CUSTOMER_SECRET', 'customer');
}

/** Admin Web JWT signing secret (SEC-013). */
function getAdminJwtSecret() {
  return resolveJwtSecret('JWT_ADMIN_SECRET', 'admin');
}

/**
 * @deprecated Prefer getCustomerJwtSecret / getAdminJwtSecret.
 * Kept for scripts that still expect a single getter (defaults to customer).
 */
function getJwtSecret() {
  return getCustomerJwtSecret();
}

function isUsableOtpPepper(value) {
  if (!isStrongSecret(value)) return false;
  const v = value.toLowerCase();
  if (v.startsWith('your_') || v.startsWith('replace_with')) return false;
  return true;
}

/**
 * Pepper for hashing OTP codes at rest (SEC-014).
 * Production: dedicated OTP_PEPPER only — never JWT_CUSTOMER_SECRET / JWT_ADMIN_SECRET / JWT_SECRET.
 * Development: dedicated pepper, then customer JWT secret (with a warning).
 */
function getOtpPepper() {
  const pepper = readEnvSecret('OTP_PEPPER');

  if (isProduction()) {
    if (!isUsableOtpPepper(pepper)) {
      throw new Error(
        'OTP_PEPPER must be set to a strong dedicated value in production (min 16 characters; placeholder values are not allowed)'
      );
    }
    return pepper;
  }

  if (isUsableOtpPepper(pepper)) {
    return pepper;
  }

  if (!warnedFallback.has('otp-pepper-dev')) {
    warnedFallback.add('otp-pepper-dev');
    console.warn(
      '[security] OTP_PEPPER unset or weak — falling back to customer JWT secret for OTP hashing (development only; set OTP_PEPPER before production)'
    );
  }
  return getCustomerJwtSecret();
}

function assertDistinctOtpPepper() {
  if (!isProduction()) return;

  const pepper = readEnvSecret('OTP_PEPPER');
  const customer = readEnvSecret('JWT_CUSTOMER_SECRET');
  const admin = readEnvSecret('JWT_ADMIN_SECRET');
  const shared = readEnvSecret('JWT_SECRET');

  if (customer && pepper === customer) {
    throw new Error('OTP_PEPPER must be different from JWT_CUSTOMER_SECRET in production');
  }
  if (admin && pepper === admin) {
    throw new Error('OTP_PEPPER must be different from JWT_ADMIN_SECRET in production');
  }
  if (shared && pepper === shared) {
    throw new Error('OTP_PEPPER must be different from JWT_SECRET in production');
  }
}

function isTwilioPlaceholder(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return true;
  return (
    v.startsWith('your_') ||
    v.startsWith('replace_with') ||
    v === 'change-me' ||
    v === 'changeme'
  );
}

/**
 * Twilio credentials used by utils/otp.js sendOtp.
 * Returns null when SMS cannot be sent (missing/placeholder config).
 */
function getTwilioSmsConfig() {
  const accountSid = readEnvSecret('TWILIO_ACCOUNT_SID');
  const authToken = readEnvSecret('TWILIO_AUTH_TOKEN');
  const phoneNumber = readEnvSecret('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !phoneNumber) return null;
  if (isTwilioPlaceholder(accountSid) || isTwilioPlaceholder(authToken) || isTwilioPlaceholder(phoneNumber)) {
    return null;
  }

  return { accountSid, authToken, phoneNumber };
}

function assertProductionTwilioConfig() {
  if (!isProduction()) return;

  const accountSid = readEnvSecret('TWILIO_ACCOUNT_SID');
  const authToken = readEnvSecret('TWILIO_AUTH_TOKEN');
  const phoneNumber = readEnvSecret('TWILIO_PHONE_NUMBER');

  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
    throw new Error(
      'TWILIO_ACCOUNT_SID is invalid for production SMS (Twilio Account SID required)'
    );
  }
  if (isTwilioPlaceholder(authToken) || authToken.length < 16) {
    throw new Error('TWILIO_AUTH_TOKEN is invalid for production SMS');
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    throw new Error(
      'TWILIO_PHONE_NUMBER is invalid for production SMS (E.164 number required, e.g. +9627…)'
    );
  }
}

const DEFAULT_ADMIN_ACCESS_TOKEN_TTL = '8h';
const PRODUCTION_MAX_ADMIN_ACCESS_TOKEN_MS = 24 * 60 * 60 * 1000;

function parseJwtDurationToMs(raw) {
  const s = String(raw || '').trim();
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(s);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

/** Admin dashboard access JWT lifetime (jsonwebtoken expiresIn string). */
function getAdminAccessTokenTtl() {
  const raw = readEnvSecret('ADMIN_ACCESS_TOKEN_TTL');
  if (!raw) return DEFAULT_ADMIN_ACCESS_TOKEN_TTL;
  if (parseJwtDurationToMs(raw) == null) {
    throw new Error('ADMIN_ACCESS_TOKEN_TTL must be a duration like 8h, 12h, or 15m');
  }
  return raw;
}

function assertAdminAccessTokenTtl() {
  const ttl = getAdminAccessTokenTtl();
  const ms = parseJwtDurationToMs(ttl);
  if (ms == null || ms <= 0) {
    throw new Error('ADMIN_ACCESS_TOKEN_TTL must be a duration like 8h, 12h, or 15m');
  }
  if (isProduction() && ms > PRODUCTION_MAX_ADMIN_ACCESS_TOKEN_MS) {
    throw new Error('ADMIN_ACCESS_TOKEN_TTL must be 24h or less in production');
  }
}

function assertDistinctJwtSecrets() {
  const customer = readEnvSecret('JWT_CUSTOMER_SECRET');
  const admin = readEnvSecret('JWT_ADMIN_SECRET');
  if (!isStrongSecret(customer) || !isStrongSecret(admin)) {
    return;
  }
  if (customer !== admin) {
    return;
  }
  if (isProduction()) {
    throw new Error(
      'JWT_CUSTOMER_SECRET and JWT_ADMIN_SECRET must be different values in production'
    );
  }
  if (!warnedFallback.has('identical-dev-secrets')) {
    warnedFallback.add('identical-dev-secrets');
    console.warn(
      '[security] JWT_CUSTOMER_SECRET and JWT_ADMIN_SECRET are identical; use distinct values before production'
    );
  }
}

/**
 * Fail fast on missing critical configuration.
 */
function validateEnv() {
  const missing = [];

  if (!process.env.DB_NAME) missing.push('DB_NAME');
  if (!process.env.DB_USER) missing.push('DB_USER');

  if (isProduction()) {
    if (!isStrongSecret(readEnvSecret('JWT_CUSTOMER_SECRET'))) {
      missing.push('JWT_CUSTOMER_SECRET');
    }
    if (!isStrongSecret(readEnvSecret('JWT_ADMIN_SECRET'))) {
      missing.push('JWT_ADMIN_SECRET');
    }
    if (!process.env.BASE_URL) missing.push('BASE_URL');
    if (!process.env.CORS_ORIGINS) missing.push('CORS_ORIGINS');
    if (!readEnvSecret('TWILIO_ACCOUNT_SID')) missing.push('TWILIO_ACCOUNT_SID');
    if (!readEnvSecret('TWILIO_AUTH_TOKEN')) missing.push('TWILIO_AUTH_TOKEN');
    if (!readEnvSecret('TWILIO_PHONE_NUMBER')) missing.push('TWILIO_PHONE_NUMBER');
    if (!isUsableOtpPepper(readEnvSecret('OTP_PEPPER'))) {
      missing.push('OTP_PEPPER');
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  assertDistinctJwtSecrets();
  assertProductionTwilioConfig();
  assertAdminAccessTokenTtl();
  assertDistinctOtpPepper();

  // Touch secrets early so misconfiguration fails at boot, not on first request.
  getCustomerJwtSecret();
  getAdminJwtSecret();
  getOtpPepper();
}

module.exports = {
  isProduction,
  getJwtSecret,
  getCustomerJwtSecret,
  getAdminJwtSecret,
  getOtpPepper,
  getTwilioSmsConfig,
  getAdminAccessTokenTtl,
  validateEnv,
  CUSTOMER_JWT_ISS,
  CUSTOMER_JWT_AUD,
  ADMIN_JWT_ISS,
  ADMIN_JWT_AUD,
  DEFAULT_ADMIN_ACCESS_TOKEN_TTL,
};
