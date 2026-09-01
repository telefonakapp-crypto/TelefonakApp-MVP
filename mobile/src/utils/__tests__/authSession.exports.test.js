'use strict';

/**
 * Lightweight export-contract check for Phase 3 authSession (no RN runtime).
 * Run: node mobile/src/utils/__tests__/authSession.exports.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const file = path.join(__dirname, '..', 'authSession.js');
const source = fs.readFileSync(file, 'utf8');

const requiredExports = [
  'setAuthSession',
  'getAuthSession',
  'clearAuthSession',
  'setAuthToken',
  'getAuthToken',
  'getRefreshToken',
  'clearAuthToken',
  'resolveStoredSession',
  'classifyAuthToken',
  'getRequestAuthorization',
];

for (const name of requiredExports) {
  const re = new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b|export\\s+\\{[^}]*\\b${name}\\b`);
  assert.ok(re.test(source), `authSession.js must export ${name}`);
}

assert.ok(
  /expo-secure-store/.test(source),
  'must use expo-secure-store'
);
assert.ok(!/AsyncStorage\.setItem\(\s*AUTH_TOKEN_KEY/.test(source), 'must not write tokens to AsyncStorage');

console.log('authSession export contract OK');
