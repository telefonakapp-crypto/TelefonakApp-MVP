'use strict';

/**
 * Home avatar must use the real profile name, never a fake "User"/"U".
 * Run: node --test src/screens/HomeScreen/HomeScreen.profileInitial.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const HOME = path.resolve(__dirname, 'index.js');
const API = path.resolve(__dirname, '../../utils/api.js');
const PROFILE = path.resolve(__dirname, '../ProfileScreen.js');

describe('Home profile initial (session-safe)', () => {
  const home = fs.readFileSync(HOME, 'utf8');
  const api = fs.readFileSync(API, 'utf8');
  const profile = fs.readFileSync(PROFILE, 'utf8');

  it('does not invent a User/U identity when profile loading fails', () => {
    assert.doesNotMatch(home, /setUserName\('User'\)/);
    assert.doesNotMatch(home, /\(userName \|\| 'U'\)/);
    assert.match(home, /userName \? userName\.charAt\(0\)\.toUpperCase\(\) : ''/);
  });

  it('keeps the last known name after a failed profile fetch', () => {
    assert.match(home, /logApiError\('HomeScreen\.fetchUserProfile', error\)/);
    const catchBlock = home.slice(
      home.indexOf("logApiError('HomeScreen.fetchUserProfile'"),
      home.indexOf('}, []);', home.indexOf("logApiError('HomeScreen.fetchUserProfile'"))
    );
    assert.doesNotMatch(catchBlock, /setUserName/);
    assert.doesNotMatch(catchBlock, /setCurrentUserId/);
  });

  it('does not fetch /user/profile three times on first focus', () => {
    assert.equal((home.match(/fetchUserProfile\(\)/g) || []).length, 1);
    assert.doesNotMatch(home, /addListener\('focus'/);
  });

  it('sends the user to AuthChoice only after tokens are gone', () => {
    assert.match(api, /shouldClearAuthOnRefreshFailure\(error\)/);
    assert.match(api, /leaveAuthenticatedSession/);
    assert.match(profile, /if \(!access && !refresh\)/);
    assert.match(profile, /name: 'AuthChoice'/);
  });
});
