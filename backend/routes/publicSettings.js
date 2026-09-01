const express = require('express');
const { getPublicSettings } = require('../utils/settings');

const router = express.Router();

/**
 * GET /api/settings/public
 * Unauthenticated. Returns only customer-safe marketplace contact settings
 * sourced from the same `settings` table Admin Web edits.
 */
router.get('/', async (req, res) => {
  try {
    const settings = await getPublicSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

module.exports = router;
