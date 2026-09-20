'use strict';

/**
 * TFK-M7 — users queries must not use SELECT * / users.* / RETURNING *.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { CUSTOMER_USER_COLUMNS } = require('./userColumns');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['routes', 'utils', 'middleware'];

function listJsFiles(dir) {
  const full = path.join(BACKEND_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const next = path.join(full, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(path.relative(BACKEND_ROOT, next)));
      continue;
    }
    if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      out.push(next);
    }
  }
  return out;
}

describe('TFK-M7 explicit users column selection', () => {
  const files = SCAN_DIRS.flatMap(listJsFiles);

  it('production code has no SELECT * FROM users', () => {
    const hits = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (/SELECT\s+\*\s+FROM\s+["']?users["']?/i.test(src)) {
        hits.push(path.relative(BACKEND_ROOT, file));
      }
    }
    assert.deepEqual(hits, []);
  });

  it('production code has no users.* / u.* user wildcards', () => {
    const hits = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (/users\.\*/i.test(src) || /\bu\.\*/.test(src)) {
        hits.push(path.relative(BACKEND_ROOT, file));
      }
    }
    assert.deepEqual(hits, []);
  });

  it('users INSERT/UPDATE do not RETURNING *', () => {
    const usersWriteFiles = [
      path.join(BACKEND_ROOT, 'routes', 'user.js'),
      path.join(BACKEND_ROOT, 'routes', 'phoneChange.js'),
      path.join(BACKEND_ROOT, 'utils', 'deactivateUser.js'),
    ];
    for (const file of usersWriteFiles) {
      const src = fs.readFileSync(file, 'utf8');
      assert.equal(/RETURNING\s+\*/.test(src), false, path.relative(BACKEND_ROOT, file));
    }
  });

  it('customer allowlist includes profile fields and omits internal/sensitive ones', () => {
    for (const col of [
      'id',
      'phone_number',
      'first_name',
      'last_name',
      'gender',
      'email',
      'date_of_birth',
      'city',
      'is_verified',
      'is_active',
      'created_at',
      'updated_at',
    ]) {
      assert.equal(CUSTOMER_USER_COLUMNS.includes(col), true, col);
    }

    for (const col of [
      'pending_phone_number',
      'pending_phone_expires_at',
      'deactivation_reason',
      'deactivated_at',
      'push_notifications_enabled',
      'password_hash',
      'otp',
    ]) {
      assert.equal(CUSTOMER_USER_COLUMNS.includes(col), false, col);
    }
  });
});
