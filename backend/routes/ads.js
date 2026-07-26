const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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

// Middleware to verify admin role
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user is admin
    const userResult = await pool.query('SELECT is_admin FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get active ads (public endpoint)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, image_url, link_url, display_order 
       FROM ads 
       WHERE is_active = TRUE 
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY display_order ASC, created_at DESC`
    );
    
    // Convert relative URLs to absolute URLs
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      baseUrl = `${protocol}://${host}`;
    }
    
    const ads = result.rows.map(ad => ({
      ...ad,
      image_url: ad.image_url && ad.image_url.startsWith('/') 
        ? `${baseUrl}${ad.image_url}` 
        : ad.image_url
    }));
    
    res.json({ ads });
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// Get all ads (admin only)
router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ads ORDER BY display_order ASC, created_at DESC`
    );
    
    // Convert relative URLs to absolute URLs
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      baseUrl = `${protocol}://${host}`;
    }
    
    const ads = result.rows.map(ad => ({
      ...ad,
      image_url: ad.image_url && ad.image_url.startsWith('/') 
        ? `${baseUrl}${ad.image_url}` 
        : ad.image_url
    }));
    
    res.json({ ads });
  } catch (error) {
    console.error('Error fetching all ads:', error);
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// Create ad (admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, image_url, link_url, display_order, expires_at } = req.body;

    if (!title || !image_url) {
      return res.status(400).json({ error: 'Title and image_url are required' });
    }

    const result = await pool.query(
      `INSERT INTO ads (title, image_url, link_url, display_order, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, image_url, link_url || null, display_order || 0, expires_at || null]
    );

    res.status(201).json({ ad: result.rows[0] });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// Update ad (admin only)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image_url, link_url, is_active, display_order, expires_at } = req.body;

    const result = await pool.query(
      `UPDATE ads 
       SET title = COALESCE($1, title),
           image_url = COALESCE($2, image_url),
           link_url = COALESCE($3, link_url),
           is_active = COALESCE($4, is_active),
           display_order = COALESCE($5, display_order),
           expires_at = COALESCE($6, expires_at)
       WHERE id = $7
       RETURNING *`,
      [title, image_url, link_url, is_active, display_order, expires_at, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    res.json({ ad: result.rows[0] });
  } catch (error) {
    console.error('Error updating ad:', error);
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

// Delete ad (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM ads WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

module.exports = router;

