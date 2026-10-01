'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  FIREBASE_PROJECT_ID,
  getFirebaseMessaging,
  getFirebaseInitCount,
  setFirebaseAdminLoader,
  resetFirebaseAdminForTests,
} = require('./firebaseAdmin');

describe('firebase admin initialization', () => {
  let previousCredentials;

  beforeEach(() => {
    previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    resetFirebaseAdminForTests();
  });

  afterEach(() => {
    resetFirebaseAdminForTests();
    if (previousCredentials == null) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
  });

  it('does not initialize Firebase when credentials are missing', () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let initialized = 0;
    setFirebaseAdminLoader(() => ({
      initializeApp() {
        initialized += 1;
        return {};
      },
      credential: { applicationDefault() { return {}; } },
      messaging() { return {}; },
    }));

    assert.throws(
      () => getFirebaseMessaging(),
      (error) => error.code === 'provider_not_configured'
    );
    assert.equal(initialized, 0);
    assert.equal(getFirebaseInitCount(), 0);
  });

  it('initializes once and reuses the app', () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'backend/secrets/firebase-adminsdk.json';
    const calls = [];
    const messaging = { sendEach: async () => ({ responses: [] }) };
    setFirebaseAdminLoader(() => ({
      initializeApp(options) {
        calls.push(options);
        return { name: 'telefonak-test-app' };
      },
      credential: {
        applicationDefault() {
          return { kind: 'application-default' };
        },
      },
      messaging() {
        return messaging;
      },
    }));

    const first = getFirebaseMessaging();
    const second = getFirebaseMessaging();
    assert.equal(first, second);
    assert.equal(calls.length, 1);
    assert.equal(getFirebaseInitCount(), 1);
    assert.equal(calls[0].projectId, FIREBASE_PROJECT_ID);
    assert.equal(calls[0].projectId, 'telefonakapp-b3e40');
    assert.deepEqual(calls[0].credential, { kind: 'application-default' });
  });
});
