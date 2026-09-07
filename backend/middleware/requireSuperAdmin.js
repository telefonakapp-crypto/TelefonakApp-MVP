const { PERMISSIONS, hasPermission } = require('../utils/adminAuth');

/**
 * Requires verifyAdminAuth to have run first.
 * Super Admin only (admins.manage). Kept as a named helper for admin-account routes.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!hasPermission(req.admin.role, PERMISSIONS.ADMINS_MANAGE)) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = requireSuperAdmin;
