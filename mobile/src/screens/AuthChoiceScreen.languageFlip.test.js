'use strict';

/**
 * AuthChoice reuses the Settings language Y-flip (same timing/easing).
 * Run: node --test src/screens/AuthChoiceScreen.languageFlip.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AUTH = path.resolve(__dirname, 'AuthChoiceScreen.js');
const SETTINGS = path.resolve(__dirname, 'SettingsScreen.js');

describe('AuthChoice language flip (UI only)', () => {
  const auth = fs.readFileSync(AUTH, 'utf8');
  const settings = fs.readFileSync(SETTINGS, 'utf8');

  it('uses the same Settings flip timing, easing, and rotateY', () => {
    assert.match(auth, /if \(nextLanguage === language \|\| flipBusyRef\.current\) return/);
    assert.match(auth, /const dir = nextLanguage === 'ar' \? 1 : -1/);
    assert.match(auth, /duration: 160/);
    assert.match(auth, /Easing\.in\(Easing\.cubic\)/);
    assert.match(auth, /duration: 200/);
    assert.match(auth, /Easing\.out\(Easing\.cubic\)/);
    assert.match(auth, /rotateY: flipRotateY/);
    assert.match(auth, /perspective: 1000/);
    assert.match(settings, /duration: 160/);
    assert.match(settings, /duration: 200/);
  });

  it('flips translated body copy and keeps the capsule toggle', () => {
    assert.match(auth, /onPress=\{\(\) => handleSelectLanguage\('en'\)\}/);
    assert.match(auth, /onPress=\{\(\) => handleSelectLanguage\('ar'\)\}/);
    assert.match(auth, /t\('welcome\.haveAccount'\)/);
    assert.match(auth, /t\('welcome\.signUp'\)/);
    assert.match(auth, /t\('welcome\.terms'\)/);
    assert.match(auth, /styles\.languageTrack/);
    assert.match(auth, /navigation\.navigate\('Login'\)/);
    assert.match(auth, /navigation\.navigate\('SignUpPhone'\)/);
  });

  it('keeps the language bar above the flip surface so logged-out taps reach it', () => {
    assert.match(auth, /zIndex: 2/);
    assert.match(auth, /pointerEvents="box-none"/);
    assert.match(auth, /pointerEvents="none"/);
    assert.match(auth, /changeLanguage\(nextLanguage\)/);
    assert.doesNotMatch(auth, /sessionKind|isAuthenticated|userToken/);
  });
});
