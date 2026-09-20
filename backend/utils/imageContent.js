'use strict';

/**
 * Content-based image format detection (magic bytes).
 * Do not trust client filename / MIME alone.
 */

const FORMAT_BY_EXT = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.gif': 'gif',
  '.webp': 'webp',
};

const EXT_BY_FORMAT = {
  jpeg: '.jpg',
  png: '.png',
  gif: '.gif',
  webp: '.webp',
};

/**
 * @param {Buffer} buffer
 * @returns {'jpeg'|'png'|'gif'|'webp'|null}
 */
function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // GIF87a / GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'gif';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

function extensionForFormat(format) {
  return EXT_BY_FORMAT[format] || null;
}

function expectedFormatForExtension(ext) {
  if (!ext) return null;
  return FORMAT_BY_EXT[String(ext).toLowerCase()] || null;
}

module.exports = {
  detectImageFormat,
  extensionForFormat,
  expectedFormatForExtension,
  FORMAT_BY_EXT,
};
