'use strict';

/**
 * TFK-M8 — customer listing mutations must scope UPDATE/snapshot SQL to user_id.
 * Isolated source tests (no database, no live API, no fixture mutations).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const LISTINGS_ROUTE = path.join(BACKEND_ROOT, 'routes', 'listings.js');
const FREEZE_UTIL = path.join(BACKEND_ROOT, 'utils', 'listingModerationEvents.js');

function extractTemplateStatements(source, startMarker) {
  const statements = [];
  let from = 0;
  while (from < source.length) {
    const marker = source.indexOf(startMarker, from);
    if (marker === -1) break;
    const open = source.lastIndexOf('`', marker);
    const close = source.indexOf('`', marker);
    if (open === -1 || close === -1) break;
    statements.push(source.slice(open + 1, close));
    from = close + 1;
  }
  return statements;
}

function whereClause(sql) {
  const match = sql.match(/\bWHERE\b[\s\S]*/i);
  return match ? match[0] : '';
}

describe('TFK-M8 customer listing UPDATE ownership SQL', () => {
  const listingsSrc = fs.readFileSync(LISTINGS_ROUTE, 'utf8');
  const freezeSrc = fs.readFileSync(FREEZE_UTIL, 'utf8');
  const listingUpdates = extractTemplateStatements(listingsSrc, 'UPDATE listings');

  it('customer listings.js has owner-scoped UPDATE listings statements', () => {
    assert.equal(listingUpdates.length, 7);
    for (const sql of listingUpdates) {
      const where = whereClause(sql);
      assert.match(where, /\bid\s*=\s*\$\d+/);
      assert.match(where, /\buser_id\s*=\s*\$\d+/);
      assert.doesNotMatch(sql, /\$\{/);
      assert.doesNotMatch(where, /user_id\s*=\s*'?\s*\+|user_id\s*=\s*`/);
    }
  });

  it('mark-sold UPDATE is parameterized with id, user_id, and status', () => {
    const sold = listingUpdates.find((sql) => /status\s*=\s*\$1/i.test(sql) && /RETURNING \*/.test(sql));
    assert.ok(sold, 'expected mark-sold UPDATE');
    assert.match(whereClause(sold), /id = \$2 AND user_id = \$3 AND status = \$4/);
  });

  it('hide/unhide and delete UPDATEs already/now include user_id', () => {
    const visibility = listingUpdates.filter((sql) =>
      /id = \$2 AND user_id = \$3 AND status/.test(whereClause(sql))
    );
    assert.ok(visibility.length >= 2);
  });

  it('seller edit UPDATE branches include user_id next to id', () => {
    const edits = listingUpdates.filter((sql) => /model_id\s*=\s*\$1/.test(sql));
    assert.equal(edits.length, 4);
    for (const sql of edits) {
      assert.match(whereClause(sql), /id = \$\d+ AND user_id = \$\d+/);
    }
  });

  it('freezeCurrentListingRevision snapshot SELECT is owner-scoped', () => {
    assert.match(
      freezeSrc,
      /FROM listings\s+WHERE id = \$1 AND user_id = \$2/
    );
    assert.match(listingsSrc, /freezeCurrentListingRevision\(client, parseInt\(id, 10\), userId\)/);
  });

  it('non-owner still hits the existing JS 403 checks before SQL', () => {
    assert.match(listingsSrc, /Not authorized to mark this listing as sold/);
    assert.match(listingsSrc, /Not authorized to edit this listing/);
    assert.match(listingsSrc, /Not authorized to change this listing/);
    assert.match(listingsSrc, /Not authorized to delete this listing/);
    assert.match(listingsSrc, /if \(checkResult\.rows\[0\]\.user_id !== userId\)/);
    assert.match(listingsSrc, /if \(existing\.rows\[0\]\.user_id !== userId\)/);
  });

  it('customer mutations remain parameterized (no string-concatenated IDs)', () => {
    for (const sql of listingUpdates) {
      assert.doesNotMatch(sql, /\$\{id\}|\$\{userId\}|\$\{listingId\}/);
    }
    assert.doesNotMatch(
      freezeSrc.slice(freezeSrc.indexOf('async function freezeCurrentListingRevision')),
      /\$\{listingId\}|\$\{userId\}/
    );
  });
});
