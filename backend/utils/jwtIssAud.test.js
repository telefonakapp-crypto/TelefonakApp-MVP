'use strict';

/**
 * TFK-M3 — JWT issuer and audience are mandatory on every verify path.
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
}

const customerAuthPath = JSON.stringify(path.join(BACKEND_ROOT, 'utils', 'customerAuth.js'));
const adminTokenPath = JSON.stringify(path.join(BACKEND_ROOT, 'utils', 'adminToken.js'));
const verifyTokenPath = JSON.stringify(path.join(BACKEND_ROOT, 'middleware', 'verifyToken.js'));
const verifyAdminAuthPath = JSON.stringify(
  path.join(BACKEND_ROOT, 'middleware', 'verifyAdminAuth.js')
);

function customerVerifyScript(tokenExpr) {
  return `
    const jwt = require('jsonwebtoken');
    const { verifyCustomerToken } = require(${customerAuthPath});
    let ok = false;
    let name = null;
    try {
      const decoded = verifyCustomerToken(${tokenExpr});
      ok = Boolean(decoded && decoded.userId === 11 && decoded.typ === 'access');
    } catch (error) {
      name = error && error.name;
    }
    process.stdout.write(JSON.stringify({ ok, rejected: !ok, name }));
  `;
}

function adminVerifyScript(tokenExpr) {
  return `
    const jwt = require('jsonwebtoken');
    const { verifyAdminAccessToken } = require(${adminTokenPath});
    let ok = false;
    let name = null;
    try {
      const decoded = verifyAdminAccessToken(${tokenExpr});
      ok = Boolean(decoded && decoded.adminId === 42 && decoded.typ === 'admin');
    } catch (error) {
      name = error && error.name;
    }
    process.stdout.write(JSON.stringify({ ok, rejected: !ok, name }));
  `;
}

function middlewareScript(modulePath, tokenExpr) {
  return `
    const jwt = require('jsonwebtoken');
    const middleware = require(${modulePath});
    const req = { headers: { authorization: ${tokenExpr} } };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let nextCalled = false;
    Promise.resolve(middleware(req, res, () => { nextCalled = true; }))
      .then(() => {
        process.stdout.write(JSON.stringify({
          status: res.statusCode,
          nextCalled,
        }));
      })
      .catch((error) => {
        process.stderr.write(String(error && error.message));
        process.exit(1);
      });
  `;
}

const noneHelper = `
    function noneToken(payload) {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return header + '.' + body + '.';
    }
`;

describe('TFK-M3 production verify paths have no iss/aud fallback', () => {
  it('source: jwt.verify always passes issuer and audience', () => {
    const files = [
      path.join(BACKEND_ROOT, 'utils', 'customerAuth.js'),
      path.join(BACKEND_ROOT, 'utils', 'adminToken.js'),
      path.join(BACKEND_ROOT, 'middleware', 'verifyAdminAuth.js'),
      path.join(BACKEND_ROOT, 'middleware', 'verifyToken.js'),
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      assert.equal(src.includes('Legacy tokens'), false, file);
      assert.equal(src.includes('legacy admin tokens'), false, file);
      const verifies = [...src.matchAll(/jwt\.verify\s*\(/g)];
      for (const match of verifies) {
        const snippet = src.slice(match.index, match.index + 280);
        assert.match(snippet, /issuer:/, file);
        assert.match(snippet, /audience:/, file);
      }
    }
  });
});

describe('TFK-M3 customer JWT issuer/audience', () => {
  it('1. valid customer JWT with secret + issuer + audience → PASS', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('2. customer JWT missing issuer → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('3. customer JWT missing audience → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('4. customer JWT wrong issuer → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('5. customer JWT wrong audience → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('6. customer JWT signed with JWT_ADMIN_SECRET → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('7. customer JWT signed with JWT_SECRET → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('15. expired customer JWT → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: 0, issuer: 'telefonak-customer', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('17. alg=none customer token → rejected', () => {
    const result = runScript(`
      ${noneHelper}
      const { verifyCustomerToken } = require(${customerAuthPath});
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = noneToken({
        userId: 11,
        phoneNumber: '0790000011',
        typ: 'access',
        iss: 'telefonak-customer',
        aud: 'telefonak-mobile',
        exp,
      });
      let rejected = false;
      try { verifyCustomerToken(token); } catch (error) { rejected = true; }
      process.stdout.write(JSON.stringify({ rejected }));
    `);
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('21. adminId inside a customer-signed token → rejected', () => {
    const result = runScript(customerVerifyScript(`
      jwt.sign(
        { adminId: 99, userId: 11, phoneNumber: '0790000011', typ: 'access' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });
});

describe('TFK-M3 admin JWT issuer/audience', () => {
  it('8. valid admin JWT with secret + issuer + audience → PASS', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('9. admin JWT missing issuer → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: '1h', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('10. admin JWT missing audience → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-admin' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('11. admin JWT wrong issuer → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('12. admin JWT wrong audience → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-mobile' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('13. admin JWT signed with JWT_CUSTOMER_SECRET → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_CUSTOMER_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('14. admin JWT signed with JWT_SECRET → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('16. expired admin JWT → rejected', () => {
    const result = runScript(adminVerifyScript(`
      jwt.sign(
        { adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' },
        process.env.JWT_ADMIN_SECRET,
        { expiresIn: 0, issuer: 'telefonak-admin', audience: 'telefonak-admin-api' }
      )
    `));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });

  it('18. alg=none admin token → rejected', () => {
    const result = runScript(`
      ${noneHelper}
      const { verifyAdminAccessToken } = require(${adminTokenPath});
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = noneToken({
        adminId: 42,
        email: 'a@b.test',
        role: 'viewer',
        typ: 'admin',
        iss: 'telefonak-admin',
        aud: 'telefonak-admin-api',
        exp,
      });
      let rejected = false;
      try { verifyAdminAccessToken(token); } catch (error) { rejected = true; }
      process.stdout.write(JSON.stringify({ rejected }));
    `);
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });
});

describe('TFK-M3 cross-token isolation (middleware 401)', () => {
  it('19. customer token on admin middleware → 401', () => {
    const result = runScript(middlewareScript(
      verifyAdminAuthPath,
      "`Bearer ${jwt.sign({ userId: 11, phoneNumber: '0790000011', typ: 'access' }, process.env.JWT_CUSTOMER_SECRET, { expiresIn: '1h', issuer: 'telefonak-customer', audience: 'telefonak-mobile' })}`"
    ));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });

  it('20. admin token on customer middleware → 401', () => {
    const result = runScript(middlewareScript(
      verifyTokenPath,
      "`Bearer ${jwt.sign({ adminId: 42, email: 'a@b.test', role: 'viewer', typ: 'admin' }, process.env.JWT_ADMIN_SECRET, { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' })}`"
    ));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });

  it('22. userId inside an admin-signed token → 401', () => {
    const result = runScript(middlewareScript(
      verifyAdminAuthPath,
      "`Bearer ${jwt.sign({ adminId: 42, userId: 11, email: 'a@b.test', role: 'viewer', typ: 'admin' }, process.env.JWT_ADMIN_SECRET, { expiresIn: '1h', issuer: 'telefonak-admin', audience: 'telefonak-admin-api' })}`"
    ));
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 401);
    assert.equal(parsed.nextCalled, false);
    assertNoSecretLeak(result.message);
  });

  it('missing iss/aud is rejected in production as well as development', () => {
    const result = runScript(
      customerVerifyScript(`
        jwt.sign(
          { userId: 11, phoneNumber: '0790000011', typ: 'access' },
          process.env.JWT_CUSTOMER_SECRET,
          { expiresIn: '1h' }
        )
      `),
      { NODE_ENV: 'production' }
    );
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.rejected, true);
    assertNoSecretLeak(result.message);
  });
});
