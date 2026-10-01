'use strict';

/**
 * Create Listing Step 3 Normal vs Bid controls.
 * Run: node --test src/screens/CreateListingScreen/createListingSaleType.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SCREEN = path.resolve(__dirname, 'index.js');
const TRANSLATIONS = path.resolve(__dirname, '../../utils/translations.js');

describe('Create Listing sale type (Step 3)', () => {
  const screen = fs.readFileSync(SCREEN, 'utf8');
  const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
  const step3Start = screen.indexOf('{step === 3 && (');
  const step3End = screen.indexOf('{step < TOTAL_STEPS', step3Start);
  const step3 = screen.slice(step3Start, step3End);
  const putStart = screen.indexOf('apiClient.put(');
  const postStart = screen.indexOf('apiClient.post(\n        \'/listings\'');
  const putBlock = screen.slice(putStart, postStart);
  const postBlock = screen.slice(postStart, screen.indexOf('const createdStatus', postStart));

  it('defaults sale type to Normal and keeps duration in session state', () => {
    assert.match(screen, /useState\(DEFAULT_LISTING_SALE_TYPE\)/);
    assert.match(screen, /useState\(null\)/);
    assert.match(screen, /setSaleType\(LISTING_SALE_TYPE\.BID\)/);
    assert.match(screen, /setSaleType\(LISTING_SALE_TYPE\.NORMAL\)/);
    assert.doesNotMatch(screen, /setDurationHours\(null\)/);
  });

  it('shows Bid Duration and helper only for Bid create and hides them in edit mode', () => {
    assert.match(step3, /isBidCreate && \(/);
    assert.match(step3, /createListing\.bidDuration/);
    assert.match(step3, /createListing\.bidCreateHelper/);
    assert.match(step3, /createListing\.bidCreateHelperApproved/);
    assert.match(step3, /information-circle-outline/);
    assert.match(step3, /isEditMode \? null/);
    assert.match(screen, /const isBidCreate = !isEditMode && isBidSaleType\(saleType\)/);
    assert.doesNotMatch(step3, /isEditMode[\s\S]{0,40}createListing\.saleType/);
  });

  it('sends sale_type only on create Bid payloads and keeps edit PUT unchanged', () => {
    assert.match(postBlock, /buildCreateSaleTypeFields\(\{\s*saleType,\s*durationHours/);
    assert.match(postBlock, /price: parseFloat\(formData\.price\)/);
    assert.doesNotMatch(postBlock, /starting_price/);
    assert.doesNotMatch(putBlock, /buildCreateSaleTypeFields/);
    assert.doesNotMatch(putBlock, /sale_type/);
    assert.doesNotMatch(putBlock, /duration_hours/);
  });

  it('validates Bid duration before submit and localizes Bid create error codes', () => {
    assert.match(screen, /bidDurationIssue\(saleType, durationHours\)/);
    assert.match(screen, /createListingErrorI18nKey/);
    assert.match(screen, /createListing\.\$\{durationIssue\}/);
    assert.match(screen, /startingPriceRequired/);
    assert.match(translations, /pleaseSelectDuration:/);
    assert.match(translations, /saleTypeNormal:/);
    assert.match(translations, /saleTypeBid:/);
    assert.match(translations, /startingPrice:/);
    assert.match(translations, /duration1Day:/);
    assert.match(translations, /duration7Days:/);
    assert.match(translations, /invalidAuctionDuration:/);
    assert.match(translations, /listingSubtitleBid:/);
    assert.match(translations, /bidDuration: 'Bid Duration'/);
    assert.match(translations, /bidDuration: 'مدة المزايدة'/);
    assert.match(translations, /saleType: 'How do you want to sell\?'/);
    assert.match(translations, /saleTypeBid: 'Bidding'/);
  });

  it('uses the locked segmented control treatment and dynamic subtitle', () => {
    assert.match(step3, /colors\.primary/);
    assert.match(step3, /colors\.onPrimary/);
    assert.match(screen, /listingSubtitleBid/);
    assert.match(screen, /isBidCreate \? t\('createListing\.startingPrice'\) : t\('createListing\.price'\)/);
    assert.doesNotMatch(step3, /saleTypeSegmentActive/);
    assert.match(screen, /borderRadius: radii\.full/);
  });
});
