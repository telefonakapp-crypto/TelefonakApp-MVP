'use strict';

/**
 * Lazy Firebase Admin singleton for Android FCM.
 *
 * Credentials come only from Application Default Credentials
 * (GOOGLE_APPLICATION_CREDENTIALS). This module does not read or embed
 * the service-account JSON. Importing it does not initialize Firebase.
 */

const fs = require('fs');

const FIREBASE_PROJECT_ID = 'telefonakapp-b3e40';

let app = null;
let messagingOverride = null;
let adminLoader = null;
let initCount = 0;

function notConfigured() {
  const error = new Error('Firebase credentials are not configured');
  error.code = 'provider_not_configured';
  return error;
}

function credentialPath() {
  const value = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (value == null) return '';
  return String(value).trim();
}

function isFirebaseConfigured() {
  return credentialPath() !== '';
}

function credentialsFileReady() {
  const filePath = credentialPath();
  if (!filePath) return false;
  try {
    return fs.existsSync(filePath);
  } catch (_error) {
    return false;
  }
}

function loadAdminSdk() {
  if (adminLoader) return adminLoader();
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getMessaging } = require('firebase-admin/messaging');
  return {
    initializeApp,
    credential: { applicationDefault },
    messaging() {
      return getMessaging();
    },
  };
}

/**
 * Returns the Firebase Messaging client.
 * Throws a provider_not_configured error when credentials are absent.
 * Does not throw merely because this module was imported.
 */
function getFirebaseMessaging() {
  if (messagingOverride) return messagingOverride;
  if (!isFirebaseConfigured()) throw notConfigured();
  if (!adminLoader && !credentialsFileReady()) throw notConfigured();

  const admin = loadAdminSdk();
  if (!app) {
    initCount += 1;
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: FIREBASE_PROJECT_ID,
    });
  }
  if (typeof admin.messaging !== 'function') {
    const error = new Error('Firebase messaging is unavailable');
    error.code = 'provider_not_configured';
    throw error;
  }
  return admin.messaging();
}

function setFirebaseMessaging(messaging) {
  messagingOverride = messaging || null;
}

function setFirebaseAdminLoader(loader) {
  adminLoader = typeof loader === 'function' ? loader : null;
}

function getFirebaseInitCount() {
  return initCount;
}

function resetFirebaseAdminForTests() {
  messagingOverride = null;
  adminLoader = null;
  const current = app;
  app = null;
  initCount = 0;
  if (current && typeof current.delete === 'function') {
    const result = current.delete();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  }
}

module.exports = {
  FIREBASE_PROJECT_ID,
  isFirebaseConfigured,
  getFirebaseMessaging,
  setFirebaseMessaging,
  setFirebaseAdminLoader,
  getFirebaseInitCount,
  resetFirebaseAdminForTests,
};
