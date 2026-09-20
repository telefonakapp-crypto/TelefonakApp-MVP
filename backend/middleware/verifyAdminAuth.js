const pool = require('../config/database');
const { toSessionAdmin, isKnownAdminRole } = require('../utils/adminAuth');
const { verifyAdminAccessToken } = require('../utils/adminToken');

/**
 * Verifies the dedicated Admin Web JWT and loads an active admin.
 * Attaches req.admin (public fields) and req.adminId.
 *
 * Independent from mobile/customer auth (verifyToken on users).
 */
async function verifyAdminAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyAdminAccessToken(token);

    if (!decoded.adminId || decoded.userId || decoded.typ !== 'admin') {
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, role, is_active, last_login,
              created_at, updated_at, created_by, updated_by, password_hash
       FROM admins
       WHERE id = $1`,
      [decoded.adminId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(403).json({ error: 'Admin account is inactive' });
    }

    if (!isKnownAdminRole(admin.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.adminId = admin.id;
    // Role and permissions always come from the database row, not the JWT claim.
    req.admin = toSessionAdmin(admin);
    // Kept for password-change verification only; never send to clients.
    req.adminPasswordHash = admin.password_hash;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = verifyAdminAuth;
