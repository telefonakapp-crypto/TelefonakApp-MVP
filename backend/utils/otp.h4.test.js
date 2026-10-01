'use strict';

/**
 * H4 — production OTP/SMS behavior (isolated processes so dotenv cannot leak .env).
 * Never prints real secrets. Uses fake SMS provider fixtures only.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const OTP_JS = path.join(BACKEND_ROOT, 'utils', 'otp.js');
const CUSTOMER = 'test-only-customer-jwt-secret-aaaaaaaa';
const ADMIN = 'test-only-admin-jwt-secret-bbbbbbbbbbbb';
const SMS_API_URL = 'https://sms.thecaptainjo.com:8445/websmpp/websms';
const SMS_USERNAME = 'Telefonak';
const SMS_PASSWORD = 'test-sms-password-not-real';
const SMS_SENDER_ID = 'Telefonak';
const SMS_TYPE = '3';
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
    SMS_API_URL,
    SMS_USERNAME,
    SMS_PASSWORD,
    SMS_SENDER_ID,
    SMS_TYPE,
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
  assert.equal(output.includes(SMS_PASSWORD), false);
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
  const noSms = {
    SMS_API_URL: '',
    SMS_USERNAME: '',
    SMS_PASSWORD: '',
    SMS_SENDER_ID: '',
    SMS_TYPE: '',
  };

  it('production sendOtp does not succeed when the SMS provider is missing', async () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('0790000000', ${JSON.stringify(OTP_CODE)}).then(() => {
        process.stdout.write('SEND_OK');
        process.exit(0);
      }).catch((error) => {
        process.stdout.write('SEND_FAIL ' + error.message);
        process.exit(1);
      });
      `,
      {
        NODE_ENV: 'production',
        ...noSms,
      }
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /SEND_FAIL/);
    assert.doesNotMatch(result.message, new RegExp(OTP_CODE));
    assertNoSecretLeak(result.message);
  });

  it('production provider failure does not report success and does not leak OTP or password', () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('0791234567', ${JSON.stringify(OTP_CODE)}, {
        fetchImpl: async (url) => {
          throw new Error('provider down ' + String(url));
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
    assert.match(result.stdout, /SEND_FAIL OTP SMS delivery failed/);
    assert.doesNotMatch(result.stdout, /SEND_OK/);
    assert.doesNotMatch(result.message, new RegExp(OTP_CODE));
    assert.doesNotMatch(result.message, /provider down/);
    assert.doesNotMatch(result.message, /websmpp/);
    assertNoSecretLeak(result.message);
  });

  it('provider error text in Response is a delivery failure and is not logged', () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('0793400033', ${JSON.stringify(OTP_CODE)}, {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ Response: ['ERROR - HTTP15 --> Not Authorized for the request.'] }),
        }),
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
    assert.match(result.stdout, /SEND_FAIL OTP SMS delivery failed/);
    assert.doesNotMatch(result.message, /HTTP15/);
    assert.doesNotMatch(result.message, /Not Authorized/);
    assert.doesNotMatch(result.message, /websmpp/);
    assert.doesNotMatch(result.message, new RegExp(OTP_CODE));
    assertNoSecretLeak(result.message);
  });

  it('accepts the verified provider success response and converts 07 numbers', () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('0791234567', ${JSON.stringify(OTP_CODE)}, {
        fetchImpl: async (url) => {
          const parsed = new URL(url);
          const summary = {
            hrefPath: parsed.origin + parsed.pathname,
            user: parsed.searchParams.get('user'),
            sid: parsed.searchParams.get('sid'),
            mno: parsed.searchParams.get('mno'),
            type: parsed.searchParams.get('type'),
            textMatches: parsed.searchParams.get('text') === 'Your Telefonak verification code is: ${OTP_CODE}',
            respformat: parsed.searchParams.get('respformat'),
            passMatches: parsed.searchParams.get('pass') === process.env.SMS_PASSWORD,
          };
          process.stdout.write('SUMMARY ' + JSON.stringify(summary) + '\\n');
          return {
            ok: true,
            json: async () => ({ Response: ['2609291933272148191'] }),
          };
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
    assert.equal(result.status, 0, result.message);
    assert.match(result.stdout, /SEND_OK/);
    const summaryLine = result.stdout.split('\n').find((line) => line.startsWith('SUMMARY '));
    const summary = JSON.parse(summaryLine.slice('SUMMARY '.length));
    assert.equal(summary.hrefPath, SMS_API_URL);
    assert.equal(summary.user, SMS_USERNAME);
    assert.equal(summary.sid, SMS_SENDER_ID);
    assert.equal(summary.mno, '962791234567');
    assert.equal(summary.type, SMS_TYPE);
    assert.equal(summary.textMatches, true);
    assert.equal(summary.respformat, 'json');
    assert.equal(summary.passMatches, true);
    assert.doesNotMatch(result.message, new RegExp(SMS_PASSWORD));
    assertNoSecretLeak(result.message);
  });

  it('development sendOtp still succeeds without an SMS provider', () => {
    const result = runScript(
      `
      const { sendOtp } = require(${JSON.stringify(OTP_JS)});
      sendOtp('0790000000', '1234').then(() => {
        process.stdout.write('SEND_OK');
        process.exit(0);
      }).catch((error) => {
        process.stdout.write('SEND_FAIL ' + error.message);
        process.exit(1);
      });
      `,
      {
        NODE_ENV: 'development',
        ...noSms,
      }
    );
    assert.equal(result.status, 0, result.message);
    assert.match(result.stdout, /SEND_OK/);
    assertNoSecretLeak(result.message);
  });
});
