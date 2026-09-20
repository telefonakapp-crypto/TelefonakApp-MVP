'use strict';

/**
 * Startup validation for JWT secret separation.
 * Spawns isolated Node processes so dotenv/.env cannot leak local secrets into cases.
 * Never prints secret values.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const CUSTOMER = 'test-only-customer-jwt-secret-aaaaaaaa';
const ADMIN = 'test-only-admin-jwt-secret-bbbbbbbbbbbb';
const SHARED = 'test-only-shared-jwt-secret-cccccccccc';
const OTP_PEPPER = 'test-only-otp-pepper-dddddddddddd';
const TWILIO_SID = 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TWILIO_TOKEN = 'test_twilio_auth_token_xx';
const TWILIO_FROM = '+15005550006';

function runValidate(envOverrides) {
  const script = `
    const { validateEnv, getCustomerJwtSecret, getAdminJwtSecret, getOtpPepper } = require(${JSON.stringify(
      path.join(BACKEND_ROOT, 'config', 'env.js')
    )});
    validateEnv();
    const same = getCustomerJwtSecret() === getAdminJwtSecret();
    const pepperEqCustomer = getOtpPepper() === getCustomerJwtSecret();
    process.stdout.write('START_OK same=' + same + ' pepperEqCustomer=' + pepperEqCustomer);
  `;

  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '',
    NODE_ENV: 'production',
    DB_NAME: 'telefonak',
    DB_USER: 'postgres',
    BASE_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_CUSTOMER_SECRET: '',
    JWT_ADMIN_SECRET: '',
    JWT_SECRET: '',
    OTP_PEPPER: OTP_PEPPER,
    TWILIO_ACCOUNT_SID: TWILIO_SID,
    TWILIO_AUTH_TOKEN: TWILIO_TOKEN,
    TWILIO_PHONE_NUMBER: TWILIO_FROM,
    ADMIN_ACCESS_TOKEN_TTL: '8h',
    ...envOverrides,
  };

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: BACKEND_ROOT,
    env,
    encoding: 'utf8',
    timeout: 8000,
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  const combined = `${stdout}\n${stderr}`;
  return {
    status: result.status,
    stdout,
    stderr,
    ok: result.status === 0 && stdout.startsWith('START_OK'),
    message: combined,
  };
}

function assertNoSecretLeak(output) {
  assert.equal(output.includes(CUSTOMER), false);
  assert.equal(output.includes(ADMIN), false);
  assert.equal(output.includes(SHARED), false);
  assert.equal(output.includes(TWILIO_TOKEN), false);
  assert.equal(output.includes(OTP_PEPPER), false);
}

describe('JWT secret production startup validation', () => {
  it('A. both dedicated secrets present and different → starts', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: CUSTOMER,
      JWT_ADMIN_SECRET: ADMIN,
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /START_OK same=false/);
    assertNoSecretLeak(result.message);
  });

  it('B. JWT_CUSTOMER_SECRET missing → refuses to start', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: ADMIN,
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /JWT_CUSTOMER_SECRET/);
    assert.doesNotMatch(result.message, /JWT_SECRET or/);
    assertNoSecretLeak(result.message);
  });

  it('C. JWT_ADMIN_SECRET missing → refuses to start', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: CUSTOMER,
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /JWT_ADMIN_SECRET/);
    assertNoSecretLeak(result.message);
  });

  it('D. both dedicated secrets missing → refuses to start', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /JWT_CUSTOMER_SECRET/);
    assert.match(result.message, /JWT_ADMIN_SECRET/);
    assertNoSecretLeak(result.message);
  });

  it('E. both present but identical → refuses to start in production', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: CUSTOMER,
      JWT_ADMIN_SECRET: CUSTOMER,
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /must be different values in production/);
    assertNoSecretLeak(result.message);
  });

  it('F. JWT_SECRET present but dedicated secrets missing → still refuses', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /Missing required environment variables/);
    assert.doesNotMatch(result.message, /JWT_CUSTOMER_SECRET or JWT_SECRET/);
    assertNoSecretLeak(result.message);
  });

  it('development still starts with JWT_SECRET fallback when dedicated secrets are unset', () => {
    const result = runValidate({
      NODE_ENV: 'development',
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
    });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /START_OK same=true/);
    assertNoSecretLeak(result.message);
  });
});

describe('Twilio production startup validation', () => {
  const productionJwt = {
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
  };

  it('A. production + all required Twilio variables present → PASS', () => {
    const result = runValidate({
      ...productionJwt,
      TWILIO_ACCOUNT_SID: TWILIO_SID,
      TWILIO_AUTH_TOKEN: TWILIO_TOKEN,
      TWILIO_PHONE_NUMBER: TWILIO_FROM,
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('B. production + missing Twilio Account SID → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      TWILIO_ACCOUNT_SID: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /TWILIO_ACCOUNT_SID/);
    assertNoSecretLeak(result.message);
  });

  it('C. production + missing Twilio Auth Token → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      TWILIO_AUTH_TOKEN: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /TWILIO_AUTH_TOKEN/);
    assertNoSecretLeak(result.message);
  });

  it('D. production + missing Twilio phone/from number → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      TWILIO_PHONE_NUMBER: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /TWILIO_PHONE_NUMBER/);
    assertNoSecretLeak(result.message);
  });

  it('E. production + all Twilio variables missing → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /TWILIO_ACCOUNT_SID/);
    assert.match(result.message, /TWILIO_AUTH_TOKEN/);
    assert.match(result.message, /TWILIO_PHONE_NUMBER/);
    assertNoSecretLeak(result.message);
  });

  it('F. development + Twilio variables missing → allowed', () => {
    const result = runValidate({
      NODE_ENV: 'development',
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('production placeholder Twilio values are rejected', () => {
    const result = runValidate({
      ...productionJwt,
      TWILIO_ACCOUNT_SID: 'your_twilio_account_sid',
      TWILIO_AUTH_TOKEN: 'your_twilio_auth_token',
      TWILIO_PHONE_NUMBER: 'your_twilio_phone_number',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /TWILIO_/);
    assertNoSecretLeak(result.message);
  });

  it('production server.js exits before listen when Twilio is missing', () => {
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME || '',
      NODE_ENV: 'production',
      PORT: '39991',
      DB_NAME: 'telefonak',
      DB_USER: 'postgres',
      BASE_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:5173',
      JWT_CUSTOMER_SECRET: CUSTOMER,
      JWT_ADMIN_SECRET: ADMIN,
      JWT_SECRET: '',
      OTP_PEPPER: OTP_PEPPER,
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
      ADMIN_ACCESS_TOKEN_TTL: '8h',
    };

    const result = spawnSync(process.execPath, ['server.js'], {
      cwd: BACKEND_ROOT,
      env,
      encoding: 'utf8',
      timeout: 8000,
    });

    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(output, /Server is running/);
    assert.match(output, /TWILIO_/);
    assertNoSecretLeak(output);
  });
});

describe('Admin access token TTL startup validation', () => {
  const productionJwt = {
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
  };

  it('production default 8h TTL starts', () => {
    const result = runValidate({
      ...productionJwt,
      ADMIN_ACCESS_TOKEN_TTL: '',
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('production rejects 30d admin TTL', () => {
    const result = runValidate({
      ...productionJwt,
      ADMIN_ACCESS_TOKEN_TTL: '30d',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /ADMIN_ACCESS_TOKEN_TTL must be 24h or less in production/);
    assertNoSecretLeak(result.message);
  });

  it('development still allows a longer local TTL', () => {
    const result = runValidate({
      NODE_ENV: 'development',
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
      ADMIN_ACCESS_TOKEN_TTL: '30d',
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });
});

describe('OTP_PEPPER production startup validation', () => {
  const productionJwt = {
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
  };

  it('A. production with valid OTP_PEPPER → PASS', () => {
    const result = runValidate({
      ...productionJwt,
      OTP_PEPPER,
    });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /pepperEqCustomer=false/);
    assertNoSecretLeak(result.message);
  });

  it('B. production with missing OTP_PEPPER → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      OTP_PEPPER: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /OTP_PEPPER/);
    assertNoSecretLeak(result.message);
  });

  it('C. production with empty OTP_PEPPER → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      OTP_PEPPER: '   ',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /OTP_PEPPER/);
    assertNoSecretLeak(result.message);
  });

  it('D. production with placeholder/weak OTP_PEPPER → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      OTP_PEPPER: 'replace_with_a_long_random_pepper',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /OTP_PEPPER/);
    assertNoSecretLeak(result.message);

    const weak = runValidate({
      ...productionJwt,
      OTP_PEPPER: 'secret',
    });
    assert.equal(weak.ok, false);
    assert.match(weak.message, /OTP_PEPPER/);
    assertNoSecretLeak(weak.message);
  });

  it('E. production with OTP_PEPPER and JWT secrets present → PASS', () => {
    const result = runValidate({
      ...productionJwt,
      JWT_SECRET: SHARED,
      OTP_PEPPER,
    });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /START_OK same=false pepperEqCustomer=false/);
    assertNoSecretLeak(result.message);
  });

  it('production refuses OTP_PEPPER equal to JWT_CUSTOMER_SECRET', () => {
    const result = runValidate({
      ...productionJwt,
      OTP_PEPPER: CUSTOMER,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /OTP_PEPPER must be different from JWT_CUSTOMER_SECRET/);
    assertNoSecretLeak(result.message);
  });

  it('G. production getOtpPepper is not JWT_CUSTOMER_SECRET', () => {
    const result = runValidate({
      ...productionJwt,
      OTP_PEPPER,
    });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /pepperEqCustomer=false/);
    assertNoSecretLeak(result.message);
  });

  it('H. development without OTP_PEPPER remains allowed (customer-secret fallback)', () => {
    const result = runValidate({
      NODE_ENV: 'development',
      JWT_CUSTOMER_SECRET: CUSTOMER,
      JWT_ADMIN_SECRET: ADMIN,
      JWT_SECRET: SHARED,
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_PHONE_NUMBER: '',
      OTP_PEPPER: '',
    });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /pepperEqCustomer=true/);
    assertNoSecretLeak(result.message);
  });
});

describe('OTP_PEPPER hashing', () => {
  function runHash(envOverrides) {
    const script = `
      const crypto = require('crypto');
      const { getOtpPepper, getCustomerJwtSecret } = require(${JSON.stringify(
        path.join(BACKEND_ROOT, 'config', 'env.js')
      )});
      const { hashOtpCode } = require(${JSON.stringify(
        path.join(BACKEND_ROOT, 'utils', 'otp.js')
      )});
      const digest = hashOtpCode('0790000111', 'auth', '1234');
      const customerDigest = crypto
        .createHmac('sha256', getCustomerJwtSecret())
        .update('0790000111|auth|1234')
        .digest('hex');
      process.stdout.write(JSON.stringify({
        eqCustomerHmac: digest === customerDigest,
        pepperEqCustomer: getOtpPepper() === getCustomerJwtSecret(),
        digestLen: digest.length,
      }));
    `;
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME || '',
      NODE_ENV: 'production',
      DB_NAME: 'telefonak',
      DB_USER: 'postgres',
      BASE_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:5173',
      JWT_CUSTOMER_SECRET: CUSTOMER,
      JWT_ADMIN_SECRET: ADMIN,
      JWT_SECRET: SHARED,
      OTP_PEPPER,
      TWILIO_ACCOUNT_SID: TWILIO_SID,
      TWILIO_AUTH_TOKEN: TWILIO_TOKEN,
      TWILIO_PHONE_NUMBER: TWILIO_FROM,
      ADMIN_ACCESS_TOKEN_TTL: '8h',
      ...envOverrides,
    };
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: BACKEND_ROOT,
      env,
      encoding: 'utf8',
      timeout: 8000,
    });
    return {
      status: result.status,
      stdout: (result.stdout || '').trim(),
      message: `${result.stdout || ''}\n${result.stderr || ''}`,
    };
  }

  it('F. OTP hashing uses OTP_PEPPER, not JWT_CUSTOMER_SECRET', () => {
    const result = runHash({ NODE_ENV: 'production' });
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.digestLen, 64);
    assert.equal(parsed.eqCustomerHmac, false);
    assert.equal(parsed.pepperEqCustomer, false);
    assertNoSecretLeak(result.message);
  });

  it('H. development hashing without OTP_PEPPER matches the customer-secret fallback', () => {
    const result = runHash({
      NODE_ENV: 'development',
      OTP_PEPPER: '',
    });
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.digestLen, 64);
    assert.equal(parsed.eqCustomerHmac, true);
    assert.equal(parsed.pepperEqCustomer, true);
    assertNoSecretLeak(result.message);
  });
});
