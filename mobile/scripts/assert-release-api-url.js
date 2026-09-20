'use strict';

const { assertReleaseApiOrigin } = require('../src/config/apiOriginPolicy');

try {
  const origin = assertReleaseApiOrigin(process.env.EXPO_PUBLIC_API_URL);
  process.stdout.write(`release API origin OK: ${origin}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
