const express = require('express');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../utils/adminAuth');
const { uploadLimiter } = require('../middleware/rateLimits');
const {
  adminImageUpload,
  respondWithUploadedImage,
  handleAdminImageUploadErrors,
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
  (req, res) => {
    adminImageUpload.single('image')(req, res, (err) => {
      if (handleAdminImageUploadErrors(err, req, res)) return;
      return respondWithUploadedImage(req, res);
    });
  }
);

module.exports = router;
