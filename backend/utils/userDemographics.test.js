'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  AGE_GROUP_ORDER,
  AGE_GROUPS_SQL,
  GENDER_SQL,
  CITY_SQL,
  ageInYears,
  ageGroupForDob,
  fillAgeGroups,
} = require('./userDemographics');

const ADMIN_REPORTS = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'adminReports.js'),
  'utf8'
);

describe('User demographic age buckets', () => {
  const today = '2026-09-22';

  it('keeps the product bucket order including Unknown', () => {
    assert.deepEqual(AGE_GROUP_ORDER, [
      '18–24',
      '25–34',
      '35–44',
      '45–54',
      '55+',
      'Unknown',
    ]);
  });

  it('treats birthday today as the new age', () => {
    assert.equal(ageInYears('2008-09-22', today), 18);
    assert.equal(ageGroupForDob('2008-09-22', today), '18–24');
    assert.equal(ageInYears('2001-09-22', today), 25);
    assert.equal(ageGroupForDob('2001-09-22', today), '25–34');
    assert.equal(ageInYears('1971-09-22', today), 55);
    assert.equal(ageGroupForDob('1971-09-22', today), '55+');
  });

  it('waits until the birthday to increment age', () => {
    assert.equal(ageInYears('2008-09-23', today), 17);
    assert.equal(ageGroupForDob('2008-09-23', today), 'Unknown');
    assert.equal(ageInYears('2001-09-23', today), 24);
    assert.equal(ageGroupForDob('2001-09-23', today), '18–24');
    assert.equal(ageInYears('1971-09-23', today), 54);
    assert.equal(ageGroupForDob('1971-09-23', today), '45–54');
  });

  it('maps missing or future DOB to Unknown', () => {
    assert.equal(ageGroupForDob(null, today), 'Unknown');
    assert.equal(ageGroupForDob('', today), 'Unknown');
    assert.equal(ageGroupForDob('2027-01-01', today), 'Unknown');
    assert.equal(ageInYears('2027-01-01', today), null);
  });

  it('fillAgeGroups always returns every bucket, zero-filled', () => {
    assert.deepEqual(fillAgeGroups([]), [
      { label: '18–24', count: 0 },
      { label: '25–34', count: 0 },
      { label: '35–44', count: 0 },
      { label: '45–54', count: 0 },
      { label: '55+', count: 0 },
      { label: 'Unknown', count: 0 },
    ]);
    assert.deepEqual(fillAgeGroups([{ label: '25–34', count: 4 }])[1], {
      label: '25–34',
      count: 4,
    });
  });
});

describe('Demographic SQL stays current-user and aggregate-only', () => {
  it('age SQL uses AGE(CURRENT_DATE, date_of_birth) and does not filter by created_at', () => {
    assert.match(AGE_GROUPS_SQL, /AGE\(CURRENT_DATE,\s*date_of_birth\)/);
    assert.doesNotMatch(AGE_GROUPS_SQL, /created_at/);
    assert.doesNotMatch(AGE_GROUPS_SQL, /first_name|phone_number|email/);
  });

  it('gender and city SQL aggregate labels only and do not use listing dates', () => {
    assert.match(GENDER_SQL, /FROM users/);
    assert.match(CITY_SQL, /FROM users/);
    assert.doesNotMatch(GENDER_SQL, /created_at/);
    assert.doesNotMatch(CITY_SQL, /created_at/);
    assert.match(CITY_SQL, /ORDER BY count DESC/);
  });

  it('reports router exposes /demographics without using the charts days filter', () => {
    assert.match(ADMIN_REPORTS, /router\.get\('\/demographics'/);
    const chartsStart = ADMIN_REPORTS.indexOf("router.get('/charts'");
    const demoStart = ADMIN_REPORTS.indexOf("router.get('/demographics'");
    assert.ok(chartsStart >= 0 && demoStart >= 0);
    const chartsFn = ADMIN_REPORTS.slice(chartsStart, demoStart);
    assert.doesNotMatch(chartsFn, /ageGroups|userAgeGroups|AGE_GROUPS_SQL/);
    const demoFn = ADMIN_REPORTS.slice(demoStart, ADMIN_REPORTS.indexOf("router.get('/export'"));
    assert.doesNotMatch(demoFn, /parseDays|req\.query\.days/);
    assert.match(demoFn, /AGE_GROUPS_SQL/);
    assert.match(demoFn, /GENDER_SQL/);
    assert.match(demoFn, /CITY_SQL/);
    assert.match(demoFn, /fillAgeGroups/);
  });
});
