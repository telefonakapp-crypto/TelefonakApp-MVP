const { hasPermission } = require('../utils/adminAuth');

/**
 * Requires verifyAdminAuth to have run first.
 * Fail-closed: missing admin, unknown role, or missing permission → 403.
 * Use 401 only when authentication itself did not attach req.admin.
 */
function requirePermission(permission) {
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!hasPermission(req.admin.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

module.exports = requirePermission;
