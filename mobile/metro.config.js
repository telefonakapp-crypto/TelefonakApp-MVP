'use strict';

const { getDefaultConfig } = require('expo/metro-config');
const { assertReleaseApiOriginFromEnv } = require('./src/config/apiOriginPolicy');

assertReleaseApiOriginFromEnv(process.env);

module.exports = getDefaultConfig(__dirname);
