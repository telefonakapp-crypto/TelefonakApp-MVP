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

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (WEAK_JWT_SECRETS.has(secret) || secret.length < 16) {
    if (isProduction()) {
      throw new Error(
        'JWT_SECRET must be set to a strong value (16+ chars) in production'
      );
    }
    console.warn(
      '[security] JWT_SECRET is missing or weak — using insecure development fallback'
    );
    return 'dev-only-insecure-jwt-secret';
  }
  return secret;
}

/**
 * Fail fast on missing critical configuration.
 */
function validateEnv() {
  const missing = [];

  if (!process.env.DB_NAME) missing.push('DB_NAME');
  if (!process.env.DB_USER) missing.push('DB_USER');

  if (isProduction()) {
    if (!process.env.JWT_SECRET || WEAK_JWT_SECRETS.has(process.env.JWT_SECRET)) {
      missing.push('JWT_SECRET (strong production value)');
    }
    if (!process.env.BASE_URL) {
      missing.push('BASE_URL');
    }
    if (!process.env.CORS_ORIGINS) {
      missing.push('CORS_ORIGINS');
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Touch secret early so misconfiguration fails at boot, not on first request.
  getJwtSecret();
}

module.exports = {
  isProduction,
  getJwtSecret,
  validateEnv,
};
