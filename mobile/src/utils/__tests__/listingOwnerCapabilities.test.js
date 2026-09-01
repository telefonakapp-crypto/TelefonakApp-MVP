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
  const { listingOwnerCapabilities } = await import(moduleUrl);

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

  console.log(`listingOwnerCapabilities: ${cases} cases passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
