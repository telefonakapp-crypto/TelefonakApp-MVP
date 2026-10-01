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
const SMS_API_URL = 'https://sms.thecaptainjo.com:8445/websmpp/websms';
const SMS_USERNAME = 'Telefonak';
const SMS_PASSWORD = 'test-sms-password-not-real';
const SMS_SENDER_ID = 'Telefonak';
const SMS_TYPE = '3';

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
    SMS_API_URL,
    SMS_USERNAME,
    SMS_PASSWORD,
    SMS_SENDER_ID,
    SMS_TYPE,
    TEST_OTP_BYPASS_ENABLED: '',
    TEST_OTP_PHONE: '',
    TEST_OTP_CODE: '',
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
  assert.equal(output.includes(SMS_PASSWORD), false);
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

describe('SMS provider production startup validation', () => {
  const productionJwt = {
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
  };
  const noSms = {
    SMS_API_URL: '',
    SMS_USERNAME: '',
    SMS_PASSWORD: '',
    SMS_SENDER_ID: '',
    SMS_TYPE: '',
  };

  it('A. production + all required SMS variables present → PASS', () => {
    const result = runValidate({
      ...productionJwt,
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('production fails startup when SMS_API_URL is missing', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_API_URL: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_API_URL/);
    assertNoSecretLeak(result.message);
  });

  it('production fails startup when SMS_USERNAME is missing', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_USERNAME: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_USERNAME/);
    assertNoSecretLeak(result.message);
  });

  it('production fails startup when SMS_PASSWORD is missing', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_PASSWORD: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_PASSWORD/);
    assertNoSecretLeak(result.message);
  });

  it('production fails startup when SMS_SENDER_ID is missing', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_SENDER_ID: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_SENDER_ID/);
    assertNoSecretLeak(result.message);
  });

  it('production fails startup when SMS_TYPE is missing', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_TYPE: '',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_TYPE/);
    assertNoSecretLeak(result.message);
  });

  it('production fails startup when SMS_TYPE is invalid', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_TYPE: 'abc',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_TYPE/);
    assertNoSecretLeak(result.message);
  });

  it('development + SMS variables missing → allowed', () => {
    const result = runValidate({
      NODE_ENV: 'development',
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: '',
      JWT_SECRET: SHARED,
      ...noSms,
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('production placeholder SMS values are rejected', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_API_URL: 'your_sms_api_url',
      SMS_USERNAME: 'your_sms_username',
      SMS_PASSWORD: 'changeme',
      SMS_SENDER_ID: 'example-sender',
      SMS_TYPE: '3',
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_/);
    assertNoSecretLeak(result.message);
  });

  it('production server.js exits before listen when SMS config is missing', () => {
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
      ...noSms,
      TEST_OTP_BYPASS_ENABLED: '',
      TEST_OTP_PHONE: '',
      TEST_OTP_CODE: '',
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
    assert.match(output, /SMS_/);
    assertNoSecretLeak(output);
  });
});

describe('TEST_OTP bypass production SMS exemption', () => {
  const productionJwt = {
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
  };
  const validBypassPhone = '0790000111';
  const validBypassCode = '9999';

  it('A. production + valid bypass + no SMS credentials → PASS', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_API_URL: '',
      SMS_USERNAME: '',
      SMS_PASSWORD: '',
      SMS_SENDER_ID: '',
      SMS_TYPE: '',
      TEST_OTP_BYPASS_ENABLED: 'true',
      TEST_OTP_PHONE: validBypassPhone,
      TEST_OTP_CODE: validBypassCode,
    });
    assert.equal(result.ok, true);
    assertNoSecretLeak(result.message);
  });

  it('B. production + bypass disabled + missing SMS config → FAIL', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_API_URL: '',
      SMS_USERNAME: '',
      SMS_PASSWORD: '',
      SMS_SENDER_ID: '',
      SMS_TYPE: '',
      TEST_OTP_BYPASS_ENABLED: 'false',
      TEST_OTP_PHONE: validBypassPhone,
      TEST_OTP_CODE: validBypassCode,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /SMS_API_URL/);
    assert.match(result.message, /SMS_USERNAME/);
    assert.match(result.message, /SMS_PASSWORD/);
    assertNoSecretLeak(result.message);
  });

  it('C. production + ENABLED=true with invalid bypass config → FAIL (does not silently skip SMS validation)', () => {
    const result = runValidate({
      ...productionJwt,
      SMS_API_URL: '',
      SMS_USERNAME: '',
      SMS_PASSWORD: '',
      SMS_SENDER_ID: '',
      SMS_TYPE: '',
      TEST_OTP_BYPASS_ENABLED: 'true',
      TEST_OTP_PHONE: 'not-a-phone',
      TEST_OTP_CODE: validBypassCode,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /TEST_OTP_PHONE|TEST_OTP_CODE|TEST_OTP_BYPASS_ENABLED/);
    assertNoSecretLeak(result.message);
  });

  it('valid bypass does not skip JWT production requirements', () => {
    const result = runValidate({
      JWT_CUSTOMER_SECRET: '',
      JWT_ADMIN_SECRET: ADMIN,
      SMS_API_URL: '',
      SMS_USERNAME: '',
      SMS_PASSWORD: '',
      SMS_SENDER_ID: '',
      SMS_TYPE: '',
      TEST_OTP_BYPASS_ENABLED: 'true',
      TEST_OTP_PHONE: validBypassPhone,
      TEST_OTP_CODE: validBypassCode,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /JWT_CUSTOMER_SECRET/);
    assertNoSecretLeak(result.message);
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
      SMS_API_URL: '',
      SMS_USERNAME: '',
      SMS_PASSWORD: '',
      SMS_SENDER_ID: '',
      SMS_TYPE: '',
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
      SMS_API_URL: '',
      SMS_USERNAME: '',
      SMS_PASSWORD: '',
      SMS_SENDER_ID: '',
      SMS_TYPE: '',
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
      SMS_API_URL,
      SMS_USERNAME,
      SMS_PASSWORD,
      SMS_SENDER_ID,
      SMS_TYPE,
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
