'use strict';

/**
 * TFK-M4 — production builds must never display or log response.data.otp.
 * Isolated node:test (no React Native runtime, no network, no database).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getDevOtpAlert, isDevClient } = require('./devOtpDiagnostic');

const MOBILE_SRC = path.resolve(__dirname, '..');
const OTP_SCREENS = [
  path.join(MOBILE_SRC, 'screens', 'LoginScreen.js'),
  path.join(MOBILE_SRC, 'screens', 'SignUpPhoneScreen.js'),
  path.join(MOBILE_SRC, 'screens', 'ChangePhoneScreen.js'),
  path.join(MOBILE_SRC, 'screens', 'OTPScreen.js'),
];

describe('TFK-M4 development OTP diagnostic', () => {
  it('1. development + OTP response → diagnostic payload (existing Alert copy)', () => {
    const alert = getDevOtpAlert({ success: true, otp: '1234' }, { isDev: true });
    assert.deepEqual(alert, {
      title: 'OTP Sent',
      message: 'Your OTP is: 1234 (Development mode)',
    });
    const titled = getDevOtpAlert({ otp: '1234' }, { isDev: true, title: 'OTP' });
    assert.equal(titled.title, 'OTP');
    assert.match(titled.message, /1234/);
  });

  it('2. production + OTP response containing otp → nothing to display', () => {
    const alert = getDevOtpAlert({ success: true, otp: '1234' }, { isDev: false });
    assert.equal(alert, null);
  });

  it('3. production + OTP response without otp → nothing to display', () => {
    const alert = getDevOtpAlert({ success: true, message: 'OTP sent successfully' }, {
      isDev: false,
    });
    assert.equal(alert, null);
  });

  it('development without otp property does not invent a diagnostic', () => {
    assert.equal(getDevOtpAlert({ success: true }, { isDev: true }), null);
    assert.equal(getDevOtpAlert({ otp: '' }, { isDev: true }), null);
    assert.equal(getDevOtpAlert({ otp: '   ' }, { isDev: true }), null);
  });

  it('node tests (no RN __DEV__) fail closed', () => {
    assert.equal(typeof __DEV__, 'undefined');
    assert.equal(isDevClient(), false);
    assert.equal(getDevOtpAlert({ otp: '1234' }), null);
  });
});

describe('TFK-M4 production source guards', () => {
  it('4. no unconditional OTP display based only on response.data.otp', () => {
    for (const file of OTP_SCREENS) {
      const src = fs.readFileSync(file, 'utf8');
      assert.match(src, /showDevOtpAlert/, file);
      assert.match(src, /if\s*\(\s*__DEV__\s*\)/, file);
      assert.equal(/\bif\s*\(\s*response\.data\??\.otp\s*\)/.test(src), false, file);
      assert.equal(/Alert\.alert\([^)]*response\.data\.otp/.test(src), false, file);
    }
  });

  it('5. production mobile OTP paths do not log OTP values', () => {
    const files = [
      ...OTP_SCREENS,
      path.join(__dirname, 'devOtpDiagnostic.js'),
      path.join(__dirname, 'otpCooldown.js'),
      path.join(__dirname, 'apiError.js'),
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      assert.equal(/console\.(log|warn|error|debug|info)\([^)]*\.otp/.test(src), false, file);
      assert.equal(src.includes('[DEV OTP]'), false, file);
    }

    const helper = fs.readFileSync(path.join(__dirname, 'devOtpDiagnostic.js'), 'utf8');
    assert.equal(/console\.(log|warn|error|debug|info)/.test(helper), false);
  });

  it('release Metro inlines __DEV__ as false (babel-preset-expo / metro)', () => {
    const babel = fs.readFileSync(path.resolve(__dirname, '..', '..', 'babel.config.js'), 'utf8');
    assert.match(babel, /babel-preset-expo/);
  });
});
