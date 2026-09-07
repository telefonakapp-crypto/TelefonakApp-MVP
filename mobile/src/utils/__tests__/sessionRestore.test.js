'use strict';

/**
 * Run: node --test mobile/src/utils/__tests__/sessionRestore.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'sessionRestore.js'),
  'utf8'
);
const wrapped = source
  .replace(/export function /g, 'function ')
  .concat('\nmodule.exports = { resolvePostMaintenanceRoute, shouldClearAuthOnRefreshFailure };\n');
const { resolvePostMaintenanceRoute, shouldClearAuthOnRefreshFailure } = vm.runInNewContext(wrapped, {
  module: { exports: {} },
  exports: {},
});

describe('resolvePostMaintenanceRoute', () => {
  it('sends an onboarded customer with a live access session to Home', () => {
    assert.equal(
      resolvePostMaintenanceRoute({
        hasSeenOnboarding: true,
        sessionKind: 'customer',
        refreshToken: 'refresh-token',
      }),
      'Home'
    );
  });

  it('keeps the user on Home when access JWT expired but refresh remains', () => {
    assert.equal(
      resolvePostMaintenanceRoute({
        hasSeenOnboarding: true,
        sessionKind: 'none',
        refreshToken: 'refresh-token',
      }),
      'Home'
    );
  });

  it('does not treat a missing refresh + expired access as logged in', () => {
    assert.equal(
      resolvePostMaintenanceRoute({
        hasSeenOnboarding: true,
        sessionKind: 'none',
        refreshToken: null,
      }),
      'AuthChoice'
    );
  });

  it('does not skip onboarding', () => {
    assert.equal(
      resolvePostMaintenanceRoute({
        hasSeenOnboarding: false,
        sessionKind: 'customer',
        refreshToken: 'refresh-token',
      }),
      'Onboarding'
    );
  });
});

describe('shouldClearAuthOnRefreshFailure', () => {
  it('clears on genuine refresh 401/403', () => {
    assert.equal(shouldClearAuthOnRefreshFailure({ response: { status: 401 } }), true);
    assert.equal(shouldClearAuthOnRefreshFailure({ response: { status: 403 } }), true);
  });

  it('does not clear on maintenance 503 or MaintenanceError', () => {
    assert.equal(
      shouldClearAuthOnRefreshFailure({
        response: { status: 503, data: { maintenance: true } },
      }),
      false
    );
    assert.equal(
      shouldClearAuthOnRefreshFailure({
        isMaintenance: true,
        name: 'MaintenanceError',
        code: 'ERR_MAINTENANCE',
      }),
      false
    );
  });

  it('does not clear on network errors or 5xx', () => {
    assert.equal(shouldClearAuthOnRefreshFailure({ message: 'Network Error' }), false);
    assert.equal(shouldClearAuthOnRefreshFailure({ response: { status: 500 } }), false);
    assert.equal(shouldClearAuthOnRefreshFailure(null), false);
  });
});
