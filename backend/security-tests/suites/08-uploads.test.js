'use strict';

/**
 * SEC-016 — Upload content validation (magic bytes).
 * SEC-002 helpers also cover upload count limits used by listing create.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  customerToken,
  tinyJpegBuffer,
  tinyPngBuffer,
  tinyWebpBuffer,
  fakeJpegBuffer,
  fakePngBuffer,
  fakeWebpBuffer,
  loadFixtures,
} = require('../lib/harness');

async function uploadImages(token, files) {
  const form = new FormData();
  for (const file of files) {
    const blob = new Blob([file.buffer], { type: file.type });
    form.append('images', blob, file.name);
  }
  return api('POST', '/upload/listing-images', { token, formData: form });
}

describe('08 — Uploads (SEC-016)', () => {
  let fx;
  let token;

  before(async () => {
    fx = await loadFixtures();
    token = customerToken(fx.owner.id, fx.owner.phone_number);
  });

  it('rejects upload without auth', async () => {
    const form = new FormData();
    form.append(
      'images',
      new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
      'ok.jpg'
    );
    const res = await api('POST', '/upload/listing-images', { formData: form });
    assert.equal(res.status, 401);
  });

  it('accepts a small valid JPEG with auth', async () => {
    const res = await uploadImages(token, [
      { buffer: tinyJpegBuffer(), type: 'image/jpeg', name: 'ok.jpg' },
    ]);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data?.image_urls));
    assert.ok(res.data.image_urls.length >= 1);
    assert.match(String(res.data.image_urls[0]), /\/uploads\/listing-/);
  });

  it('accepts a small valid PNG with auth', async () => {
    const res = await uploadImages(token, [
      { buffer: tinyPngBuffer(), type: 'image/png', name: 'ok.png' },
    ]);
    assert.equal(res.status, 200);
    assert.ok(res.data.image_urls.length >= 1);
  });

  it('accepts a small valid WebP with auth', async () => {
    const res = await uploadImages(token, [
      { buffer: tinyWebpBuffer(), type: 'image/webp', name: 'ok.webp' },
    ]);
    assert.equal(res.status, 200);
    assert.ok(res.data.image_urls.length >= 1);
  });

  it('rejects non-image extension even if named oddly', async () => {
    const res = await uploadImages(token, [
      {
        buffer: Buffer.from('not-an-image'),
        type: 'application/octet-stream',
        name: 'payload.exe',
      },
    ]);
    assert.equal(res.status, 400);
  });

  it('rejects fake image/jpeg MIME with .jpg name but non-image bytes (SEC-016)', async () => {
    const res = await uploadImages(token, [
      {
        buffer: fakeJpegBuffer(),
        type: 'image/jpeg',
        name: 'fake.jpg',
      },
    ]);
    assert.equal(res.status, 400);
    assert.ok(!String(res.data?.error || '').includes('/Users/'));
    assert.ok(!String(res.data?.error || '').includes('uploads/'));
  });

  it('rejects fake PNG content', async () => {
    const res = await uploadImages(token, [
      { buffer: fakePngBuffer(), type: 'image/png', name: 'fake.png' },
    ]);
    assert.equal(res.status, 400);
  });

  it('rejects fake WebP content', async () => {
    const res = await uploadImages(token, [
      { buffer: fakeWebpBuffer(), type: 'image/webp', name: 'fake.webp' },
    ]);
    assert.equal(res.status, 400);
  });

  it('rejects JPEG bytes with wrong .png extension', async () => {
    const res = await uploadImages(token, [
      { buffer: tinyJpegBuffer(), type: 'image/png', name: 'wrong.png' },
    ]);
    assert.equal(res.status, 400);
  });

  it('rejects JPEG bytes labeled as image/png with .jpg name (wrong MIME)', async () => {
    const res = await uploadImages(token, [
      { buffer: tinyJpegBuffer(), type: 'image/png', name: 'wrong.jpg' },
    ]);
    assert.equal(res.status, 400);
  });

  it('rejects oversized file over 5MB', async () => {
    // Minimal JPEG header + padding past 5MB (not a dangerous payload).
    const oversized = Buffer.concat([
      tinyJpegBuffer(),
      Buffer.alloc(5 * 1024 * 1024),
    ]);
    const res = await uploadImages(token, [
      { buffer: oversized, type: 'image/jpeg', name: 'big.jpg' },
    ]);
    assert.equal(res.status, 400);
  });

  it('rejects path-traversal style original filename', async () => {
    const res = await uploadImages(token, [
      {
        buffer: tinyJpegBuffer(),
        type: 'image/jpeg',
        name: '../../../etc/passwd.jpg',
      },
    ]);
    // Either rejected by filter/content rules, or accepted only as a sanitized listing-* name.
    if (res.status === 200) {
      for (const url of res.data.image_urls || []) {
        assert.match(String(url), /\/uploads\/listing-[^/]+$/);
        assert.ok(!String(url).includes('..'));
        assert.ok(!String(url).includes('etc/passwd'));
      }
    } else {
      assert.equal(res.status, 400);
    }
  });

  it('accepts up to 10 images in one upload', async () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      buffer: tinyJpegBuffer(),
      type: 'image/jpeg',
      name: `ok-${i}.jpg`,
    }));
    const res = await uploadImages(token, files);
    assert.equal(res.status, 200);
    assert.equal(res.data.image_urls.length, 10);
  });

  it('rejects 11 images in one upload', async () => {
    const files = Array.from({ length: 11 }, (_, i) => ({
      buffer: tinyJpegBuffer(),
      type: 'image/jpeg',
      name: `ok-${i}.jpg`,
    }));
    const res = await uploadImages(token, files);
    assert.equal(res.status, 400);
  });
});
