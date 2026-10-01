'use strict';

/**
 * Run: node --test src/utils/__tests__/auctionDuration.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'auctionDuration.js')).href;
  return import(moduleUrl);
}

describe('auction duration and create sale-type helpers', () => {
  it('defaults to Normal and lists all 13 allowed durations', async () => {
    const {
      DEFAULT_LISTING_SALE_TYPE,
      LISTING_SALE_TYPE,
      AUCTION_DURATION_HOURS,
      DEFAULT_AUCTION_DURATION_HOURS,
      isAllowedAuctionDuration,
      auctionDurationOptions,
    } = await load();
    assert.equal(DEFAULT_LISTING_SALE_TYPE, LISTING_SALE_TYPE.NORMAL);
    assert.equal(DEFAULT_LISTING_SALE_TYPE, 'normal');
    assert.equal(DEFAULT_AUCTION_DURATION_HOURS, 24);
    assert.deepEqual(
      [...AUCTION_DURATION_HOURS],
      [24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168]
    );
    assert.equal(auctionDurationOptions().length, 13);
    for (const hours of AUCTION_DURATION_HOURS) {
      assert.equal(isAllowedAuctionDuration(hours), true);
    }
    assert.equal(isAllowedAuctionDuration(25), false);
    assert.equal(isAllowedAuctionDuration(null), false);
  });

  it('Normal payload omits sale_type and duration_hours', async () => {
    const { buildCreateSaleTypeFields, LISTING_SALE_TYPE } = await load();
    assert.deepEqual(
      buildCreateSaleTypeFields({
        saleType: LISTING_SALE_TYPE.NORMAL,
        durationHours: 48,
      }),
      {}
    );
    assert.deepEqual(buildCreateSaleTypeFields({ saleType: 'normal' }), {});
    assert.deepEqual(buildCreateSaleTypeFields({}), {});
  });

  it('Bid payload sends sale_type and duration_hours, not starting_price', async () => {
    const { buildCreateSaleTypeFields, LISTING_SALE_TYPE, AUCTION_DURATION_HOURS } =
      await load();
    for (const hours of AUCTION_DURATION_HOURS) {
      assert.deepEqual(
        buildCreateSaleTypeFields({
          saleType: LISTING_SALE_TYPE.BID,
          durationHours: hours,
        }),
        { sale_type: 'bid', duration_hours: hours }
      );
    }
    const bidFields = buildCreateSaleTypeFields({
      saleType: 'bid',
      durationHours: 48,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(bidFields, 'starting_price'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(bidFields, 'auction_id'), false);
  });

  it('rejects missing Bid duration and accepts a selected duration', async () => {
    const { bidDurationIssue, LISTING_SALE_TYPE } = await load();
    assert.equal(bidDurationIssue(LISTING_SALE_TYPE.NORMAL, null), null);
    assert.equal(bidDurationIssue(LISTING_SALE_TYPE.BID, null), 'pleaseSelectDuration');
    assert.equal(bidDurationIssue(LISTING_SALE_TYPE.BID, 25), 'pleaseSelectDuration');
    assert.equal(bidDurationIssue(LISTING_SALE_TYPE.BID, 48), null);
  });

  it('maps Bid create error codes to translation keys', async () => {
    const { createListingErrorI18nKey } = await load();
    assert.equal(
      createListingErrorI18nKey({ response: { data: { code: 'INVALID_AUCTION_DURATION' } } }),
      'createListing.invalidAuctionDuration'
    );
    assert.equal(
      createListingErrorI18nKey({ response: { data: { code: 'INVALID_STARTING_PRICE' } } }),
      'createListing.invalidStartingPrice'
    );
    assert.equal(
      createListingErrorI18nKey({ response: { data: { code: 'INVALID_SALE_TYPE' } } }),
      'createListing.invalidSaleType'
    );
    assert.equal(createListingErrorI18nKey({ response: { data: { error: 'nope' } } }), null);
  });
});
