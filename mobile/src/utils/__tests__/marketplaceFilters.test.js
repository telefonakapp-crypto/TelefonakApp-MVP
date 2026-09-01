'use strict';

/**
 * Run: node mobile/src/utils/__tests__/marketplaceFilters.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const moduleUrl = pathToFileURL(
    path.join(__dirname, '..', 'marketplaceFilters.js')
  ).href;
  const {
    formatListingLocation,
    localizedPlaceName,
    listingAreaText,
    composeListingLocation,
    parseManualAreaFromLocation,
  } = await import(moduleUrl);

  assert.equal(
    localizedPlaceName({ name_en: 'Amman', name_ar: 'عمان' }, 'en'),
    'Amman'
  );
  assert.equal(
    localizedPlaceName({ name_en: 'Amman', name_ar: 'عمان' }, 'ar'),
    'عمان'
  );

  const listing = {
    location: 'عمان',
    city_name_en: 'Amman',
    city_name_ar: 'عمان',
    area_name_en: 'Abdoun',
    area_name_ar: 'عبدون',
  };

  assert.equal(formatListingLocation(listing, 'en'), 'Abdoun, Amman');
  assert.equal(formatListingLocation(listing, 'ar'), 'عبدون, عمان');
  assert.equal(
    formatListingLocation(
      { location: 'عمان', city_name_en: 'Amman', city_name_ar: 'عمان' },
      'en'
    ),
    'Amman'
  );
  assert.equal(
    formatListingLocation({ location: 'عمان' }, 'en'),
    'عمان'
  );

  const freeText = {
    location: 'Sweifieh, Amman',
    city_name_en: 'Amman',
    city_name_ar: 'عمان',
  };
  assert.equal(formatListingLocation(freeText, 'en'), 'Sweifieh, Amman');
  assert.equal(formatListingLocation(freeText, 'ar'), 'Sweifieh, عمان');
  assert.equal(parseManualAreaFromLocation(freeText), 'Sweifieh');
  assert.equal(listingAreaText(freeText, 'en'), 'Sweifieh');
  assert.equal(
    listingAreaText(
      { location: 'Amman', city_name_en: 'Amman', city_name_ar: 'عمان' },
      'en'
    ),
    ''
  );
  assert.equal(listingAreaText(listing, 'en'), 'Abdoun');
  assert.equal(listingAreaText(listing, 'ar'), 'عبدون');
  assert.equal(composeListingLocation('Sweifieh', 'Amman'), 'Sweifieh, Amman');
  assert.equal(composeListingLocation('', 'Amman'), 'Amman');
  assert.equal(composeListingLocation('Sweifieh', ''), 'Sweifieh');
  assert.equal(composeListingLocation('  ', ''), null);

  console.log('marketplaceFilters location: cases passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
