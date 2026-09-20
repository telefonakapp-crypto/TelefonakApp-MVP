'use strict';

/**
 * Freeze Listing Details insight UI + Offers navigation (no backend changes).
 * Run: node --test src/screens/ListingDetailsScreen.insights.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DETAILS = path.resolve(__dirname, 'ListingDetailsScreen.js');
const RECEIVED = path.resolve(__dirname, 'ReceivedOffersScreen.js');

describe('Listing Details insights (UI + navigation only)', () => {
  const details = fs.readFileSync(DETAILS, 'utf8');
  const received = fs.readFileSync(RECEIVED, 'utf8');

  it('renders status with the existing StatusBadge, not a hardcoded Approved value', () => {
    assert.match(details, /StatusBadge/);
    assert.match(details, /status=\{listing\.status\}/);
    assert.match(details, /label=\{getStatusLabel\(listing\.status\)\}/);
    assert.doesNotMatch(
      details,
      /insightStatusBadge[\s\S]{0,200}Approved/
    );
  });

  it('opens the existing Offers route with this listing’s ID', () => {
    assert.match(details, /navigation\.push\(\s*'Offers'/);
    assert.match(details, /initialSegment:\s*'received'/);
    assert.match(details, /listingId,/);
    assert.match(details, /chevron-forward/);
    assert.match(details, /activeOpacity=\{0\.85\}/);
  });

  it('filters received offers client-side without changing the fetch URL', () => {
    assert.match(received, /apiClient\.get\('\/offers\/received'\)/);
    assert.match(received, /filterReceivedOffersByListingId\(offers, listingIdFilter\)/);
    assert.match(received, /route\.params\?\.listingId/);
  });
});
