const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { resolveBaseUrl } = require('../utils/baseUrl');
const verifyToken = require('../middleware/verifyToken');
const { uploadLimiter } = require('../middleware/rateLimits');
const {
  detectImageFormat,
  expectedFormatForExtension,
} = require('../utils/imageContent');
const { recordListingImageUpload } = require('../utils/listingImageAuth');

function expectedFormatForMime(mime) {
  if (!mime) return null;
  if (/^image\/jpe?g$/i.test(mime)) return 'jpeg';
  if (/^image\/png$/i.test(mime)) return 'png';
  if (/^image\/webp$/i.test(mime)) return 'webp';
  return null;
}

// ---------------------------------------------------------------------------
// Listing image uploads (authenticated sellers — customer JWT)
// ---------------------------------------------------------------------------
const MAX_LISTING_IMAGES = 10;
const MAX_LISTING_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const listingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Temporary extension from client; may be corrected after magic-byte check.
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = /^\.(jpe?g|png|webp)$/.test(ext) ? ext : '.jpg';
    cb(null, `listing-${uniqueSuffix}${safeExt}`);
  },
});

const listingImageUpload = multer({
  storage: listingStorage,
  limits: { fileSize: MAX_LISTING_IMAGE_SIZE, files: MAX_LISTING_IMAGES },
  fileFilter: (req, file, cb) => {
    const extOk = /\.(jpe?g|png|webp)$/i.test(file.originalname || '');
    const mimeOk = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype || '');
    if (extOk && mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed'));
  },
});

function unlinkQuietly(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Reject uploads whose bytes are not a real JPEG/PNG/WebP, or whose content
 * does not match the file extension. Cleans up rejected files on disk.
 */
function validateUploadedImageFiles(files) {
  const accepted = [];
  const rejectedPaths = [];

  for (const file of files) {
    let buffer;
    try {
      buffer = fs.readFileSync(file.path);
    } catch {
      rejectedPaths.push(file.path);
      return { error: 'Failed to read uploaded image', rejectedPaths: [...rejectedPaths, ...accepted.map((f) => f.path)] };
    }

    const format = detectImageFormat(buffer);
    if (!format) {
      rejectedPaths.push(file.path);
      continue;
    }

    const ext = path.extname(file.filename || file.originalname || '').toLowerCase();
    const expectedExt = expectedFormatForExtension(ext);
    const expectedMime = expectedFormatForMime(file.mimetype);
    // Require extension and declared MIME to match actual image bytes.
    if (!expectedExt || expectedExt !== format || !expectedMime || expectedMime !== format) {
      rejectedPaths.push(file.path);
      continue;
    }

    file.detectedFormat = format;
    accepted.push(file);
  }

  if (rejectedPaths.length > 0) {
    return {
      error: 'One or more files are not valid JPEG, PNG, or WEBP images',
      rejectedPaths: [...rejectedPaths, ...accepted.map((f) => f.path)],
      accepted: [],
    };
  }

  return { accepted, rejectedPaths: [] };
}

// Upload one or more listing images; returns public URLs to store on the listing
router.post('/listing-images', uploadLimiter, verifyToken, (req, res) => {
  listingImageUpload.array('images', MAX_LISTING_IMAGES)(req, res, async (err) => {
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
        return res.status(400).json({ error: 'Failed to upload images' });
      }
      return res.status(400).json({ error: err.message || 'Failed to upload images' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const userId = req.user?.userId;
    if (!userId) {
      for (const file of req.files) unlinkQuietly(file.path);
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const validation = validateUploadedImageFiles(req.files);
    if (validation.error) {
      for (const filePath of validation.rejectedPaths) {
        unlinkQuietly(filePath);
      }
      return res.status(400).json({ error: validation.error });
    }

    try {
      for (const file of validation.accepted) {
        await recordListingImageUpload(userId, file.filename);
      }
    } catch (dbError) {
      console.error('Error recording listing image uploads:', dbError.message);
      for (const file of validation.accepted) {
        unlinkQuietly(file.path);
      }
      return res.status(500).json({ error: 'Failed to upload images' });
    }

    const baseUrl = resolveBaseUrl(req);
    const imageUrls = validation.accepted.map((file) => `${baseUrl}/uploads/${file.filename}`);

    res.json({
      image_urls: imageUrls,
      message: 'Images uploaded successfully',
    });
  });
});

module.exports = router;
