/**
 * Manual verification for Maintenance Mode enforcement.
 * Usage: node tmp_verify_maintenance.js
 */
require('dotenv').config();
const pool = require('./config/database');
const {
  getSetting,
  invalidateMaintenanceCache,
} = require('./utils/settings');

const BASE = process.env.VERIFY_API_BASE || 'http://127.0.0.1:3000/api';

async function req(method, path, { token, adminToken, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function findCustomerToken() {
  if (process.env.VERIFY_CUSTOMER_TOKEN) {
    return process.env.VERIFY_CUSTOMER_TOKEN;
  }
  return null;
}

async function adminLogin() {
  const email = process.env.VERIFY_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
  const password =
    process.env.VERIFY_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SKIP admin login — set VERIFY_ADMIN_EMAIL/PASSWORD');
    return null;
  }
  const { status, data } = await req('POST', '/admin/auth/login', {
    body: { email, password },
  });
  if (status !== 200 || !data?.token) {
    console.log('Admin login failed', status, data);
    return null;
  }
  return data.token;
}

async function setMaintenance(enabled) {
  // Direct SQL avoids requiring a valid admins.id for updated_by FK in this script.
  await pool.query(
    `INSERT INTO settings (key, value)
     VALUES ('maintenance_mode', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [enabled ? 'true' : 'false']
  );
  invalidateMaintenanceCache();
  // Server process has its own 2s cache; wait so probes see the new value.
  await new Promise((r) => setTimeout(r, 2200));
  const value = await getSetting('maintenance_mode');
  assert(value === enabled, `Expected maintenance_mode=${enabled}, got ${value}`);
}

async function main() {
  console.log('=== Maintenance Mode verification ===');
  console.log('API:', BASE);

  const healthBefore = await req('GET', '/health');
  assert(healthBefore.status === 200, 'Health should be reachable');

  const adminToken = await adminLogin();

  console.log('\n1) Enable maintenance_mode in DB');
  await setMaintenance(true);

  console.log('2) Public status should report maintenance=true (200)');
  const statusOn = await req('GET', '/status');
  assert(statusOn.status === 200, `status expected 200, got ${statusOn.status}`);
  assert(statusOn.data?.maintenance === true, 'status.maintenance should be true');

  console.log('3) Customer endpoints should return 503');
  const cases = [
    ['GET', '/listings'],
    ['GET', '/banners'],
    ['GET', '/brands'],
    ['GET', '/categories'],
    ['POST', '/auth/request-otp', { body: { phone_number: '0790000001' } }],
    ['POST', '/auth/verify-otp', { body: { phone_number: '0790000001', otp: '000000' } }],
  ];

  const customerToken = await findCustomerToken();
  if (customerToken) {
    cases.push(
      ['GET', '/user/profile', { token: customerToken }],
      ['GET', '/favorites', { token: customerToken }],
      ['GET', '/offers/sent', { token: customerToken }],
      ['POST', '/listings', { token: customerToken, body: {} }]
    );
  } else {
    console.log('   (no VERIFY_CUSTOMER_TOKEN — skipping authenticated customer cases)');
  }

  for (const [method, path, opts] of cases) {
    const result = await req(method, path, opts || {});
    assert(
      result.status === 503 && result.data?.maintenance === true,
      `${method} ${path} expected 503 maintenance, got ${result.status} ${JSON.stringify(result.data)}`
    );
    console.log(`   OK ${method} ${path} → 503`);
  }

  if (adminToken) {
    console.log('4) Admin APIs must still work');
    const adminSettings = await req('GET', '/admin/settings', { adminToken });
    assert(
      adminSettings.status === 200 && adminSettings.data?.settings,
      `Admin settings failed: ${adminSettings.status}`
    );
    console.log('   OK GET /admin/settings');

    const adminLoginAgain = await req('POST', '/admin/auth/login', {
      body: {
        email: process.env.VERIFY_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL,
        password:
          process.env.VERIFY_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD,
      },
    });
    assert(adminLoginAgain.status === 200, 'Admin login during maintenance failed');
    console.log('   OK POST /admin/auth/login');
  } else {
    console.log('4) SKIP admin API checks (no admin credentials)');
  }

  console.log('5) Disable maintenance_mode');
  await setMaintenance(false);

  const statusOff = await req('GET', '/status');
  assert(statusOff.data?.maintenance === false, 'status.maintenance should be false');

  const listingsOff = await req('GET', '/listings');
  assert(
    listingsOff.status !== 503,
    `Listings should not be 503 after disable, got ${listingsOff.status}`
  );
  console.log(`   OK GET /listings → ${listingsOff.status}`);

  console.log('\n✅ All maintenance verification checks passed');
}

main()
  .catch((err) => {
    console.error('\n❌ Verification failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await setMaintenance(false);
    } catch {
      // ignore cleanup errors
    }
    await pool.end();
  });
