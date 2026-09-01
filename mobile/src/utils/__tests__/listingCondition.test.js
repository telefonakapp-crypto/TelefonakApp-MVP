'use strict';

/**
 * Run: node mobile/src/utils/__tests__/listingCondition.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'listingCondition.js')
  ).href;
  const { conditionKey, localizeConditionName } = await import(moduleUrl);

  assert.equal(conditionKey('Used - Like New'), 'usedlikenew');
  assert.equal(conditionKey('Used - Good'), 'usedgood');
  assert.equal(conditionKey('Used - Fair'), 'usedfair');
  assert.equal(conditionKey('New'), 'new');

  const en = (key) =>
    ({
      'conditions.new': 'New',
      'conditions.likeNew': 'Like New',
      'conditions.usedlikenew': 'Used - Like New',
      'conditions.usedgood': 'Used - Good',
      'conditions.usedfair': 'Used - Fair',
    }[key]);

  const ar = (key) =>
    ({
      'conditions.new': 'جديد',
      'conditions.likeNew': 'كالجديد',
      'conditions.usedlikenew': 'مستعمل - كالجديد',
      'conditions.usedgood': 'مستعمل - جيد',
      'conditions.usedfair': 'مستعمل - مقبول',
    }[key]);

  assert.equal(localizeConditionName('New', en), 'New');
  assert.equal(localizeConditionName('Used - Like New', en), 'Used - Like New');
  assert.equal(localizeConditionName('Used - Good', en), 'Used - Good');
  assert.equal(localizeConditionName('Used - Fair', en), 'Used - Fair');

  assert.equal(localizeConditionName('New', ar), 'جديد');
  assert.equal(localizeConditionName('Used - Like New', ar), 'مستعمل - كالجديد');
  assert.equal(localizeConditionName('Used - Good', ar), 'مستعمل - جيد');
  assert.equal(localizeConditionName('Used - Fair', ar), 'مستعمل - مقبول');

  console.log('listingCondition: 12 cases passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
