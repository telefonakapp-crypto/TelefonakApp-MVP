'use strict';

/**
 * Required-field asterisks on Create Listing must match Step 3.
 * Run: node --test src/screens/CreateListingScreen/requiredAsterisks.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCREEN = path.resolve(__dirname, 'index.js');
const IMAGES = path.resolve(__dirname, 'CreateListingImages.js');
const SELECT = path.resolve(__dirname, '../../components/ui/SelectField.js');

function sliceStep(src, step) {
  const start = src.indexOf(`{step === ${step} && (`);
  assert.notEqual(start, -1, `missing step ${step}`);
  const next = src.indexOf(`{step === ${step + 1} && (`, start + 1);
  const end = next === -1 ? src.indexOf('{step < TOTAL_STEPS', start) : next;
  return src.slice(start, end);
}

describe('Create Listing required asterisks', () => {
  const screen = fs.readFileSync(SCREEN, 'utf8');
  const images = fs.readFileSync(IMAGES, 'utf8');
  const select = fs.readFileSync(SELECT, 'utf8');
  const step1 = sliceStep(screen, 1);
  const step2 = sliceStep(screen, 2);
  const step3 = sliceStep(screen, 3);

  it('keeps the Step 3 red asterisk color and nested rendering', () => {
    assert.match(screen, /requiredAsterisk:\s*\{\s*color:\s*'#E53935'/);
    assert.match(images, /requiredAsterisk:\s*\{\s*color:\s*'#E53935'/);
    assert.match(select, /requiredAsterisk:\s*\{\s*color:\s*'#E53935'/);
    assert.match(step3, /createListing\.price'\)[\s\S]{0,40}requiredAsterisk/);
    assert.match(step3, /label=\{t\('home\.city'\) \|\| 'City'\}\s*required/);
    assert.match(images, /createListing\.images'\)[\s\S]{0,40}requiredAsterisk/);
  });

  it('does not mark optional Step 3 fields as required', () => {
    assert.doesNotMatch(step3, /createListing\.description'\)[\s\S]{0,80}requiredAsterisk/);
    assert.doesNotMatch(step3, /home\.area'[\s\S]{0,80}requiredAsterisk/);
    assert.doesNotMatch(step3, /home\.area'[\s\S]{0,40}\srequired/);
  });

  it('uses the same red asterisk on required Step 1 labels', () => {
    assert.match(step1, /createListing\.category'[\s\S]{0,80}requiredAsterisk/);
    assert.match(step1, /label=\{t\('createListing\.brand'\)\}\s*required/);
    assert.match(step1, /label=\{t\('createListing\.model'\)\}\s*required/);
    assert.match(step1, /label=\{t\('createListing\.storage'\)\}\s*required/);
    assert.doesNotMatch(step1, /createListing\.(brand|model|storage)'\) \*/);
  });

  it('uses the same red asterisk on required Step 2 labels', () => {
    assert.match(step2, /label=\{t\('createListing\.condition'\)\}\s*required/);
    assert.match(step2, /createListing\.batteryPercentage'\)[\s\S]{0,40}requiredAsterisk/);
    assert.match(step2, /createListing\.simConfiguration'\)\}\s*required/);
    assert.doesNotMatch(step2, /batteryPercentage'\) \*/);
    assert.doesNotMatch(step2, /simConfiguration'\) \*/);
  });
});
