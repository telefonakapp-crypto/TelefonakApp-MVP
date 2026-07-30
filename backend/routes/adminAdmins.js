const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const {
  ADMIN_ROLES,
  ADMIN_ROLE_VALUES,
  DEFAULT_ADMIN_ROLE,
  toPublicAdmin,
} = require('../utils/adminAuth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

router.use(verifyAdminAuth, requireSuperAdmin);

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

async function countActiveSuperAdmins(client = pool) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM admins
     WHERE role = $1 AND is_active = TRUE`,
    [ADMIN_ROLES.SUPER_ADMIN]
  );
  return result.rows[0].count;
}

async function getAdminById(id, client = pool) {
  const result = await client.query(
    `SELECT id, full_name, email, role, is_active, last_login,
            created_at, updated_at, created_by, updated_by
     FROM admins
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

function isUniqueViolation(error) {
  return error && error.code === '23505';
}

/**
 * GET /api/admin/admins
 */
router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const params = [];
    const where = [];

    const pushParam = (value) => {
      params.push(value);
      return params.length;
    };

    if (search) {
      const pattern = `%${search.replace(/[%_\\]/g, '')}%`;
      const idx = pushParam(pattern);
      where.push(`(
        full_name ILIKE $${idx}
        OR email ILIKE $${idx}
      )`);
    }

    if (role && role !== 'all') {
      if (!ADMIN_ROLE_VALUES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role filter' });
      }
      where.push(`role = $${pushParam(role)}`);
    }

    if (status === 'active') {
      where.push('is_active = TRUE');
    } else if (status === 'disabled') {
      where.push('is_active = FALSE');
    } else if (status && status !== 'all') {
      return res.status(400).json({
        error: 'Invalid status filter. Allowed: active, disabled',
      });
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM admins ${whereSql}`,
      params
    );
    const totalItems = countResult.rows[0].total;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const limitIdx = pushParam(limit);
    const offsetIdx = pushParam(offset);

    const listResult = await pool.query(
      `SELECT id, full_name, email, role, is_active, last_login,
              created_at, updated_at, created_by, updated_by
       FROM admins
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    res.json({
      items: listResult.rows.map(toPublicAdmin),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

/**
 * POST /api/admin/admins
 */
router.post('/', async (req, res) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role || DEFAULT_ADMIN_ROLE;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (!ADMIN_ROLE_VALUES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const actorId = req.admin.id;

    const result = await pool.query(
      `INSERT INTO admins (
         full_name, email, password_hash, role, is_active, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, TRUE, $5, $5)
       RETURNING id, full_name, email, role, is_active, last_login,
                 created_at, updated_at, created_by, updated_by`,
      [fullName, email, passwordHash, role, actorId]
    );

    res.status(201).json({ admin: toPublicAdmin(result.rows[0]) });
    await writeAuditLog({
      adminId: actorId,
      action: 'admin.create',
      entityType: 'admin',
      entityId: result.rows[0].id,
      metadata: {
        email: result.rows[0].email,
        role: result.rows[0].role,
      },
      req,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'An admin with this email already exists' });
    }
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

/**
 * PUT /api/admin/admins/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }

    const current = await getAdminById(id);
    if (!current) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const nextFullName =
      req.body.full_name !== undefined
        ? String(req.body.full_name || '').trim()
        : current.full_name;
    if (!nextFullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const nextEmail =
      req.body.email !== undefined
        ? normalizeEmail(req.body.email)
        : current.email;
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const nextRole =
      req.body.role !== undefined ? req.body.role : current.role;
    if (!ADMIN_ROLE_VALUES.includes(nextRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const nextActive =
      req.body.is_active !== undefined
        ? Boolean(req.body.is_active)
        : current.is_active;

    // Prevent disabling yourself
    if (id === req.admin.id && nextActive === false) {
      return res.status(400).json({ error: 'You cannot disable your own account' });
    }

    const demotingSuperAdmin =
      current.role === ADMIN_ROLES.SUPER_ADMIN &&
      nextRole !== ADMIN_ROLES.SUPER_ADMIN;
    const disablingSuperAdmin =
      current.role === ADMIN_ROLES.SUPER_ADMIN &&
      current.is_active &&
      nextActive === false;

    if (demotingSuperAdmin || disablingSuperAdmin) {
      const activeSuperCount = await countActiveSuperAdmins();
      if (activeSuperCount <= 1 && current.is_active) {
        return res.status(400).json({
          error: demotingSuperAdmin
            ? 'Cannot demote the last remaining Super Admin'
            : 'Cannot disable the last remaining Super Admin',
        });
      }
    }

    const result = await pool.query(
      `UPDATE admins
       SET full_name = $1,
           email = $2,
           role = $3,
           is_active = $4,
           updated_by = $5
       WHERE id = $6
       RETURNING id, full_name, email, role, is_active, last_login,
                 created_at, updated_at, created_by, updated_by`,
      [nextFullName, nextEmail, nextRole, nextActive, req.admin.id, id]
    );

    res.json({ admin: toPublicAdmin(result.rows[0]) });
    await writeAuditLog({
      adminId: req.admin.id,
      action: 'admin.update',
      entityType: 'admin',
      entityId: result.rows[0].id,
      metadata: {
        email: result.rows[0].email,
        role: result.rows[0].role,
        is_active: result.rows[0].is_active,
      },
      req,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'An admin with this email already exists' });
    }
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

/**
 * POST /api/admin/admins/:id/reset-password
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }

    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const current = await getAdminById(id);
    if (!current) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query(
      `UPDATE admins
       SET password_hash = $1, updated_by = $2
       WHERE id = $3`,
      [passwordHash, req.admin.id, id]
    );

    await writeAuditLog({
      adminId: req.admin.id,
      action: 'admin.password_reset',
      entityType: 'admin',
      entityId: id,
      metadata: { email: current.email },
      req,
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting admin password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

/**
 * DELETE /api/admin/admins/:id
 * Soft delete — sets is_active = false.
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }

    if (id === req.admin.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const current = await getAdminById(id);
    if (!current) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (!current.is_active) {
      return res.json({
        message: 'Admin already disabled',
        admin: toPublicAdmin(current),
      });
    }

    if (current.role === ADMIN_ROLES.SUPER_ADMIN) {
      const activeSuperCount = await countActiveSuperAdmins();
      if (activeSuperCount <= 1) {
        return res.status(400).json({
          error: 'Cannot delete the last remaining Super Admin',
        });
      }
    }

    const result = await pool.query(
      `UPDATE admins
       SET is_active = FALSE, updated_by = $1
       WHERE id = $2
       RETURNING id, full_name, email, role, is_active, last_login,
                 created_at, updated_at, created_by, updated_by`,
      [req.admin.id, id]
    );

    res.json({
      message: 'Admin disabled successfully',
      admin: toPublicAdmin(result.rows[0]),
    });
    await writeAuditLog({
      adminId: req.admin.id,
      action: 'admin.disable',
      entityType: 'admin',
      entityId: result.rows[0].id,
      metadata: {
        email: result.rows[0].email,
        role: result.rows[0].role,
      },
      req,
    });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

module.exports = router;
