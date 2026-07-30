const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const verifyToken = require('../middleware/verifyToken');

// Register/Update user
router.post('/register', verifyToken,
  [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('date_of_birth').optional().isISO8601().withMessage('Invalid date format'),
    body('city').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { first_name, last_name, gender, email, date_of_birth, city } = req.body;
      const phoneNumber = req.user.phoneNumber;

      if (!req.user.verified) {
        return res.status(400).json({ error: 'Phone number not verified' });
      }

      // Check if user already exists
      const existingUser = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);

      if (existingUser.rows.length > 0) {
        // Update existing user
        const result = await pool.query(
          `UPDATE users 
           SET first_name = $1, last_name = $2, gender = $3, email = $4, 
               date_of_birth = $5, city = $6, is_verified = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE phone_number = $7
           RETURNING *`,
          [first_name, last_name, gender, email, date_of_birth, city, phoneNumber]
        );

        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
          { userId: result.rows[0].id, phoneNumber: result.rows[0].phone_number },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '30d' }
        );

        return res.json({
          message: 'User updated successfully',
          token,
          user: result.rows[0]
        });
      } else {
        // Create new user
        const result = await pool.query(
          `INSERT INTO users (phone_number, first_name, last_name, gender, email, date_of_birth, city, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           RETURNING *`,
          [phoneNumber, first_name, last_name, gender, email, date_of_birth, city]
        );

        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
          { userId: result.rows[0].id, phoneNumber: result.rows[0].phone_number },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '30d' }
        );

        return res.json({
          message: 'User registered successfully',
          token,
          user: result.rows[0]
        });
      }
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  }
);

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', verifyToken,
  [
    body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
    body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('date_of_birth').optional().isISO8601().withMessage('Invalid date format'),
    body('city').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { first_name, last_name, gender, email, date_of_birth, city } = req.body;
      const userId = req.user.userId;

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (first_name !== undefined) {
        updates.push(`first_name = $${paramIndex++}`);
        values.push(first_name);
      }
      if (last_name !== undefined) {
        updates.push(`last_name = $${paramIndex++}`);
        values.push(last_name);
      }
      if (gender !== undefined) {
        updates.push(`gender = $${paramIndex++}`);
        values.push(gender);
      }
      if (email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (date_of_birth !== undefined) {
        updates.push(`date_of_birth = $${paramIndex++}`);
        values.push(date_of_birth);
      }
      if (city !== undefined) {
        updates.push(`city = $${paramIndex++}`);
        values.push(city);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const result = await pool.query(
        `UPDATE users 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      res.json({
        message: 'Profile updated successfully',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

module.exports = router;

