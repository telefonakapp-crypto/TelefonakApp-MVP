const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ad-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ---------------------------------------------------------------------------
// Listing image uploads (authenticated sellers)
// ---------------------------------------------------------------------------
const MAX_LISTING_IMAGES = 10;
const MAX_LISTING_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

// Separate storage so listing files are prefixed distinctly from ad images
const listingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'listing-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const listingImageUpload = multer({
  storage: listingStorage,
  limits: { fileSize: MAX_LISTING_IMAGE_SIZE, files: MAX_LISTING_IMAGES },
  fileFilter: (req, file, cb) => {
    // Only JPEG, JPG, PNG, WEBP are allowed for listings
    const extOk = /\.(jpe?g|png|webp)$/i.test(file.originalname);
    const mimeOk = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype);
    if (extOk && mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed'));
  },
});

// Build a base URL that works both locally and behind ngrok/proxies
const getBaseUrl = (req) => {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
};

// Upload one or more listing images; returns public URLs to store on the listing
router.post('/listing-images', verifyToken, (req, res) => {
  listingImageUpload.array('images', MAX_LISTING_IMAGES)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Each image must be 5MB or smaller' });
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: `You can upload up to ${MAX_LISTING_IMAGES} images per listing` });
        }
        return res.status(400).json({ error: err.message });
      }
      // fileFilter / other errors
      return res.status(400).json({ error: err.message || 'Failed to upload images' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const baseUrl = getBaseUrl(req);
    const imageUrls = req.files.map((file) => `${baseUrl}/uploads/${file.filename}`);

    res.json({
      image_urls: imageUrls,
      message: 'Images uploaded successfully',
    });
  });
});

// Upload image endpoint (admin only)
router.post('/image', verifyToken, verifyAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Return the full file URL
    // In production, you would upload to cloud storage (S3, Cloudinary, etc.)
    // and return the cloud URL
    // Get the base URL from environment or construct from request
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      // Construct from request headers (works with ngrok)
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
      baseUrl = `${protocol}://${host}`;
    }
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ 
      image_url: fileUrl,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;

