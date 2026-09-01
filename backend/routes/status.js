const express = require('express');
const {
  isMaintenanceModeEnabled,
} = require('../utils/settings');
const { MAINTENANCE_MESSAGE } = require('../middleware/checkMaintenanceMode');

const router = express.Router();

/**
 * GET /api/status
 * Always available (exempt from maintenance block). Used by the mobile app
 * for cold-start gating and the Maintenance screen Refresh action.
 */
router.get('/', async (req, res) => {
  try {
    const maintenance = await isMaintenanceModeEnabled();
    return res.json({
      status: maintenance ? 'maintenance' : 'ok',
      maintenance,
      message: maintenance ? MAINTENANCE_MESSAGE : 'Telefonak API is running',
    });
  } catch (error) {
    console.error('[status] Failed to read maintenance state:', error.message);
    return res.status(500).json({
      status: 'error',
      maintenance: false,
      error: 'Failed to read status',
    });
  }
});

module.exports = router;
