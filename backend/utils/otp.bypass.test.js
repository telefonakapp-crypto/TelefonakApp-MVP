'use strict';

/**
 * Temporary TEST_OTP_* one-phone bypass (isolated processes so dotenv/.env
 * cannot leak local secrets). Never prints real Twilio/JWT secrets.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const OTP_JS = path.join(BACKEND_ROOT, 'utils', 'otp.js');
const CUSTOMER = 'test-only-customer-jwt-secret-aaaaaaaa';
const ADMIN = 'test-only-admin-jwt-secret-bbbbbbbbbbbb';
const TWILIO_SID = 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TWILIO_TOKEN = 'test_twilio_auth_token_xx';
const TWILIO_FROM = '+15005550006';

const TEST_PHONE = '0791244555';
const TEST_PHONE_E164 = '+962791244555';
const TEST_CODE = '1623';
const OTHER_PHONE = '0790000111';
const WRONG_CODE = '0000';

function baseEnv(overrides) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '',
    DB_NAME: 'telefonak',
    DB_USER: 'postgres',
    BASE_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_CUSTOMER_SECRET: CUSTOMER,
    JWT_ADMIN_SECRET: ADMIN,
    JWT_SECRET: '',
    OTP_PEPPER: CUSTOMER,
    TWILIO_ACCOUNT_SID: TWILIO_SID,
    TWILIO_AUTH_TOKEN: TWILIO_TOKEN,
    TWILIO_PHONE_NUMBER: TWILIO_FROM,
    TEST_OTP_BYPASS_ENABLED: '',
    TEST_OTP_PHONE: '',
    TEST_OTP_CODE: '',
    ...overrides,
  };
}

function bypassOn(overrides) {
  return baseEnv({
    TEST_OTP_BYPASS_ENABLED: 'true',
    TEST_OTP_PHONE: TEST_PHONE,
    TEST_OTP_CODE: TEST_CODE,
    ...overrides,
  });
}

function runScript(script, env) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: BACKEND_ROOT,
    env,
    encoding: 'utf8',
    timeout: 8000,
  });
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  return {
    status: result.status,
    stdout,
    stderr,
    message: `${stdout}\n${stderr}`,
  };
}

function assertNoSecretLeak(output) {
  assert.equal(output.includes(TWILIO_TOKEN), false);
  assert.equal(output.includes(CUSTOMER), false);
  assert.equal(output.includes(ADMIN), false);
}

function parseResult(stdout) {
  const line = String(stdout || '')
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('RESULT '));
  assert.ok(line, `missing RESULT line in stdout: ${stdout}`);
  return JSON.parse(line.slice('RESULT '.length));
}

describe('TEST_OTP bypass — request (no SMS)', () => {
  it('TEST 1: designated phone issues configured code and skips SMS', () => {
    const result = runScript(
      `
      const { generateOtpCode, sendOtp, getActiveTestOtpBypass } = require(${JSON.stringify(OTP_JS)});
      const bypass = getActiveTestOtpBypass();
      const local = generateOtpCode(${JSON.stringify(TEST_PHONE)});
      const e164 = generateOtpCode(${JSON.stringify(TEST_PHONE_E164)});
      let smsCalls = 0;
      sendOtp(${JSON.stringify(TEST_PHONE)}, local, {
        sendMessage: async () => { smsCalls += 1; },
      }).then(() => {
        process.stdout.write('RESULT ' + JSON.stringify({
          canonical: bypass && bypass.phone,
          local: local,
          e164: e164,
          smsCalls: smsCalls,
        }));
      });
      `,
      bypassOn({ NODE_ENV: 'development' })
    );
    assert.equal(result.status, 0, result.message);
    const parsed = parseResult(result.stdout);
    assert.equal(parsed.canonical, TEST_PHONE);
    assert.equal(parsed.local, TEST_CODE);
    assert.equal(parsed.e164, TEST_CODE);
    assert.equal(parsed.smsCalls, 0);
    assertNoSecretLeak(result.message);
  });
});

describe('TEST_OTP bypass — verify designated phone', () => {
  it('TEST 2: designated phone + configured code matches the issued hash', () => {
    const result = runScript(
      `
      const { generateOtpCode, hashOtpCode, OTP_PURPOSE } = require(${JSON.stringify(OTP_JS)});
      const issued = generateOtpCode(${JSON.stringify(TEST_PHONE)});
      const issuedHash = hashOtpCode(${JSON.stringify(TEST_PHONE)}, OTP_PURPOSE.AUTH, issued);
      const enteredHash = hashOtpCode(${JSON.stringify(TEST_PHONE)}, OTP_PURPOSE.AUTH, ${JSON.stringify(TEST_CODE)});
      process.stdout.write('RESULT ' + JSON.stringify({
        issued: issued,
        hashesMatch: issuedHash === enteredHash,
      }));
      `,
      bypassOn({ NODE_ENV: 'development' })
    );
    assert.equal(result.status, 0, result.message);
    const parsed = parseResult(result.stdout);
    assert.equal(parsed.issued, TEST_CODE);
    assert.equal(parsed.hashesMatch, true);
    assertNoSecretLeak(result.message);
  });

  it('TEST 3: designated phone + wrong code does not match the issued hash', () => {
    const result = runScript(
      `
      const { generateOtpCode, hashOtpCode, OTP_PURPOSE } = require(${JSON.stringify(OTP_JS)});
      const issued = generateOtpCode(${JSON.stringify(TEST_PHONE)});
      const issuedHash = hashOtpCode(${JSON.stringify(TEST_PHONE)}, OTP_PURPOSE.AUTH, issued);
      const wrongHash = hashOtpCode(${JSON.stringify(TEST_PHONE)}, OTP_PURPOSE.AUTH, ${JSON.stringify(WRONG_CODE)});
      process.stdout.write('RESULT ' + JSON.stringify({
        issued: issued,
        hashesMatch: issuedHash === wrongHash,
      }));
      `,
      bypassOn({ NODE_ENV: 'development' })
    );
    assert.equal(result.status, 0, result.message);
    const parsed = parseResult(result.stdout);
    assert.equal(parsed.issued, TEST_CODE);
    assert.equal(parsed.hashesMatch, false);
    assertNoSecretLeak(result.message);
  });
});

describe('TEST_OTP bypass — other phones unchanged', () => {
  it('TEST 4: another phone does not receive the bypass code and still sends SMS', () => {
    const result = runScript(
      `
      const { generateOtpCode, sendOtp, hashOtpCode, OTP_PURPOSE } = require(${JSON.stringify(OTP_JS)});
      const issued = generateOtpCode(${JSON.stringify(OTHER_PHONE)});
      const bypassHash = hashOtpCode(${JSON.stringify(OTHER_PHONE)}, OTP_PURPOSE.AUTH, ${JSON.stringify(TEST_CODE)});
      const issuedHash = hashOtpCode(${JSON.stringify(OTHER_PHONE)}, OTP_PURPOSE.AUTH, issued);
      let smsCalls = 0;
      sendOtp(${JSON.stringify(OTHER_PHONE)}, issued, {
        sendMessage: async () => { smsCalls += 1; },
      }).then(() => {
        process.stdout.write('RESULT ' + JSON.stringify({
          issued: issued,
          bypassWouldMatch: issuedHash === bypassHash,
          smsCalls: smsCalls,
        }));
      });
      `,
      bypassOn({ NODE_ENV: 'development' })
    );
    assert.equal(result.status, 0, result.message);
    const parsed = parseResult(result.stdout);
    assert.notEqual(parsed.issued, TEST_CODE);
    assert.equal(parsed.issued, '1234');
    assert.equal(parsed.bypassWouldMatch, false);
    assert.equal(parsed.smsCalls, 1);
    assertNoSecretLeak(result.message);
  });
});

describe('TEST_OTP bypass — disabled', () => {
  it('TEST 5: ENABLED=false does not issue the bypass code or skip SMS', () => {
    const result = runScript(
      `
      const { generateOtpCode, sendOtp, getActiveTestOtpBypass } = require(${JSON.stringify(OTP_JS)});
      const bypass = getActiveTestOtpBypass();
      const issued = generateOtpCode(${JSON.stringify(TEST_PHONE)});
      let smsCalls = 0;
      sendOtp(${JSON.stringify(TEST_PHONE)}, issued, {
        sendMessage: async () => { smsCalls += 1; },
      }).then(() => {
        process.stdout.write('RESULT ' + JSON.stringify({
          active: Boolean(bypass),
          issued: issued,
          smsCalls: smsCalls,
        }));
      });
      `,
      baseEnv({
        NODE_ENV: 'development',
        TEST_OTP_BYPASS_ENABLED: 'false',
        TEST_OTP_PHONE: TEST_PHONE,
        TEST_OTP_CODE: TEST_CODE,
      })
    );
    assert.equal(result.status, 0, result.message);
    const parsed = parseResult(result.stdout);
    assert.equal(parsed.active, false);
    assert.notEqual(parsed.issued, TEST_CODE);
    assert.equal(parsed.issued, '1234');
    assert.equal(parsed.smsCalls, 1);
    assertNoSecretLeak(result.message);
  });

  it('misconfigured ENABLED=true with invalid phone stays inactive', () => {
    const result = runScript(
      `
      const { generateOtpCode, getActiveTestOtpBypass } = require(${JSON.stringify(OTP_JS)});
      const bypass = getActiveTestOtpBypass();
      const issued = generateOtpCode(${JSON.stringify(TEST_PHONE)});
      process.stdout.write('RESULT ' + JSON.stringify({
        active: Boolean(bypass),
        issued: issued,
      }));
      `,
      baseEnv({
        NODE_ENV: 'development',
        TEST_OTP_BYPASS_ENABLED: 'true',
        TEST_OTP_PHONE: 'not-a-phone',
        TEST_OTP_CODE: TEST_CODE,
      })
    );
    assert.equal(result.status, 0, result.message);
    const parsed = parseResult(result.stdout);
    assert.equal(parsed.active, false);
    assert.equal(parsed.issued, '1234');
    assertNoSecretLeak(result.message);
  });
});
