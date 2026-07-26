const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate OTP - Using hardcoded OTP for testing
function generateOTP() {
  // TODO: Replace with actual OTP service when ready
  return '1234'; // Hardcoded for testing (4 digits)
}

// Send OTP (mock implementation - replace with Twilio in production)
async function sendOTP(phoneNumber, code) {
  // TEST MODE: Using hardcoded OTP (1234)
  // In production, use Twilio to send SMS
  console.log(`[TEST MODE] OTP for ${phoneNumber}: ${code}`);
  // TODO: Uncomment and configure Twilio when ready
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: `Your Telefonak verification code is: ${code}`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });
  return true;
}

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
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete old OTPs for this phone number
      await pool.query('DELETE FROM otp_codes WHERE phone_number = $1', [phone_number]);

      // Insert new OTP
      await pool.query(
        'INSERT INTO otp_codes (phone_number, code, expires_at) VALUES ($1, $2, $3)',
        [phone_number, otp, expiresAt]
      );

      // Send OTP
      await sendOTP(phone_number, otp);

      res.json({ 
        message: 'OTP sent successfully',
        // Always return OTP in test mode (hardcoded to 1234)
        otp: otp
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
    body('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone_number, otp } = req.body;

      // Find valid OTP
      const result = await pool.query(
        `SELECT * FROM otp_codes 
         WHERE phone_number = $1 AND code = $2 AND expires_at > NOW() AND is_used = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [phone_number, otp]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      // Mark OTP as used
      await pool.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [result.rows[0].id]);

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

