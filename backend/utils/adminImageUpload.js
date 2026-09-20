const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { resolveBaseUrl } = require('./baseUrl');
const {
  detectImageFormat,
  expectedFormatForExtension,
} = require('./imageContent');

/**
 * Shared multer + response handler for Admin Web marketing/banner image uploads.
 * Mounted at POST /api/admin/upload/image (verifyAdminAuth / admins table).
 */

const ADMIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ADMIN_IMAGE_EXT = /^\.(jpe?g|png|gif|webp)$/i;

function unlinkQuietly(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup errors
  }
}

function expectedFormatForMime(mime) {
  if (!mime) return null;
  if (/^image\/jpe?g$/i.test(mime)) return 'jpeg';
  if (/^image\/png$/i.test(mime)) return 'png';
  if (/^image\/gif$/i.test(mime)) return 'gif';
  if (/^image\/webp$/i.test(mime)) return 'webp';
  return null;
}

/** Whitelist only; never use the original basename (avoids path traversal). */
function safeAdminImageExt(originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (!ADMIN_IMAGE_EXT.test(ext)) return null;
  return ext === '.jpeg' ? '.jpg' : ext;
}

function adminImageFilename(originalname) {
  const ext = safeAdminImageExt(originalname) || '.jpg';
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  return `ad-${uniqueSuffix}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, adminImageFilename(file.originalname));
  },
});

function adminImageFileFilter(req, file, cb) {
  const extOk = Boolean(safeAdminImageExt(file.originalname));
  const mimeOk = Boolean(expectedFormatForMime(file.mimetype));
  if (extOk && mimeOk) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed'));
}

const adminImageUpload = multer({
  storage,
  limits: { fileSize: ADMIN_IMAGE_MAX_BYTES },
  fileFilter: adminImageFileFilter,
});

/**
 * After multer writes the file, require magic bytes to match extension and MIME.
 * Deletes the file when validation fails.
 */
function validateStoredAdminImage(file) {
  if (!file || !file.path) {
    return { error: 'No image file provided' };
  }

  let buffer;
  try {
    buffer = fs.readFileSync(file.path);
  } catch {
    unlinkQuietly(file.path);
    return { error: 'Failed to read uploaded image' };
  }

  if (!buffer.length) {
    unlinkQuietly(file.path);
    return { error: 'File is not a valid JPEG, PNG, GIF, or WEBP image' };
  }

  const format = detectImageFormat(buffer);
  const ext = path.extname(file.filename || file.originalname || '').toLowerCase();
  const expectedExt = expectedFormatForExtension(ext);
  const expectedMime = expectedFormatForMime(file.mimetype);

  if (!format || !expectedExt || expectedExt !== format || !expectedMime || expectedMime !== format) {
    unlinkQuietly(file.path);
    return { error: 'File is not a valid JPEG, PNG, GIF, or WEBP image' };
  }

  return { ok: true, format };
}

function respondWithUploadedImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const checked = validateStoredAdminImage(req.file);
    if (checked.error) {
      return res.status(400).json({ error: checked.error });
    }

    const baseUrl = resolveBaseUrl(req);
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({
      image_url: fileUrl,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    if (req.file) unlinkQuietly(req.file.path);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

function handleAdminImageUploadErrors(err, req, res) {
  if (!err) return false;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Image must be 5MB or smaller' });
      return true;
    }
    res.status(400).json({ error: 'Failed to upload image' });
    return true;
  }
  res.status(400).json({ error: err.message || 'Failed to upload image' });
  return true;
}

module.exports = {
  adminImageUpload,
  respondWithUploadedImage,
  validateStoredAdminImage,
  handleAdminImageUploadErrors,
  adminImageFilename,
  safeAdminImageExt,
  adminImageFileFilter,
  expectedFormatForMime,
  ADMIN_IMAGE_MAX_BYTES,
};
