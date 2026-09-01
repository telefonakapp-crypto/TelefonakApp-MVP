'use strict';

/**
 * Customer marketplace JWT + refresh-session helpers (Phase 3).
 *
 * Access tokens are short-lived JWTs signed with the customer secret.
 * Refresh tokens are opaque random values; only SHA-256 hashes are stored.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const {
  getCustomerJwtSecret,
  CUSTOMER_JWT_ISS,
  CUSTOMER_JWT_AUD,
} = require('../config/env');

const ACCESS_TOKEN_TTL = process.env.CUSTOMER_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.CUSTOMER_REFRESH_TOKEN_TTL_DAYS || 30);
const REGISTRATION_TOKEN_TTL = '1h';

function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function accessExpiresInSeconds() {
  // Used by clients for UI only; server enforces JWT exp.
  const raw = String(ACCESS_TOKEN_TTL).trim();
  const m = raw.match(/^(\d+)([smhd])$/i);
  if (!m) return 15 * 60;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 15 * 60;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id || user.userId,
      phoneNumber: user.phone_number || user.phoneNumber,
      typ: 'access',
    },
    getCustomerJwtSecret(),
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: CUSTOMER_JWT_ISS,
      audience: CUSTOMER_JWT_AUD,
    }
  );
}

function signRegistrationToken(phoneNumber) {
  return jwt.sign(
    {
      phoneNumber,
      verified: true,
      typ: 'registration',
    },
    getCustomerJwtSecret(),
    {
      expiresIn: REGISTRATION_TOKEN_TTL,
      issuer: CUSTOMER_JWT_ISS,
      audience: CUSTOMER_JWT_AUD,
    }
  );
}

/**
 * Verify a customer JWT (access or registration).
 * Accepts legacy tokens signed with the same secret that omit iss/aud/typ
 * so pre-Phase-3 sessions can finish their natural lifetime.
 */
function verifyCustomerToken(token) {
  const secret = getCustomerJwtSecret();
  try {
    return jwt.verify(token, secret, {
      issuer: CUSTOMER_JWT_ISS,
      audience: CUSTOMER_JWT_AUD,
    });
  } catch (err) {
    // Legacy tokens (no iss/aud) — verify without claim checks once.
    if (err.name === 'JsonWebTokenError') {
      const decoded = jwt.verify(token, secret);
      if (decoded.adminId) {
        throw err;
      }
      if (decoded.iss && decoded.iss !== CUSTOMER_JWT_ISS) {
        throw err;
      }
      if (decoded.aud && decoded.aud !== CUSTOMER_JWT_AUD) {
        throw err;
      }
      return decoded;
    }
    throw err;
  }
}

async function createRefreshSession(userId, { userAgent = null, ip = null } = {}) {
  const rawToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO auth_refresh_sessions
       (user_id, token_hash, family_id, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, tokenHash, familyId, expiresAt, userAgent, ip]
  );

  return { refreshToken: rawToken, expiresAt, familyId };
}

/**
 * Issue access + refresh for a verified marketplace user.
 */
async function issueCustomerSession(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const { refreshToken } = await createRefreshSession(user.id, meta);
  return {
    token: accessToken,
    refresh_token: refreshToken,
    expires_in: accessExpiresInSeconds(),
    token_type: 'Bearer',
  };
}

/**
 * Registration / reactivation gate — short-lived access only (no refresh).
 */
function issueRegistrationSession(phoneNumber) {
  return {
    token: signRegistrationToken(phoneNumber),
    expires_in: 60 * 60,
    token_type: 'Bearer',
  };
}

async function revokeRefreshFamily(familyId) {
  await pool.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE family_id = $1 AND revoked_at IS NULL`,
    [familyId]
  );
}

async function revokeAllUserSessions(userId) {
  await pool.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

async function revokeRefreshToken(rawToken) {
  if (!rawToken) return false;
  const tokenHash = hashRefreshToken(rawToken);
  const result = await pool.query(
    `UPDATE auth_refresh_sessions
     SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id`,
    [tokenHash]
  );
  return result.rowCount > 0;
}

/**
 * Rotate refresh token. Detects reuse of an already-revoked token in a family
 * and invalidates the whole family (stolen-token mitigation).
 */
async function rotateRefreshSession(rawToken, meta = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { ok: false, reason: 'invalid' };
  }

  const tokenHash = hashRefreshToken(rawToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, user_id, family_id, expires_at, revoked_at, replaced_by
       FROM auth_refresh_sessions
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'invalid' };
    }

    const row = existing.rows[0];

    // Reuse of a rotated/revoked token → revoke family.
    if (row.revoked_at || row.replaced_by) {
      await client.query(
        `UPDATE auth_refresh_sessions
         SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
         WHERE family_id = $1 AND revoked_at IS NULL`,
        [row.family_id]
      );
      await client.query('COMMIT');
      return { ok: false, reason: 'reuse' };
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query(
        `UPDATE auth_refresh_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id]
      );
      await client.query('COMMIT');
      return { ok: false, reason: 'expired' };
    }

    const userResult = await client.query(
      `SELECT id, phone_number, is_active, is_verified
       FROM users WHERE id = $1 FOR UPDATE`,
      [row.user_id]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].is_active === false) {
      await client.query(
        `UPDATE auth_refresh_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE family_id = $1`,
        [row.family_id]
      );
      await client.query('COMMIT');
      return { ok: false, reason: 'invalid' };
    }

    const user = userResult.rows[0];
    const newRaw = generateRefreshToken();
    const newHash = hashRefreshToken(newRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const inserted = await client.query(
      `INSERT INTO auth_refresh_sessions
         (user_id, token_hash, family_id, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.id, newHash, row.family_id, expiresAt, meta.userAgent || null, meta.ip || null]
    );

    await client.query(
      `UPDATE auth_refresh_sessions
       SET revoked_at = CURRENT_TIMESTAMP,
           replaced_by = $2,
           last_used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [row.id, inserted.rows[0].id]
    );

    await client.query('COMMIT');

    const accessToken = signAccessToken(user);
    return {
      ok: true,
      token: accessToken,
      refresh_token: newRaw,
      expires_in: accessExpiresInSeconds(),
      token_type: 'Bearer',
      user,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  REGISTRATION_TOKEN_TTL,
  hashRefreshToken,
  signAccessToken,
  signRegistrationToken,
  verifyCustomerToken,
  issueCustomerSession,
  issueRegistrationSession,
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshToken,
  revokeRefreshFamily,
  revokeAllUserSessions,
  accessExpiresInSeconds,
};
