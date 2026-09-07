const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { MVP_CATEGORY_SLUGS } = require('../config/mvpCategories');
const { resolveModelCategory } = require('../utils/listingCatalog');

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

// GET /api/models/:modelId/watch-options
// Model-specific smartwatch options only. Never dumps global size/connectivity tables.
router.get('/models/:modelId/watch-options', async (req, res) => {
  try {
    const modelId = parseInt(req.params.modelId, 10);
    if (!Number.isInteger(modelId) || modelId <= 0) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }

    const modelExists = await pool.query('SELECT id FROM models WHERE id = $1', [modelId]);
    if (modelExists.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const category = await resolveModelCategory(pool, modelId);
    if (category.error || category.category_slug !== 'smartwatches') {
      return res.status(400).json({ error: 'Watch options are only available for smartwatch models' });
    }

    const [sizesResult, connectivitiesResult, storagesResult, colorsResult] = await Promise.all([
      pool.query(
        `SELECT
            mwcs.id,
            mwcs.model_id,
            mwcs.case_size_id,
            wcs.size_mm,
            wcs.label,
            mwcs.sort_order
         FROM model_watch_case_sizes mwcs
         JOIN watch_case_sizes wcs ON wcs.id = mwcs.case_size_id
         WHERE mwcs.model_id = $1
           AND mwcs.is_active = TRUE
         ORDER BY mwcs.sort_order, wcs.size_mm`,
        [modelId]
      ),
      pool.query(
        `SELECT
            mwc.id,
            mwc.model_id,
            mwc.connectivity_id,
            wc.slug,
            wc.name_en,
            wc.name_ar,
            mwc.sort_order
         FROM model_watch_connectivities mwc
         JOIN watch_connectivities wc ON wc.id = mwc.connectivity_id
         WHERE mwc.model_id = $1
           AND mwc.is_active = TRUE
           AND wc.is_active = TRUE
         ORDER BY mwc.sort_order, wc.sort_order`,
        [modelId]
      ),
      pool.query(
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
      ),
      pool.query(
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
      ),
    ]);

    const storages = storagesResult.rows;
    const colors = colorsResult.rows;

    res.json({
      model_id: modelId,
      category_slug: category.category_slug,
      sizes: sizesResult.rows,
      connectivities: connectivitiesResult.rows,
      storages,
      colors,
      required: {
        size: sizesResult.rows.length > 0,
        connectivity: connectivitiesResult.rows.length > 0,
        storage: storages.length > 0,
        color: colors.length > 0,
      },
    });
  } catch (err) {
    console.error('Error fetching watch options:', err);
    res.status(500).json({ error: 'Failed to fetch watch options' });
  }
});

// Get all brands (optional ?category_id — only brands with models in that category)
router.get('/brands', async (req, res) => {
  try {
    const { category_id } = req.query;
    let result;

    if (category_id && String(category_id).trim()) {
      const categoryId = parseInt(category_id, 10);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: 'Invalid category ID' });
      }
      result = await pool.query(
        `SELECT DISTINCT b.*
         FROM brands b
         JOIN models m ON m.brand_id = b.id
         WHERE m.category_id = $1
         ORDER BY b.name`,
        [categoryId]
      );
    } else {
      result = await pool.query('SELECT * FROM brands ORDER BY name');
    }

    res.json({ brands: result.rows });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Get models by brand (optional ?category_id filter)
router.get('/brands/:brandId/models', async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId, 10);
    if (!Number.isInteger(brandId) || brandId <= 0) {
      return res.status(400).json({ error: 'Invalid brand ID' });
    }
    const { category_id } = req.query;

    let query  = 'SELECT * FROM models WHERE brand_id = $1';
    const params = [brandId];

    // Filter by category when provided, but still return models that have no
    // category yet so existing brands remain selectable during the transition.
    if (category_id && category_id.trim()) {
      query += ' AND (category_id = $2 OR category_id IS NULL)';
      params.push(parseInt(category_id));
    }

    query += ' ORDER BY sort_order ASC NULLS LAST, release_year DESC, name';

    const result = await pool.query(query, params);
    res.json({ models: result.rows });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Get storage options
router.get('/storage', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM storage_options ORDER BY capacity_gb');
    res.json({ storage: result.rows });
  } catch (error) {
    console.error('Error fetching storage:', error);
    res.status(500).json({ error: 'Failed to fetch storage options' });
  }
});

// Get conditions
router.get('/conditions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM conditions ORDER BY id');
    res.json({ conditions: result.rows });
  } catch (error) {
    console.error('Error fetching conditions:', error);
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

// Get cities
router.get('/cities', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, slug, name_en, name_ar, sort_order
       FROM cities
       WHERE is_active = TRUE
       ORDER BY sort_order, name_en`
    );
    res.json({ cities: result.rows });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Get areas for a city
router.get('/cities/:cityId/areas', async (req, res) => {
  try {
    const cityId = parseInt(req.params.cityId, 10);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return res.status(400).json({ error: 'Invalid city ID' });
    }
    const result = await pool.query(
      `SELECT id, city_id, slug, name_en, name_ar, sort_order
       FROM areas
       WHERE city_id = $1 AND is_active = TRUE
       ORDER BY sort_order, name_en`,
      [cityId]
    );
    res.json({ areas: result.rows });
  } catch (error) {
    console.error('Error fetching areas:', error);
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

module.exports = router;
