'use strict';

/**
 * Run: node mobile/src/utils/__tests__/brandPickerLayout.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'brandPickerLayout.js')).href;
  const { buildBrandPickerSections, POPULAR_BRAND_NAMES } = await import(moduleUrl);

  assert.deepEqual(POPULAR_BRAND_NAMES, ['Apple', 'Samsung', 'Huawei']);

  const options = [
    { id: 5, label: 'Xiaomi' },
    { id: 1, label: 'Samsung' },
    { id: 2, label: 'Apple' },
    { id: 9, label: '__other__' },
    { id: 4, label: 'Huawei' },
    { id: 3, label: 'Google' },
    { id: 1, label: 'Samsung' },
  ];

  const idle = buildBrandPickerSections(options, { manualId: 9 });
  assert.deepEqual(
    idle.popular.map((b) => b.label),
    ['Apple', 'Samsung', 'Huawei']
  );
  assert.deepEqual(
    idle.all.map((b) => b.label),
    ['Apple', 'Google', 'Huawei', 'Samsung', 'Xiaomi']
  );
  assert.equal(idle.all.filter((b) => b.label === 'Samsung').length, 1);
  assert.equal(
    idle.all.some((b) => String(b.id) === '9'),
    false
  );

  const missingHuawei = buildBrandPickerSections(
    [
      { id: 2, label: 'Apple' },
      { id: 1, label: 'Samsung' },
      { id: 5, label: 'Xiaomi' },
    ]
  );
  assert.deepEqual(
    missingHuawei.popular.map((b) => b.label),
    ['Apple', 'Samsung']
  );

  const searching = buildBrandPickerSections(options, { query: 'sam', manualId: 9 });
  assert.equal(searching.isSearching, true);
  assert.deepEqual(searching.popular, []);
  assert.deepEqual(
    searching.all.map((b) => b.label),
    ['Samsung']
  );

  console.log('brandPickerLayout: passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
