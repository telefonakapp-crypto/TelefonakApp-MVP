'use strict';

/**
 * Run: node mobile/src/utils/__tests__/listingOwnerCapabilities.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const CAPABILITY_KEYS = [
  'canEdit',
  'canResubmit',
  'canHide',
  'canUnhide',
  'canMarkSold',
  'canDelete',
];

const NONE = {
  canEdit: false,
  canResubmit: false,
  canHide: false,
  canUnhide: false,
  canMarkSold: false,
  canDelete: false,
};

const OWNER_BY_STATUS = {
  pending: {
    canEdit: true,
    canResubmit: false,
    canHide: false,
    canUnhide: false,
    canMarkSold: false,
    canDelete: true,
  },
  resubmitted: {
    canEdit: true,
    canResubmit: false,
    canHide: false,
    canUnhide: false,
    canMarkSold: false,
    canDelete: true,
  },
  updated: {
    canEdit: true,
    canResubmit: false,
    canHide: false,
    canUnhide: false,
    canMarkSold: false,
    canDelete: true,
  },
  approved: {
    canEdit: true,
    canResubmit: false,
    canHide: true,
    canUnhide: false,
    canMarkSold: true,
    canDelete: true,
  },
  declined: {
    canEdit: false,
    canResubmit: true,
    canHide: false,
    canUnhide: false,
    canMarkSold: false,
    canDelete: true,
  },
  hidden: {
    canEdit: true,
    canResubmit: false,
    canHide: false,
    canUnhide: true,
    canMarkSold: false,
    canDelete: true,
  },
  sold: NONE,
  deleted: NONE,
  bid_duration_ended: NONE,
};

function assertCaps(actual, expected, message) {
  for (const key of CAPABILITY_KEYS) {
    assert.equal(
      actual[key],
      expected[key],
      `${message}: ${key} expected ${expected[key]}, got ${actual[key]}`
    );
  }
}

async function main() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'listingOwnerCapabilities.js')
  ).href;
  const { listingOwnerCapabilities, partitionOwnerListings } = await import(moduleUrl);

  let cases = 0;

  for (const [status, expected] of Object.entries(OWNER_BY_STATUS)) {
    const listing = { id: 1, status };
    assertCaps(
      listingOwnerCapabilities(listing, { isOwner: true }),
      expected,
      `owner ${status}`
    );
    cases += 1;

    assertCaps(
      listingOwnerCapabilities(listing, { isOwner: false }),
      NONE,
      `non-owner ${status}`
    );
    cases += 1;
  }

  // Declined: My Listings uses Update (canResubmit); Details uses Edit UI
  // via canEdit || canResubmit. Helper must not collapse those flags.
  const declinedOwner = listingOwnerCapabilities(
    { status: 'declined' },
    { isOwner: true }
  );
  assert.equal(declinedOwner.canEdit, false, 'declined owner canEdit');
  assert.equal(declinedOwner.canResubmit, true, 'declined owner canResubmit');
  assert.equal(
    declinedOwner.canEdit || declinedOwner.canResubmit,
    true,
    'declined Details Edit visibility'
  );
  cases += 1;

  const declinedGuest = listingOwnerCapabilities(
    { status: 'declined' },
    { isOwner: false }
  );
  assert.equal(declinedGuest.canEdit, false, 'declined guest canEdit');
  assert.equal(declinedGuest.canResubmit, false, 'declined guest canResubmit');
  cases += 1;

  for (const status of ['sold', 'deleted']) {
    const caps = listingOwnerCapabilities({ status }, { isOwner: true });
    assert.ok(
      CAPABILITY_KEYS.every((key) => caps[key] === false),
      `${status} is terminal with no owner mutations`
    );
    cases += 1;
  }

  assertCaps(
    listingOwnerCapabilities({ status: 'approved' }, {}),
    NONE,
    'missing isOwner'
  );
  cases += 1;

  assertCaps(listingOwnerCapabilities(null, { isOwner: true }), NONE, 'null listing');
  cases += 1;

  const pendingBid = {
    status: 'pending',
    sale_type: 'bid',
    auction: { auction_status: 'pending_start', can_list_again: false },
  };
  assertCaps(
    listingOwnerCapabilities(pendingBid, { isOwner: true }),
    OWNER_BY_STATUS.pending,
    'pending Bid keeps pending caps'
  );
  cases += 1;

  const liveBid = {
    status: 'approved',
    sale_type: 'bid',
    auction: { auction_status: 'live', can_list_again: false },
  };
  assertCaps(
    listingOwnerCapabilities(liveBid, { isOwner: true }),
    NONE,
    'live Bid is frozen'
  );
  cases += 1;
  assert.equal(
    listingOwnerCapabilities(liveBid, { isOwner: true }).canEdit,
    false,
    'live Bid cannot edit'
  );
  cases += 1;
  assert.equal(
    listingOwnerCapabilities(liveBid, { isOwner: true }).canHide,
    false,
    'live Bid cannot hide'
  );
  cases += 1;
  assert.equal(
    listingOwnerCapabilities(
      { ...liveBid, status: 'hidden' },
      { isOwner: true }
    ).canUnhide,
    false,
    'live Bid cannot unhide'
  );
  cases += 1;
  assert.equal(
    listingOwnerCapabilities(liveBid, { isOwner: true }).canMarkSold,
    false,
    'live Bid cannot mark sold'
  );
  cases += 1;
  assert.equal(
    listingOwnerCapabilities(liveBid, { isOwner: true }).canDelete,
    false,
    'live Bid cannot generic-delete'
  );
  cases += 1;

  const endedExpired = {
    status: 'bid_duration_ended',
    sale_type: 'bid',
    auction: {
      auction_status: 'completed',
      completion_source: 'expired',
      can_list_again: true,
    },
  };
  const endedSold = {
    status: 'bid_duration_ended',
    sale_type: 'bid',
    auction: {
      auction_status: 'completed',
      completion_source: 'sold',
      can_list_again: false,
    },
  };
  const endedCancelled = {
    status: 'bid_duration_ended',
    sale_type: 'bid',
    auction: {
      auction_status: 'cancelled',
      completion_source: 'cancelled',
      can_list_again: false,
    },
  };

  for (const listing of [endedExpired, endedSold, endedCancelled]) {
    assertCaps(
      listingOwnerCapabilities(listing, { isOwner: true }),
      NONE,
      `bid_duration_ended ${listing.auction.completion_source}`
    );
    cases += 1;
    assert.equal(
      listing.auction.can_list_again,
      listing.auction.completion_source === 'expired',
      'can_list_again preserved on listing.auction'
    );
    cases += 1;
  }

  const deletedBid = {
    status: 'deleted',
    sale_type: 'bid',
    auction: { auction_status: 'live' },
  };
  assertCaps(
    listingOwnerCapabilities(deletedBid, { isOwner: true }),
    NONE,
    'deleted Bid remains historical'
  );
  cases += 1;

  const partitioned = partitionOwnerListings([
    { id: 1, status: 'approved', sale_type: 'normal' },
    { id: 2, status: 'pending', sale_type: 'bid', auction: { auction_status: 'pending_start' } },
    { id: 3, status: 'approved', sale_type: 'bid', auction: { auction_status: 'live' } },
    { id: 4, status: 'sold', sale_type: 'normal' },
    { id: 5, status: 'deleted', sale_type: 'normal' },
    {
      id: 6,
      status: 'bid_duration_ended',
      sale_type: 'bid',
      auction: { completion_source: 'expired', can_list_again: true },
    },
    {
      id: 7,
      status: 'bid_duration_ended',
      sale_type: 'bid',
      auction: { completion_source: 'sold', can_list_again: false },
    },
    {
      id: 8,
      status: 'bid_duration_ended',
      sale_type: 'bid',
      auction: { completion_source: 'cancelled', can_list_again: false },
    },
    { id: 9, status: 'hidden', sale_type: 'normal' },
    { id: 10, status: 'declined', sale_type: 'normal' },
  ]);
  assert.deepEqual(
    partitioned.active.map((row) => row.id),
    [1, 2, 3, 9, 10],
    'active excludes sold/deleted/bid_duration_ended'
  );
  cases += 1;
  assert.deepEqual(
    partitioned.history.map((row) => row.id),
    [4, 6, 7, 8, 5],
    'history is sold, ended bids, then deleted'
  );
  cases += 1;
  assert.equal(
    partitioned.history.some((row) => row.status === 'bid_duration_ended'),
    true
  );
  cases += 1;
  assert.equal(
    partitioned.active.some((row) => row.status === 'bid_duration_ended'),
    false
  );
  cases += 1;
  assert.equal(partitioned.sold[0].id, 4);
  cases += 1;
  assert.equal(partitioned.deleted[0].id, 5);
  cases += 1;
  assert.equal(
    partitioned.endedBids.every((row) => row.auction != null),
    true,
    'ended bid auction objects are preserved'
  );
  cases += 1;
  assert.equal(
    partitioned.endedBids.find((row) => row.id === 6).auction.can_list_again,
    true,
    'expired Bid keeps can_list_again'
  );
  cases += 1;
  assert.equal(
    partitioned.endedBids.find((row) => row.id === 7).auction.can_list_again,
    false,
    'manually sold Bid keeps can_list_again false'
  );
  cases += 1;

  console.log(`listingOwnerCapabilities: ${cases} cases passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
