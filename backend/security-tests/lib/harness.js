/**
 * Shared helpers for Telefonak security regression tests.
 *
 * These tests hit the LOCAL API only (default http://127.0.0.1:3000).
 * They never print secrets, OTP codes, or full JWTs.
 */
'use strict';

const path = require('path');
const jwt = require('jsonwebtoken');

// Load backend env from backend/.env when run from security-tests/
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('../../config/database');
const { getCustomerJwtSecret, getAdminJwtSecret, CUSTOMER_JWT_ISS, CUSTOMER_JWT_AUD, ADMIN_JWT_ISS, ADMIN_JWT_AUD } = require('../../config/env');

const API_ORIGIN = (process.env.SECURITY_TEST_API_URL || 'http://127.0.0.1:3000').replace(
  /\/+$/,
  ''
);
const API = `${API_ORIGIN}/api`;

function customerToken(userId, phoneNumber = `0790000${String(userId).padStart(3, '0')}`) {
  return jwt.sign(
    { userId, phoneNumber, typ: 'access' },
    getCustomerJwtSecret(),
    {
      expiresIn: '1h',
      issuer: CUSTOMER_JWT_ISS,
      audience: CUSTOMER_JWT_AUD,
    }
  );
}

function registrationToken(phoneNumber = '0790000999') {
  return jwt.sign(
    { phoneNumber, verified: true, typ: 'registration' },
    getCustomerJwtSecret(),
    {
      expiresIn: '1h',
      issuer: CUSTOMER_JWT_ISS,
      audience: CUSTOMER_JWT_AUD,
    }
  );
}

function adminToken({ adminId, email = 'security-test@telefonak.local', role = 'viewer' }) {
  return jwt.sign(
    { adminId, email, role, typ: 'admin' },
    getAdminJwtSecret(),
    {
      expiresIn: '1h',
      issuer: ADMIN_JWT_ISS,
      audience: ADMIN_JWT_AUD,
    }
  );
}

async function api(method, pathname, { token, body, headers = {}, formData } = {}) {
  const url = pathname.startsWith('http') ? pathname : `${API}${pathname}`;
  const reqHeaders = { ...headers };

  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  let payload = formData;
  if (!formData && body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : payload,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text.slice(0, 500) };
  }

  return { status: response.status, data, headers: response.headers };
}

function collectPhoneLikeFields(value, pathKey = '', out = []) {
  if (value == null) return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPhoneLikeFields(item, `${pathKey}[${index}]`, out));
    return out;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = pathKey ? `${pathKey}.${key}` : key;
      if (/phone/i.test(key)) {
        out.push({ path: next, value: child });
      }
      collectPhoneLikeFields(child, next, out);
    }
  }
  return out;
}

/** Tiny valid 1x1 JPEG (magic bytes FF D8 … FF D9). */
function tinyJpegBuffer() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwAPwB/f/9k=',
    'base64'
  );
}

/** Tiny valid 1x1 PNG. */
function tinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

/** Tiny valid WebP (VP8). */
function tinyWebpBuffer() {
  return Buffer.from(
    'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
    'base64'
  );
}

/** Bytes that are NOT a JPEG, but will be uploaded with a .jpg name. */
function fakeJpegBuffer() {
  return Buffer.from('MZ\x00\x00this-is-not-an-image-file');
}

/** Bytes that are NOT a PNG. */
function fakePngBuffer() {
  return Buffer.from('not-a-real-png-file-content');
}

/** Bytes that are NOT a WebP. */
function fakeWebpBuffer() {
  return Buffer.from('RIFF....NOTWEBP_CONTENT_HERE');
}

async function loadFixtures() {
  const users = await pool.query(
    `SELECT id, phone_number
     FROM users
     WHERE is_active IS DISTINCT FROM false
     ORDER BY id
     LIMIT 5`
  );

  if (users.rows.length < 2) {
    throw new Error('Need at least 2 active users in DB for security fixtures');
  }

  const listings = await pool.query(
    `SELECT l.id, l.user_id, l.status
     FROM listings l
     JOIN models m ON m.id = l.model_id
     JOIN categories c ON c.id = m.category_id
     WHERE l.status = 'approved'
       AND c.slug = 'phones'
       AND NOT EXISTS (
         SELECT 1 FROM listings child WHERE child.previous_listing_id = l.id
       )
     ORDER BY l.id DESC
     LIMIT 5`
  );

  const offers = await pool.query(
    `SELECT id, seller_id, buyer_id, listing_id, status
     FROM offers
     ORDER BY id DESC
     LIMIT 5`
  );

  const notifications = await pool.query(
    `SELECT id, user_id
     FROM notifications
     WHERE user_id IS NOT NULL
     ORDER BY id DESC
     LIMIT 5`
  );

  const admins = await pool.query(
    `SELECT id, email, role
     FROM admins
     WHERE is_active = true
     ORDER BY
       CASE role
         WHEN 'super_admin' THEN 0
         WHEN 'moderator' THEN 1
         ELSE 2
       END,
       id
     LIMIT 10`
  );

  const owner = listings.rows[0]
    ? users.rows.find((u) => u.id === listings.rows[0].user_id) || users.rows[0]
    : users.rows[0];

  const stranger = users.rows.find((u) => u.id !== owner.id) || users.rows[1];

  const catalog = await pool.query(
    `SELECT
       ms.model_id,
       ms.id AS model_storage_id,
       mc.id AS model_color_id,
       (SELECT id FROM sim_configurations WHERE is_active = TRUE ORDER BY id LIMIT 1) AS sim_configuration_id,
       (SELECT id FROM conditions ORDER BY id LIMIT 1) AS condition_id
     FROM model_storages ms
     JOIN model_colors mc ON mc.model_id = ms.model_id
     JOIN models m ON m.id = ms.model_id
     JOIN categories cat ON cat.id = m.category_id
     WHERE cat.slug = 'phones'
     ORDER BY ms.id
     LIMIT 1`
  );

  return {
    apiOrigin: API_ORIGIN,
    owner,
    stranger,
    users: users.rows,
    listing: listings.rows[0] || null,
    listings: listings.rows,
    offer: offers.rows[0] || null,
    offers: offers.rows,
    notification: notifications.rows[0] || null,
    notifications: notifications.rows,
    admin: admins.rows[0] || null,
    admins: admins.rows,
    catalog: catalog.rows[0] || null,
  };
}

async function deleteListingsByIds(ids) {
  const listingIds = [
    ...new Set(
      (ids || [])
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
  if (listingIds.length === 0) return { deleted: 0 };

  const related = await pool.query(
    `SELECT id FROM listings
     WHERE id = ANY($1::int[])
        OR root_listing_id = ANY($1::int[])
        OR previous_listing_id = ANY($1::int[])`,
    [listingIds]
  );
  const allIds = [...new Set(related.rows.map((row) => row.id))];
  if (allIds.length === 0) return { deleted: 0 };

  await pool.query(
    `DELETE FROM listing_moderation_events
     WHERE listing_id = ANY($1::int[])
        OR previous_listing_id = ANY($1::int[])
        OR root_listing_id = ANY($1::int[])`,
    [allIds]
  );
  await pool.query(
    `UPDATE notifications SET related_listing_id = NULL
     WHERE related_listing_id = ANY($1::int[])`,
    [allIds]
  );
  await pool.query(`DELETE FROM listing_views WHERE listing_id = ANY($1::int[])`, [allIds]);
  await pool.query(`DELETE FROM favorites WHERE listing_id = ANY($1::int[])`, [allIds]);
  await pool.query(`DELETE FROM offers WHERE listing_id = ANY($1::int[])`, [allIds]);
  await pool.query(`DELETE FROM listing_images WHERE listing_id = ANY($1::int[])`, [allIds]);
  await pool.query(
    `UPDATE listings
     SET previous_listing_id = NULL
     WHERE id = ANY($1::int[])
        OR previous_listing_id = ANY($1::int[])`,
    [allIds]
  );
  const result = await pool.query(`DELETE FROM listings WHERE id = ANY($1::int[])`, [allIds]);
  return { deleted: result.rowCount || 0 };
}

async function closeFixtures() {
  await pool.end();
}

module.exports = {
  API,
  API_ORIGIN,
  pool,
  customerToken,
  registrationToken,
  adminToken,
  api,
  collectPhoneLikeFields,
  tinyJpegBuffer,
  tinyPngBuffer,
  tinyWebpBuffer,
  fakeJpegBuffer,
  fakePngBuffer,
  fakeWebpBuffer,
  loadFixtures,
  deleteListingsByIds,
  closeFixtures,
};
