const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimits');
const {
  OTP_PURPOSE,
  issueOtp,
  consumeOtp,
  otpValidator,
  sendOtpError,
  shouldExposeOtpInResponse,
  otpIssueSuccessFields,
} = require('../utils/otp');
const {
  issueCustomerSession,
  issueRegistrationSession,
  rotateRefreshSession,
  revokeRefreshToken,
} = require('../utils/customerAuth');

function clientMeta(req) {
  return {
    userAgent: req.get('user-agent') || null,
    ip: req.ip || null,
  };
}

// Request OTP
router.post(
  '/request-otp',
  otpRequestLimiter,
  [body('phone_number').isMobilePhone('ar-JO').withMessage('Invalid Jordanian phone number')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone_number } = req.body;
      const issued = await issueOtp(pool, {
        phoneNumber: phone_number,
        purpose: OTP_PURPOSE.AUTH,
      });

      if (!issued.ok) {
        return sendOtpError(res, issued);
      }

      const payload = {
        message: 'OTP sent successfully',
        ...otpIssueSuccessFields(),
      };
      if (shouldExposeOtpInResponse()) {
        payload.otp = issued.code;
      }
      res.json(payload);
    } catch (error) {
      console.error('Error requesting OTP:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  }
);

// Verify OTP
router.post(
  '/verify-otp',
  otpVerifyLimiter,
  [
    body('phone_number').isMobilePhone('ar-JO').withMessage('Invalid Jordanian phone number'),
    otpValidator('otp'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone_number, otp } = req.body;

      const consumed = await consumeOtp(pool, {
        phoneNumber: phone_number,
        code: otp,
        purpose: OTP_PURPOSE.AUTH,
      });

      if (!consumed.ok) {
        return sendOtpError(res, consumed);
      }

      const userResult = await pool.query('SELECT * FROM users WHERE phone_number = $1', [
        phone_number,
      ]);
      const existingUser = userResult.rows[0];

      // Deactivated accounts cannot log in. They must re-complete registration
      // (reactivation) so the marketplace stays a clean slate.
      if (existingUser && existingUser.is_active === false) {
        const session = issueRegistrationSession(phone_number);
        return res.json({
          message: 'OTP verified successfully. Please complete registration.',
          ...session,
          isNewUser: true,
          isReactivation: true,
        });
      }

      if (existingUser && existingUser.is_verified) {
        const session = await issueCustomerSession(existingUser, clientMeta(req));
        return res.json({
          message: 'Login successful',
          ...session,
          user: existingUser,
          isNewUser: false,
        });
      }

      const session = issueRegistrationSession(phone_number);
      return res.json({
        message: 'OTP verified successfully. Please complete registration.',
        ...session,
        isNewUser: true,
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  }
);

/**
 * POST /auth/refresh
 * Rotate refresh token → new access + refresh pair.
 */
router.post(
  '/refresh',
  [body('refresh_token').isString().notEmpty().withMessage('refresh_token is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const rotated = await rotateRefreshSession(req.body.refresh_token, clientMeta(req));
      if (!rotated.ok) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      return res.json({
        message: 'Token refreshed',
        token: rotated.token,
        refresh_token: rotated.refresh_token,
        expires_in: rotated.expires_in,
        token_type: rotated.token_type,
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      return res.status(500).json({ error: 'Failed to refresh token' });
    }
  }
);

/**
 * POST /auth/logout
 * Revoke the presented refresh token (client must also clear SecureStore).
 */
router.post(
  '/logout',
  [body('refresh_token').optional().isString()],
  async (req, res) => {
    try {
      const refreshToken = req.body?.refresh_token;
      if (refreshToken) {
        await revokeRefreshToken(refreshToken);
      }
      return res.json({ message: 'Logged out' });
    } catch (error) {
      console.error('Error logging out:', error);
      return res.status(500).json({ error: 'Failed to logout' });
    }
  }
);

module.exports = router;
