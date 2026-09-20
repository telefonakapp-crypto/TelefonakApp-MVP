'use strict';

/**
 * Language selected at app start must reach Complete Your Profile via
 * LanguageContext (t / isRTL), not hardcoded English.
 * Run: node --test src/screens/RegisterScreen.i18n.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REGISTER = path.resolve(__dirname, 'RegisterScreen.js');
const SIGN_UP = path.resolve(__dirname, 'SignUpPhoneScreen.js');
const OTP = path.resolve(__dirname, 'OTPScreen.js');
const TRANSLATIONS = path.resolve(__dirname, '../utils/translations.js');
const RTL = path.resolve(__dirname, '../utils/rtlStyles.js');
const LANGUAGE_CONTEXT = path.resolve(__dirname, '../context/LanguageContext.js');

const ARABIC = /[\u0600-\u06FF]/;

function tFor(translations, lang) {
  return (keyPath) => {
    const keys = keyPath.split('.');
    let value = translations[lang];
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return keyPath;
      }
    }
    return typeof value === 'string' ? value : keyPath;
  };
}

const REGISTER_KEYS = [
  'register.completeYourProfile',
  'register.tellUsAboutYourself',
  'register.firstName',
  'register.lastName',
  'register.gender',
  'register.email',
  'register.dateOfBirth',
  'register.city',
  'register.male',
  'register.female',
  'register.enterFirstName',
  'register.enterLastName',
  'register.enterEmail',
  'register.selectDate',
  'register.selectCity',
  'register.searchCities',
  'register.noCitiesFound',
  'register.completeRegistration',
  'register.registering',
  'register.pleaseEnterFirstName',
  'register.pleaseEnterLastName',
  'register.pleaseSelectGender',
  'register.pleaseEnterEmail',
  'register.pleaseEnterValidEmail',
  'register.pleaseSelectDob',
  'register.pleaseSelectCity',
  'register.verificationRequired',
  'register.phoneNotVerified',
  'register.unableToComplete',
  'register.couldNotComplete',
];

describe('signup language flow uses LanguageContext', () => {
  const registerSrc = fs.readFileSync(REGISTER, 'utf8');
  const signUpSrc = fs.readFileSync(SIGN_UP, 'utf8');
  const otpSrc = fs.readFileSync(OTP, 'utf8');
  const contextSrc = fs.readFileSync(LANGUAGE_CONTEXT, 'utf8');
  const rtlSrc = fs.readFileSync(RTL, 'utf8');

  it('does not remount language or default Register to English', () => {
    assert.match(contextSrc, /LanguageProvider/);
    assert.match(contextSrc, /LANGUAGE_STORAGE_KEY/);
    assert.match(registerSrc, /useLanguage\(\)/);
    assert.doesNotMatch(registerSrc, /changeLanguage\(\s*'en'\s*\)/);
    assert.doesNotMatch(registerSrc, /setLanguage\(\s*'en'\s*\)/);
  });

  it('Complete Your Profile consumes t() and existing RTL helpers', () => {
    assert.match(registerSrc, /t\('register\.completeYourProfile'\)/);
    assert.match(registerSrc, /t\('register\.tellUsAboutYourself'\)/);
    assert.match(registerSrc, /t\('register\.selectCity'\)/);
    assert.match(registerSrc, /t\('register\.searchCities'\)/);
    assert.match(registerSrc, /t\('register\.completeRegistration'\)/);
    assert.match(registerSrc, /getTextAlign\(isRTL/);
    assert.match(registerSrc, /getFlexDirection\(isRTL/);
    assert.match(registerSrc, /isRTL \? 'arrow-forward' : 'arrow-back'/);
    assert.doesNotMatch(registerSrc, /Complete Your Profile/);
    assert.doesNotMatch(registerSrc, /Tell us a bit about yourself/);
    assert.doesNotMatch(registerSrc, /Select city/);
    assert.doesNotMatch(registerSrc, /Complete Registration/);
  });

  it('Sign Up and OTP also read the same language context', () => {
    assert.match(signUpSrc, /useLanguage\(\)/);
    assert.match(signUpSrc, /t\('auth\.createAccount'\)/);
    assert.match(signUpSrc, /t\('auth\.enterPhoneToGetStarted'\)/);
    assert.match(signUpSrc, /getTextAlign\(isRTL/);
    assert.match(otpSrc, /useLanguage\(\)/);
    assert.match(otpSrc, /t\('auth\.verifyItsYou'\)/);
    assert.match(otpSrc, /t\('auth\.verifyCode'\)/);
    assert.match(otpSrc, /getTextAlign\(isRTL/);
    assert.match(otpSrc, /getFlexDirection\(isRTL/);
    assert.doesNotMatch(otpSrc, /Verify it's you/);
  });

  it('RTL helpers stay LTR when isRTL is false', () => {
    assert.match(rtlSrc, /flexDirection: isRTL \? 'row-reverse' : 'row'/);
    assert.match(rtlSrc, /textAlign: isRTL \? 'right' : 'left'/);
  });
});

describe('Complete Your Profile translations', () => {
  it('Arabic language selects Arabic copy; English stays the original English', async () => {
    const { translations } = await import(pathToFileURL(TRANSLATIONS).href);
    const tEn = tFor(translations, 'en');
    const tAr = tFor(translations, 'ar');

    assert.equal(tEn('register.createProfile'), 'Create Your Profile');
    assert.equal(tEn('register.completeYourProfile'), 'Complete Your Profile');
    assert.equal(tEn('register.tellUsAboutYourself'), 'Tell us a bit about yourself');
    assert.equal(tEn('register.selectCity'), 'Select city');
    assert.equal(tEn('register.searchCities'), 'Search cities...');
    assert.equal(tEn('register.completeRegistration'), 'Complete Registration');
    assert.equal(tEn('auth.verifyItsYou'), "Verify it's you");
    assert.equal(tEn('auth.createAccount'), 'Create Account');

    for (const key of REGISTER_KEYS) {
      const en = tEn(key);
      const ar = tAr(key);
      assert.notEqual(en, key, `missing English key ${key}`);
      assert.notEqual(ar, key, `missing Arabic key ${key}`);
      assert.match(ar, ARABIC, `Arabic missing for ${key}`);
    }

    assert.equal(tAr('register.completeYourProfile'), 'أكمل ملفك الشخصي');
    assert.match(tAr('register.selectCity'), ARABIC);
    assert.notEqual(tAr('register.completeYourProfile'), tEn('register.completeYourProfile'));
  });
});
