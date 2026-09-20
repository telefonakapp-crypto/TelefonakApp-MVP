'use strict';

/**
 * Run: node --test src/utils/__tests__/notificationNavigation.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'notificationNavigation.js')
  ).href;
  return import(moduleUrl);
}

describe('notification navigation destinations', () => {
  it('sends a New Offer with a listing id to Offers (received), not Listing Details', async () => {
    const { resolveNotificationDestination } = await load();
    const dest = resolveNotificationDestination({
      type: 'offer_received',
      title: 'New Offer',
      related_listing_id: 42,
    });

    assert.equal(dest.name, 'Offers');
    assert.equal(dest.method, 'push');
    assert.equal(dest.params.initialSegment, 'received');
    assert.equal(dest.params.listingId, 42);
    assert.notEqual(dest.name, 'ListingDetails');
  });

  it('keeps Listing Approved on Listing Details', async () => {
    const { resolveNotificationDestination } = await load();
    const dest = resolveNotificationDestination({
      type: 'listing_approved',
      title: 'Listing Approved',
      related_listing_id: 7,
    });

    assert.equal(dest.name, 'ListingDetails');
    assert.equal(dest.method, 'navigate');
    assert.deepEqual(dest.params, { listingId: 7 });
  });

  it('keeps Listing Submitted on Listing Details', async () => {
    const { resolveNotificationDestination } = await load();
    const dest = resolveNotificationDestination({
      type: 'listing_submitted',
      title: 'Listing Submitted',
      related_listing_id: 9,
    });

    assert.equal(dest.name, 'ListingDetails');
    assert.equal(dest.method, 'navigate');
    assert.deepEqual(dest.params, { listingId: 9 });
  });

  it('opens Received Offers context for New Offer even without a listing id', async () => {
    const { resolveNotificationDestination } = await load();
    const dest = resolveNotificationDestination({
      type: 'offer_received',
      title: 'New Offer',
      related_listing_id: null,
    });

    assert.equal(dest.name, 'Offers');
    assert.equal(dest.params.initialSegment, 'received');
    assert.equal(dest.params.listingId, undefined);
  });

  it('does not throw on a missing notification and does not invent a listing', async () => {
    const { resolveNotificationDestination } = await load();
    assert.equal(resolveNotificationDestination(null), null);
    assert.equal(
      resolveNotificationDestination({ type: 'offer_received' }).params.listingId,
      undefined
    );
  });

  it('keeps Offer Accepted and Offer Rejected on Listing Details', async () => {
    const { resolveNotificationDestination } = await load();
    const accepted = resolveNotificationDestination({
      type: 'offer_accepted',
      title: 'Offer Accepted',
      related_listing_id: 15,
    });
    const rejected = resolveNotificationDestination({
      type: 'offer_rejected',
      title: 'Offer Declined',
      related_listing_id: 16,
    });

    assert.equal(accepted.name, 'ListingDetails');
    assert.deepEqual(accepted.params, { listingId: 15 });
    assert.equal(rejected.name, 'ListingDetails');
    assert.deepEqual(rejected.params, { listingId: 16 });
  });
});

describe('NotificationsScreen wiring (navigation only)', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../screens/NotificationsScreen.js'),
    'utf8'
  );

  it('uses the destination helper and does not send every tap to Listing Details', () => {
    assert.match(src, /resolveNotificationDestination/);
    assert.match(src, /navigation\.push\(destination\.name, destination\.params\)/);
    assert.doesNotMatch(
      src,
      /if \(item\.related_listing_id\) \{\s*navigation\.navigate\('ListingDetails'/
    );
  });
});
