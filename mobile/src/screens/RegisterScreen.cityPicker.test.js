'use strict';

/**
 * Freeze the registration city list and confirm the picker is presentation-only.
 * Run: node --test src/screens/RegisterScreen.cityPicker.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REGISTER = path.resolve(__dirname, 'RegisterScreen.js');
const CREATE_LISTING = path.resolve(
  __dirname,
  'CreateListingScreen',
  'index.js'
);

const EXPECTED_CITIES = [
  'Amman',
  'Irbid',
  'Zarqa',
  'Balqa',
  'Madaba',
  'Karak',
  'Tafilah',
  "Ma'an",
  'Aqaba',
  'Jerash',
  'Ajloun',
  'Mafraq',
];

describe('RegisterScreen city picker (UI only)', () => {
  const src = fs.readFileSync(REGISTER, 'utf8');

  it('keeps the existing city list and order', () => {
    const match = src.match(/const CITY_OPTIONS = \[([\s\S]*?)\];/);
    assert.ok(match, 'CITY_OPTIONS must exist');
    const cities = [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map(
      (m) => m[1] || m[2]
    );
    assert.deepEqual(cities, EXPECTED_CITIES);
  });

  it('uses SearchablePickerSheet and still submits formData.city', () => {
    assert.match(src, /SearchablePickerSheet/);
    assert.match(src, /title=\{t\('register\.city'\)\}/);
    assert.match(src, /searchPlaceholder=\{t\('register\.searchCities'\)\}/);
    assert.match(src, /emptyText=\{t\('register\.noCitiesFound'\)\}/);
    assert.match(src, /handleInputChange\('city', item\.label\)/);
    assert.match(src, /apiClient\.post\('\/user\/register', formData/);
    assert.equal(/Modal/.test(src), false);
  });
});

describe('CreateListing model picker is unchanged', () => {
  it('still opens SearchablePickerSheet for models', () => {
    const src = fs.readFileSync(CREATE_LISTING, 'utf8');
    assert.match(src, /open=\{activeSheet === 'model'\}/);
    assert.match(src, /searchPlaceholder=\{t\('createListing\.searchModels'\)/);
  });
});
