const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const pool = require('../config/database');
const verifyToken = require('../middleware/verifyToken');
const {
  issueCustomerSession,
  revokeAllUserSessions,
} = require('../utils/customerAuth');
const {
  OTP_PURPOSE,
  issueOtp,
  consumeOtp,
  otpValidator,
  sendOtpError,
  OTP_TTL_MINUTES,
  shouldExposeOtpInResponse,
  otpIssueSuccessFields,
} = require('../utils/otp');
const { normalizePhoneNumber, phoneNumberVariants, isSamePhoneNumber, phoneNumberValidator } = require('../utils/phone');
const { otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimits');

/**
 * Change Phone Number, verified by OTP.
 *
 * The requested number is parked in users.pending_phone_number and only becomes
 * users.phone_number once a code sent to it is redeemed, so the current number
 * stays active for the whole flow. Every step is keyed by the authenticated
 * user's id — the client never names the account or the pending number it is
 * verifying, which is what keeps one user out of another's pending request.
 */

// Errors are returned as a single readable message (plus the raw list) so the
// mobile screens can show validation feedback the same way as other endpoints.
const rejectInvalid = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({ error: errors.array()[0].msg, errors: errors.array() });
  return true;
};

const clearPendingChange = (userId) =>
  pool.query(
    `UPDATE users
     SET pending_phone_number = NULL, pending_phone_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [userId]
  );

router.use(verifyToken);

/**
 * POST /api/profile/change-phone/request
 * Validates the new number, sends it an OTP, and records the pending change.
 * The user record keeps its current phone number.
 */
router.post('/request', otpRequestLimiter, [phoneNumberValidator('new_phone_number')], async (req, res) => {
  if (rejectInvalid(req, res)) return;

  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const newPhoneNumber = normalizePhoneNumber(req.body.new_phone_number);
    const variants = phoneNumberVariants(newPhoneNumber);

    // One lookup answers both questions: who am I, and does anyone already own
    // this number (in any of the formats older accounts may be stored in)?
    const rows = (await pool.query(
      'SELECT id, phone_number FROM users WHERE id = $1 OR phone_number = ANY($2::text[])',
      [userId, variants]
    )).rows;

    const me = rows.find((row) => row.id === userId);
    if (!me) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (isSamePhoneNumber(me.phone_number, newPhoneNumber)) {
      return res.status(400).json({ error: 'This is already your current phone number' });
    }

    if (rows.some((row) => row.id !== userId)) {
      return res.status(409).json({ error: 'This phone number is already in use by another account' });
    }

    // Cooldown and hourly request limits are enforced by the shared service, so
    // this flow cannot be used to outrun the limits on the login flow either.
    const issued = await issueOtp(pool, {
      phoneNumber: newPhoneNumber,
      purpose: OTP_PURPOSE.PHONE_CHANGE,
    });

    if (!issued.ok) {
      return sendOtpError(res, issued);
    }

    const { code, expiresAt } = issued;

    // Pending state expires with its code, so an abandoned request goes stale
    // instead of lingering as a verifiable change.
    await pool.query(
      `UPDATE users
       SET pending_phone_number = $1, pending_phone_expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newPhoneNumber, expiresAt, userId]
    );

    res.json({
      message: 'Verification code sent to the new phone number',
      new_phone_number: newPhoneNumber,
      expires_at: expiresAt,
      expires_in_minutes: OTP_TTL_MINUTES,
      ...otpIssueSuccessFields(),
      ...(shouldExposeOtpInResponse() ? { otp: code } : {}),
    });
  } catch (error) {
    console.error('Error requesting phone number change:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/profile/change-phone/verify
 * Redeems the code and promotes the pending number to the account's number.
 */
router.post('/verify', otpVerifyLimiter, [otpValidator('otp')], async (req, res) => {
  if (rejectInvalid(req, res)) return;

  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const me = (await pool.query(
      `SELECT id, phone_number, pending_phone_number, pending_phone_expires_at
       FROM users WHERE id = $1`,
      [userId]
    )).rows[0];

    if (!me) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!me.pending_phone_number) {
      return res.status(400).json({ error: 'No pending phone number change. Please request a new code.' });
    }

    if (new Date(me.pending_phone_expires_at).getTime() <= Date.now()) {
      await clearPendingChange(userId);
      return res.status(400).json({ error: 'Verification code expired. Please request a new code.' });
    }

    // The number verified is the stored pending one, never a client-supplied
    // value, and the code must have been issued for this flow.
    const consumed = await consumeOtp(pool, {
      phoneNumber: me.pending_phone_number,
      code: req.body.otp,
      purpose: OTP_PURPOSE.PHONE_CHANGE,
    });

    if (!consumed.ok) {
      return sendOtpError(res, consumed);
    }

    // The number could have been claimed between the request and now.
    const taken = await pool.query(
      'SELECT 1 FROM users WHERE phone_number = ANY($1::text[]) AND id <> $2 LIMIT 1',
      [phoneNumberVariants(me.pending_phone_number), userId]
    );

    if (taken.rows.length > 0) {
      await clearPendingChange(userId);
      return res.status(409).json({ error: 'This phone number is already in use by another account' });
    }

    const result = await pool.query(
      `UPDATE users
       SET phone_number = pending_phone_number,
           pending_phone_number = NULL,
           pending_phone_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND pending_phone_number = $2
       RETURNING *`,
      [userId, me.pending_phone_number]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Pending phone number change was replaced, please try again' });
    }

    const user = result.rows[0];

    // Phone number changed — revoke prior refresh sessions and issue a fresh pair.
    await revokeAllUserSessions(user.id);
    const session = await issueCustomerSession(user, {
      userAgent: req.get('user-agent') || null,
      ip: req.ip || null,
    });

    res.json({
      message: 'Phone number updated successfully',
      ...session,
      user,
    });
  } catch (error) {
    // Losing a race for the same number surfaces as a unique violation.
    if (error.code === '23505') {
      await clearPendingChange(req.user.userId).catch(() => {});
      return res.status(409).json({ error: 'This phone number is already in use by another account' });
    }

    console.error('Error verifying phone number change:', error);
    res.status(500).json({ error: 'Failed to verify phone number' });
  }
});

module.exports = router;
