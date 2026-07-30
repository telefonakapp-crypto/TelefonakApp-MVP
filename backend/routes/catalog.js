const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { MVP_CATEGORY_SLUGS } = require('../config/mvpCategories');

// GET /api/categories
// Returns only active MVP categories for the mobile app.
// Other categories stay in the DB (is_active = false) for future expansion.
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, slug, name_en, name_ar, sort_order
       FROM categories
       WHERE is_active = TRUE
         AND slug = ANY($1::text[])
       ORDER BY sort_order, name_en`,
      [MVP_CATEGORY_SLUGS]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/sim-configurations
router.get('/sim-configurations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, sort_order
       FROM sim_configurations
       WHERE is_active = TRUE
       ORDER BY sort_order, name`
    );
    res.json({ sim_configurations: result.rows });
  } catch (err) {
    console.error('Error fetching SIM configurations:', err);
    res.status(500).json({ error: 'Failed to fetch SIM configurations' });
  }
});

// GET /api/models/:modelId/storages
// Returns the storage capacities officially supported by a specific model.
router.get('/models/:modelId/storages', async (req, res) => {
  try {
    const modelId = parseInt(req.params.modelId, 10);
    if (!Number.isInteger(modelId) || modelId <= 0) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }
    const result = await pool.query(
      `SELECT
          ms.id,
          ms.model_id,
          ms.storage_capacity_id,
          sc.capacity_gb,
          COALESCE(sc.label, sc.capacity_gb || ' GB') AS label,
          ms.sort_order
       FROM model_storages ms
       JOIN storage_capacities sc ON sc.id = ms.storage_capacity_id
       WHERE ms.model_id = $1
         AND ms.is_active = TRUE
       ORDER BY ms.sort_order, sc.capacity_gb`,
      [modelId]
    );
    res.json({ storages: result.rows });
  } catch (err) {
    console.error('Error fetching model storages:', err);
    res.status(500).json({ error: 'Failed to fetch model storages' });
  }
});

// GET /api/models/:modelId/colors
// Returns the colors officially supported by a specific model.
router.get('/models/:modelId/colors', async (req, res) => {
  try {
    const modelId = parseInt(req.params.modelId, 10);
    if (!Number.isInteger(modelId) || modelId <= 0) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }
    const result = await pool.query(
      `SELECT
          mc.id,
          mc.model_id,
          mc.color_id,
          c.name                                            AS name,
          COALESCE(mc.official_name, c.name)               AS display_name,
          COALESCE(mc.hex_override,  c.hex_code)           AS hex_code,
          mc.sort_order
       FROM model_colors mc
       JOIN colors c ON c.id = mc.color_id
       WHERE mc.model_id = $1
         AND mc.is_active = TRUE
       ORDER BY mc.sort_order, c.name`,
      [modelId]
    );
    res.json({ colors: result.rows });
  } catch (err) {
    console.error('Error fetching model colors:', err);
    res.status(500).json({ error: 'Failed to fetch model colors' });
  }
});

module.exports = router;
