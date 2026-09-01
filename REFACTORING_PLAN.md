# Telefonak — Codebase Refactoring Plan

**Status:** Audit complete. No code, schema, API, or UI changes in this pass.  
**Date:** 2026-09-01  
**Rule:** The working MVP is the source of truth. Do not rebuild. Do not rewrite in one shot. Refactor later in small, verified steps.

This document is the Phase 1–3 deliverable: a full-project audit, a problem catalog, and a target architecture. Implementation starts only after this file is reviewed.

---

## Constraints (do not violate during later work)

- Preserve existing screens, flows, API contracts, database schema, and UI unless a change is required to fix a clear bug or unblock a safe extraction.
- Do not convert the mobile app to TypeScript as part of cleanup.
- Do not add Redux, Zustand, Clean Architecture layers, a new HTTP client, or extra “enterprise” folders.
- Do not redesign the UI.
- When unsure whether something is dead, mark it **REQUIRES VERIFICATION** and leave it.

---

## 1. Current architecture

Telefonak is three clients around one Express API and one PostgreSQL database.

```text
Expo mobile (JS)  --customer JWT (OTP + refresh)-->  Express /api  -->  PostgreSQL
Vite admin-web (TS) --admin JWT (email + password)-->     |
```

There is no mobile admin path and no `users.is_admin` column. Customer and staff auth are already split. See `docs/14_AUTHENTICATION_ARCHITECTURE.md` (this doc is relatively accurate; most other `docs/` files are not).

### 1.1 Frontend architecture (mobile)

| Area | Where it lives | How it works today |
|------|----------------|--------------------|
| Boot | `mobile/App.js` | Fonts + splash timer + `resolveStoredSession()` + maintenance probe. Navigation does not mount until boot state is set. |
| Navigation | One React Navigation **stack** | Home embeds its own bottom nav. It is not a tab navigator. Other “tabs” are stack pushes. |
| Session | `mobile/src/utils/authSession.js` | Access + refresh tokens in expo-secure-store. Legacy AsyncStorage `authToken` is migrated then removed. |
| i18n / RTL | `LanguageContext` + `translations.js` + `rtlStyles.js` | App language `en` / `ar` in AsyncStorage. Layout is derived from language, not from `I18nManager` as source of truth. |
| Theme | `ThemeContext` + `designTokens.js` | Light/dark in AsyncStorage. |
| Badges | `FavoritesContext`, `NotificationsContext`, `OffersUnreadContext` | Small aggregates only. Listing lists are not global state. |
| HTTP | `mobile/src/utils/api.js` (`apiClient`) | Axios instance: Bearer from SecureStore, 401 refresh, maintenance interceptors. |
| UI kit | `mobile/src/components/ui/` | Custom kit (Button, TextField, SelectField, EmptyState, …). Not fully adopted on auth/legal screens. |
| Screens | `mobile/src/screens/` | 28 screens. Data fetching happens **inside screens**, not in a service layer. |

Cold-start route: Maintenance → Onboarding → Home (if customer session) → AuthChoice.

Splash is **not** a stack route. It renders before navigation. Restoring the creamy splash is a checkpoint rule (`.cursor/rules/creamy-splash-screen.mdc`); do not delete those assets.

### 1.2 Frontend architecture (admin-web)

Vite + React 19 + TypeScript + Tailwind 4 + TanStack Query.

- Routing: `admin-web/src/routing/AppRouter.tsx` (ProtectedRoute + SuperAdminRoute for `/admins`).
- HTTP: `admin-web/src/services/apiClient.ts` (`VITE_API_URL` or `http://localhost:3000/api`). 401 clears session and redirects to login.
- Domain services under `admin-web/src/services/` (listings, users, banners, reports, …).
- Auth: `AuthContext` + `useAuth`. Email/password against `/api/admin/auth`.
- Types: hand-maintained mirrors of backend JSON. There is no shared OpenAPI/Zod package.

This app is the cleanest of the three. Main issue is size of a few drawers/pages, not chaos.

### 1.3 Backend architecture

Express in `backend/server.js`.

Middleware order: env validation → helmet → CORS → JSON 1mb → static `/uploads` → global `checkMaintenanceMode` on `/api` → routers → 404 → error handler.

Customer mounts include `/api/auth`, `/api/user`, `/api/listings` (via `listings.js`), `/api/catalog`, `/api/favorites`, `/api/offers`, `/api/notifications`, `/api/upload`, `/api/banners`, `/api/status`, `/api/settings/public`.

Admin mounts are all under `/api/admin/*` and are maintenance-exempt.

Domain logic already extracted in places:

- `backend/utils/listingCatalog.js` — SQL fragments + catalog validation
- `backend/utils/listingStatus.js` — status constants and transitions
- `backend/utils/listingCustom.js` — custom “Other” listings
- `backend/utils/customerAuth.js` / `adminAuth.js`
- `backend/utils/notifications.js` — single writer for notification rows
- `backend/security-tests/` — 22 suites; this is the safety net for later refactors

`listings.js` is still the god file: geo/catalog GETs, marketplace list, my listings, detail, create, update, hide, sold, views.

### 1.4 Data flow

1. Mobile/admin call `/api/...` with a Bearer token (or none for public listing browse).
2. Route handler validates input (express-validator **or** hand-rolled `parseInt`, inconsistently).
3. SQL via `pg` Pool (`backend/config/database.js`). DATE columns are parsed as strings to avoid timezone day-shift.
4. JSON response. Listing images are public `/uploads/...` URLs.

### 1.5 Authentication flow

**Customers:** Jordan phone + OTP → access JWT (short TTL) + refresh token stored in `auth_refresh_sessions`. Middleware: `verifyToken` (`userId`).

**Admins:** email + bcrypt password → access JWT (~30 days, no refresh rotation). Middleware: `verifyAdminAuth` (`adminId`, `role`) + `requireSuperAdmin` where needed.

Dev OTP testing mode can log codes and use a fixed `1234` when not production. That is intentional for local work; it must stay disabled in production (`OTP_DEV_MODE` is ignored when `NODE_ENV=production`).

### 1.6 State management

No Redux. Mobile uses React context for cross-cutting UI state and screen-local `useState` for lists/forms. Admin uses TanStack Query as the server-state cache. This is appropriate. Do not add a global store.

### 1.7 Database interaction

`backend/scripts/ensureDatabase.js` applies **48 SQL files in a fixed order on every boot**, then checks required tables/columns. Scripts are written to be mostly idempotent (`IF NOT EXISTS`). There is **no migration version table**. Large seeds (`phone_catalog_seed.sql`, smartwatch seeds) re-run at startup.

### 1.8 File / image upload flow

1. Client uploads photos to `/api/upload/listing-images` (customer) or `/api/admin/upload` (admin banners).
2. Server stores files under `backend/uploads/`, checks magic bytes (`imageContent.js`), records ownership.
3. Create/update listing sends those URLs. `listingImageAuth.js` rejects URLs the user does not own (and allows URLs already on the listing being edited).

---

## 2. Problems found

### CRITICAL

Problems that can cause bugs, security mistakes, data accidents, or serious maintainability failure.

| ID | Issue | Why it matters |
|----|--------|----------------|
| C1 | Dual Node trees: root `package.json` duplicates backend deps but **omits** `helmet`, `multer`, `express-rate-limit` | `npm start` from repo root vs `backend/` can silently run a different dependency set. |
| C2 | JWT secret fallbacks in `backend/config/env.js` | Customer and admin can share `JWT_SECRET`. Non-prod can use `dev-only-insecure-*-secret`. OTP pepper can fall back to the customer JWT secret. |
| C3 | Admin access tokens ~30 days, no refresh rotation | Customer path is 15m + rotating refresh. Staff tokens are long-lived bearer cookies in practice (stored in the browser). |
| C4 | `tmp/` (~59MB of simulator screenshots) is **not** gitignored | Only `*.tmp` is ignored. A broad `git add` would commit QA dumps. |
| C5 | `docs/07_API_SPECIFICATION.md` is wrong | Documents port 5000 and password login. The API is port 3000 and customer auth is OTP. Dangerous as an iOS-phase contract. |

### HIGH

Significantly hurts maintainability, scalability, or performance.

| ID | Issue | Why it matters |
|----|--------|----------------|
| H1 | God files | `HomeScreen.js` ~2600, `CreateListingScreen.js` ~1958, `ListingDetailsScreen.js` ~1706, `backend/routes/listings.js` ~1836. Hard to review, test, or extend for iOS. |
| H2 | Create/edit listing bypasses `apiClient` | `CreateListingScreen.js` and catalog hooks use raw `axios` + `API_BASE_URL`. Refresh/maintenance behavior is easy to get wrong vs the shared client. |
| H3 | Duplicate listing SELECT SQL | Fragments exist in `listingCatalog.js`, but full queries are still copied in `listings.js`, `favorites.js`, `adminListings.js`. Suite `17-listing-query-consistency.test.js` exists to guard a future extraction. |
| H4 | `ensureDatabase` re-applies all SQL every boot | Startup cost grows with every seed. No “already applied” versioning. |
| H5 | Business rules inside screens | Mark sold / hide / delete / share Alert flows are copied in `MyListingsScreen.js` and `ListingDetailsScreen.js`. |
| H6 | Stale product docs vs working MVP | Admin roles, smartwatch catalog, moderation history, and OTP auth already exist. `IMPLEMENTATION_BACKLOG.md` and `05_ADMIN_PANEL.md` still describe an older product. |

### MEDIUM

Should be cleaned up; does not immediately threaten the MVP.

| ID | Issue |
|----|--------|
| M1 | `react-native-paper` is in `mobile/package.json` with **zero** app imports. |
| M2 | Mixed feedback: ~115 `Alert.alert` vs ~30 `showToast`. Create listing is Alert-heavy. |
| M3 | Empty states: `EmptyState` used on Home/My Listings/offers; Saved and Notifications still hand-roll empty UI. |
| M4 | `listingDisplayName` duplicated in mobile JS and admin TS (and related backend `formatListingDeviceName`). |
| M5 | Catalog split: `listings.js` still serves `/brands`, `/storage`, `/conditions`, `/cities`; `catalog.js` serves newer catalog APIs. |
| M6 | Ad-hoc scripts: `backend/tmp_verify_auto_approve.js`, `tmp_verify_maintenance.js`, `scripts/captureAdminListingsResponse.js` (the capture script signs `{ adminId }` using the **customer** JWT helper). |
| M7 | Validation inconsistency: create listing uses express-validator; offers/favorites/admin list routes often use hand-rolled `parseInt`. |
| M8 | Notifications stored as English title/message snapshots. Mobile already localizes by `type` in `notificationDisplay.js`. Backend still writes English only. |
| M9 | `ListingDetailDrawer.tsx` ~652 lines (fetch + moderate + gallery + revisions). |
| M10 | In-memory rate limits (`express-rate-limit`) — fine for one instance; comment already warns this will not work across multiple API processes. |

### LOW

Consistency and hygiene.

| ID | Issue |
|----|--------|
| L1 | Tracked junk file `dummy` (empty Jupyter notebook) since the initial commit. |
| L2 | Admin unused assets: `src/assets/hero.png`, `public/icons.svg`, empty `src/components/ui/` (`.gitkeep` only). |
| L3 | Brand PNGs live in `assets/`, `mobile/assets/`, and `admin-web/public/`. Some wordmark files have **different MD5** between folders. |
| L4 | Admin TypeScript: no `strict: true`; `ListingStatus \| string` weakens the union. No explicit `any` found. |
| L5 | Mobile is JavaScript. JSDoc exists in a few utils. That is acceptable until a later, dedicated typing pass. |
| L6 | Auth/legal screens still use raw `TextInput` instead of the UI kit. |
| L7 | `TRUST_PROXY` accepted as `1` or `true` in `server.js`; `listingViews.js` only treats `'true'`. |
| L8 | `designs/DESIGN_SYSTEM.md` describes a different product (“Clinical Sanctuary”) with Telefonak color bolted on. |
| L9 | Several `docs/` files are empty stubs (`07_API_SPEC.md`, `08_DESIGN_SYSTEM.md`, `10_CURSOR_RULES.md`, `12_DECISIONS.md`, and others). |
| L10 | Dev `console.info` in listing image picker / ImagePickerDiagnostic. No `TODO`/`FIXME`/`debugger` found in mobile or backend JS. |

---

## 3. Dead code

**Do not delete anything below without grepping references again at the time of deletion.**

### Files / modules that appear unused

| Item | Evidence | Verdict |
|------|----------|---------|
| `react-native-paper` | No `from 'react-native-paper'` in `mobile/` | **REQUIRES VERIFICATION** then remove from `package.json` |
| `mobile/src/components/batteryPickerMath.cjs` | No imports | **REQUIRES VERIFICATION** then delete |
| `dummy` | Empty notebook, no references, tracked in git | Safe to delete after a quick `git grep dummy` |
| `admin-web/src/assets/hero.png` | No imports | **REQUIRES VERIFICATION** then delete |
| `admin-web/public/icons.svg` | Vite scaffold icons, unused | **REQUIRES VERIFICATION** then delete |
| `backend/tmp_verify_auto_approve.js` | Not in npm scripts | **REQUIRES VERIFICATION** — local QA script |
| `backend/tmp_verify_maintenance.js` | Not in npm scripts | **REQUIRES VERIFICATION** |
| `backend/scripts/captureAdminListingsResponse.js` | Not in npm scripts; wrong JWT helper | **REQUIRES VERIFICATION** |
| `ads` table / `ads_schema.sql` | No `/api/ads` routes; banners replaced ads | **REQUIRES VERIFICATION** before dropping table or skipping the SQL file |
| Unused splash/icon PNGs: `telefonak-app-icon-v2.png`, `v3.png`, unused wordmarks | No JS/`app.json` references | **REQUIRES VERIFICATION**. **Keep** `telefonak-word-mark-white-bg-bigger-curved.png` (creamy splash checkpoint). |

### Screens / routes

| Item | Notes |
|------|--------|
| `EditListingScreen.js` | Already deleted. Edit is `CreateListing` + `{ listingId }`. Do not restore. |
| Stack names `MyOffers` / `ReceivedOffers` in `App.js` | Screens are imported as **children of `OffersScreen`**, not via `navigate('MyOffers')`. Stack entries look redundant. **REQUIRES VERIFICATION** for deep links / notifications. |
| `ImagePickerDiagnosticScreen` | Registered; opened from Settings behind `__DEV__`. Keep until iOS photo debugging is done. |

### Imports / old implementations

- Create listing no longer fetches `/cities/:id/areas` for a picker (Area is free text). Home marketplace filters **still** have an Area picker. That is product behavior, not dead code.
- Do not treat `notificationDisplay.js` as temporary. It is the correct client localization layer for English-stored notification rows.

---

## 4. Duplication — single sources of truth

| Duplicated thing | Current copies | Proposed source of truth (later) |
|------------------|----------------|----------------------------------|
| Listing device title | `mobile/src/utils/listingDisplayName.js`, `admin-web/src/utils/listingDisplayName.ts`, backend `formatListingDeviceName` | Keep mobile + admin copies for now (small). Backend remains canonical for stored names. Optional shared package is overkill. |
| Listing location display | `formatListingLocation` / `listingAreaText` in `marketplaceFilters.js` | Already the mobile source of truth. Admin `resolveLocation` in `adminListings.js` is a separate English snapshot — leave unless a bug appears. |
| Listing SELECT SQL | `listings.js`, `favorites.js`, `adminListings.js` | New `backend/utils/listingQueries.js` (or expand `listingCatalog.js`) with scopes `public` / `owner` / `favorite` / `admin`. Keep suite 17 green. |
| Catalog HTTP | Home uses `apiClient`; CreateListing uses axios in `useModelOptions` / `useWatchOptions` | One `apiClient` path. Hooks should call `apiClient`, not raw axios. |
| Owner listing actions | My Listings + Listing Details | Extract `listingOwnerActions.js` (or a tiny hook) used by both screens. **Do not change copy or confirmation order.** |
| Condition labels | `listingCondition.js` is already shared | Keep. Do not add a third mapper. |
| Status badges | `ui/StatusBadge` vs `OfferStatusBadge` vs several admin badge components | Parallel is OK (different domains). Do not force one Badge to rule them all. |
| Root vs backend `package.json` | Same Express stack listed twice | **Backend `package.json` is the API source of truth.** Root should become a thin launcher or a workspace — not a second incomplete install. |
| Create vs update listing validators | Near-duplicate `body()` blocks in `listings.js` | Shared validator array in that file or `listingValidators.js`. |

---

## 5. Complexity

### Overly large files

| File | ~LOC | Why it is large | Later split (no behavior change) |
|------|------|-----------------|----------------------------------|
| `mobile/src/screens/HomeScreen.js` | 2600 | Marketplace, filters, banners, bottom nav, profile prefetch | Colocate `useMarketplace.js`, `MarketplaceFiltersSheet.js`, keep Home as shell |
| `mobile/src/screens/CreateListingScreen.js` | 1958 | Create **and** edit, 3 steps, catalog + custom, images | `steps/StepDevice.js`, `StepCondition.js`, `StepPublish.js` + `buildListingPayload.js` |
| `mobile/src/screens/ListingDetailsScreen.js` | 1706 | Buyer + owner actions, offers, gallery | Extract owner action bar + offer panel |
| `backend/routes/listings.js` | 1836 | Catalog GETs + CRUD + moderation side effects | Move GETs to `catalog.js` / `geo.js`; queries to `listingQueries.js` |
| `mobile/src/utils/translations.js` | 1498 | All EN/AR copy | Leave until a real i18n library is chosen (not now) |
| `admin-web/.../ListingDetailDrawer.tsx` | 652 | Detail + moderate + images + history | Sections/hooks inside the same folder |

### Unnecessary abstractions

None worth adding. The risk is the opposite: **under-extraction** in the four god files, and a few **over-copied** helpers.

Do not introduce:

- Feature-folder rewrite of the entire `src/` tree
- Repository/UseCase/Entity layers
- A second API client
- Global listing cache

### Unnecessary state / effects

- Home fetches marketplace listings, banners, categories, and sometimes profile in one screen. Splitting files should **not** add extra fetches.
- CreateListing keeps a large `formData` object — appropriate for a wizard. Do not explode it into 20 `useState`s.
- Avoid new `useMemo`/`useCallback` unless a split actually causes measurable extra work.

---

## 6. Proposed architecture

**Simplest architecture that will scale with Telefonak:**

Keep the three-app layout. Improve boundaries **inside** existing folders.

```text
mobile/src/
  App.js                    boot + stack (stay)
  screens/                  one folder per screen; large screens get a subfolder of helpers
  components/ui/            presentation primitives (grow adoption, don’t replace)
  components/               domain widgets (MyListingCard, FavoriteButton)
  context/                  language, theme, unread badges only
  hooks/                    catalog option hooks (fix them to use apiClient)
  services/                 ADD LATER only for duplicated API/business helpers
  utils/                    pure helpers (keep)
  config/                   API origin (keep)

backend/
  server.js                 stay thin
  routes/                   HTTP only; listings.js shrinks
  utils/listingQueries.js   ADD: SELECT builders
  utils/                    domain (status, catalog, auth, otp) — keep
  middleware/               keep
  config/                   keep
  database/                 later: versioned migrations (product decision)
  security-tests/           keep as the refactor safety net

admin-web/src/
  pages/ + components/      keep
  services/ + types/        keep; extract query-key constants if strings drift
```

Principles:

1. **UI screens present.** Fetching may stay in screens until a second caller appears; then extract a service/hook.
2. **API routes parse HTTP and call utils.** SQL for listings should not be copy-pasted.
3. **Auth stays split.** Never merge customer and admin JWTs.
4. **One HTTP client per app** (`apiClient` mobile, `apiClient` admin).
5. **Tests before cleverness.** `backend/security-tests` + `mobile/src/utils/__tests__` must stay green on each step.

---

## 7. Target folder structure

Do **not** force a `features/auth|listings|phones` tree in the first refactors. A big-bang move breaks imports, Metro, and reviewability.

**Phase A (recommended first structural moves, still later):**

- `mobile/src/screens/HomeScreen/` (index + hooks + filter sheet)
- `mobile/src/screens/CreateListingScreen/` (index + steps + payload builder)
- `backend/utils/listingQueries.js`
- Catalog GET routes leave `listings.js`

**Phase B (only if the app keeps growing):**

- `mobile/src/services/listings.js` for owner actions + listing CRUD
- Optional `packages/` for shared listing-name + status enums — **not** needed yet

Avoid creating empty `types/`, `constants/`, `app/providers/` folders just to look like a template.

---

## 8. Incremental refactor sequence (later — not this pass)

Each step: understand behavior → change one area → run the relevant tests → confirm the flow still works → stop.

| Step | What | Safety |
|------|------|--------|
| 1 | Repo hygiene: gitignore `tmp/`, delete `dummy` after grep | No runtime change |
| 2 | Remove proven-unused deps/files (`react-native-paper`, `batteryPickerMath.cjs` after verification) | `npm ls` / grep |
| 3 | Point root scripts at `backend/` as the only API install, or document “always `cd backend`” | Start server both ways |
| 4 | CreateListing + hooks → `apiClient` | Create/edit listing E2E |
| 5 | Extract listing owner actions helper | My Listings + Listing Details |
| 6 | Extract `listingQueries.js`; keep suite 17 green | `npm run test:security` subset |
| 7 | Move catalog/geo GETs out of `listings.js` | Catalog + create listing |
| 8 | Split HomeScreen / CreateListingScreen into colocated files **without** changing UI | Visual check of Home + Sell + Edit |
| 9 | Split ListingDetails owner/buyer sections | Listing details + offers |
| 10 | Align empty states / toast-vs-Alert **only where copy-paste**, not a UX redesign | Spot check |
| 11 | Naming consistency in new files only | — |
| 12 | Styling: adopt UI kit on leftover screens only if identical visually | — |
| 13 | Dedicated JWT secrets in prod (no shared fallback); document admin token TTL as a product decision | Auth tests |
| 14 | Docs: rewrite or archive stale `docs/07_*` and `05_ADMIN_PANEL.md`; add `ARCHITECTURE.md` **after** the splits exist | — |

**Explicitly out of scope until a dedicated project:**

- Mobile → TypeScript
- Feature-based rewrite of all of `src/`
- Versioned SQL migration framework (needs a product/ops decision)
- Enabling `strict` on admin-web (needs a compile-break budget)
- Dropping Home filter `area_id` (product: catalog areas vs free-text listing Area)
- Removing ImagePickerDiagnostic from production builds

---

## 9. Types and naming (later)

- Prefer existing names: `listing`, `apiClient`, `t()`, `formData` in the wizard.
- Avoid new `data`, `temp`, `result2`.
- Admin: drop `| string` from `ListingStatus` once call sites are checked.
- Do not scatter new TypeScript interfaces into random screens; keep them in `admin-web/src/types/`.
- Moderation history types currently live in `moderationHistoryService.ts` — move to `types/` when that file is touched.

---

## 10. TypeScript

- **Mobile:** stay on JavaScript. JSDoc on extracted utils is enough.
- **Admin:** already TS without `any`. Enabling `strict` is valuable but is a separate pass (**REQUIRES VERIFICATION** of error count).
- **Backend:** stay on JavaScript. Security tests are the contract.

Do not create types for trivial strings (`'en' | 'ar'` in one file is enough).

---

## 11. Error handling (later)

Current patterns:

- Mobile: `logApiError` + `getApiErrorMessage` in `apiError.js`; screens mix Alert and toast.
- Admin: Query `isError` + inline messages.
- Backend: `res.status(4xx).json({ error })` plus `console.error` in catch blocks.

Later single policy (when touching a screen, not as a global sweep):

- Network/API: `getApiErrorMessage` + toast for non-blocking; Alert for destructive confirmations only.
- Auth 401: existing interceptor (refresh or clear session).
- Validation: keep express-validator on write endpoints; don’t rewrite working hand-rolled ID checks in one PR.

---

## 12. Performance review

Obvious, evidence-based issues only:

- HomeScreen is a large component; splitting files may reduce *human* load more than render load. Do not wrap everything in `React.memo` without a reason.
- Marketplace lists use pagination (`limit`/`offset`). Keep that.
- Duplicate catalog requests: Home and CreateListing both hit model storages/colors — acceptable (different screens). Unify the client, not a global cache, unless profiling shows it.
- Images: listing cards already use remote URLs. Do not add a new image pipeline in cleanup.
- `ensureDatabase` seed re-run is the main **server** performance smell at boot.

---

## 13. Security review

Flagged for later hardening (do not weaken controls while refactoring):

| Topic | Finding |
|-------|---------|
| Secrets in git | `backend/.env` and `admin-web/.env` are gitignored. `env.example` is placeholders. No live cloud keys found in tracked source. |
| JWT | Shared `JWT_SECRET` fallback and insecure dev secrets — **CRITICAL** for production. Dedicated `JWT_CUSTOMER_SECRET` / `JWT_ADMIN_SECRET` should be required in production. |
| OTP | Dev fixed code `1234` and console logs — production path disables this. |
| Uploads | Ownership checks exist (`listingImageAuth.js`). Keep them when moving code. |
| IDOR | Security suites 02–06 cover listings/offers/favorites/notifications. Run them after query extraction. |
| Admin | Super-admin routes exist. Do not collapse admin and customer middleware. |
| Capture script | `captureAdminListingsResponse.js` uses the customer JWT secret helper for an admin-shaped payload — do not use it as a template. |
| Maintenance | Gate fail-opens on DB errors (availability over fail-closed). Product decision, not a silent change. |
| `tmp/` | Must be gitignored so screenshots never land in the remote. |

Historical “was `.env` ever committed?” was **not** checked (`git log` on ignored files). **REQUIRES VERIFICATION** before a public launch.

---

## 14. Documentation (after real refactors)

Do **not** write `ARCHITECTURE.md` until the folder splits exist, or it will describe a future that is not true.

When that pass happens, `ARCHITECTURE.md` should cover: three apps, auth split, where to add a screen, where to add a route, where listing SQL lives, upload ownership, and “run `backend/security-tests`”.

Until then, treat this file as the living map. Prefer fixing or archiving stale `docs/07_API_SPECIFICATION.md` and `docs/05_ADMIN_PANEL.md` over adding more fiction.

---

## 15. Remaining issues (product / ops decisions)

These are intentionally **not** scheduled as silent cleanup:

1. Keep ImagePickerDiagnostic in `__DEV__` vs remove from release builds.
2. Home filter still uses catalog `area_id` while Sell/Edit Area is free text — filters will not match typed neighborhoods. Decide whether that is acceptable.
3. Versioned SQL migrations vs current re-apply-all.
4. Enable TypeScript `strict` on admin-web.
5. Canonical brand-asset folder vs copies (respect creamy-splash checkpoint paths).
6. Admin JWT TTL / refresh (security vs “stay logged in”).
7. Whether to drop the unused `ads` table.
8. Whether root should be an npm workspace or a README-only launcher.

---

## 16. Verification performed for this audit

| Check | Result |
|-------|--------|
| Mobile structure, screens, App.js routes | Inspected |
| `react-native-paper` imports | None |
| `batteryPickerMath.cjs` imports | None |
| `navigate('MyOffers'\|'ReceivedOffers')` | None (screens used as Offers children) |
| ImagePickerDiagnostic | Settings `__DEV__` only |
| Backend `server.js` mounts + `listings.js` size | Inspected |
| Dual package.json overlap | Confirmed |
| `.gitignore` vs `tmp/` | `tmp/` not ignored |
| Admin routing vs Sidebar | All pages wired |
| Explicit `any` in admin-web | None found |
| Security-test suite presence | Suites 01–22 present |
| This pass: code changes | **None** |

---

## 17. What this pass is not

This file is not a license to:

- Rebuild the app
- Rename every component
- “Make it production-ready” in one PR
- Change listing, search, auth, or moderation behavior while moving files

Telefonak is a real MVP. The next engineering move, after this plan is approved, should be **Step 1 only** (gitignore `tmp/`, delete `dummy` if still unused) — not a mega-screen split.
