const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { toPublicAdmin } = require('../utils/adminAuth');
const { writeAuditLog } = require('../utils/auditLog');
const { getAdminJwtSecret, ADMIN_JWT_ISS, ADMIN_JWT_AUD } = require('../config/env');
const { adminLoginLimiter } = require('../middleware/rateLimits');

const router = express.Router();

const ADMIN_TOKEN_TTL = '30d';
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

function signAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      typ: 'admin',
    },
    getAdminJwtSecret(),
    {
      expiresIn: ADMIN_TOKEN_TTL,
      issuer: ADMIN_JWT_ISS,
      audience: ADMIN_JWT_AUD,
    }
  );
}

function validationErrorResponse(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

/**
 * POST /api/admin/auth/login
 * Email + password → Admin JWT (independent from mobile OTP auth).
 */
router.post(
  '/login',
  adminLoginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const { email, password } = req.body;

      const result = await pool.query(
        `SELECT id, full_name, email, password_hash, role, is_active,
                last_login, created_at, updated_at, created_by, updated_by
         FROM admins
         WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const admin = result.rows[0];

      if (!admin.is_active) {
        return res.status(403).json({ error: 'Admin account is inactive' });
      }

      const passwordMatches = await bcrypt.compare(password, admin.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      await pool.query(
        'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [admin.id]
      );

      const refreshed = await pool.query(
        `SELECT id, full_name, email, role, is_active, last_login,
                created_at, updated_at, created_by, updated_by
         FROM admins WHERE id = $1`,
        [admin.id]
      );

      const token = signAdminToken(admin);

      res.json({
        token,
        admin: toPublicAdmin(refreshed.rows[0]),
      });

      await writeAuditLog({
        adminId: admin.id,
        action: 'admin.login',
        entityType: 'admin',
        entityId: admin.id,
        metadata: { email: admin.email },
        req,
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Failed to log in' });
    }
  }
);

/**
 * GET /api/admin/auth/me
 */
router.get('/me', verifyAdminAuth, async (req, res) => {
  res.json({ admin: req.admin });
});

/**
 * POST /api/admin/auth/change-password
 */
router.post(
  '/change-password',
  verifyAdminAuth,
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: MIN_PASSWORD_LENGTH })
      .withMessage(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  ],
  async (req, res) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const { current_password, new_password } = req.body;

      const matches = await bcrypt.compare(current_password, req.adminPasswordHash);
      if (!matches) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      if (current_password === new_password) {
        return res.status(400).json({ error: 'New password must be different from the current password' });
      }

      const passwordHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

      await pool.query(
        `UPDATE admins
         SET password_hash = $1, updated_by = $2
         WHERE id = $3`,
        [passwordHash, req.adminId, req.adminId]
      );

      await writeAuditLog({
        adminId: req.adminId,
        action: 'admin.password_change',
        entityType: 'admin',
        entityId: req.adminId,
        metadata: {},
        req,
      });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Admin change-password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

module.exports = router;
