'use strict';

/**
 * Run: node --test src/utils/__tests__/themeMode.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  return import(pathToFileURL(path.join(__dirname, '..', 'themeMode.js')).href);
}

describe('normalizeThemeMode', () => {
  it('keeps stored light and dark (existing users)', async () => {
    const { normalizeThemeMode } = await load();
    assert.equal(normalizeThemeMode('light'), 'light');
    assert.equal(normalizeThemeMode('dark'), 'dark');
  });

  it('accepts system', async () => {
    const { normalizeThemeMode } = await load();
    assert.equal(normalizeThemeMode('system'), 'system');
  });

  it('missing/invalid defaults to system without rewriting light/dark', async () => {
    const { normalizeThemeMode } = await load();
    assert.equal(normalizeThemeMode(null), 'system');
    assert.equal(normalizeThemeMode(undefined), 'system');
    assert.equal(normalizeThemeMode(''), 'system');
    assert.equal(normalizeThemeMode('auto'), 'system');
    assert.equal(normalizeThemeMode('light'), 'light');
    assert.equal(normalizeThemeMode('dark'), 'dark');
  });
});

describe('resolveIsDarkMode', () => {
  it('stored light → effective light regardless of OS', async () => {
    const { resolveIsDarkMode } = await load();
    assert.equal(resolveIsDarkMode('light', 'dark'), false);
    assert.equal(resolveIsDarkMode('light', 'light'), false);
  });

  it('stored dark → effective dark regardless of OS', async () => {
    const { resolveIsDarkMode } = await load();
    assert.equal(resolveIsDarkMode('dark', 'light'), true);
    assert.equal(resolveIsDarkMode('dark', 'dark'), true);
  });

  it('stored system follows OS', async () => {
    const { resolveIsDarkMode } = await load();
    assert.equal(resolveIsDarkMode('system', 'light'), false);
    assert.equal(resolveIsDarkMode('system', 'dark'), true);
  });

  it('system + unknown OS scheme → light', async () => {
    const { resolveIsDarkMode } = await load();
    assert.equal(resolveIsDarkMode('system', null), false);
    assert.equal(resolveIsDarkMode('system', undefined), false);
  });

  it('missing stored mode follows OS (system default)', async () => {
    const { resolveIsDarkMode } = await load();
    assert.equal(resolveIsDarkMode(null, 'dark'), true);
    assert.equal(resolveIsDarkMode(null, 'light'), false);
  });
});

describe('statusBarStyleForRoute', () => {
  it('keeps branded auth screens independent of theme', async () => {
    const { statusBarStyleForRoute } = await load();
    assert.equal(statusBarStyleForRoute('Login', true), 'light-content');
    assert.equal(statusBarStyleForRoute('Register', true), 'light-content');
    assert.equal(statusBarStyleForRoute('OTP', true), 'dark-content');
    assert.equal(statusBarStyleForRoute('Onboarding', true), 'dark-content');
  });

  it('themed screens follow effective isDarkMode', async () => {
    const { statusBarStyleForRoute } = await load();
    assert.equal(statusBarStyleForRoute('Home', false), 'dark-content');
    assert.equal(statusBarStyleForRoute('Home', true), 'light-content');
    assert.equal(statusBarStyleForRoute('Settings', true), 'light-content');
  });
});

describe('ThemeContext wiring (source)', () => {
  it('listens to Appearance and still persists themeMode', () => {
    const fs = require('fs');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'context', 'ThemeContext.js'),
      'utf8'
    );
    assert.match(src, /Appearance\.addChangeListener/);
    assert.match(src, /THEME_STORAGE_KEY/);
    assert.match(src, /DEFAULT_THEME_MODE/);
    assert.match(src, /resolveIsDarkMode/);
  });
});
