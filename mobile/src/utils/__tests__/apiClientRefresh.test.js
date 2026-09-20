'use strict';

/**
 * Guard the Android session-refresh path.
 * Run: node --test src/utils/__tests__/apiClientRefresh.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const API = path.resolve(__dirname, '../api.js');

describe('apiClient Android-safe refresh', () => {
  const src = fs.readFileSync(API, 'utf8');

  it('does not reuse the shared maintenance AbortSignal on every request', () => {
    assert.doesNotMatch(src, /config\.signal = maintenanceSignal/);
    assert.match(src, /attachPerRequestAbortSignal/);
  });

  it('refreshes via a client that does not share api interceptors', () => {
    assert.match(src, /const refreshClient = axios\.create/);
    assert.match(src, /refreshClient\.post\(/);
    assert.doesNotMatch(src, /axios\.post\(\s*`\$\{API_BASE_URL\}\/auth\/refresh`/);
  });

  it('leaves authenticated screens only after the session is actually cleared', () => {
    assert.match(src, /leaveAuthenticatedSession/);
    assert.match(src, /resetToAuthChoice/);
    assert.match(src, /shouldClearAuthOnRefreshFailure\(error\)/);
  });
});
