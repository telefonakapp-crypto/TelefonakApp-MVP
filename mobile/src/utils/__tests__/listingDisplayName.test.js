'use strict';

/**
 * Run: node mobile/src/utils/__tests__/listingDisplayName.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'listingDisplayName.js'),
  ).href;
  const { getListingDisplayName } = await import(moduleUrl);

  const cases = [
  ['Apple', 'Apple Watch Series 8', 'Apple Watch Series 8'],
  ['Apple', 'Apple Watch', 'Apple Watch'],
  ['Apple', 'Apple Watch Series 6', 'Apple Watch Series 6'],
  ['Apple', 'iPhone 16', 'Apple iPhone 16'],
  ['Apple', 'iPhone 15 Pro Max', 'Apple iPhone 15 Pro Max'],
  ['Samsung', 'Galaxy Watch8', 'Samsung Galaxy Watch8'],
  ['Samsung', 'Samsung Galaxy Watch8', 'Samsung Galaxy Watch8'],
  ['Huawei', 'HUAWEI WATCH 5', 'HUAWEI WATCH 5'],
  ['Huawei', 'Pura 70', 'Huawei Pura 70'],
  ['Apple', 'Watch for Apple', 'Apple Watch for Apple'],
  ['Apple', 'apple watch series 8', 'apple watch series 8'],
  [' Apple ', ' Apple Watch Series 8 ', 'Apple Watch Series 8'],
  ['Apple', null, 'Apple'],
  [null, 'iPhone 16', 'iPhone 16'],
  [null, null, ''],
  ['', 'Galaxy Watch8', 'Galaxy Watch8'],
];

  for (const [brand, model, expected] of cases) {
    assert.equal(getListingDisplayName(brand, model), expected, `${brand} + ${model}`);
  }

  console.log(`listingDisplayName: ${cases.length} cases passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
