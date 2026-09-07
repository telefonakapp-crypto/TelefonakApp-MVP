const express = require('express');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../utils/adminAuth');
const { uploadLimiter } = require('../middleware/rateLimits');
const {
  adminImageUpload,
  respondWithUploadedImage,
} = require('../utils/adminImageUpload');

const router = express.Router();

/**
 * POST /api/admin/upload/image
 * Admin Web only — authenticates against the admins table (verifyAdminAuth).
 * Independent from the legacy mobile OTP admin path.
 */
router.post(
  '/image',
  uploadLimiter,
  verifyAdminAuth,
  requirePermission(PERMISSIONS.UPLOAD_WRITE),
  adminImageUpload.single('image'),
  respondWithUploadedImage
);

module.exports = router;
