/**
 * Telefonak Phase 0 — Security regression harness
 *
 * Usage (from backend/):
 *   npm run test:security
 *
 * Requires a running local API (default http://127.0.0.1:3000) and DB fixtures.
 * Does NOT modify production data destructively.
 * Does NOT print secrets / OTPs / JWTs.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SUITES_DIR = path.join(ROOT, 'suites');
const BASELINE_PATH = path.join(ROOT, 'BASELINE.md');

async function preflight() {
  const origin = (process.env.SECURITY_TEST_API_URL || 'http://127.0.0.1:3000').replace(
    /\/+$/,
    ''
  );
  try {
    const res = await fetch(`${origin}/api/health`);
    if (!res.ok) {
      throw new Error(`health returned ${res.status}`);
    }
  } catch (error) {
    console.error(`\n[security-tests] API not reachable at ${origin}/api/health`);
    console.error('Start the backend first: cd backend && npm run dev\n');
    console.error(error.message);
    process.exit(2);
  }
}

function runNodeTest() {
  return new Promise((resolve) => {
    const suiteFiles = fs
      .readdirSync(SUITES_DIR)
      .filter((name) => name.endsWith('.test.js'))
      .sort()
      .map((name) => path.join(SUITES_DIR, name));

    if (suiteFiles.length === 0) {
      console.error('No suite files found');
      process.exit(1);
    }

    const child = spawn(
      process.execPath,
      [
        '--test',
        '--test-concurrency=1',
        '--test-reporter=spec',
        ...suiteFiles,
      ],
      {
        cwd: path.join(ROOT, '..'),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseResults(stdout) {
  const pass = [...stdout.matchAll(/^\s*✔\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((name) => !/^\d+\s—/.test(name) && name !== 'Teardown');
  const fail = [...stdout.matchAll(/^\s*✖\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((name) => !/^\d+\s—/.test(name));

  const tests = Number((stdout.match(/ℹ tests (\d+)/) || [])[1] || 0);
  const passed = Number((stdout.match(/ℹ pass (\d+)/) || [])[1] || 0);
  const failed = Number((stdout.match(/ℹ fail (\d+)/) || [])[1] || 0);
  const skipped = Number((stdout.match(/ℹ skipped (\d+)/) || [])[1] || 0);

  return {
    pass,
    fail,
    skip: [],
    summary: { tests, passed, failed, skipped },
  };
}

function writeBaseline({ code, stdout, parsed }) {
  const now = new Date().toISOString();
  const knownVulnerable = [
    // Phase 2 closed SEC-016 and SEC-002. Remaining items belong to later phases.
  ];

  const s = parsed.summary;
  const body = `# Telefonak Security Test Baseline

Generated: ${now}

## Purpose

Security regression results after hardening phases.
Failing tests that assert *desired* secure behavior document remaining vulnerabilities.

## How to run

\`\`\`bash
cd backend
npm run test:security
\`\`\`

Requires local API on \`SECURITY_TEST_API_URL\` (default \`http://127.0.0.1:3000\`).

## Run result

- Exit code: **${code}**
- Tests: **${s.tests}**
- Passed: **${s.passed}**
- Failed: **${s.failed}**
- Skipped: **${s.skipped}**

## Product decisions (not vulnerabilities)

- **SEC-001** — Seller phone numbers are **intentionally public contact information** on marketplace listings. \`GET /api/listings/:id\` exposes \`phone_number\` as part of the public listing contact information so any viewer can use Call Seller without submitting an offer. Other private account fields (email, pending phone, auth data, etc.) must **not** leak via listing endpoints. List/search endpoints (\`GET /api/listings\`, favorites) do not include seller phone — detail view only.

## Fixed in Phase 2

- **SEC-016** — Upload endpoint validates JPEG/PNG/WebP **magic bytes**; fake files with spoofed extension/MIME are rejected.
- **SEC-002** — Listing create/edit only accepts image URLs that are owned Telefonak \`listing-*\` uploads (or already attached to the listing / seller's listings). External and fabricated URLs are rejected.

## Fixed in Phase 3

- **SEC-003** — Mobile stores access/refresh tokens in SecureStore (AsyncStorage migrated away).
- **SEC-006 / SEC-012** — Short-lived customer access JWT + rotating hashed refresh sessions with logout revocation.
- **SEC-008** — OTP never returned when \`NODE_ENV=production\`.
- **SEC-013** — Separate customer/admin JWT secrets (\`JWT_CUSTOMER_SECRET\` / \`JWT_ADMIN_SECRET\`) with distinct iss/aud.
- **SEC-014** — OTP codes stored as HMAC-SHA256 digests, not plaintext.

## Remaining known failures (expected until later phases)

${
  knownVulnerable.length
    ? knownVulnerable
        .map(
          (item) =>
            `- **${item.id}** — ${item.title} (until ${item.expectedUntil})${item.note ? ` — ${item.note}` : ''}`
        )
        .join('\n')
    : '_None tracked for Phase 2 scope._'
}

## Failed assertions (this run)

${
  parsed.fail.length
    ? parsed.fail.map((name) => `- ${name}`).join('\n')
    : '_None_'
}

## Passed assertions (leaf tests)

${
  parsed.pass.length
    ? parsed.pass.map((name) => `- ${name}`).join('\n')
    : '_None_'
}

## Raw reporter summary

\`\`\`
${stdout
  .split('\n')
  .filter((line) => line.includes('ℹ ') || line.startsWith('✖ failing'))
  .join('\n')}
\`\`\`
`;

  fs.writeFileSync(BASELINE_PATH, body, 'utf8');
  console.log(`\n[security-tests] Wrote ${BASELINE_PATH}`);
  console.log(
    `[security-tests] Summary: ${s.passed} passed, ${s.failed} failed, ${s.tests} total (exit ${code})`
  );
}

(async () => {
  await preflight();
  const { code, stdout } = await runNodeTest();
  const parsed = parseResults(stdout);
  writeBaseline({ code, stdout, parsed });
  process.exit(code);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
