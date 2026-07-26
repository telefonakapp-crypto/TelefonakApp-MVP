const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all brands
router.get('/brands', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name');
    res.json({ brands: result.rows });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Get models by brand
router.get('/brands/:brandId/models', async (req, res) => {
  try {
    const { brandId } = req.params;
    const result = await pool.query(
      'SELECT * FROM models WHERE brand_id = $1 ORDER BY release_year DESC, name',
      [brandId]
    );
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

// Get colors
router.get('/colors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM colors ORDER BY name');
    res.json({ colors: result.rows });
  } catch (error) {
    console.error('Error fetching colors:', error);
    res.status(500).json({ error: 'Failed to fetch colors' });
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

// Create listing (status defaults to 'pending' for admin approval)
router.post('/listings', verifyToken,
  [
    body('model_id').isInt().withMessage('Model ID is required'),
    body('storage_id').isInt().withMessage('Storage ID is required'),
    body('color_id').isInt().withMessage('Color ID is required'),
    body('condition_id').isInt().withMessage('Condition ID is required'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('battery_percentage').optional().isInt({ min: 70, max: 100 }).withMessage('Battery percentage must be between 70 and 100'),
    body('description').optional().isString(),
    body('location').optional().isString(),
    body('images').optional().isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { model_id, storage_id, color_id, condition_id, battery_percentage, price, description, location, images } = req.body;
      const userId = req.user.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      // Create listing (status defaults to 'pending' for admin approval)
      const listingResult = await pool.query(
        `INSERT INTO listings (user_id, model_id, storage_id, color_id, condition_id, battery_percentage, price, description, location, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
         RETURNING *`,
        [userId, model_id, storage_id, color_id, condition_id, battery_percentage || null, price, description || null, location || null]
      );

      const listing = listingResult.rows[0];

      // Insert images if provided
      // Note: For now, we accept image URLs/URIs directly
      // In production, you should upload images to cloud storage (S3, Cloudinary, etc.)
      // and store the cloud URLs here
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          // For local development, accept file:// URIs or base64 data URIs
          // In production, these should be cloud storage URLs
          const imageUrl = images[i];
          await pool.query(
            'INSERT INTO listing_images (listing_id, image_url, display_order) VALUES ($1, $2, $3)',
            [listing.id, imageUrl, i]
          );
        }
      }

      // Fetch full listing with relations
      const fullListing = await pool.query(
        `SELECT 
          l.*,
          m.name as model_name,
          b.name as brand_name,
          s.capacity_gb,
          c.name as color_name,
          c.hex_code as color_hex,
          cond.name as condition_name
         FROM listings l
         JOIN models m ON l.model_id = m.id
         JOIN brands b ON m.brand_id = b.id
         JOIN storage_options s ON l.storage_id = s.id
         JOIN colors c ON l.color_id = c.id
         JOIN conditions cond ON l.condition_id = cond.id
         WHERE l.id = $1`,
        [listing.id]
      );

      // Notify all admins about the new listing
      try {
        const adminUsers = await pool.query(
          'SELECT id FROM users WHERE is_admin = TRUE'
        );

        const listingDetails = fullListing.rows[0];
        const notificationMessage = `New listing pending approval: ${listingDetails.brand_name} ${listingDetails.model_name} (${listingDetails.price} JOD)`;

        for (const admin of adminUsers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, listing_id, type, title, message)
             VALUES ($1, $2, 'new_listing', 'New Listing Pending Approval', $3)`,
            [admin.id, listing.id, notificationMessage]
          );
        }
      } catch (notificationError) {
        console.error('Error creating admin notifications:', notificationError);
        // Don't fail the listing creation if notification fails
      }

      res.json({
        message: 'Listing created successfully',
        listing: fullListing.rows[0]
      });
    } catch (error) {
      console.error('Error creating listing:', error);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  }
);

// Get all listings with search functionality
router.get('/listings', async (req, res) => {
  try {
    const { 
      status = 'active', 
      limit = 50, 
      offset = 0,
      search = '',
      brand_id = '',
      model_id = '',
      min_price = '',
      max_price = '',
      condition_id = ''
    } = req.query;

    // Check if listings table exists, if not return empty array
    try {
      // Build WHERE clause dynamically
      let whereConditions = ['l.status = $1'];
      let queryParams = [status];
      let paramIndex = 2;

      // Search functionality - search in brand name, model name, description
      if (search && search.trim()) {
        whereConditions.push(`(
          b.name ILIKE $${paramIndex} OR 
          m.name ILIKE $${paramIndex} OR 
          l.description ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search.trim()}%`);
        paramIndex++;
      }

      // Brand filter
      if (brand_id && brand_id.trim()) {
        whereConditions.push(`b.id = $${paramIndex}`);
        queryParams.push(parseInt(brand_id));
        paramIndex++;
      }

      // Model filter
      if (model_id && model_id.trim()) {
        whereConditions.push(`m.id = $${paramIndex}`);
        queryParams.push(parseInt(model_id));
        paramIndex++;
      }

      // Price range filters
      if (min_price && min_price.trim()) {
        whereConditions.push(`l.price >= $${paramIndex}`);
        queryParams.push(parseFloat(min_price));
        paramIndex++;
      }

      if (max_price && max_price.trim()) {
        whereConditions.push(`l.price <= $${paramIndex}`);
        queryParams.push(parseFloat(max_price));
        paramIndex++;
      }

      // Condition filter
      if (condition_id && condition_id.trim()) {
        whereConditions.push(`l.condition_id = $${paramIndex}`);
        queryParams.push(parseInt(condition_id));
        paramIndex++;
      }

      // Storage filter
      if (req.query.storage_id && req.query.storage_id.trim()) {
        whereConditions.push(`l.storage_id = $${paramIndex}`);
        queryParams.push(parseInt(req.query.storage_id));
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');
      
      const result = await pool.query(
        `SELECT 
          l.*,
          m.name as model_name,
          b.name as brand_name,
          s.capacity_gb,
          c.name as color_name,
          c.hex_code as color_hex,
          cond.name as condition_name,
          u.first_name,
          u.last_name,
          (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) as thumbnail_image
         FROM listings l
         JOIN models m ON l.model_id = m.id
         JOIN brands b ON m.brand_id = b.id
         JOIN storage_options s ON l.storage_id = s.id
         JOIN colors c ON l.color_id = c.id
         JOIN conditions cond ON l.condition_id = cond.id
         JOIN users u ON l.user_id = u.id
         WHERE ${whereClause}
         ORDER BY l.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, parseInt(limit), parseInt(offset)]
      );

      res.json({ listings: result.rows });
    } catch (dbError) {
      // If table doesn't exist, return empty array instead of error
      if (dbError.message && dbError.message.includes('does not exist')) {
        console.warn('Listings tables not found. Please run database initialization.');
        return res.json({ listings: [] });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch listings',
      details: error.message 
    });
  }
});

// Get listing details
router.get('/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get listing details
    const listingResult = await pool.query(
      `SELECT 
        l.*,
        m.name as model_name,
        m.release_year,
        m.chipset,
        m.screen_size,
        b.name as brand_name,
        s.capacity_gb,
        c.name as color_name,
        c.hex_code as color_hex,
        cond.name as condition_name,
        u.first_name,
        u.last_name,
        u.phone_number
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [id]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get listing images
    const imagesResult = await pool.query(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
      [id]
    );

    res.json({
      listing: listingResult.rows[0],
      images: imagesResult.rows
    });
  } catch (error) {
    console.error('Error fetching listing details:', error);
    res.status(500).json({ error: 'Failed to fetch listing details' });
  }
});

// Get user's listings
router.get('/listings/user/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        m.name as model_name,
        b.name as brand_name,
        s.capacity_gb,
        c.name as color_name,
        cond.name as condition_name,
        (SELECT image_url FROM listing_images WHERE listing_id = l.id ORDER BY display_order LIMIT 1) as thumbnail_image
       FROM listings l
       JOIN models m ON l.model_id = m.id
       JOIN brands b ON m.brand_id = b.id
       JOIN storage_options s ON l.storage_id = s.id
       JOIN colors c ON l.color_id = c.id
       JOIN conditions cond ON l.condition_id = cond.id
       WHERE l.user_id = $1 AND l.status != 'deleted'
       ORDER BY l.created_at DESC`,
      [userId]
    );

    res.json({ listings: result.rows });
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ error: 'Failed to fetch user listings' });
  }
});

// Mark listing as sold
router.put('/listings/:id/mark-sold', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    // Check if listing belongs to user
    const checkResult = await pool.query(
      'SELECT user_id, status FROM listings WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to mark this listing as sold' });
    }

    // Only allow marking approved listings as sold
    if (checkResult.rows[0].status !== 'approved') {
      return res.status(400).json({ error: 'Only approved listings can be marked as sold' });
    }

    // Update status to 'sold'
    const result = await pool.query(
      `UPDATE listings 
       SET status = 'sold', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    res.json({ 
      message: 'Listing marked as sold successfully',
      listing: result.rows[0] 
    });
  } catch (error) {
    console.error('Error marking listing as sold:', error);
    res.status(500).json({ error: 'Failed to mark listing as sold' });
  }
});

// Delete listing (soft delete - set status to 'deleted')
router.delete('/listings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check if listing belongs to user
    const checkResult = await pool.query(
      'SELECT user_id FROM listings WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this listing' });
    }

    // Soft delete - set status to 'deleted'
    await pool.query(
      `UPDATE listings 
       SET status = 'deleted', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;

