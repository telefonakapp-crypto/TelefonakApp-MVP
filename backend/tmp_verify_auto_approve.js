/**
 * Verifies auto_approve_listings drives create/edit moderation status dynamically.
 * Usage: node tmp_verify_auto_approve.js
 */
require('dotenv').config();
const pool = require('./config/database');
const {
  getSetting,
  invalidateMaintenanceCache,
} = require('./utils/settings');
const {
  LISTING_STATUS,
  resolveListingModerationStatus,
  PUBLIC_LISTING_STATUSES,
} = require('./utils/listingStatus');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function setAutoApprove(enabled) {
  await pool.query(
    `INSERT INTO settings (key, value)
     VALUES ('auto_approve_listings', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [enabled ? 'true' : 'false']
  );
}

async function main() {
  console.log('=== Auto Approve Listings verification ===');

  const before = await getSetting('auto_approve_listings');
  console.log('Starting auto_approve_listings =', before);

  console.log('\n1) Auto Approve OFF → pending');
  await setAutoApprove(false);
  assert((await getSetting('auto_approve_listings')) === false, 'setting should be false');
  assert(
    (await resolveListingModerationStatus()) === LISTING_STATUS.PENDING,
    'resolve should be pending'
  );
  console.log('   OK resolveListingModerationStatus → pending');

  console.log('\n2) Auto Approve ON → approved');
  await setAutoApprove(true);
  assert((await getSetting('auto_approve_listings')) === true, 'setting should be true');
  assert(
    (await resolveListingModerationStatus()) === LISTING_STATUS.APPROVED,
    'resolve should be approved'
  );
  console.log('   OK resolveListingModerationStatus → approved');

  console.log('\n3) Toggle again without restart (OFF → pending)');
  await setAutoApprove(false);
  assert(
    (await resolveListingModerationStatus()) === LISTING_STATUS.PENDING,
    'toggle-off should be pending'
  );
  console.log('   OK dynamic toggle → pending');

  console.log('\n4) Toggle ON again (approved) + marketplace visibility rules');
  await setAutoApprove(true);
  const status = await resolveListingModerationStatus();
  assert(status === LISTING_STATUS.APPROVED, 'expected approved');
  assert(
    PUBLIC_LISTING_STATUSES.includes(status),
    'approved must be a public marketplace status'
  );
  assert(
    !PUBLIC_LISTING_STATUSES.includes(LISTING_STATUS.PENDING),
    'pending must stay hidden from marketplace'
  );
  console.log('   OK approved is public; pending is not');

  // Restore prior value
  await setAutoApprove(before === true);
  console.log('\n✅ Auto approve resolution checks passed');
  console.log('Restored auto_approve_listings =', await getSetting('auto_approve_listings'));
}

main()
  .catch((err) => {
    console.error('\n❌ Verification failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      invalidateMaintenanceCache();
    } catch {
      // ignore
    }
    await pool.end();
  });
