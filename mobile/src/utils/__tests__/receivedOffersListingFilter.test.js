'use strict';

/**
 * Run: node --test src/utils/__tests__/receivedOffersListingFilter.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'receivedOffersListingFilter.js')
  ).href;
  const { filterReceivedOffersByListingId } = await import(moduleUrl);

  const offers = [
    { id: 1, listing_id: 10 },
    { id: 2, listing_id: '11' },
    { id: 3, listing_id: 10 },
  ];

  assert.deepEqual(filterReceivedOffersByListingId(offers, 10).map((o) => o.id), [
    1, 3,
  ]);
  assert.deepEqual(filterReceivedOffersByListingId(offers, '11').map((o) => o.id), [
    2,
  ]);
  assert.equal(filterReceivedOffersByListingId(offers, undefined), offers);
  assert.equal(filterReceivedOffersByListingId(offers, null), offers);
  assert.equal(filterReceivedOffersByListingId(offers, 0), offers);
  assert.deepEqual(filterReceivedOffersByListingId(offers, 99), []);
}

main();
