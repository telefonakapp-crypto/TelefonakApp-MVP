'use strict';

/**
 * Run: node mobile/src/utils/__tests__/notificationDisplay.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'notificationDisplay.js')
  ).href;
  const translationsUrl = pathToFileURL(
    path.join(__dirname, '..', 'translations.js')
  ).href;
  const { formatNotificationTime, localizeNotification } = await import(moduleUrl);
  const { translations } = await import(translationsUrl);

  function tFor(lang) {
    return (keyPath) => {
      const keys = keyPath.split('.');
      let value = translations[lang];
      for (const key of keys) {
        value = value?.[key];
      }
      return typeof value === 'string' ? value : keyPath;
    };
  }

  const afternoon = new Date(2026, 8, 1, 17, 41, 0);
  const morning = new Date(2026, 8, 1, 9, 5, 0);
  const mid = new Date(2026, 8, 1, 15, 24, 0);
  assert.equal(formatNotificationTime(afternoon, 'ar'), '17:41');
  assert.equal(formatNotificationTime(morning, 'ar'), '09:05');
  assert.equal(formatNotificationTime(mid, 'ar'), '15:24');
  assert.equal(formatNotificationTime(afternoon, 'ar').includes('م'), false);
  assert.equal(formatNotificationTime(afternoon, 'ar').includes('ص'), false);

  const approved = {
    type: 'listing_approved',
    title: 'Listing Approved',
    message: 'Your listing "Apple iPhone 16" has been approved and is now live.',
  };
  const en = localizeNotification(approved, tFor('en'), 'en');
  assert.equal(en.title, 'Listing Approved');
  assert.equal(en.message, approved.message);

  const ar = localizeNotification(approved, tFor('ar'), 'ar');
  assert.equal(ar.title, 'تمت الموافقة على الإعلان');
  assert.equal(ar.message.includes('Apple iPhone 16'), true);
  assert.equal(/[A-Za-z]{4,}/.test(ar.title), false);

  const hidden = {
    type: 'listing_hidden',
    title: 'Listing Hidden',
    message:
      'Your listing "Apple Watch Series 2" has been hidden and is no longer visible to buyers.',
  };
  const hiddenAr = localizeNotification(hidden, tFor('ar'), 'ar');
  assert.equal(hiddenAr.title, 'تم إخفاء الإعلان');
  assert.equal(hiddenAr.message.includes('Listing Hidden'), false);

  const submitted = {
    type: 'listing_submitted',
    title: 'Listing Submitted',
    message:
      'Your listing "Apple iPhone 16" has been submitted and is awaiting approval.',
  };
  const submittedAr = localizeNotification(submitted, tFor('ar'), 'ar');
  assert.equal(submittedAr.title, 'تم إرسال الإعلان');
  assert.equal(submittedAr.message.includes('بانتظار الموافقة'), true);

  const rejected = {
    type: 'listing_rejected',
    title: 'Listing Rejected',
    message: 'Your listing "Apple iPhone 16" was rejected. Reason: Photos are unclear.',
  };
  const rejectedAr = localizeNotification(rejected, tFor('ar'), 'ar');
  assert.equal(rejectedAr.title, 'تم رفض الإعلان');
  assert.equal(rejectedAr.message.includes('السبب: Photos are unclear'), true);
  assert.equal(rejectedAr.message.includes('Listing Rejected'), false);

  const offer = {
    type: 'offer_received',
    title: 'New Offer',
    message:
      'You received an offer of 150 JOD for your listing "Apple iPhone 16".',
  };
  const offerAr = localizeNotification(offer, tFor('ar'), 'ar');
  assert.equal(offerAr.title, 'عرض جديد');
  assert.equal(offerAr.message.includes('150'), true);
  assert.equal(offerAr.message.includes('New Offer'), false);

  const englishTime = formatNotificationTime(afternoon, 'en');
  assert.equal(
    englishTime,
    afternoon.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );

  console.log('notificationDisplay: cases passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
