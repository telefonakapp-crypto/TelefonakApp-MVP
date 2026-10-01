/**
 * Central environment loading + startup validation.
 * Call validateEnv() once before accepting traffic.
 */
require('dotenv').config();

const { normalizePhoneNumber } = require('../utils/phone');

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

function isSmsPlaceholder(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return true;
  if (v.includes('<secret>')) return true;
  return (
    v.startsWith('your_') ||
    v.startsWith('replace_with') ||
    v.startsWith('example') ||
    v === 'change-me' ||
    v === 'changeme' ||
    v === '<secret>'
  );
}

function isValidSmsApiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch (_error) {
    return false;
  }
}

function isValidSmsType(value) {
  return /^[0-9]+$/.test(String(value || '').trim());
}

/**
 * Raw TEST_OTP_* settings (phone is canonicalized here and in utils/otp.js).
 * Bypass is inactive unless ENABLED is exactly "true".
 */
function getTestOtpBypassSettings() {
  return {
    enabled: readEnvSecret('TEST_OTP_BYPASS_ENABLED') === 'true',
    phone: readEnvSecret('TEST_OTP_PHONE'),
    code: readEnvSecret('TEST_OTP_CODE'),
  };
}

/** Matches backend/config/otp.js otpLength (always 4). */
const TEST_OTP_CODE_RE = /^\d{4}$/;

function isTestOtpBypassRequested() {
  return getTestOtpBypassSettings().enabled;
}

function isTestOtpBypassConfigValid() {
  const settings = getTestOtpBypassSettings();
  if (!settings.enabled) return false;
  const phone = normalizePhoneNumber(settings.phone);
  const code = String(settings.code || '').trim();
  return Boolean(phone && TEST_OTP_CODE_RE.test(code));
}

/**
 * Production: ENABLED=true with invalid phone/code must fail startup.
 * Do not silently disable the bypass (and do not fall through to SMS validation).
 */
function assertProductionTestOtpBypassConfig() {
  if (!isProduction()) return;
  if (!isTestOtpBypassRequested()) return;
  if (isTestOtpBypassConfigValid()) return;
  throw new Error(
    'TEST_OTP_BYPASS_ENABLED=true requires a valid TEST_OTP_PHONE (Jordanian mobile) and TEST_OTP_CODE (4 digits)'
  );
}

/**
 * SMS provider credentials used by utils/otp.js sendOtp.
 * Returns null when SMS cannot be sent (missing/placeholder/invalid config).
 */
function getSmsProviderConfig() {
  const apiUrl = readEnvSecret('SMS_API_URL');
  const username = readEnvSecret('SMS_USERNAME');
  const password = readEnvSecret('SMS_PASSWORD');
  const senderId = readEnvSecret('SMS_SENDER_ID');
  const type = readEnvSecret('SMS_TYPE');

  if (!apiUrl || !username || !password || !senderId || !type) return null;
  if (
    isSmsPlaceholder(apiUrl) ||
    isSmsPlaceholder(username) ||
    isSmsPlaceholder(password) ||
    isSmsPlaceholder(senderId) ||
    isSmsPlaceholder(type)
  ) {
    return null;
  }
  if (!isValidSmsApiUrl(apiUrl) || !isValidSmsType(type)) return null;

  return { apiUrl, username, password, senderId, type };
}

function assertProductionSmsConfig() {
  if (!isProduction()) return;
  if (isTestOtpBypassConfigValid()) return;

  const apiUrl = readEnvSecret('SMS_API_URL');
  const username = readEnvSecret('SMS_USERNAME');
  const password = readEnvSecret('SMS_PASSWORD');
  const senderId = readEnvSecret('SMS_SENDER_ID');
  const type = readEnvSecret('SMS_TYPE');

  if (!isValidSmsApiUrl(apiUrl) || isSmsPlaceholder(apiUrl)) {
    throw new Error('SMS_API_URL is invalid for production SMS');
  }
  if (!username || isSmsPlaceholder(username)) {
    throw new Error('SMS_USERNAME is invalid for production SMS');
  }
  if (!password || isSmsPlaceholder(password)) {
    throw new Error('SMS_PASSWORD is invalid for production SMS');
  }
  if (!senderId || isSmsPlaceholder(senderId)) {
    throw new Error('SMS_SENDER_ID is invalid for production SMS');
  }
  if (!isValidSmsType(type) || isSmsPlaceholder(type)) {
    throw new Error('SMS_TYPE is invalid for production SMS');
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
    if (!isTestOtpBypassRequested()) {
      if (!readEnvSecret('SMS_API_URL')) missing.push('SMS_API_URL');
      if (!readEnvSecret('SMS_USERNAME')) missing.push('SMS_USERNAME');
      if (!readEnvSecret('SMS_PASSWORD')) missing.push('SMS_PASSWORD');
      if (!readEnvSecret('SMS_SENDER_ID')) missing.push('SMS_SENDER_ID');
      if (!readEnvSecret('SMS_TYPE')) missing.push('SMS_TYPE');
    }
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
  assertProductionTestOtpBypassConfig();
  assertProductionSmsConfig();
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
  getSmsProviderConfig,
  getTestOtpBypassSettings,
  isTestOtpBypassConfigValid,
  getAdminAccessTokenTtl,
  validateEnv,
  CUSTOMER_JWT_ISS,
  CUSTOMER_JWT_AUD,
  ADMIN_JWT_ISS,
  ADMIN_JWT_AUD,
  DEFAULT_ADMIN_ACCESS_TOKEN_TTL,
};
