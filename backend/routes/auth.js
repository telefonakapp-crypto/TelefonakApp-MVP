const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OTP_PURPOSE, issueOtp, consumeOtp, otpValidator, sendOtpError } = require('../utils/otp');

// Request OTP
router.post('/request-otp', 
  [
    body('phone_number').isMobilePhone('ar-JO').withMessage('Invalid Jordanian phone number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone_number } = req.body;
      // Cooldown and hourly request limits are enforced by the shared service.
      const issued = await issueOtp(pool, {
        phoneNumber: phone_number,
        purpose: OTP_PURPOSE.AUTH,
      });

      if (!issued.ok) {
        return sendOtpError(res, issued);
      }

      res.json({ 
        message: 'OTP sent successfully',
        // Always return OTP in test mode (hardcoded to 1234)
        otp: issued.code
      });
    } catch (error) {
      console.error('Error requesting OTP:', error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  }
);

// Verify OTP
router.post('/verify-otp',
  [
    body('phone_number').isMobilePhone('ar-JO').withMessage('Invalid Jordanian phone number'),
    otpValidator('otp')
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

      // Check if user already exists
      const userResult = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
      const existingUser = userResult.rows[0];

      if (existingUser && existingUser.is_verified) {
        // User exists and is verified - return full token and go directly to Home
        const token = jwt.sign(
          { userId: existingUser.id, phoneNumber: existingUser.phone_number },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '30d' }
        );

        return res.json({
          message: 'Login successful',
          token: token,
          user: existingUser,
          isNewUser: false
        });
      } else {
        // New user or not verified - need to complete registration
        const token = jwt.sign(
          { phoneNumber: phone_number, verified: true },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '1h' }
        );

        return res.json({
          message: 'OTP verified successfully. Please complete registration.',
          token: token,
          isNewUser: true
        });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  }
);

module.exports = router;

