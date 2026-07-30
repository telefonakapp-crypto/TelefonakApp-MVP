const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { resolveBaseUrl } = require('./baseUrl');

/**
 * Shared multer + response handler for Admin Web marketing/banner image uploads.
 * Mounted at POST /api/admin/upload/image (verifyAdminAuth / admins table).
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ad-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const adminImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  },
});

function respondWithUploadedImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const baseUrl = resolveBaseUrl(req);
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({
      image_url: fileUrl,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

module.exports = {
  adminImageUpload,
  respondWithUploadedImage,
};
