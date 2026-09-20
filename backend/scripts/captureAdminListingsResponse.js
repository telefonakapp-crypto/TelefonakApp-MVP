/**
 * Capture All-statuses vs Declined the same way Admin Web does.
 * Usage: node scripts/captureAdminListingsResponse.js
 */
require('dotenv').config();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const { getAdminJwtSecret, ADMIN_JWT_ISS, ADMIN_JWT_AUD } = require('../config/env');

async function get(path, token) {
  const res = await fetch(`http://127.0.0.1:3000/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
}

(async () => {
  const admin = (
    await pool.query(`SELECT id FROM admins WHERE is_active ORDER BY id LIMIT 1`)
  ).rows[0];
  const token = jwt.sign(
    { adminId: admin.id, typ: 'admin' },
    getAdminJwtSecret(),
    { expiresIn: '1h', issuer: ADMIN_JWT_ISS, audience: ADMIN_JWT_AUD }
  );

  const target = (
    await pool.query(
      `SELECT id FROM listings WHERE status = 'declined'
       ORDER BY COALESCE(approved_or_rejected_at, updated_at) DESC NULLS LAST
       LIMIT 1`
    )
  ).rows[0];

  const all = await get('/admin/listings?page=1&limit=20', token);
  const declined = await get('/admin/listings?page=1&limit=20&status=declined', token);

  const allItems = all.body.items || [];
  const declinedItems = declined.body.items || [];

  const report = {
    verdict:
      allItems.some((i) => i.id === target.id)
        ? 'A_API_CONTAINS_DECLINED_LISTING'
        : 'B_API_MISSING_DECLINED_LISTING',
    targetDeclinedId: target.id,
    allStatuses: {
      http: all.status,
      url: '/api/admin/listings?page=1&limit=20',
      pagination: all.body.pagination,
      ids: allItems.map((i) => i.id),
      idStatus: allItems.map((i) => ({ id: i.id, status: i.status })),
      declinedIdsInResponse: allItems.filter((i) => i.status === 'declined').map((i) => i.id),
      targetPresent: allItems.some((i) => i.id === target.id),
    },
    declinedFilter: {
      http: declined.status,
      url: '/api/admin/listings?page=1&limit=20&status=declined',
      pagination: declined.body.pagination,
      ids: declinedItems.map((i) => i.id),
      targetPresent: declinedItems.some((i) => i.id === target.id),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
