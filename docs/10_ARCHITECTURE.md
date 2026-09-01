# Telefonak — current architecture

**Status:** Describes the running MVP (code as of September 2026).  
**Source of truth:** the repository, not the July 2026 planning docs.

---

## Overview

Telefonak is a Jordan marketplace for second-hand **phones and smartwatches**. Three apps share one Express API and one PostgreSQL database.

```text
Expo mobile (JS)
  customer JWT (phone OTP + refresh) ──► Express /api ──► PostgreSQL
Vite admin-web (TS)
  admin JWT (email + bcrypt password) ─┘
```

There is no mobile admin path and no `users.is_admin` column.

---

## Repository layout

```text
TelefonakApp/
  backend/          Express API, SQL files, security tests
  mobile/           Expo React Native (JavaScript)
  admin-web/        Vite + React 19 + TypeScript admin
  docs/             Technical documentation
  REFACTORING_PLAN.md   Historical audit (2026-09-01)
```

Root `package.json` only proxies `npm start` / `npm dev` to `backend/`. Install and run each app in its own directory.

---

## Mobile (`mobile/`)

- **Runtime:** Expo SDK 54, React Native 0.81, JavaScript (not TypeScript).
- **Entry:** `mobile/App.js`. Splash is **not** a stack route; it renders until boot finishes (fonts + ~2500ms timer + session + maintenance probe).
- **Navigation:** one React Navigation **stack**. Home embeds its own bottom bar (`HomeScreen/HomeBottomNav.js`). It is not a tab navigator. “Tabs” (My Listings, Sell, Offers, Saved) are stack pushes.
- **Cold start:** Maintenance → Onboarding (first launch) → Home (if customer session) → AuthChoice.
- **HTTP:** `mobile/src/utils/api.js` (`apiClient`). Bearer from SecureStore, 401 refresh, maintenance interceptors.
- **Session:** `mobile/src/utils/authSession.js` (access + refresh in expo-secure-store).
- **State:** React context only — `LanguageContext`, `ThemeContext`, `FavoritesContext`, `NotificationsContext`, `OffersUnreadContext`. No Redux / Zustand / React Query. Listing lists are fetched inside screens.
- **i18n:** `en` / `ar` in AsyncStorage; layout from language (`rtlStyles.js`), not `I18nManager` as source of truth.
- **Large screens:** `HomeScreen/` (marketplace + filters + embedded nav), `CreateListingScreen/` (create and edit, 3-step wizard), `ListingDetailsScreen.js` (buyer + owner).
- **Listing helpers:** `listingOwnerActions.js` (HTTP), `listingOwnerCapabilities.js` (which owner actions are allowed), `listingDisplayName.js`, `listingCatalogForm.js`, `listingImages.js`.

### Major customer flows

- Auth: Jordan phone + OTP → register profile if new → Home.
- Marketplace: browse approved listings, search, filters (category, brand, model, storage/color, watch attrs, condition, price, battery, city/area).
- Listing detail: gallery, specs, favorite, offer (buyers), owner manage (edit/hide/sold/delete).
- Create/edit listing: phones or smartwatches, catalog or custom “Other”, photos, moderation.
- My listings: active vs history (sold/deleted).
- Offers sent/received, saved listings, notifications, profile, settings, legal/help.

---

## Admin Web (`admin-web/`)

- Vite, React 19, TypeScript, Tailwind 4, TanStack Query, React Router 7.
- HTTP: `admin-web/src/services/apiClient.ts` (`VITE_API_URL`, default `http://localhost:3000/api`).
- Auth: `AuthContext` against `/api/admin/auth`. Super Admin only for `/admins`.
- Pages: dashboard, listings (moderate), moderation history, users, banners, notifications, reports, settings, audit logs, admins.

---

## Backend (`backend/`)

- **Entry:** `backend/server.js`. Validates env, then `await ensureDatabase(pool)` **before** `app.listen()`.
- **Stack:** Express, `pg` Pool, helmet, CORS, JSON 1mb, static `/uploads`.
- **Middleware order:** env → helmet → CORS → JSON → `/uploads` → `checkMaintenanceMode` on `/api` → routers → 404 → error handler.
- **Maintenance:** customer APIs return 503 when `maintenance_mode` is on. Admin, `/api/health`, and `/api/status` are exempt.
- **Data access:** raw SQL via `pg`. No ORM. Listing SELECTs live in `backend/utils/listingQueries.js` (marketplace / owner / favorite / admin scopes).
- **Domain utils:** `listingStatus.js`, `listingCatalog.js`, `listingCustom.js`, `listingImageAuth.js`, `moderateListing.js`, `customerAuth.js`, `adminAuth.js`, `notifications.js`, `otp.js`.
- **Startup:** `backend/scripts/ensureDatabase.js` — see [06_DATABASE.md](06_DATABASE.md).

Customer mounts include `/api/auth`, `/api/user`, `/api/listings`, `/api/catalog` routes, `/api/favorites`, `/api/offers`, `/api/notifications`, `/api/upload`, `/api/banners`, `/api/status`, `/api/settings/public`.

Admin mounts are all under `/api/admin/*`.

---

## Listing lifecycle (implementation)

Canonical rules: `backend/utils/listingStatus.js`.

Public marketplace visibility is **`approved` only**. Sold and deleted are terminal.

Seller edit next status: declined → new `resubmitted` snapshot; approved → `updated`; in-place resubmitted/updated stay in queue. Create status follows live setting `auto_approve_listings` (`pending` or `approved`), except those seller-edit rules.

---

## Principles that the code already follows

1. Customer and admin JWTs stay split. Never merge them.
2. One HTTP client per app (`apiClient` mobile, `apiClient` admin).
3. Screens present; fetching stays in screens until a second caller appears.
4. API routes parse HTTP and call utils; listing list SQL is not copy-pasted across routers.
5. `backend/security-tests` is the API refactor safety net.

Do not add Redux, a second API client, a shared npm package for display names, or an ORM as part of ordinary feature work.
