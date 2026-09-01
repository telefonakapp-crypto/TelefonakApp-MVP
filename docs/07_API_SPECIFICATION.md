# Telefonak API (current)

**Base URL (local):** `http://localhost:3000/api`  
**Content-Type:** `application/json` except uploads (`multipart/form-data`).  
**Auth:** `Authorization: Bearer <token>` on protected routes.

This inventory is taken from `backend/server.js` and `backend/routes/`. Inspect the route file for request/response fields. Do not use the July 2026 spec (port 5000, password login) as a contract.

Health (maintenance-exempt): `GET /api/health`. Mobile maintenance probe: `GET /api/status`.

---

## Customer authentication

Separate from admin. See [14_AUTHENTICATION_ARCHITECTURE.md](14_AUTHENTICATION_ARCHITECTURE.md).

| Method | Path | Auth |
|---|---|---|
| POST | `/auth/request-otp` | Public |
| POST | `/auth/verify-otp` | Public |
| POST | `/auth/refresh` | Public (`refresh_token` in JSON body) |
| POST | `/auth/logout` | Customer |
| POST | `/user/register` | Customer (post-OTP) |
| GET | `/user/profile` | Customer |
| PUT | `/user/profile` | Customer |
| POST | `/user/deactivate` | Customer |
| POST | `/profile/change-phone/request` | Customer |
| POST | `/profile/change-phone/verify` | Customer |

There is no `POST /auth/login` password endpoint and no forgot-password routes.

---

## Public / catalog

Mounted from `backend/routes/catalog.js` (and banners/status/settings).

| Method | Path |
|---|---|
| GET | `/status` |
| GET | `/settings/public` |
| GET | `/banners` |
| GET | `/categories` |
| GET | `/sim-configurations` |
| GET | `/brands` |
| GET | `/brands/:brandId/models` |
| GET | `/models/:modelId/storages` |
| GET | `/models/:modelId/colors` |
| GET | `/models/:modelId/watch-options` |
| GET | `/storage` |
| GET | `/conditions` |
| GET | `/cities` |
| GET | `/cities/:cityId/areas` |

---

## Listings (`backend/routes/listings.js`)

| Method | Path | Notes |
|---|---|---|
| GET | `/listings` | Marketplace; public statuses only (`approved`) |
| GET | `/listings/user/my` | Owner list |
| GET | `/listings/:id` | Detail; owner sees non-public |
| POST | `/listings` | Create |
| PUT | `/listings/:id` | Owner edit (moderation / revision rules) |
| PUT | `/listings/:id/mark-sold` | Owner, approved only |
| PATCH | `/listings/:id/hide` | approved → hidden |
| PATCH | `/listings/:id/unhide` | hidden → approved |
| DELETE | `/listings/:id` | Soft-delete |
| POST | `/listings/:id/view` | View count |

Images: `POST /upload/listing-images` (`backend/routes/upload.js`). URLs must be owned (`listingImageAuth.js`).

---

## Favorites, offers, notifications

| Method | Path |
|---|---|
| GET | `/favorites` |
| GET | `/favorites/ids` |
| GET | `/favorites/:listingId` |
| POST | `/favorites/:listingId` |
| DELETE | `/favorites/:listingId` |
| POST | `/offers/:listingId` |
| GET | `/offers/sent` |
| GET | `/offers/received` |
| GET | `/offers/received/unread-count` |
| PATCH | `/offers/:offerId/seen` |
| PATCH | `/offers/:offerId/accept` |
| PATCH | `/offers/:offerId/reject` |
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| PATCH | `/notifications/read-all` |
| PATCH | `/notifications/:id/read` |

---

## Admin (`/api/admin/...`)

All use admin JWT except login. Super Admin: `/admin/admins/*` and `PUT /admin/settings`.

| Method | Path |
|---|---|
| POST | `/admin/auth/login` |
| GET | `/admin/auth/me` |
| POST | `/admin/auth/change-password` |
| GET | `/admin/dashboard` |
| GET | `/admin/listings` |
| GET | `/admin/listings/brands` |
| GET | `/admin/listings/:id` |
| POST | `/admin/listings/:id/approve` |
| POST | `/admin/listings/:id/decline` |
| POST | `/admin/listings/:id/delete` |
| GET | `/admin/moderation-history` |
| GET/POST | `/admin/banners` |
| PUT/DELETE | `/admin/banners/:id` |
| GET/POST | `/admin/admins` |
| PUT | `/admin/admins/:id` |
| POST | `/admin/admins/:id/reset-password` |
| DELETE | `/admin/admins/:id` |
| GET | `/admin/users` |
| GET | `/admin/users/:id` |
| PUT | `/admin/users/:id/status` |
| GET | `/admin/reports/overview` |
| GET | `/admin/reports/charts` |
| GET | `/admin/reports/export` |
| GET | `/admin/settings` |
| PUT | `/admin/settings` |
| GET | `/admin/audit-logs` |
| GET | `/admin/audit-logs/:id` |
| GET | `/admin/notifications` |
| GET | `/admin/notifications/unread-count` |
| PATCH | `/admin/notifications/read-all` |
| PATCH | `/admin/notifications/:id/read` |
| POST | `/admin/upload/image` |

---

## Maintenance

When `maintenance_mode` is enabled, most **customer** `/api` routes return 503. Admin, `/api/health`, and `/api/status` remain available (`backend/middleware/checkMaintenanceMode.js`).

## Static files

`/uploads` is served from `backend/uploads/`.
