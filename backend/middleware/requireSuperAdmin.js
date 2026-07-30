const { ADMIN_ROLES } = require('../utils/adminAuth');

/**
 * Requires verifyAdminAuth to have run first.
 * Only super_admin may proceed.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== ADMIN_ROLES.SUPER_ADMIN) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = requireSuperAdmin;
