'use strict';

/**
 * Run: node mobile/src/utils/__tests__/dateUtils.test.js
 */
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const DATES = ['1999-12-25', '1999-12-23', '2000-02-29', '2001-01-01', '1970-12-31'];
const ZONES = ['Asia/Amman', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC'];

async function loadUtils() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'dateUtils.js')).href;
  return import(moduleUrl);
}

async function runInCurrentTz() {
  const {
    formatPickerDateYYYYMMDD,
    parsePickerDateYYYYMMDD,
    toCalendarDateYYYYMMDD,
    calendarDateAtLocalNoon,
  } = await loadUtils();

  for (const iso of DATES) {
    const [y, m, d] = iso.split('-').map(Number);
    const fromComponents = calendarDateAtLocalNoon(y, m, d);
    assert.equal(
      formatPickerDateYYYYMMDD(fromComponents),
      iso,
      `local noon of ${iso} must format back to ${iso}`
    );

    const parsed = parsePickerDateYYYYMMDD(iso);
    assert.equal(parsed.getFullYear(), y);
    assert.equal(parsed.getMonth() + 1, m);
    assert.equal(parsed.getDate(), d);
    assert.equal(parsed.getHours(), 12);
    assert.equal(formatPickerDateYYYYMMDD(parsed), iso);
    assert.equal(formatPickerDateYYYYMMDD(parsePickerDateYYYYMMDD(iso)), iso);
  }

  assert.equal(toCalendarDateYYYYMMDD('1999-12-25'), '1999-12-25');
  assert.equal(toCalendarDateYYYYMMDD('1999-12-25T00:00:00.000Z'), '1999-12-25');
  assert.equal(toCalendarDateYYYYMMDD(null), '');

  // The bug: Date.UTC + getUTCDate disagrees with a local picker in western zones.
  // Our helpers must not follow that path.
  const utcMidnight = new Date(Date.UTC(1999, 11, 26));
  const screenshotBug = `${utcMidnight.getUTCFullYear()}-${String(utcMidnight.getUTCMonth() + 1).padStart(2, '0')}-${String(utcMidnight.getUTCDate()).padStart(2, '0')}`;
  assert.equal(screenshotBug, '1999-12-26');
  const pickerWouldShow = `${utcMidnight.getFullYear()}-${String(utcMidnight.getMonth() + 1).padStart(2, '0')}-${String(utcMidnight.getDate()).padStart(2, '0')}`;
  if (new Date().getTimezoneOffset() > 0) {
    // Picker in local TZ shows 25, UTC format shows 26 — the reported screenshot.
    assert.equal(pickerWouldShow, '1999-12-25');
    assert.notEqual(formatPickerDateYYYYMMDD(utcMidnight), '1999-12-26');
  }
  assert.equal(formatPickerDateYYYYMMDD(calendarDateAtLocalNoon(1999, 12, 25)), '1999-12-25');
  assert.equal(formatPickerDateYYYYMMDD(parsePickerDateYYYYMMDD('1999-12-25')), '1999-12-25');

  console.log(`  OK in ${process.env.TZ || 'host TZ'}`);
}

function runInZones() {
  const script = path.join(__dirname, 'dateUtils.test.js');
  for (const tz of ZONES) {
    const result = spawnSync(process.execPath, [script, '--in-zone'], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(
        `Failed under TZ=${tz}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );
    }
    process.stdout.write(result.stdout);
  }
}

async function main() {
  if (process.argv.includes('--in-zone')) {
    await runInCurrentTz();
    return;
  }

  console.log('dateUtils calendar-day round trips');
  runInZones();
  console.log('ALL PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
