'use strict';

const appJson = require('./app.json');
const { assertReleaseApiOriginFromEnv } = require('./src/config/apiOriginPolicy');

assertReleaseApiOriginFromEnv(process.env);

module.exports = appJson;
