const crypto = require('crypto');
const { body } = require('express-validator');
const { isProduction, getOtpPepper } = require('../config/env');
const { getOtpConfig, isOtpDevMode } = require('../config/otp');

/**
 * Shared OTP service, used by every flow that needs a one-time code (login,
 * registration, phone change). It owns code generation, delivery, expiry,
 * single-use redemption, and rate limiting, so a new flow gets all of it by
 * calling issueOtp / consumeOtp and nothing else.
 *
 * Codes are scoped by purpose, so a code issued for one flow can never be
 * redeemed in another. Rate limits are deliberately NOT scoped by purpose: they
 * are per phone number, so no flow can be used to top up another flow's budget.
 *
 * Numeric limits come from config/otp.js (production vs Development Testing Mode).
 * At rest, only an HMAC of the code is stored (SEC-014) — never plaintext.
 */

const OTP_PURPOSE = {
  AUTH: 'auth',
  PHONE_CHANGE: 'phone_change',
};

const OTP_ERROR = {
  COOLDOWN: 'cooldown',
  REQUEST_LIMIT: 'request_limit',
  INVALID: 'invalid',
  ATTEMPTS_EXCEEDED: 'attempts_exceeded',
};

const OTP_LIMIT = {
  RESEND_COOLDOWN: 'resend_cooldown',
  REQUEST_WINDOW: 'request_window',
};

// Development returns a fixed code so mobile QA stays simple without SMS.
const TEST_MODE_CODE = '1234';

function generateOtpCode() {
  if (isProduction() || process.env.OTP_MODE === 'random') {
    return String(crypto.randomInt(1000, 10000));
  }
  return TEST_MODE_CODE;
}

/** HMAC-SHA256 hex digest of phone|purpose|code — stored instead of plaintext. */
function hashOtpCode(phoneNumber, purpose, code) {
  return crypto
    .createHmac('sha256', getOtpPepper())
    .update(`${String(phoneNumber)}|${String(purpose)}|${String(code)}`)
    .digest('hex');
}

/**
 * Dev convenience only. Production must never return OTP in JSON (SEC-008).
 * Staging with NODE_ENV=production is also blocked.
 */
function shouldExposeOtpInResponse() {
  if (isProduction()) return false;
  return process.env.NODE_ENV === 'development' || process.env.OTP_DEV_MODE === 'true';
}

function formatPhoneForDevLog(phoneNumber) {
  const raw = String(phoneNumber || '');
  if (raw.startsWith('+')) return raw;
  if (/^0\d+$/.test(raw)) return `+962${raw.slice(1)}`;
  return raw;
}

/** Console-only helper — never used in production (isOtpDevMode is false there). */
function logDevOtp(phoneNumber, code) {
  if (isProduction()) return;
  console.log(
    `[DEV OTP]\nPhone: ${formatPhoneForDevLog(phoneNumber)}\nOTP: ${code}`
  );
}

async function sendOtp(phoneNumber, code) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  let sentViaTwilio = false;

  if (sid && token && from && !sid.startsWith('your_')) {
    try {
      const twilio = require('twilio');
      const client = twilio(sid, token);
      await client.messages.create({
        body: `Your Telefonak verification code is: ${code}`,
        from,
        to: phoneNumber,
      });
      sentViaTwilio = true;
    } catch (error) {
      console.error('[otp] Twilio send failed:', error.message || error);
      throw error;
    }
  }

  if (isOtpDevMode()) {
    // Always print in Development Testing Mode (with or without Twilio).
    logDevOtp(phoneNumber, code);
  } else if (!sentViaTwilio) {
    if (isProduction()) {
      console.warn(
        '[otp] Production OTP issued without Twilio credentials — configure TWILIO_* before launch'
      );
    } else {
      // Non-production fallback without Twilio — still avoid logging the code
      // unless Development Testing Mode is on (handled above).
      console.log(`[TEST MODE] OTP issued for ${formatPhoneForDevLog(phoneNumber)} (code not logged)`);
    }
  }

  return true;
}

const secondsUntil = (date) => Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / 1000));

/**
 * Issue a code for a phone number, unless a rate limit says otherwise.
 *
 * Limits are enforced inside a transaction that holds a per-phone advisory lock,
 * so simultaneous requests queue up and are counted rather than racing past each
 * other. A refused request neither generates a code nor disturbs the outstanding
 * one, which keeps working until it expires.
 *
 * @returns {Promise<{ok: true, code: string, expiresAt: Date}
 *                  | {ok: false, reason: string, retryAfterSeconds: number}>}
 */
async function issueOtp(pool, { phoneNumber, purpose = OTP_PURPOSE.AUTH }) {
  const {
    resendCooldownSeconds,
    otpTtlMinutes,
    phoneWindowMinutes,
    phoneMaxRequestsPerWindow,
  } = getOtpConfig();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serialize issuing per phone number for the rest of this transaction.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [phoneNumber]);

    // Drop rows that have aged out of the window (they can no longer affect any
    // limit) and measure what is left, in one round trip. Every remaining row
    // for this number is therefore a request inside the current window.
    const windowState = (await client.query(
      `WITH pruned AS (
         DELETE FROM otp_codes
         WHERE phone_number = $1 AND created_at <= NOW() - ($2 || ' minutes')::interval
       )
       SELECT COUNT(*)::int AS requests,
              MIN(created_at) AS oldest_request,
              MAX(created_at) AS latest_request
       FROM otp_codes
       WHERE phone_number = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
      [phoneNumber, phoneWindowMinutes]
    )).rows[0];

    if (windowState.latest_request) {
      const nextAllowedAt =
        new Date(windowState.latest_request).getTime() + resendCooldownSeconds * 1000;
      if (nextAllowedAt > Date.now()) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          reason: OTP_ERROR.COOLDOWN,
          retryAfterSeconds: secondsUntil(nextAllowedAt),
        };
      }
    }

    if (windowState.requests >= phoneMaxRequestsPerWindow) {
      // The budget frees up when the oldest request leaves the window.
      const windowFreesAt =
        new Date(windowState.oldest_request).getTime() + phoneWindowMinutes * 60 * 1000;
      await client.query('ROLLBACK');
      return {
        ok: false,
        reason: OTP_ERROR.REQUEST_LIMIT,
        retryAfterSeconds: secondsUntil(windowFreesAt),
      };
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(phoneNumber, purpose, code);
    const expiresAt = new Date(Date.now() + otpTtlMinutes * 60 * 1000);

    // Retiring the previous code for this purpose keeps exactly one redeemable
    // code per flow, as before. It is marked spent rather than deleted so the
    // request still counts towards the rolling window.
    await client.query(
      `WITH retired AS (
         UPDATE otp_codes SET is_used = TRUE
         WHERE phone_number = $1 AND purpose = $4 AND is_used = FALSE
       )
       INSERT INTO otp_codes (phone_number, code, expires_at, purpose)
       VALUES ($1, $2, $3, $4)`,
      [phoneNumber, codeHash, expiresAt, purpose]
    );

    await client.query('COMMIT');

    // Delivered after commit so a rolled back request never sends an SMS.
    await sendOtp(phoneNumber, code);

    return {
      ok: true,
      code,
      expiresAt,
      requestsRemaining: phoneMaxRequestsPerWindow - (windowState.requests + 1),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Redeem a code.
 *
 * A correct code is marked used in the same statement that matches it, so it can
 * never be replayed, and its attempt counter is reset. An incorrect code
 * increments the counter on the outstanding code and burns it on the final
 * allowed attempt, forcing the user to request a new one.
 *
 * @returns {Promise<{ok: true} | {ok: false, reason: string, attemptsRemaining?: number}>}
 */
async function consumeOtp(pool, { phoneNumber, code, purpose = OTP_PURPOSE.AUTH }) {
  const { maxVerifyAttempts } = getOtpConfig();
  const codeHash = hashOtpCode(phoneNumber, purpose, code);

  // Selecting the row FOR UPDATE inside the UPDATE makes redemption atomic.
  const activeCode = `
    SELECT id FROM otp_codes
    WHERE phone_number = $1 AND purpose = $2
      AND is_used = FALSE AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE`;

  const redeemed = await pool.query(
    `UPDATE otp_codes
     SET is_used = TRUE, attempts = 0
     WHERE id = (${activeCode}) AND code = $3
     RETURNING id`,
    [phoneNumber, purpose, codeHash]
  );

  if (redeemed.rows.length > 0) {
    return { ok: true };
  }

  // Wrong code (or nothing outstanding). Charge the attempt to the outstanding
  // code, and burn it if this was the last allowed guess.
  const attempted = await pool.query(
    `UPDATE otp_codes
     SET attempts = attempts + 1,
         is_used = (attempts + 1 >= $3)
     WHERE id = (${activeCode})
     RETURNING attempts, is_used`,
    [phoneNumber, purpose, maxVerifyAttempts]
  );

  if (attempted.rows.length === 0) {
    // Nothing redeemable: never issued, already used, or expired.
    return { ok: false, reason: OTP_ERROR.INVALID };
  }

  const { attempts, is_used: burned } = attempted.rows[0];

  return burned
    ? { ok: false, reason: OTP_ERROR.ATTEMPTS_EXCEEDED }
    : { ok: false, reason: OTP_ERROR.INVALID, attemptsRemaining: maxVerifyAttempts - attempts };
}

/**
 * Fields every successful OTP-issue response should include so clients can
 * start the resend countdown from the server constant (not a guessed value).
 */
function otpIssueSuccessFields() {
  const { resendCooldownSeconds, otpTtlMinutes } = getOtpConfig();
  return {
    resend_cooldown_seconds: resendCooldownSeconds,
    otp_ttl_seconds: otpTtlMinutes * 60,
  };
}

/**
 * Single place where OTP refusals become HTTP responses, so every flow reports
 * the same limits the same way.
 */
function sendOtpError(res, result) {
  if (result.retryAfterSeconds) {
    res.set('Retry-After', String(result.retryAfterSeconds));
  }

  switch (result.reason) {
    case OTP_ERROR.COOLDOWN:
      return res.status(429).json({
        error: `Please wait ${result.retryAfterSeconds} seconds before requesting another code`,
        retry_after_seconds: result.retryAfterSeconds,
        // Short gap between sends — drives the Resend button countdown.
        limit: OTP_LIMIT.RESEND_COOLDOWN,
      });

    case OTP_ERROR.REQUEST_LIMIT:
      return res.status(429).json({
        error: `Too many verification codes requested. Please try again in ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`,
        retry_after_seconds: result.retryAfterSeconds,
        // Hourly budget exhausted — must NOT drive the Resend countdown.
        limit: OTP_LIMIT.REQUEST_WINDOW,
      });

    case OTP_ERROR.ATTEMPTS_EXCEEDED:
      return res.status(429).json({
        error: 'Too many incorrect attempts. Please request a new code.',
      });

    default:
      // Unchanged response for a wrong, expired, or already used code.
      return res.status(400).json({
        error: 'Invalid or expired OTP',
        ...(result.attemptsRemaining !== undefined ? { attempts_remaining: result.attemptsRemaining } : {}),
      });
  }
}

const otpValidator = (field = 'otp') => {
  const { otpLength } = getOtpConfig();
  return body(field)
    .isLength({ min: otpLength, max: otpLength })
    .withMessage(`OTP must be ${otpLength} digits`);
};

// Named exports keep existing import sites working; values resolve from config.
module.exports = {
  get OTP_LENGTH() {
    return getOtpConfig().otpLength;
  },
  get OTP_TTL_MINUTES() {
    return getOtpConfig().otpTtlMinutes;
  },
  get OTP_RESEND_COOLDOWN_SECONDS() {
    return getOtpConfig().resendCooldownSeconds;
  },
  get OTP_REQUEST_WINDOW_MINUTES() {
    return getOtpConfig().phoneWindowMinutes;
  },
  get OTP_MAX_REQUESTS_PER_WINDOW() {
    return getOtpConfig().phoneMaxRequestsPerWindow;
  },
  get OTP_MAX_VERIFY_ATTEMPTS() {
    return getOtpConfig().maxVerifyAttempts;
  },
  OTP_PURPOSE,
  OTP_ERROR,
  OTP_LIMIT,
  generateOtpCode,
  hashOtpCode,
  sendOtp,
  shouldExposeOtpInResponse,
  otpIssueSuccessFields,
  issueOtp,
  consumeOtp,
  sendOtpError,
  otpValidator,
  isOtpDevMode,
  getOtpConfig,
};
