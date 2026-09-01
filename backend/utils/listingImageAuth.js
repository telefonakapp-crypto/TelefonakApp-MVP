'use strict';

const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

/** Local listing upload filename under /uploads (no path segments). */
const LISTING_UPLOAD_FILENAME_RE = /^listing-[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i;

/**
 * Parse a listing image URL into a local uploads filename, or null.
 * Rejects path traversal and non-listing upload paths.
 */
function listingImageFilename(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  let pathname = imageUrl.trim();
  try {
    pathname = new URL(pathname).pathname;
  } catch {
    // Relative paths like /uploads/... are fine as-is
  }

  if (!pathname.includes('/uploads/')) {
    return null;
  }

  // Only allow a single path segment after /uploads/
  const uploadsIdx = pathname.lastIndexOf('/uploads/');
  const afterUploads = pathname.slice(uploadsIdx + '/uploads/'.length);
  if (!afterUploads || afterUploads.includes('/') || afterUploads.includes('\\') || afterUploads.includes('..')) {
    return null;
  }

  const filename = path.basename(afterUploads);
  if (!LISTING_UPLOAD_FILENAME_RE.test(filename)) {
    return null;
  }

  return filename;
}

function deleteLocalListingImageFile(imageUrl) {
  try {
    const filename = listingImageFilename(imageUrl);
    if (!filename) return;
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Could not delete listing image file:', err.message);
  }
}

/**
 * Copy a local listing-* upload to a new filename so revision snapshots do not
 * share disk files with their parents. Returns a public URL for the copy.
 */
function copyLocalListingImageFile(imageUrl, publicBaseUrl) {
  const filename = listingImageFilename(imageUrl);
  if (!filename) {
    return imageUrl;
  }

  const sourcePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(sourcePath)) {
    return imageUrl;
  }

  const ext = path.extname(filename).toLowerCase();
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const newFilename = `listing-${uniqueSuffix}${ext}`;
  const destPath = path.join(UPLOADS_DIR, newFilename);
  fs.copyFileSync(sourcePath, destPath);

  try {
    const parsed = new URL(imageUrl);
    return `${parsed.origin}/uploads/${newFilename}`;
  } catch {
    const base = (publicBaseUrl || '').replace(/\/+$/, '');
    return base ? `${base}/uploads/${newFilename}` : `/uploads/${newFilename}`;
  }
}

async function recordListingImageUpload(userId, filename) {
  if (!userId || !filename || !LISTING_UPLOAD_FILENAME_RE.test(filename)) {
    return;
  }
  await pool.query(
    `INSERT INTO listing_image_uploads (user_id, filename)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
    [userId, filename]
  );
}

/**
 * Normalize URL for comparison against stored listing_images.image_url values.
 * Compares by filename when both are Telefonak listing uploads.
 */
function imageUrlKey(imageUrl) {
  const filename = listingImageFilename(imageUrl);
  if (filename) return `file:${filename.toLowerCase()}`;
  return `raw:${String(imageUrl || '').trim()}`;
}

/**
 * Validate that each image URL may be attached to a listing by this user.
 *
 * Allowed:
 * - Upload owned by this user (listing_image_uploads)
 * - Image already attached to one of this user's listings (reuse / edit)
 * - Image already on the listing being edited (legacy grandfather for that listing only)
 *
 * Rejected:
 * - External URLs (unless already on this listing)
 * - Fabricated /uploads paths
 * - Another user's uploads
 * - Path traversal
 *
 * @returns {{ ok: true, urls: string[] } | { ok: false, error: string }}
 */
async function validateListingImageUrls({ userId, imageUrls, listingId = null }) {
  const urls = (Array.isArray(imageUrls) ? imageUrls : [])
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => url.trim());

  if (urls.length === 0) {
    return { ok: false, error: 'At least one image is required' };
  }

  let existingOnListing = new Set();
  if (listingId) {
    const existing = await pool.query(
      'SELECT image_url FROM listing_images WHERE listing_id = $1',
      [listingId]
    );
    existingOnListing = new Set(existing.rows.map((row) => imageUrlKey(row.image_url)));
  }

  const filenames = [];
  for (const url of urls) {
    const filename = listingImageFilename(url);
    if (filename) {
      filenames.push(filename);
    }
  }

  const ownedFilenames = new Set();
  if (filenames.length > 0) {
    const owned = await pool.query(
      `SELECT filename
       FROM listing_image_uploads
       WHERE user_id = $1 AND filename = ANY($2::text[])`,
      [userId, filenames]
    );
    for (const row of owned.rows) {
      ownedFilenames.add(row.filename);
    }

    // Also allow images already attached to any listing owned by this user
    // (covers pre-Phase-2 uploads that were never recorded in listing_image_uploads).
    const fromOwnListings = await pool.query(
      `SELECT li.image_url
       FROM listing_images li
       JOIN listings l ON l.id = li.listing_id
       WHERE l.user_id = $1`,
      [userId]
    );
    for (const row of fromOwnListings.rows) {
      const fn = listingImageFilename(row.image_url);
      if (fn) ownedFilenames.add(fn);
    }
  }

  for (const url of urls) {
    const key = imageUrlKey(url);
    if (existingOnListing.has(key)) {
      // Legacy / already-attached image on this listing — keep as-is.
      continue;
    }

    const filename = listingImageFilename(url);
    if (!filename) {
      return { ok: false, error: 'Invalid image reference' };
    }

    if (!ownedFilenames.has(filename)) {
      return { ok: false, error: 'Invalid image reference' };
    }

    // File must still exist on disk for newly referenced uploads
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: 'Invalid image reference' };
    }
  }

  return { ok: true, urls };
}

module.exports = {
  UPLOADS_DIR,
  LISTING_UPLOAD_FILENAME_RE,
  listingImageFilename,
  deleteLocalListingImageFile,
  copyLocalListingImageFile,
  recordListingImageUpload,
  validateListingImageUrls,
  imageUrlKey,
};
