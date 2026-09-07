const express = require('express');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../utils/adminAuth');
const { getAllSettings, upsertSettings } = require('../utils/settings');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();

/**
 * GET /api/admin/settings
 * Any authenticated Admin Web user may read settings.
 */
router.get('/', verifyAdminAuth, async (req, res) => {
  try {
    const { settings, meta } = await getAllSettings();
    res.json({ settings, meta });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * PUT /api/admin/settings
 * Super Admin only (settings.write) — accepts a partial settings object.
 */
router.put(
  '/',
  verifyAdminAuth,
  requirePermission(PERMISSIONS.SETTINGS_WRITE),
  async (req, res) => {
    try {
      const payload = req.body?.settings || req.body;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'Settings object is required' });
      }

      const { settings, meta } = await upsertSettings(payload, req.admin.id);
      await writeAuditLog({
        adminId: req.admin.id,
        action: 'settings.update',
        entityType: 'settings',
        entityId: null,
        metadata: { keys: Object.keys(payload) },
        req,
      });

      res.json({ settings, meta, message: 'Settings updated successfully' });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

module.exports = router;
