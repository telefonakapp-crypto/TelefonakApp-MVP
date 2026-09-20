'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  validateStoredAdminImage,
  adminImageFilename,
  safeAdminImageExt,
  adminImageFileFilter,
  expectedFormatForMime,
  handleAdminImageUploadErrors,
  ADMIN_IMAGE_MAX_BYTES,
} = require('./adminImageUpload');

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwAPwB/f/9k=',
  'base64'
);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const WEBP = Buffer.from(
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
  'base64'
);

let tmpDir;

function writeTemp(name, buffer) {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function filterDecision(originalname, mimetype) {
  let accepted;
  let error;
  adminImageFileFilter({}, { originalname, mimetype }, (err, ok) => {
    error = err;
    accepted = ok;
  });
  return { accepted: Boolean(accepted), error };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('TFK-M5 admin image content validation', () => {
  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telefonak-admin-upload-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('1. valid JPEG is accepted', () => {
    const filePath = writeTemp('ok.jpg', JPEG);
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-1.jpg',
      originalname: 'ok.jpg',
      mimetype: 'image/jpeg',
    });
    assert.equal(result.ok, true);
    assert.equal(result.format, 'jpeg');
    assert.equal(fs.existsSync(filePath), true);
  });

  it('2. valid PNG is accepted', () => {
    const filePath = writeTemp('ok.png', PNG);
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-2.png',
      originalname: 'ok.png',
      mimetype: 'image/png',
    });
    assert.equal(result.ok, true);
    assert.equal(result.format, 'png');
  });

  it('3. valid GIF is accepted (admin currently supports GIF)', () => {
    const filePath = writeTemp('ok.gif', GIF);
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-3.gif',
      originalname: 'ok.gif',
      mimetype: 'image/gif',
    });
    assert.equal(result.ok, true);
    assert.equal(result.format, 'gif');
  });

  it('valid WebP is accepted', () => {
    const filePath = writeTemp('ok.webp', WEBP);
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-webp.webp',
      originalname: 'ok.webp',
      mimetype: 'image/webp',
    });
    assert.equal(result.ok, true);
  });

  it('4. JPEG name/MIME with non-JPEG bytes is rejected and deleted', () => {
    const filePath = writeTemp('fake.jpg', Buffer.from('this-is-not-jpeg'));
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-fake.jpg',
      originalname: 'fake.jpg',
      mimetype: 'image/jpeg',
    });
    assert.ok(result.error);
    assert.equal(fs.existsSync(filePath), false);
  });

  it('5. PNG name/MIME with non-PNG bytes is rejected', () => {
    const filePath = writeTemp('fake.png', JPEG);
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-fake.png',
      originalname: 'fake.png',
      mimetype: 'image/png',
    });
    assert.ok(result.error);
    assert.equal(fs.existsSync(filePath), false);
  });

  it('6. executable-like bytes renamed to .jpg are rejected', () => {
    const filePath = writeTemp('payload.jpg', Buffer.from('MZ\x00\x00not-an-image'));
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-payload.jpg',
      originalname: 'payload.jpg',
      mimetype: 'image/jpeg',
    });
    assert.ok(result.error);
    assert.equal(fs.existsSync(filePath), false);
  });

  it('7. SVG is rejected (not an allowed admin image type)', () => {
    const svgFilter = filterDecision('banner.svg', 'image/svg+xml');
    assert.equal(svgFilter.accepted, false);

    const filePath = writeTemp('banner.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-banner.svg',
      originalname: 'banner.svg',
      mimetype: 'image/svg+xml',
    });
    assert.ok(result.error);
    assert.equal(expectedFormatForMime('image/svg+xml'), null);
  });

  it('8. oversized upload is bounded at 5MB', () => {
    assert.equal(ADMIN_IMAGE_MAX_BYTES, 5 * 1024 * 1024);
    const err = { name: 'MulterError', code: 'LIMIT_FILE_SIZE' };
    Object.setPrototypeOf(err, require('multer').MulterError.prototype);
    const res = mockRes();
    const handled = handleAdminImageUploadErrors(err, {}, res);
    assert.equal(handled, true);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /5MB/i);
  });

  it('9. empty file is rejected', () => {
    const filePath = writeTemp('empty.jpg', Buffer.alloc(0));
    const result = validateStoredAdminImage({
      path: filePath,
      filename: 'ad-empty.jpg',
      originalname: 'empty.jpg',
      mimetype: 'image/jpeg',
    });
    assert.ok(result.error);
    assert.equal(fs.existsSync(filePath), false);
  });

  it('10. path-traversal original names are stored as ad-* in uploads, without ..', () => {
    const name = adminImageFilename('../../../etc/passwd.jpg');
    assert.match(name, /^ad-\d+-\d+\.jpg$/);
    assert.ok(!name.includes('..'));
    assert.ok(!name.includes('/'));
    assert.ok(!name.includes('\\'));
    assert.equal(safeAdminImageExt('../../../etc/passwd.jpg'), '.jpg');
    assert.equal(safeAdminImageExt('payload.jpg.exe'), null);
    assert.equal(safeAdminImageExt('banner.svg'), null);
  });
});
