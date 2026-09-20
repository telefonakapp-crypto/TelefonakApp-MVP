'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectImageFormat, expectedFormatForExtension } = require('./imageContent');

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwAPwB/f/9k=',
  'base64'
);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const WEBP = Buffer.from(
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
  'base64'
);
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

describe('detectImageFormat (magic bytes)', () => {
  it('detects JPEG, PNG, WebP, and GIF', () => {
    assert.equal(detectImageFormat(JPEG), 'jpeg');
    assert.equal(detectImageFormat(PNG), 'png');
    assert.equal(detectImageFormat(WEBP), 'webp');
    assert.equal(detectImageFormat(GIF), 'gif');
  });

  it('rejects empty, short, SVG, and executable-like bytes', () => {
    assert.equal(detectImageFormat(Buffer.alloc(0)), null);
    assert.equal(detectImageFormat(Buffer.from('MZ')), null);
    assert.equal(detectImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
    assert.equal(detectImageFormat(Buffer.from('not-an-image')), null);
    assert.equal(detectImageFormat(null), null);
  });

  it('maps extensions independently of client MIME', () => {
    assert.equal(expectedFormatForExtension('.jpg'), 'jpeg');
    assert.equal(expectedFormatForExtension('.gif'), 'gif');
    assert.equal(expectedFormatForExtension('.svg'), null);
    assert.equal(expectedFormatForExtension('.exe'), null);
  });
});
