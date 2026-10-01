'use strict';

/**
 * Run: node --test src/utils/__tests__/auctionCountdown.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'auctionCountdown.js')).href;
  return import(moduleUrl);
}

describe('auctionCountdown', () => {
  it('future ends_at returns positive remaining time', async () => {
    const { remainingMs, countdownFromEndsAt } = await load();
    const now = Date.parse('2026-06-01T12:00:00.000Z');
    const ends = '2026-06-01T12:00:10.000Z';
    assert.equal(remainingMs(ends, now), 10000);
    const countdown = countdownFromEndsAt(ends, now);
    assert.equal(countdown.expired, false);
    assert.equal(countdown.seconds, 10);
    assert.equal(countdown.label, '0m 10s');
  });

  it('past ends_at returns zero/expired and never negative', async () => {
    const { remainingMs, formatCountdownParts, formatCountdownLabel } = await load();
    const now = Date.parse('2026-06-01T12:00:00.000Z');
    const ends = '2026-06-01T11:59:50.000Z';
    assert.equal(remainingMs(ends, now), 0);
    const parts = formatCountdownParts(-5000);
    assert.equal(parts.expired, true);
    assert.equal(parts.seconds, 0);
    assert.equal(formatCountdownLabel(parts), '0m 00s');
  });

  it('invalid ends_at is handled safely', async () => {
    const { parseAuctionEndsAtMs, remainingMs, countdownFromEndsAt } = await load();
    assert.equal(parseAuctionEndsAtMs(null), null);
    assert.equal(parseAuctionEndsAtMs('not-a-date'), null);
    assert.equal(remainingMs('not-a-date', Date.now()), null);
    const countdown = countdownFromEndsAt(undefined, Date.now());
    assert.equal(countdown.valid, false);
    assert.equal(countdown.label, '');
  });

  it('formatting is deterministic across second/minute/hour/day', async () => {
    const { formatCountdownParts, formatCountdownLabel } = await load();
    assert.equal(
      formatCountdownLabel(formatCountdownParts(1000)),
      '0m 01s'
    );
    assert.equal(
      formatCountdownLabel(formatCountdownParts(61 * 1000)),
      '1m 01s'
    );
    assert.equal(
      formatCountdownLabel(formatCountdownParts((2 * 3600 + 3 * 60 + 4) * 1000)),
      '2h 03m 04s'
    );
    assert.equal(
      formatCountdownLabel(formatCountdownParts((2 * 86400 + 5 * 3600 + 6 * 60) * 1000)),
      '2d 5h 6m'
    );
    const { formatCountdownClock } = await load();
    assert.equal(formatCountdownClock(formatCountdownParts((1 * 3600 + 24 * 60 + 32) * 1000)), '01:24:32');
    assert.equal(formatCountdownClock(formatCountdownParts(10 * 1000)), '00:00:10');
  });

  it('UTC/ISO timestamps are interpreted correctly', async () => {
    const { remainingMs } = await load();
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    assert.equal(remainingMs('2026-01-01T00:00:01.000Z', now), 1000);
    assert.equal(remainingMs('2026-01-01T00:00:00.000+00:00', now), 0);
  });
});
