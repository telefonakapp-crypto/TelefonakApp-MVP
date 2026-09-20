'use strict';

/**
 * Create Listing wizard step slide direction (no RN runtime).
 * Run: node --test src/screens/CreateListingScreen/stepTransition.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DIR = __dirname;
const SCREEN = path.join(DIR, 'index.js');
const APP = path.resolve(DIR, '../../../App.js');

describe('stepEnterTranslateX', () => {
  it('LTR: forward from right, back from left', async () => {
    const { stepEnterTranslateX } = await import(
      pathToFileURL(path.join(DIR, 'stepTransition.js')).href
    );
    assert.equal(stepEnterTranslateX(true, false, 390), 390);
    assert.equal(stepEnterTranslateX(false, false, 390), -390);
  });

  it('RTL: forward from left, back from right (matches inverted stack gestures)', async () => {
    const { stepEnterTranslateX } = await import(
      pathToFileURL(path.join(DIR, 'stepTransition.js')).href
    );
    assert.equal(stepEnterTranslateX(true, true, 390), -390);
    assert.equal(stepEnterTranslateX(false, true, 390), 390);
  });
});

describe('CreateListingScreen uses in-place step slides', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');
  const app = fs.readFileSync(APP, 'utf8');

  it('stays a single CreateListing route and still uses setStep', () => {
    assert.match(app, /name="CreateListing" component=\{CreateListingScreen\}/);
    assert.equal((app.match(/name="CreateListing"/g) || []).length, 1);
    assert.match(src, /const \[step, setStep\] = useState\(1\)/);
    assert.match(src, /setStep\(\(s\) => Math\.min\(TOTAL_STEPS, s \+ 1\)\)/);
    assert.match(src, /setStep\(\(s\) => s - 1\)/);
    assert.match(src, /apiClient\.(post|put)/);
  });

  it('slides step content with Animated, not the header or pickers', () => {
    assert.match(src, /stepEnterTranslateX/);
    assert.match(src, /Animated\.spring/);
    assert.match(src, /stepTranslateX/);
    assert.match(src, /CreateListingHeader/);
    assert.match(src, /styles\.stepViewport/);
    const headerIdx = src.indexOf('<CreateListingHeader');
    const viewportIdx = src.indexOf('styles.stepViewport');
    const pickerIdx = src.indexOf('<SearchablePickerSheet');
    assert.ok(headerIdx > 0 && viewportIdx > headerIdx);
    assert.ok(pickerIdx > viewportIdx);
    assert.match(src, /open=\{activeSheet === 'brand'\}/);
    assert.match(src, /open=\{activeSheet === 'model'\}/);
  });
});
