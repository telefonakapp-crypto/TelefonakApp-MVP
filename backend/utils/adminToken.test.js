'use strict';

/**
 * H3 — Admin JWT issue/verify/TTL isolation.
 * Spawns isolated Node processes so dotenv/.env cannot leak local secrets.
 * Never prints tokens or secret values.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const CUSTOMER = 'test-only-customer-jwt-secret-aaaaaaaa';
const ADMIN = 'test-only-admin-jwt-secret-bbbbbbbbbbbb';
const SHARED = 'test-only-shared-jwt-secret-cccccccccc';
const TWILIO_SID = 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TWILIO_TOKEN = 'test_twilio_auth_token_xx';
const TWILIO_FROM = '+15005550006';

function baseEnv(overrides) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '',
    NODE_ENV: 'development',
    DB_NAME: 'telefonak',
    DB_USER: 'postgres',
    BASE_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
    JWT_SECRET: SHARED,
    OTP_PEPPER: CUSTOMER,
    TWILIO_ACCOUNT_SID: TWILIO_SID,
    TWILIO_AUTH_TOKEN: TWILIO_TOKEN,
    TWILIO_PHONE_NUMBER: TWILIO_FROM,
    ADMIN_ACCESS_TOKEN_TTL: '8h',
    ...overrides,
  };
}

function runScript(script, envOverrides) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: BACKEND_ROOT,
    env: baseEnv(envOverrides),
    encoding: 'utf8',
    timeout: 8000,
  });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    message: `${result.stdout || ''}\n${result.stderr || ''}`,
  };
}

function assertNoSecretLeak(output) {
  assert.equal(output.includes(CUSTOMER), false);
  assert.equal(output.includes(ADMIN), false);
  assert.equal(output.includes(SHARED), false);
  assert.equal(output.includes(TWILIO_TOKEN), false);
  assert.doesNotMatch(output, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
}

describe('H3 admin JWT issuance and secret isolation', () => {
  it('1-5. issues an admin token with JWT_ADMIN_SECRET, 8h exp, and rejects other secrets', () => {
    const result = runScript(`
      const jwt = require('jsonwebtoken');
      const { signAdminToken, verifyAdminAccessToken } = require(${JSON.stringify(
        path.join(BACKEND_ROOT, 'utils', 'adminToken.js')
      )});
      const { getAdminAccessTokenTtl } = require(${JSON.stringify(
        path.join(BACKEND_ROOT, 'config', 'env.js')
      )});
      const token = signAdminToken({
        id: 42,
        email: 'h3-admin@example.test',
        role: 'viewer',
      });
      const decoded = verifyAdminAccessToken(token);
      const ttlSec = decoded.exp - decoded.iat;
      let customerOk = false;
      let sharedOk = false;
      try {
        jwt.verify(token, process.env.JWT_CUSTOMER_SECRET, {
          issuer: 'telefonak-admin',
          audience: 'telefonak-admin-api',
        });
        customerOk = true;
      } catch {}
      try {
        jwt.verify(token, process.env.JWT_SECRET, {
          issuer: 'telefonak-admin',
          audience: 'telefonak-admin-api',
        });
        sharedOk = true;
      } catch {}
      process.stdout.write(JSON.stringify({
        ok: true,
        ttl: getAdminAccessTokenTtl(),
        ttlSec,
        adminId: decoded.adminId,
        typ: decoded.typ,
        iss: decoded.iss,
        aud: decoded.aud,
        customerOk,
        sharedOk,
      }));
    `);
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.ttl, '8h');
    assert.ok(parsed.ttlSec >= 8 * 3600 - 5);
    assert.ok(parsed.ttlSec <= 8 * 3600 + 5);
    assert.equal(parsed.adminId, 42);
    assert.equal(parsed.typ, 'admin');
    assert.equal(parsed.iss, 'telefonak-admin');
    assert.equal(parsed.aud, 'telefonak-admin-api');
    assert.equal(parsed.customerOk, false);
    assert.equal(parsed.sharedOk, false);
    assertNoSecretLeak(result.message);
  });
});

describe('H3 admin middleware rejection', () => {
  const middlewareScript = (tokenExpr) => `
    const verifyAdminAuth = require(${JSON.stringify(
      path.join(BACKEND_ROOT, 'middleware', 'verifyAdminAuth.js')
    )});
    const jwt = require('jsonwebtoken');
    const req = { headers: { authorization: ${tokenExpr} } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let nextCalled = false;
    Promise.resolve(verifyAdminAuth(req, res, () => { nextCalled = true; }))
      .then(() => {
        process.stdout.write(JSON.stringify({
          status: res.statusCode,
          error: res.body && res.body.error,
          nextCalled,
        }));
      })
      .catch((error) => {
        process.stderr.write(String(error && error.message));
        process.exit(1);
      });
  `;

  it('6. expired admin token is rejected with 401', () => {
    const result = runScript(middlewareScript(
      "`Bearer ${jwt.sign({ adminId: 1, email: 'a@b.test', role: 'viewer', typ: 'admin' }, process.env.JWT_ADMIN_SECRET, { expiresIn: 0, issuer: 'telefonak-admin', audience: 'telefonak-admin-api' })}`"
    ));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });

  it('7. missing admin token is rejected', () => {
    const result = runScript(middlewareScript('undefined'));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.match(String(parsed.error), /No token provided/i);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });

  it('8. invalid admin token is rejected', () => {
    const result = runScript(middlewareScript("'Bearer not-a-jwt'"));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });

  it('9. customer token cannot pass verifyAdminAuth', () => {
    const result = runScript(middlewareScript(
      "`Bearer ${jwt.sign({ userId: 7, phoneNumber: '0790000007', typ: 'access' }, process.env.JWT_CUSTOMER_SECRET, { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-mobile' })}`"
    ));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });
});

describe('H3 admin authorization helpers still fail-closed', () => {
  it('10. role permissions are unchanged (viewer cannot manage admins; super_admin can)', () => {
    const { hasPermission, PERMISSIONS, ADMIN_ROLES } = require('./adminAuth');
    assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.ADMINS_MANAGE), false);
    assert.equal(hasPermission(ADMIN_ROLES.SUPER_ADMIN, PERMISSIONS.ADMINS_MANAGE), true);
    assert.equal(hasPermission(ADMIN_ROLES.MODERATOR, PERMISSIONS.LISTINGS_MODERATE), true);
    assert.equal(hasPermission('not-a-role', PERMISSIONS.LISTINGS_MODERATE), false);
  });

  it('logout remains client-side only (no admin auth logout route)', () => {
    const src = fs.readFileSync(path.join(BACKEND_ROOT, 'routes', 'adminAuth.js'), 'utf8');
    assert.doesNotMatch(src, /router\.(post|delete)\(\s*['"]\/logout['"]/);
  });
});
