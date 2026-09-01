# Telefonak Security Tests

Safe, local-only security regression harness for the Express API.

## Requirements

1. Backend running locally (`npm run dev` in `backend/`)
2. PostgreSQL with seed/fixture data (at least 2 users, 1 approved listing)
3. Node 18+ (uses built-in `node:test` and `fetch`)

## Run

```bash
cd backend
npm run test:security
```

Optional:

```bash
SECURITY_TEST_API_URL=http://127.0.0.1:3000 npm run test:security
```

## What this does / does not do

**Does:**
- Hit localhost API for authz, IDOR, privacy, uploads, validation, rate limits
- Document known vulnerabilities as failing assertions (baseline)
- Write `BASELINE.md` after each run

**Does not:**
- Attack production or third-party hosts
- Print JWTs, OTPs, or passwords
- Delete production data

## Suites

| File | Covers |
|------|--------|
| `01-auth-boundaries` | Customer vs admin token separation |
| `02-listings-privacy` | SEC-001 marketplace seller contact + private field checks |
| `03-idor-listings` | Listing ownership |
| `04-idor-offers` | Offer accept/reject/seen |
| `05-idor-favorites` | Favorites auth |
| `06-idor-notifications` | Notification ownership |
| `07-admin-boundaries` | Admin gate + SEC-005 baseline |
| `08-uploads` | Upload auth + SEC-016 magic bytes |
| `09-input-validation` | Offer/OTP/listing validation |
| `10-rate-limiting` | OTP IP limiter |
| `11-listing-image-refs` | SEC-002 image URL ownership |
| `12-customer-auth` | Phase 3 JWT/OTP/refresh/logout |

## Interpreting failures

- **SEC-001** is an intentional product rule (seller phone on public listing detail), not a vulnerability
- **SEC-016** and **SEC-002** should **pass** after Phase 2
- **Phase 3** auth suites (01 + 12) should pass after customer auth hardening
- Other failures are unexpected and should be investigated
