'use strict';

/**
 * H4 — production OTP/SMS behavior (isolated processes so dotenv cannot leak .env).
 * Never prints real secrets. Uses obvious fake Twilio fixtures only.
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
const OTP_CODE = '4321';

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

function runScript(script, envOverrides) {
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: BACKEND_ROOT,
    env: baseEnv(envOverrides),
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

describe('OTP response exposure', () => {
  it('G. production OTP response does NOT contain the OTP', () => {
    const result = runScript(
      `
      const { shouldExposeOtpInResponse } = require(${JSON.stringify(OTP_JS)});
      const issued = { code: ${JSON.stringify(OTP_CODE)} };
      const payload = { message: 'OTP sent successfully' };
      if (shouldExposeOtpInResponse()) payload.otp = issued.code;
      process.stdout.write(JSON.stringify({
        expose: shouldExposeOtpInResponse(),
        payload: payload,
      }));
      `,
      { NODE_ENV: 'production', OTP_DEV_MODE: 'true' }
    );
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.expose, false);
    assert.equal(parsed.payload.otp, undefined);
    assert.equal(JSON.stringify(parsed.payload).includes(OTP_CODE), false);
    assert.equal(parsed.payload.message, 'OTP sent successfully');
    assertNoSecretLeak(result.message);
  });

  it('H. development OTP behavior remains unchanged', () => {
    const result = runScript(
      `
      const { shouldExposeOtpInResponse, generateOtpCode } = require(${JSON.stringify(OTP_JS)});
      const code = generateOtpCode();
      const payload = { message: 'OTP sent successfully' };
      if (shouldExposeOtpInResponse()) payload.otp = code;
      process.stdout.write(JSON.stringify({
        expose: shouldExposeOtpInResponse(),
        code: code,
        payload: payload,
      }));
      `,
      {
        NODE_ENV: 'development',
        TWILIO_ACCOUNT_SID: '',
        TWILIO_AUTH_TOKEN: '',
        TWILIO_PHONE_NUMBER: '',
        OTP_MODE: '',
      }
    );
    assert.equal(result.status, 0, result.message);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.expose, true);
    assert.equal(parsed.code, '1234');
    assert.equal(parsed.payload.otp, '1234');
    assertNoSecretLeak(result.message);
  });
});

describe('sendOtp production delivery', () => {
  it('production sendOtp does not succeed when Twilio is missing', async () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('+962790000000', ${JSON.stringify(OTP_CODE)}).then(() => {
        process.stdout.write('SEND_OK');
        process.exit(0);
      }).catch((error) => {
        process.stdout.write('SEND_FAIL ' + error.message);
        process.exit(1);
      });
      `,
      {
        NODE_ENV: 'production',
        TWILIO_ACCOUNT_SID: '',
        TWILIO_AUTH_TOKEN: '',
        TWILIO_PHONE_NUMBER: '',
      }
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /SEND_FAIL/);
    assert.doesNotMatch(result.message, new RegExp(OTP_CODE));
    assertNoSecretLeak(result.message);
  });

  it('production Twilio send failure does not report success and does not leak OTP', () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('+962790000000', ${JSON.stringify(OTP_CODE)}, {
        sendMessage: async () => {
          throw new Error('simulated twilio failure');
        },
      }).then(() => {
        process.stdout.write('SEND_OK');
        process.exit(0);
      }).catch((error) => {
        process.stdout.write('SEND_FAIL ' + error.message);
        process.exit(1);
      });
      `,
      { NODE_ENV: 'production' }
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /SEND_FAIL simulated twilio failure/);
    assert.doesNotMatch(result.stdout, /SEND_OK/);
    assert.doesNotMatch(result.message, new RegExp(OTP_CODE));
    assertNoSecretLeak(result.message);
  });

  it('development sendOtp still succeeds without Twilio', () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('+962790000000', '1234').then(() => {
        process.stdout.write('SEND_OK');
        process.exit(0);
      }).catch((error) => {
        process.stdout.write('SEND_FAIL ' + error.message);
        process.exit(1);
      });
      `,
      {
        NODE_ENV: 'development',
        TWILIO_ACCOUNT_SID: '',
        TWILIO_AUTH_TOKEN: '',
        TWILIO_PHONE_NUMBER: '',
      }
    );
    assert.equal(result.status, 0, result.message);
    assert.match(result.stdout, /SEND_OK/);
    assertNoSecretLeak(result.message);
  });
});
