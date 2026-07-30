# Telefonak — Implementation Backlog

**Version:** 1.0  
**Status:** Active (Master Planning Document)  
**Last Updated:** July 2026  
**Source of Truth:** Existing codebase + `docs/` product documentation + project audit

---

# 1. Purpose

This document is the **master implementation backlog** for Telefonak.

It tracks every remaining:

- Implementation task
- Enhancement
- Bug fix
- Technical improvement

required to reach a **production-ready MVP**.

This backlog will be used throughout the remainder of development.

**Maintenance rule:** After every completed feature or bug fix, this document must be updated immediately so it always reflects the real state of the project.

Anything not listed here should be considered out of scope unless it is explicitly approved and added to this backlog.

---

# 2. Legend

## Status

| Symbol | Meaning |
|--------|---------|
| ⬜ | To Do |
| 🟨 | In Progress |
| ✅ | Done |
| ⛔ | Blocked |

## Priority

| Code | Meaning |
|------|---------|
| **P0** | Critical — blocks core flows or causes incorrect/broken behavior |
| **P1** | High — required for MVP quality and seller/buyer trust |
| **P2** | Medium — important improvement, can follow core flows |
| **P3** | Low — polish or nice-to-have within MVP window |

---

# 3. Sprint Roadmap

## Sprint 1 — Foundation Stabilization

**Goal:** Fix blockers that break core flows and make the codebase safe to build on.

**Estimated scope:** 5–8 working days  
**Dependencies:** None (start immediately)

| ID | Task | Priority | Status | Notes |
|----|------|----------|--------|-------|
| S1-01 | Fix `GET /api/listings/user/my` route shadowing (`:id` captures `"user"`) | P0 | ⬜ | Register `/listings/user/my` **before** `/listings/:id` |
| S1-02 | Standardize listing status workflow (`pending` → `approved` / `declined` → `sold` / `deleted`) | P0 | ⬜ | Remove reliance on legacy `active` as published status; align DB default, API defaults, and mobile |
| S1-03 | Align backend public listings default filter with `approved` | P0 | ⬜ | Backend currently defaults to `status=active` |
| S1-04 | Register or remove broken `EditListing` navigation target | P0 | ⬜ | `MyListingsScreen` navigates to unregistered screen |
| S1-05 | Centralize mobile API base URL via environment / Expo config | P1 | ⬜ | Stop hardcoding `http://localhost:3000/api` in many files |
| S1-06 | Migrate all screens to shared `apiClient` | P1 | ⬜ | Remove duplicated axios + `API_BASE_URL` copies |
| S1-07 | Navigation cleanup (consistent bottom nav / stack usage) | P2 | ⬜ | Custom tab bar only exists on Home today |
| S1-08 | Environment configuration cleanup (backend + mobile) | P1 | ⬜ | Document required env vars; add `BASE_URL` where needed |
| S1-09 | Create missing Expo `assets/` (icon, splash, adaptive icon) | P2 | ⬜ | Referenced by `app.json` but missing on disk |
| S1-10 | Persist rejection reason / stop ignoring unused admin fields | P2 | ⬜ | Decline reason only in notification text; `admin_notes` unused |

**Sprint 1 exit criteria:**
- My Listings works end-to-end
- Approved listings appear consistently without client-side workarounds
- No broken navigation routes
- Single API configuration path for mobile

---

## Sprint 2 — Seller Experience

**Goal:** Make selling reliable: real photos, editable listings, and solid validation.

**Estimated scope:** 7–10 working days  
**Dependencies:** Sprint 1 (route/status/navigation fixes)

| ID | Task | Priority | Status | Notes |
|----|------|----------|--------|-------|
| S2-01 | Implement listing image upload endpoint (authenticated seller) | P0 | ⬜ | Reuse multer pattern from ads upload |
| S2-02 | Wire `CreateListingScreen` to upload images before submit | P0 | ⬜ | Stop sending local `file://` URIs |
| S2-03 | Enforce max 5 images (MVP) on client and server | P1 | ⬜ | UI currently allows 10 |
| S2-04 | Implement Edit Listing API (`PUT /listings/:id`) | P0 | ⬜ | Owner only; approved edits return to `pending` |
| S2-05 | Implement `EditListingScreen` and register in navigation | P0 | ⬜ | |
| S2-06 | Image management (reorder / delete / replace) | P1 | ⬜ | Listing image CRUD endpoints |
| S2-07 | Improve listing field validation (required fields, price, battery, location) | P1 | ⬜ | Align with `docs/04_FEATURES.md` |
| S2-08 | Hide listing action (status support if retained in MVP) | P2 | ⬜ | Docs mention Hidden; confirm against MVP scope |
| S2-09 | Seller workflow manual QA checklist | P1 | ⬜ | Create → pending → approve → appear → edit → sold/delete |

**Sprint 2 exit criteria:**
- Seller can create a listing with real uploaded photos
- Seller can edit a pending/approved listing (re-moderation when required)
- Images display correctly for other users/devices

---

## Sprint 3 — Buyer Experience

**Goal:** Make discovery and buyer actions match MVP expectations.

**Estimated scope:** 7–10 working days  
**Dependencies:** Sprint 1 (stable listings feed); Sprint 2 preferred for image quality

| ID | Task | Priority | Status | Notes |
|----|------|----------|--------|-------|
| S3-01 | Saved / Favorites — database table + API | P1 | ⬜ | `saved_listings` |
| S3-02 | Saved / Favorites — mobile UI + navigation | P1 | ⬜ | Docs UI guidelines include Saved in bottom nav |
| S3-03 | Complete filters: color, battery health, city/area | P1 | ⬜ | Partial filters exist today |
| S3-04 | Structured city + area fields (replace free-text-only location long-term) | P1 | ⬜ | Align with MVP filters |
| S3-05 | Pagination / infinite scroll on Home and Search | P1 | ⬜ | Currently hard-limited (e.g. 20) |
| S3-06 | Share listing | P2 | ⬜ | Native share sheet |
| S3-07 | Report listing | P2 | ⬜ | Minimal report flow + admin visibility later |
| S3-08 | Featured listings support | P2 | ⬜ | Flag + Home section |
| S3-09 | Listing view counts | P2 | ⬜ | Track and show views |
| S3-10 | Empty / loading / error states polish on browse flows | P2 | ⬜ | Align with UI/UX guidelines |

**Sprint 3 exit criteria:**
- Buyers can save listings
- Filters cover MVP attributes
- Feed supports pagination
- Core buyer actions feel complete

---

## Sprint 4 — Marketplace Expansion

**Goal:** Expand catalog and search quality for phones + smartwatches.

**Estimated scope:** 5–8 working days  
**Dependencies:** Sprint 2–3 catalog/listing stability

| ID | Task | Priority | Status | Notes |
|----|------|----------|--------|-------|
| S4-01 | Add device type to schema (`smartphone` / `smartwatch`) | P1 | ⬜ | Required by MVP scope |
| S4-02 | Seed smartwatch brands/models | P1 | ⬜ | |
| S4-03 | Create Listing: device type selection | P1 | ⬜ | |
| S4-04 | Home/Search filter by device type | P1 | ⬜ | |
| S4-05 | Improve search relevance (brand/model ranking, partial match UX) | P2 | ⬜ | |
| S4-06 | Model-specific storage/color options (where feasible) | P2 | ⬜ | Docs competitive advantage |
| S4-07 | Performance: indexes review for search/filter queries | P2 | ⬜ | |
| S4-08 | Listing card consistency across Home / Search / Saved / My Listings | P2 | ⬜ | Per UI guidelines |

**Sprint 4 exit criteria:**
- Users can browse and sell smartphones and smartwatches
- Search/filter performance remains acceptable with larger catalogs

---

## Sprint 5 — Admin Panel

**Goal:** Give admins operational control beyond listing moderation and ads.

**Estimated scope:** 7–10 working days  
**Dependencies:** Stable listings + users data from prior sprints

| ID | Task | Priority | Status | Notes |
|----|------|----------|--------|-------|
| S5-01 | Admin user list API + screen | P1 | ⬜ | |
| S5-02 | Suspend / reactivate user | P1 | ⬜ | Needs `account_status` (or equivalent) |
| S5-03 | Brand CRUD (admin) | P1 | ⬜ | |
| S5-04 | Model CRUD (admin) | P1 | ⬜ | |
| S5-05 | Analytics dashboard (users, listings, approvals, sold) | P1 | ⬜ | Per admin docs |
| S5-06 | Audit logs for admin actions | P2 | ⬜ | approve/decline/suspend/banner changes |
| S5-07 | Move user notifications off `/api/admin` prefix | P2 | ⬜ | Confusing placement today |
| S5-08 | Admin listing search/filter improvements | P2 | ⬜ | ID, seller, brand, model, status |
| S5-09 | Persist rejection reason on listing record | P1 | ⬜ | Related to S1-10 |

**Sprint 5 exit criteria:**
- Admins can manage users, catalog, banners, and see basic marketplace health metrics

---

## Sprint 6 — Production Readiness

**Goal:** Make the platform secure, deployable, and testable for launch.

**Estimated scope:** 8–12 working days  
**Dependencies:** Core MVP features from Sprints 1–5 largely complete

| ID | Task | Priority | Status | Notes |
|----|------|----------|--------|-------|
| S6-01 | Real SMS OTP via Twilio (remove hardcoded `1234`) | P0 | ⬜ | Stop returning OTP in API responses in production |
| S6-02 | OTP rate limiting + attempt locking | P0 | ⬜ | |
| S6-03 | Push notifications (FCM / APNs) | P1 | ⬜ | Settings toggle already exists locally |
| S6-04 | Security hardening (JWT secret enforcement, CORS tightening) | P0 | ⬜ | |
| S6-05 | Fix SQL string interpolation on decline notification | P0 | ⬜ | Use parameterized queries only |
| S6-06 | Global rate limiting on auth and public endpoints | P1 | ⬜ | |
| S6-07 | HTTPS / production TLS configuration | P0 | ⬜ | |
| S6-08 | Automated API tests for critical paths | P1 | ⬜ | Auth, create listing, approve, browse |
| S6-09 | Manual QA release checklist execution | P0 | ⬜ | From testing strategy |
| S6-10 | Performance optimization (queries, images, pagination) | P1 | ⬜ | |
| S6-11 | Production deployment preparation (env, backups, monitoring) | P1 | ⬜ | |
| S6-12 | Cloud object storage for images (production) | P1 | ⬜ | Local uploads OK for dev only |
| S6-13 | Dependency audit / vulnerability remediation | P2 | ⬜ | |

**Sprint 6 exit criteria:**
- OTP is production-safe
- Critical security issues closed
- Launch checklist passed
- Deployment path documented and tested

---

# 4. Bug Backlog

| ID | Priority | Description | Impact | Suggested Fix | Status |
|----|----------|-------------|--------|---------------|--------|
| BUG-01 | P0 | `GET /api/listings/user/my` is shadowed by `GET /api/listings/:id` | My Listings API returns 404 / wrong behavior | Define `/listings/user/my` **before** `/listings/:id` | ⬜ |
| BUG-02 | P0 | Public listings default to `status=active`, while approval sets `approved` | Empty marketplace if client omits status | Default API filter to `approved`; migrate/remove legacy `active` usage | ⬜ |
| BUG-03 | P0 | `EditListing` navigation target is not registered | Seller Edit button crashes / fails | Implement screen + route, or temporarily hide Edit until ready | ⬜ |
| BUG-04 | P0 | Listing images stored as local device URIs | Photos do not work for other users/servers | Upload to backend/cloud; store public URLs | ⬜ |
| BUG-05 | P0 | OTP hardcoded to `1234` and returned in response | Anyone can authenticate as any phone | Integrate Twilio; never return OTP in production | ⬜ |
| BUG-06 | P1 | Decline notification builds SQL with string interpolation | Injection / fragile queries | Parameterized `INSERT` only | ⬜ |
| BUG-07 | P1 | JWT falls back to `'your-secret-key'` | Token forgery if env missing | Require `JWT_SECRET` in non-dev; fail fast | ⬜ |
| BUG-08 | P1 | Logout clears `hasSeenOnboarding` | Users forced through onboarding again | Clear auth token only | ⬜ |
| BUG-09 | P2 | Settings Help / Privacy use alerts instead of real screens | Dead/stub UX | Navigate to existing Help / Privacy screens | ⬜ |
| BUG-10 | P2 | Create Listing allows 10 images; MVP says 5 | Spec mismatch | Cap at 5 client + server | ⬜ |
| BUG-11 | P2 | Missing Expo assets (`icon.png`, splash, etc.) | Warnings; incomplete branding | Add `mobile/assets/` | ⬜ |
| BUG-12 | P2 | `admin_notes` accepted but never stored | Admin feedback lost | Add column or remove from API | ⬜ |
| BUG-13 | P2 | Notifications live under `/api/admin` for all users | Confusing auth model | Move to `/api/notifications` | ⬜ |
| BUG-14 | P3 | Package version mismatches vs Expo SDK expectations | Potential runtime issues | Align dependency versions | ⬜ |

---

# 5. Technical Debt

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| TD-01 | Create shared mobile component library (`src/components/`) | P1 | ⬜ | Listing cards, buttons, inputs, empty states |
| TD-02 | Extract shared backend middleware (`verifyToken`, `verifyAdminAuth`) | P1 | ⬜ | Keep customer and Admin Web auth helpers consistent |
| TD-03 | Enforce single shared mobile API client everywhere | P1 | ⬜ | Related to S1-05 / S1-06 |
| TD-04 | Introduce AuthContext (or equivalent) for session state | P2 | ⬜ | Avoid remount-only auth awareness |
| TD-05 | Backend folder restructuring (controllers / services / middleware) | P2 | ⬜ | Align with architecture doc over time |
| TD-06 | Standardize API response envelope | P2 | ⬜ | Docs describe `{ success, data, message }` |
| TD-07 | Expand express-validator coverage to all mutating endpoints | P1 | ⬜ | Ads, admin actions, uploads |
| TD-08 | Environment variable cleanup and documentation | P1 | ⬜ | Backend + mobile |
| TD-09 | Remove unused dependencies / dead code | P3 | ⬜ | e.g. unused bottom-tabs usage, unused bcrypt until passwords exist |
| TD-10 | Versioned database migrations (stop only editing historical SQL) | P1 | ⬜ | Per database design principles |
| TD-11 | Complete i18n coverage on all screens | P2 | ⬜ | Some auth/profile screens still partly English-only |
| TD-12 | Docs folder hygiene (empty/duplicate numbered docs) | P3 | ⬜ | Keep one authoritative file per topic |
| TD-13 | Add automated test harness | P1 | ⬜ | At least API critical path |
| TD-14 | Image URL strategy (absolute URLs, CDN later) | P2 | ⬜ | |

---

# 6. Future Features

Intentionally **postponed until after MVP** (unless product docs are revised):

| Feature | Reason / Notes |
|---------|----------------|
| Offer / bid system | In product docs; can follow buyer basics if schedule allows, otherwise post-MVP |
| In-app chat / messaging | Explicitly out of MVP scope |
| Password authentication + forgot password | Current product uses phone OTP; add only if requirements change |
| Social login (Google / Apple / Facebook) | Out of MVP scope |
| AI price suggestions | Long-term vision |
| IMEI / warranty verification | Long-term vision |
| Seller ratings / reviews | Post-MVP trust layer |
| Store subscriptions / store pages | Phase Two business model |
| Premium / paid featured listings | Monetization later |
| Trade-in program | Long-term |
| Web application | Out of MVP |
| Dark mode as product requirement | App already has a theme toggle; formal product dark-mode scope can wait |
| Multi-country expansion | After Jordan product-market fit |
| Advanced analytics / webhooks | Post-MVP ops |
| Cloud image optimization / CDN pipelines | Production enhancement after basic cloud storage |
| Device comparison | Future |
| Tablets / laptops / accessories categories | Future categories |

---

# 7. Progress Tracker

> Counts are initial estimates based on this backlog. Update after each sprint.

| Area | Total Tasks | Done | Remaining |
|------|-------------|------|-----------|
| Authentication | 6 | 0 | 6 |
| Seller Experience | 9 | 0 | 9 |
| Buyer Experience | 10 | 0 | 10 |
| Admin Panel | 9 | 0 | 9 |
| Backend | 18 | 0 | 18 |
| Frontend | 16 | 0 | 16 |
| Database | 8 | 0 | 8 |
| Security | 8 | 0 | 8 |
| Testing | 4 | 0 | 4 |
| Deployment | 5 | 0 | 5 |
| **Overall (unique sprint + bug + debt items)** | **~85** | **0** | **~85** |

**Already implemented (not backlog work, for context):**
- Phone OTP login/register (dev mode)
- Profile view/edit
- Home feed, search, basic filters
- Create listing (fields)
- Admin approve/decline
- Ads CRUD + ad image upload
- In-app notifications (basic)
- Theme + EN/AR language support
- Core PostgreSQL schema (11 tables) + seed catalog

---

# 8. Development Rules

1. **Only work on one feature at a time.**
2. **Every feature must be fully tested before starting the next.**
3. **Every completed task must immediately be marked as Done** in this document.
4. **The backlog must always reflect the current state of the project.**
5. **No feature should be implemented unless it exists in this backlog or is explicitly approved.**
6. Prefer fixing **P0 bugs** before starting new feature work in the same area.
7. Do not expand scope mid-sprint without updating this backlog first.
8. When a task is blocked, mark it ⛔ and record the blocker in Notes.
9. Keep product docs (`docs/01`–`docs/11+`) and this backlog aligned; if they conflict, resolve the conflict in writing before coding.
10. After each sprint, update the Progress Tracker table.

---

## Next Immediate Action

Start **Sprint 1 — Foundation Stabilization**, beginning with:

1. BUG-01 / S1-01 — Fix My Listings route order  
2. BUG-02 / S1-02–S1-03 — Standardize listing status  
3. BUG-03 / S1-04 — Fix Edit Listing navigation gap  

These three unlock reliable seller and buyer testing for all later sprints.
