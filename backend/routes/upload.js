const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { resolveBaseUrl } = require('../utils/baseUrl');
const verifyToken = require('../middleware/verifyToken');
const { uploadLimiter } = require('../middleware/rateLimits');

// ---------------------------------------------------------------------------
// Listing image uploads (authenticated sellers — customer JWT)
// ---------------------------------------------------------------------------
const MAX_LISTING_IMAGES = 10;
const MAX_LISTING_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

const listingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'listing-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const listingImageUpload = multer({
  storage: listingStorage,
  limits: { fileSize: MAX_LISTING_IMAGE_SIZE, files: MAX_LISTING_IMAGES },
  fileFilter: (req, file, cb) => {
    const extOk = /\.(jpe?g|png|webp)$/i.test(file.originalname);
    const mimeOk = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype);
    if (extOk && mimeOk) {
      return cb(null, true);
    }
    cb(
      new Error(
        `Only JPEG, PNG, and WEBP images are allowed (received ${file.mimetype || 'unknown'} / ${file.originalname || 'unnamed'})`
      )
    );
  },
});

const getBaseUrl = resolveBaseUrl;

// Upload one or more listing images; returns public URLs to store on the listing
router.post('/listing-images', uploadLimiter, verifyToken, (req, res) => {
  listingImageUpload.array('images', MAX_LISTING_IMAGES)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Each image must be 5MB or smaller' });
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res
            .status(400)
            .json({ error: `You can upload up to ${MAX_LISTING_IMAGES} images per listing` });
        }
        return res.status(400).json({ error: err.message });
      }
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

module.exports = router;
