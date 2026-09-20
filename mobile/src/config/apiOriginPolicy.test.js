'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEV_FALLBACK_API_ORIGIN,
  shouldEnforceReleaseApiOrigin,
  assertReleaseApiOrigin,
  assertReleaseApiOriginFromEnv,
  resolveApiOrigin,
} = require('./apiOriginPolicy');

describe('resolveApiOrigin — development', () => {
  it('A. missing URL falls back to localhost', () => {
    assert.equal(
      resolveApiOrigin(undefined, { isDevelopment: true }),
      DEV_FALLBACK_API_ORIGIN
    );
    assert.equal(
      resolveApiOrigin('', { isDevelopment: true }),
      DEV_FALLBACK_API_ORIGIN
    );
  });

  it('B. localhost is allowed', () => {
    assert.equal(
      resolveApiOrigin('http://localhost:3000', { isDevelopment: true }),
      'http://localhost:3000'
    );
  });

  it('rewrites Android emulator loopback only when requested', () => {
    assert.equal(
      resolveApiOrigin('http://localhost:3000', {
        isDevelopment: true,
        androidEmulatorRewrite: true,
      }),
      'http://10.0.2.2:3000'
    );
    assert.equal(
      resolveApiOrigin('http://127.0.0.1:3000', {
        isDevelopment: true,
        androidEmulatorRewrite: true,
      }),
      'http://10.0.2.2:3000'
    );
  });
});

describe('assertReleaseApiOrigin — production', () => {
  it('C. missing URL fails', () => {
    assert.throws(() => assertReleaseApiOrigin(undefined), /missing/i);
    assert.throws(() => assertReleaseApiOrigin(''), /missing/i);
    assert.throws(() => assertReleaseApiOrigin('   '), /missing|valid URL/i);
  });

  it('D. http://localhost:3000 fails', () => {
    assert.throws(
      () => assertReleaseApiOrigin('http://localhost:3000'),
      /https|localhost/i
    );
  });

  it('E. http://example.com fails', () => {
    assert.throws(() => assertReleaseApiOrigin('http://example.com'), /https/i);
  });

  it('F. http://127.0.0.1:3000 fails', () => {
    assert.throws(
      () => assertReleaseApiOrigin('http://127.0.0.1:3000'),
      /https|localhost|loopback/i
    );
  });

  it('G. valid HTTPS URL passes', () => {
    assert.equal(
      assertReleaseApiOrigin('https://api.example.com'),
      'https://api.example.com'
    );
    assert.equal(
      assertReleaseApiOrigin('https://api.example.com/api'),
      'https://api.example.com'
    );
  });

  it('H. malformed URL fails', () => {
    assert.throws(() => assertReleaseApiOrigin('not-a-url'), /valid URL/i);
    assert.throws(() => assertReleaseApiOrigin('https://'), /valid URL|hostname/i);
  });

  it('rejects HTTPS localhost and private LAN hosts', () => {
    assert.throws(() => assertReleaseApiOrigin('https://localhost'), /localhost|private/i);
    assert.throws(() => assertReleaseApiOrigin('https://127.0.0.1'), /localhost|loopback|private/i);
    assert.throws(() => assertReleaseApiOrigin('https://10.0.2.2:3000'), /emulator|private/i);
    assert.throws(() => assertReleaseApiOrigin('https://192.168.1.10'), /private/i);
    assert.throws(() => assertReleaseApiOrigin('https://0.0.0.0'), /private|loopback/i);
  });
});

describe('shouldEnforceReleaseApiOrigin', () => {
  it('does not enforce in a blank development env', () => {
    assert.equal(shouldEnforceReleaseApiOrigin({}), false);
    assert.equal(shouldEnforceReleaseApiOrigin({ NODE_ENV: 'development' }), false);
  });

  it('enforces for production NODE_ENV, Xcode Release, EAS production, and Android release tasks', () => {
    assert.equal(shouldEnforceReleaseApiOrigin({ NODE_ENV: 'production' }), true);
    assert.equal(shouldEnforceReleaseApiOrigin({ CONFIGURATION: 'Release' }), true);
    assert.equal(
      shouldEnforceReleaseApiOrigin({ EAS_BUILD_PROFILE: 'production' }),
      true
    );
    assert.equal(
      shouldEnforceReleaseApiOrigin({ GRADLE_TASK: 'assembleRelease' }),
      true
    );
  });

  it('does not treat node:test production env as a store build', () => {
    assert.equal(
      shouldEnforceReleaseApiOrigin({
        NODE_ENV: 'production',
        NODE_TEST_CONTEXT: '1',
      }),
      false
    );
  });
});

describe('resolveApiOrigin — production', () => {
  it('does not fall back to localhost when EXPO_PUBLIC_API_URL is unset', () => {
    assert.throws(
      () => resolveApiOrigin(undefined, { isDevelopment: false }),
      /missing/i
    );
  });
});

describe('assertReleaseApiOriginFromEnv', () => {
  it('skips enforcement in development even when the URL is missing', () => {
    assert.equal(
      assertReleaseApiOriginFromEnv({ NODE_ENV: 'development' }),
      null
    );
  });

  it('fails a production env with localhost and passes valid HTTPS', () => {
    assert.throws(
      () =>
        assertReleaseApiOriginFromEnv({
          NODE_ENV: 'production',
          EXPO_PUBLIC_API_URL: 'http://localhost:3000',
        }),
      /https|localhost/i
    );
    assert.equal(
      assertReleaseApiOriginFromEnv({
        NODE_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://api.example.com',
      }),
      'https://api.example.com'
    );
  });
});
