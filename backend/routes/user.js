const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const verifyToken = require('../middleware/verifyToken');
const {
  issueCustomerSession,
  revokeAllUserSessions,
} = require('../utils/customerAuth');
const {
  DEACTIVATION_REASONS,
  deactivateUser,
  reactivateUser,
} = require('../utils/deactivateUser');

async function issueUserTokenResponse(user, req) {
  return issueCustomerSession(user, {
    userAgent: req?.get?.('user-agent') || null,
    ip: req?.ip || null,
  });
}

// Register / update / reactivate user after phone OTP verification
router.post('/register', verifyToken,
  [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('gender').isIn(['male', 'female']).withMessage('Invalid gender'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('date_of_birth').optional().isISO8601().withMessage('Invalid date format'),
    body('city').optional().isString()
  ],
  async (req, res) => {
    const client = await pool.connect();
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

      await client.query('BEGIN');

      const existingUser = await client.query(
        'SELECT * FROM users WHERE phone_number = $1 FOR UPDATE',
        [phoneNumber]
      );

      let user;
      let message;

      if (existingUser.rows.length > 0) {
        const existing = existingUser.rows[0];

        if (existing.is_active === false) {
          // Same phone as a deactivated account → reactivate identity, fresh marketplace.
          user = await reactivateUser(client, {
            phoneNumber,
            firstName: first_name,
            lastName: last_name,
            gender,
            email,
            dateOfBirth: date_of_birth,
            city,
          });
          message = 'Account reactivated successfully';
        } else {
          const result = await client.query(
            `UPDATE users
             SET first_name = $1, last_name = $2, gender = $3, email = $4,
                 date_of_birth = $5, city = $6, is_verified = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE phone_number = $7
             RETURNING *`,
            [first_name, last_name, gender, email, date_of_birth, city, phoneNumber]
          );
          user = result.rows[0];
          message = 'User updated successfully';
        }
      } else {
        const result = await client.query(
          `INSERT INTO users (phone_number, first_name, last_name, gender, email, date_of_birth, city, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
           RETURNING *`,
          [phoneNumber, first_name, last_name, gender, email, date_of_birth, city]
        );
        user = result.rows[0];
        message = 'User registered successfully';
      }

      await client.query('COMMIT');

      const session = await issueUserTokenResponse(user, req);
      return res.json({
        message,
        ...session,
        user,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Error registering user:', error);
      res.status(500).json({ error: 'Failed to register user' });
    } finally {
      client.release();
    }
  }
);

// Get user profile
router.get('/profile', verifyToken.requireUserId, async (req, res) => {
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
router.put('/profile', verifyToken.requireUserId,
  [
    body('first_name').optional().notEmpty().withMessage('First name cannot be empty'),
    body('last_name').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('gender').optional().isIn(['male', 'female']).withMessage('Invalid gender'),
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

/**
 * POST /api/user/deactivate
 * Self-serve "Delete Account": deactivate + wipe marketplace activity.
 */
router.post(
  '/deactivate',
  verifyToken.requireUserId,
  [
    body('reason')
      .isIn(DEACTIVATION_REASONS)
      .withMessage('Invalid deactivation reason'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await deactivateUser(pool, {
        userId: req.user.userId,
        reason: req.body.reason,
      });

      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }

      await revokeAllUserSessions(req.user.userId);

      res.json({
        message: 'Account deactivated successfully',
        user: {
          id: result.user.id,
          is_active: result.user.is_active,
          deactivated_at: result.user.deactivated_at,
          deactivation_reason: result.user.deactivation_reason,
        },
      });
    } catch (error) {
      console.error('Error deactivating user:', error);
      res.status(500).json({ error: 'Failed to deactivate account' });
    }
  }
);

module.exports = router;
