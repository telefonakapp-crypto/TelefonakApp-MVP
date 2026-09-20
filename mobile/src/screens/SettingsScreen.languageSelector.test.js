'use strict';

/**
 * Settings language selector matches AuthChoice capsule; flip is local.
 * Run: node --test src/screens/SettingsScreen.languageSelector.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SETTINGS = path.resolve(__dirname, 'SettingsScreen.js');
const AUTH = path.resolve(__dirname, 'AuthChoiceScreen.js');
const LANGUAGE = path.resolve(__dirname, '../context/LanguageContext.js');

describe('Settings language selector (UI only)', () => {
  const settings = fs.readFileSync(SETTINGS, 'utf8');
  const auth = fs.readFileSync(AUTH, 'utf8');
  const languageCtx = fs.readFileSync(LANGUAGE, 'utf8');

  it('uses a Welcome-style capsule and does not instant-switch on same language', () => {
    assert.match(settings, /styles\.languageTrack/);
    assert.match(settings, /styles\.languageSegmentSelected/);
    assert.match(settings, /t\('welcome\.languageEnglish'\)/);
    assert.match(settings, /t\('welcome\.languageArabic'\)/);
    assert.match(settings, /handleSelectLanguage/);
    assert.match(
      settings,
      /if \(nextLanguage === language \|\| flipBusyRef\.current\) return/
    );
    assert.match(settings, /Animated\.timing\(flip/);
    assert.match(settings, /rotateY/);
    assert.match(settings, /changeLanguage\(nextLanguage\)/);
    assert.doesNotMatch(settings, /onPress=\{\(\) => changeLanguage\('en'\)\}/);
    assert.doesNotMatch(settings, />EN</);
    assert.doesNotMatch(settings, />AR</);
  });

  it('does not change language persistence, AuthChoice capsule, or navigation', () => {
    assert.match(languageCtx, /AsyncStorage\.setItem\(LANGUAGE_STORAGE_KEY/);
    assert.match(auth, /styles\.languageTrack/);
    assert.match(auth, /onPress=\{\(\) => handleSelectLanguage\('en'\)\}/);
    assert.match(settings, /navigation\.navigate\('EditProfile'\)/);
    assert.match(settings, /handleToggleNotifications/);
    assert.match(settings, /changeThemeMode/);
  });

  it('offers Light / Dark / System without a binary Dark Mode switch', () => {
    assert.match(settings, /settings\.themeLight/);
    assert.match(settings, /settings\.themeDark/);
    assert.match(settings, /settings\.themeSystem/);
    assert.match(settings, /changeThemeMode\(option\.id\)/);
    assert.doesNotMatch(settings, /onValueChange=\{toggleTheme\}/);
    assert.match(settings, /styles\.appearanceTrack/);
    assert.match(settings, /alignSelf: isRTL \? 'flex-start' : 'flex-end'/);
  });
});
