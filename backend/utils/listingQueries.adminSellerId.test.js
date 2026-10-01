'use strict';

/**
 * Admin listings Seller ID filter must match listings.user_id exactly.
 * Isolated source tests (no database writes, no live HTTP).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const QUERIES = fs.readFileSync(path.join(BACKEND_ROOT, 'utils', 'listingQueries.js'), 'utf8');
const ADMIN_LISTINGS = fs.readFileSync(
  path.join(BACKEND_ROOT, 'routes', 'adminListings.js'),
  'utf8'
);

describe('Admin listings seller_id exact filter', () => {
  it('fetchAdminListingList applies l.user_id equality for sellerId', () => {
    const fnStart = QUERIES.indexOf('async function fetchAdminListingList');
    assert.ok(fnStart >= 0);
    const fn = QUERIES.slice(fnStart, QUERIES.indexOf('async function fetchAdminListingRowById', fnStart));
    assert.match(fn, /l\.user_id = \$\$\{add\(sellerId\)\}/);
    assert.doesNotMatch(fn, /u\.id ILIKE/);
    assert.match(fn, /u\.first_name ILIKE/);
  });

  it('GET /admin/listings validates seller_id and forwards sellerId', () => {
    assert.match(ADMIN_LISTINGS, /parseOptionalSellerId\(req\.query\.seller_id\)/);
    assert.match(ADMIN_LISTINGS, /Invalid seller_id\. Must be a positive integer\./);
    assert.match(ADMIN_LISTINGS, /sellerId: sellerIdParsed\.value/);
    assert.match(ADMIN_LISTINGS, /\^\[1-9\]\\d\*\$/);
  });
});
