# Telefonak Security Test Baseline

Generated: 2026-09-01T23:26:51.956Z

## Purpose

Security regression results after hardening phases.
Failing tests that assert *desired* secure behavior document remaining vulnerabilities.

## How to run

```bash
cd backend
npm run test:security
```

Requires local API on `SECURITY_TEST_API_URL` (default `http://127.0.0.1:3000`).

## Run result

- Exit code: **0**
- Tests: **201**
- Passed: **201**
- Failed: **0**
- Skipped: **0**

## Product decisions (not vulnerabilities)

- **SEC-001** — Seller phone numbers are **intentionally public contact information** on marketplace listings. `GET /api/listings/:id` exposes `phone_number` as part of the public listing contact information so any viewer can use Call Seller without submitting an offer. Other private account fields (email, pending phone, auth data, etc.) must **not** leak via listing endpoints. List/search endpoints (`GET /api/listings`, favorites) do not include seller phone — detail view only.

## Fixed in Phase 2

- **SEC-016** — Upload endpoint validates JPEG/PNG/WebP **magic bytes**; fake files with spoofed extension/MIME are rejected.
- **SEC-002** — Listing create/edit only accepts image URLs that are owned Telefonak `listing-*` uploads (or already attached to the listing / seller's listings). External and fabricated URLs are rejected.

## Fixed in Phase 3

- **SEC-003** — Mobile stores access/refresh tokens in SecureStore (AsyncStorage migrated away).
- **SEC-006 / SEC-012** — Short-lived customer access JWT + rotating hashed refresh sessions with logout revocation.
- **SEC-008** — OTP never returned when `NODE_ENV=production`.
- **SEC-013** — Separate customer/admin JWT secrets (`JWT_CUSTOMER_SECRET` / `JWT_ADMIN_SECRET`) with distinct iss/aud.
- **SEC-014** — OTP codes stored as HMAC-SHA256 digests, not plaintext.

## Remaining known failures (expected until later phases)

_None tracked for Phase 2 scope._

## Failed assertions (this run)

_None_

## Passed assertions (leaf tests)

- rejects missing bearer token on /user/profile (12.946834ms)
- rejects admin JWT on customer /user/profile (3.803083ms)
- rejects customer JWT on /admin/dashboard (1.077667ms)
- rejects unauthenticated access to /admin/users (0.673292ms)
- rejects unauthenticated access to /admin/reports/overview (0.616708ms)
- allows customer JWT to access own /user/profile (2.116166ms)
- GET /listings/:id guest on public listing includes seller phone (Call Seller) (44.875292ms)
- GET /listings/:id unrelated authenticated user includes seller phone (10.2335ms)
- GET /listings/:id buyer with pending offer includes seller phone (0.104458ms)
- GET /listings/:id buyer with accepted offer includes seller phone (0.058458ms)
- GET /listings/:id listing owner includes seller phone (8.104875ms)
- GET /listings search does not expose seller phone (list cards only) (73.157875ms)
- GET /favorites does not expose seller phone (list cards only) (21.717083ms)
- GET /offers/sent exposes seller phone only when offer is accepted (1.604791ms)
- GET /user/profile returns only authenticated user own profile (1.024208ms)
- non-owner cannot delete another user listing (15.323833ms)
- non-owner cannot mark another user listing sold (2.582792ms)
- non-owner cannot hide another user listing (1.140917ms)
- unauthenticated cannot delete listing (0.576583ms)
- non-seller cannot accept an offer (28.695417ms)
- non-seller cannot reject an offer (2.8565ms)
- buyer cannot mark seller offer as seen (1.096084ms)
- received offers only return for authenticated seller scope (4.501625ms)
- sent offers only return for authenticated buyer scope (1.47525ms)
- unauthenticated cannot list received offers (0.423375ms)
- unauthenticated cannot list favorites (20.899291ms)
- favorites list is scoped to authenticated user (49.867083ms)
- cannot favorite without auth (1.275042ms)
- unauthenticated cannot list notifications (20.514417ms)
- user cannot mark another user notification as read (6.149334ms)
- notifications list only returns own user_id rows (1.817583ms)
- customer cannot approve listings via admin API (15.072083ms)
- customer cannot access admin moderation history (2.217333ms)
- customer cannot access admin audit logs (0.718875ms)
- unauthenticated cannot access admin dashboard (0.4935ms)
- viewer-role token is accepted by verifyAdminAuth (RBAC not yet enforced — baseline) (17.600292ms)
- rejects upload without auth (23.719458ms)
- accepts a small valid JPEG with auth (6.771583ms)
- accepts a small valid PNG with auth (1.576042ms)
- accepts a small valid WebP with auth (1.44575ms)
- rejects non-image extension even if named oddly (0.964292ms)
- rejects fake image/jpeg MIME with .jpg name but non-image bytes (SEC-016) (1.035125ms)
- rejects fake PNG content (1.128708ms)
- rejects fake WebP content (1.364125ms)
- rejects JPEG bytes with wrong .png extension (1.128416ms)
- rejects JPEG bytes labeled as image/png with .jpg name (wrong MIME) (1.160334ms)
- rejects oversized file over 5MB (6.059125ms)
- rejects path-traversal style original filename (1.445917ms)
- accepts up to 10 images in one upload (37.616875ms)
- rejects 11 images in one upload (2.72325ms)
- rejects offer with non-positive price (23.269333ms)
- rejects offer on own listing (5.029416ms)
- rejects invalid phone on OTP request (1.126541ms)
- rejects malformed listing id (3.991333ms)
- OTP request limiter returns 429 after burst from same IP (34.331459ms)
- unauthenticated upload limiter still requires auth first (401 before rate limit) (1.27375ms)
- owner can create listing with own uploaded image (50.644459ms)
- rejects external image URL on create (1.225208ms)
- rejects fabricated internal /uploads path (2.69575ms)
- rejects path-traversal image reference (0.873042ms)
- rejects another user uploaded image reference (3.151375ms)
- accepts 1, 5, and 10 owned images; rejects 11 (49.37275ms)
- edit rejects attaching another users image to own listing (9.508917ms)
- rejects expired customer JWT (19.486ms)
- rejects invalid JWT signature (1.640833ms)
- customer token is rejected by admin routes (separate secrets / claims) (0.852625ms)
- admin token is rejected by customer routes (0.78075ms)
- customer JWT signed with admin secret is rejected on customer routes (0.598542ms)
- issues refresh session and rotates successfully (14.548ms)
- logout revokes refresh token (2.375084ms)
- OTP is never exposed when production mode is active (0.062875ms)
- OTP stored in DB is hashed, not plaintext (4.031667ms)
- OTP cannot be reused after successful verification (4.355542ms)
- OTP request remains rate limited under burst (2.189084ms)
- verifyCustomerToken rejects admin-shaped tokens (0.54325ms)
- does not log tokens in rotateRefreshSession errors (smoke) (0.910375ms)
- smartwatches category exists and is active (1.092625ms)
- Apple, Samsung, and Huawei exist under Smartwatches (2.898958ms)
- Apple has all expected smartwatch models in catalog order (0.934333ms)
- Samsung has all expected smartwatch models in catalog order (0.5385ms)
- Huawei has all expected smartwatch models in catalog order (0.845458ms)
- has no duplicate brand/model relationships (0.877459ms)
- key 2025/2026 models resolve through the catalog (1.190458ms)
- phone brand/model data remains in the phones category (3.319458ms)
- re-running the seed is idempotent (30.907083ms)
- API returns smartwatch brands for the Smartwatches category (21.83ms)
- API returns Apple Watch models for Smartwatches → Apple, not iPhones (1.701541ms)
- API returns Samsung watch models for Smartwatches → Samsung, not phones (0.917334ms)
- API returns Huawei watch models for Smartwatches → Huawei, not phones (0.886417ms)
- API does not return smartwatch models when Phones is selected (2.582042ms)
- schema tables and listing columns exist (13.019459ms)
- shared connectivity vocabulary is seeded (1.164334ms)
- accepts a model_watch_case_sizes row for a smartwatch model (1.955042ms)
- rejects duplicate (model_id, case_size_id) (1.139291ms)
- accepts a model_watch_connectivities row for a smartwatch model (7.161167ms)
- rejects duplicate (model_id, connectivity_id) (1.175125ms)
- existing phone listings keep storage_id and NULL watch attribute FKs (9.907792ms)
- listings.storage_id can be NULL (9.890459ms)
- compound FK rejects a case size belonging to a different model (2.880542ms)
- existing model_storage and model_color unique constraints remain intact (1.495709ms)
- phone and smartwatch catalog counts are unchanged by Phase 2A (4.170584ms)
- cleans up Phase 2A test junctions without touching catalog data (3.163167ms)
- existing smartwatch model returns 200 watch-options (8.743667ms)
- watch-options storages and colors belong only to that model (4.695042ms)
- nonexistent model watch-options returns 404 (0.654792ms)
- phone model does not return smartwatch options (0.82375ms)
- watch without size fails (3.758ms)
- watch without connectivity fails (1.602834ms)
- watch without color fails (1.896958ms)
- watch with SIM configuration fails (1.404916ms)
- watch with another models size fails (1.854084ms)
- watch with another models connectivity fails (3.102875ms)
- watch with another models color fails (2.217125ms)
- watch with another models storage fails (2.996458ms)
- phone without storage still fails (1.326041ms)
- phone without color still fails (1.46975ms)
- phone without SIM still fails (1.247792ms)
- valid phone listing create remains unchanged (19.093375ms)
- watch listing can be created without storage when model has none (13.381375ms)
- watch edit validates size (10.331333ms)
- watch edit validates connectivity (13.738709ms)
- watch edit validates color (9.045459ms)
- watch edit rejects SIM (7.9625ms)
- changing model revalidates existing attributes (7.496833ms)
- watch listing with NULL storage is not hidden by GET /listings (20.062125ms)
- model_watch_case_size_id filter works (22.967833ms)
- model_watch_connectivity_id filter works (23.74575ms)
- phone listings are not affected by watch filters (31.665ms)
- existing phone storage filtering still works (14.643791ms)
- watch response contains case size and connectivity and no phone SIM (8.741792ms)
- phone response retains existing fields and null watch attributes (2.662ms)
- placeholder catalog rows remain unchanged after Phase 2B tests (8.836292ms)
- Apple Watch Series 8 has exactly 41mm and 45mm (30.405958ms)
- Apple Watch Series 8 has GPS and GPS + Cellular (5.071833ms)
- Apple Watch Series 8 has 32 GB (1.819792ms)
- Apple Watch Series 8 does not have 16 GB or 64 GB (4.313709ms)
- Apple Watch Series 8 does not have generic Black or White (1.612167ms)
- Samsung Galaxy Watch8 has only its official sizes (2.72575ms)
- Samsung Galaxy Watch8 has only its official connectivity options (1.471833ms)
- Huawei WATCH 5 has manufacturer-backed attributes (0.999333ms)
- no phone model receives watch sizes (1.804ms)
- no phone model receives watch connectivity (1.344875ms)
- no smartwatch model receives SIM configurations (5.787792ms)
- re-running the seed does not create duplicates (59.146083ms)
- placeholder inactive rows do not appear in watch-options (2.110916ms)
- every active watch color belongs to that model (1.113625ms)
- every active watch storage belongs to that model (0.236875ms)
- every active watch size belongs to that model (0.680625ms)
- every active watch connectivity belongs to that model (0.546459ms)
- smartwatch listing with storage appears in search (39.610583ms)
- smartwatch listing with NULL storage appears in search (24.431959ms)
- smartwatch listing with NULL storage appears in favorites (37.106625ms)
- smartwatch listing returns case_size_label and watch_connectivity_name (11.867416ms)
- smartwatch listing does not require or invent SIM (9.615333ms)
- phone listing still requires SIM and returns storage (31.176916ms)
- official smartwatch color/finish is preserved (8.431542ms)
- smartwatch with NULL case size or connectivity does not crash (18.00075ms)
- approve keeps the listing on All statuses page 1 and updates filters (178.604458ms)
- existing approved listing is included under All statuses (39.819084ms)
- individual status filters only return that status (71.615417ms)
- helper maps previous status to the correct next seller-edit status (0.324167ms)
- new listing is pending or approved, never updated/resubmitted (34.195209ms)
- declined listing edited by seller becomes resubmitted (new revision) (23.994708ms)
- approved listing edited by seller becomes updated on the same row (16.223292ms)
- admin can approve a resubmitted listing (15.102125ms)
- admin can approve an updated listing (17.441458ms)
- admin can decline a resubmitted listing (13.548208ms)
- admin can decline an updated listing (12.9ms)
- declined after updated → seller edit is resubmitted, not updated (18.174458ms)
- approved after updated → seller edit is updated again (18.166875ms)
- admin Resubmitted filter returns only resubmitted (18.868875ms)
- admin Updated filter returns only updated (18.276042ms)
- All statuses includes updated listings and keeps created_at sort (63.685708ms)
- approved-edit snapshot is not a second current listing in Admin Listings (281.93275ms)
- existing approved/pending/sold/hidden statuses still validate (0.681584ms)
- declined → resubmitted creates a historical resubmission event (53.184792ms)
- resubmitted → approved does not delete the historical resubmission event (17.463417ms)
- resubmitted → declined does not delete the historical resubmission event (17.841792ms)
- resubmission appears in the current month history API (20.751625ms)
- resubmission from a previous month does not appear in another month (17.228041ms)
- Resubmissions (Month) dashboard count is based on events, not current status (31.377708ms)
- approved → updated creates a historical update event and keeps listing id (22.756417ms)
- updated → approved does not delete the historical update event (16.099542ms)
- updated → declined does not delete the historical update event (16.540708ms)
- update appears in the current month Updates history (19.541042ms)
- Updates (Month) count is based on historical events, not current updated queue (25.408ms)
- historical resubmission and update can access previous and new revisions (65.147916ms)
- customer cannot access moderation history (1.688834ms)
- dashboard cards point current status vs historical routes (0.494833ms)
- creates a valid custom phone listing and persists custom fields (25.030958ms)
- creates a valid custom smartwatch listing (13.310584ms)
- rejects custom listings that mix catalog IDs or omit required fields (6.643959ms)
- keeps catalog phone creation unchanged (8.431666ms)
- approves a custom listing into marketplace, my listings, search, favorites, and admin (112.995042ms)
- edits a custom listing, preserves resubmit/update snapshots, and records history (21.544208ms)
- does not change the smartwatch model count (4.326333ms)
- seeds researched phone models with active storage (3.877875ms)
- corrects Apple storage SKUs from official support data (3.106083ms)
- keeps Redmi and POCO as their own brands (1.748084ms)
- has no duplicate phone models per brand+name (1.069834ms)
- does not delete listing-referenced catalog rows (3.077417ms)

## Raw reporter summary

```
ℹ tests 201
ℹ suites 22
ℹ pass 201
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 214746.331667
```
