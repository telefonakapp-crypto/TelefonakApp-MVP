# Admin Web — as implemented

Staff dashboard at `admin-web/`. Not available in the mobile app.

## Stack

Vite + React 19 + TypeScript + Tailwind 4 + TanStack Query + React Router 7.

API base: `VITE_API_URL` (see `admin-web/.env.example`), typically `http://localhost:3000/api`.

## Authentication

Email + password against `/api/admin/auth/login`. JWT stored client-side. Middleware on the API is `verifyAdminAuth`.

Roles in the `admins` table include `super_admin`. Only the **Admins** page (`/admins`) and **PUT `/api/admin/settings`** require Super Admin in the current UI/API. Other staff pages are available to any active admin.

Bootstrap the first Super Admin:

```bash
cd backend
npm run create-super-admin
```

## Pages

| Path | Purpose |
|---|---|
| `/login` | Staff login |
| `/` | Dashboard counts |
| `/listings` | Search/filter listings; approve, decline, delete |
| `/moderation-history` | Append-only moderation events |
| `/users` | Marketplace users; activate/deactivate |
| `/banners` | Marketing banners CRUD |
| `/notifications` | Staff notification inbox |
| `/reports` | Overview, charts, CSV export |
| `/settings` | Includes `auto_approve_listings` and `maintenance_mode` |
| `/audit-logs` | Admin audit trail |
| `/admins` | Super Admin: manage staff accounts |

## What Admin Web does not do

- It does not edit the phone/watch catalog through a dedicated catalog CMS (catalog is SQL-seeded).
- It does not use customer OTP or the `users` table for login.
- It is not a mobile screen.
