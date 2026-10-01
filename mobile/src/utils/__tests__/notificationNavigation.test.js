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

  it('opens bid_one_hour_remaining on Listing Details from related_listing_id', async () => {
    const { resolveNotificationDestination } = await load();
    const dest = resolveNotificationDestination({
      type: 'bid_one_hour_remaining',
      title: 'Bid ending soon',
      related_listing_id: 88,
    });
    assert.equal(dest.name, 'ListingDetails');
    assert.equal(dest.method, 'navigate');
    assert.deepEqual(dest.params, { listingId: 88 });
    assert.equal(Object.prototype.hasOwnProperty.call(dest.params, 'phone_number'), false);
  });

  it('still opens Listing Details for a stale Bid notification', async () => {
    const { resolveNotificationDestination } = await load();
    const dest = resolveNotificationDestination({
      type: 'bid_one_hour_remaining',
      title: 'Bid ending soon',
      related_listing_id: '91',
      message: 'Your Bid listing has about 1 hour remaining.',
    });
    assert.equal(dest.name, 'ListingDetails');
    assert.deepEqual(dest.params, { listingId: 91 });
    assert.equal(
      resolveNotificationDestination({
        type: 'bid_one_hour_remaining',
        related_listing_id: null,
      }),
      null
    );
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
    assert.match(src, /bid_one_hour_remaining/);
    assert.match(src, /hammer-outline/);
    assert.match(src, /localizeNotification/);
    assert.doesNotMatch(src, /phone_number/);
    assert.doesNotMatch(src, /openPhoneDialer/);
    assert.doesNotMatch(
      src,
      /if \(item\.related_listing_id\) \{\s*navigation\.navigate\('ListingDetails'/
    );
  });

  it('keeps inbox pagination, read APIs, refresh, and RTL helpers', () => {
    assert.match(src, /const PAGE_SIZE = 20/);
    assert.match(src, /apiClient\.get\('\/notifications'/);
    assert.match(src, /apiClient\.patch\(`\/notifications\/\$\{id\}\/read`\)/);
    assert.match(src, /apiClient\.patch\('\/notifications\/read-all'\)/);
    assert.match(src, /useFocusEffect/);
    assert.match(src, /getFlexDirection\(isRTL/);
    assert.match(src, /getTextAlign\(isRTL/);
    assert.doesNotMatch(src, /setInterval/);
    assert.doesNotMatch(src, /bid_placed/);
    assert.doesNotMatch(src, /outbid/);
  });
});

describe('notification architecture reuse', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../../../App.js'), 'utf8');
  const context = fs.readFileSync(
    path.resolve(__dirname, '../../context/NotificationsContext.js'),
    'utf8'
  );
  const details = fs.readFileSync(
    path.resolve(__dirname, '../../screens/ListingDetailsScreen.js'),
    'utf8'
  );
  const srcRoot = path.resolve(__dirname, '../..');

  function walkJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') return [];
        return walkJs(full);
      }
      return entry.name.endsWith('.js') ? [full] : [];
    });
  }

  it('reuses the existing provider and push registration', () => {
    assert.equal((app.match(/NotificationsProvider/g) || []).length, 3);
    assert.match(app, /import \{ NotificationsProvider \}/);
    assert.match(context, /syncDevicePushRegistration/);
    assert.match(context, /requestPermission: false/);
    assert.match(context, /\/notifications\/unread-count/);
    assert.doesNotMatch(context, /addNotificationResponseReceivedListener/);
    assert.doesNotMatch(app, /addNotificationResponseReceivedListener/);
  });

  it('does not add a second notification context, scheduler, or fake Bid types', () => {
    const files = walkJs(srcRoot);
    const contexts = files.filter((file) =>
      fs.readFileSync(file, 'utf8').includes('createContext(null)') &&
      path.basename(file).toLowerCase().includes('notification')
    );
    assert.equal(contexts.length, 1);
    const joined = files
      .filter((file) => !file.includes('.test.js'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    assert.doesNotMatch(joined, /addNotificationResponseReceivedListener/);
    assert.doesNotMatch(joined, /type: 'bid_placed'/);
    assert.doesNotMatch(joined, /type: 'outbid'/);
    assert.doesNotMatch(joined, /type: 'bid_won'/);
  });

  it('lets Listing Details refetch current auction state after a stale Bid tap', () => {
    assert.match(details, /useFocusEffect/);
    assert.match(details, /fetchListingDetails/);
    assert.match(details, /apiClient\.get\(`\/listings\/\$\{listingId\}`\)/);
    assert.doesNotMatch(details, /bid_one_hour_remaining/);
    assert.doesNotMatch(details, /can_end_bid.*notification/);
  });
});
