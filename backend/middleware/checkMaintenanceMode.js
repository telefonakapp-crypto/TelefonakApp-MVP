const { isMaintenanceModeEnabled } = require('../utils/settings');

const MAINTENANCE_MESSAGE =
  'Telefonak is currently undergoing maintenance.';

/**
 * Paths that must remain reachable while the marketplace is in maintenance.
 * - /api/status — public probe for mobile cold-start / refresh
 * - /api/health — ops health checks
 * - /api/settings/public — contact email/phone for Support during outages
 * - /api/auth/refresh — rotate customer sessions without hitting marketplace APIs
 * - /api/admin/* — Admin Dashboard + admin auth (enforced by path prefix)
 */
function isExemptFromMaintenance(req) {
  const path = (req.originalUrl || req.url || '').split('?')[0];

  if (
    path === '/api/status' ||
    path === '/api/health' ||
    path === '/api/settings/public' ||
    path === '/api/auth/refresh'
  ) {
    return true;
  }

  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    return true;
  }

  return false;
}

/**
 * Blocks all customer-facing API traffic when maintenance_mode is enabled.
 * Admin Dashboard routes are intentionally exempt.
 */
async function checkMaintenanceMode(req, res, next) {
  try {
    if (isExemptFromMaintenance(req)) {
      return next();
    }

    const enabled = await isMaintenanceModeEnabled();
    if (!enabled) {
      return next();
    }

    return res.status(503).json({
      maintenance: true,
      message: MAINTENANCE_MESSAGE,
    });
  } catch (error) {
    console.error('[maintenance] Middleware error:', error.message);
    // Fail open — do not brick the API if the check itself fails.
    return next();
  }
}

module.exports = checkMaintenanceMode;
module.exports.MAINTENANCE_MESSAGE = MAINTENANCE_MESSAGE;
module.exports.isExemptFromMaintenance = isExemptFromMaintenance;
