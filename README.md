# Telefonak

Jordan marketplace for buying and selling second-hand **phones and smartwatches**.

Three apps, one API, one PostgreSQL database:

- **Mobile** — Expo / React Native (JavaScript)
- **API** — Node.js / Express (`backend/`, port **3000**)
- **Admin Web** — Vite / React / TypeScript (`admin-web/`)

The running code is the source of truth. Index: [docs/README.md](docs/README.md).

## What the product does today

**Customers (mobile)**

- Jordan phone + OTP auth (refresh tokens)
- Browse approved listings (search + filters)
- Phones and smartwatches; catalog models or custom “Other”
- Create / edit listings (photos, moderation)
- Favorites, offers, notifications
- Hide / unhide, mark sold, delete own listings
- Profile, change phone, deactivate account
- English / Arabic, light / dark

**Staff (Admin Web)**

- Email + password (separate `admins` table)
- Moderate listings, users, banners, reports, settings (including maintenance and auto-approve), audit logs
- Super Admin manages other admins

Marketplace visibility is **approved listings only**. Full status lifecycle: [docs/06_DATABASE.md](docs/06_DATABASE.md).

## Architecture (short)

```text
mobile  --customer JWT-->  Express /api  -->  PostgreSQL
admin   --admin JWT------>       |
```

Home uses an **embedded bottom nav**, not a React Navigation tab navigator. Details: [docs/10_ARCHITECTURE.md](docs/10_ARCHITECTURE.md).

Auth split: [docs/14_AUTHENTICATION_ARCHITECTURE.md](docs/14_AUTHENTICATION_ARCHITECTURE.md).

## Repository

```text
backend/     API, SQL, security tests
mobile/       Expo app (`ios/` native project)
admin-web/    Staff dashboard
docs/         Current + historical docs
```

Root `npm start` / `npm dev` only proxy to `backend/`. Always `cd` into the app you are working on for `npm install`.

There is no Node `engines` pin in package.json. The API security harness uses Node’s built-in test runner (Node 18+).

## Local setup

### 1. PostgreSQL

```sql
CREATE DATABASE telefonak;
```

### 2. Backend

```bash
cd backend
npm install
cp env.example .env
# Set DB_* , JWT_SECRET, BASE_URL, CORS_ORIGINS (see env.example)
npm run dev
```

First start on an **empty** database applies the SQL catalog via `ensureDatabase` (48 files) and records them in `schema_migrations`. On an **already complete** database with empty tracking, it **baselines** filenames and does **not** replay historical SQL.

Do not run `psql … schema.sql` by itself as “the” setup. Do not replay all SQL on a populated database. Full contract and production baseline: [docs/06_DATABASE.md](docs/06_DATABASE.md).

Optional: `npm run init-db` (same init, then exit). Uses whatever `DB_*` is in `.env` — do not point this at production as a special targeting step.

Create the first Super Admin:

```bash
cd backend
npm run create-super-admin
```

### 3. Mobile (native iOS is the primary workflow)

Expo Go is **not** the primary workflow. See [docs/13_IOS_DEVELOPMENT_WORKFLOW.md](docs/13_IOS_DEVELOPMENT_WORKFLOW.md).

```bash
cd mobile
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL=http://localhost:3000
npm start
npx expo run:ios       # or npm run ios:native
```

Use the **Telefonak** simulator app, not Expo Go. Android emulator API URL: `http://10.0.2.2:3000`. Physical device: LAN IP.

### 4. Admin Web

```bash
cd admin-web
cp .env.example .env   # VITE_API_URL=http://localhost:3000/api
npm install
npm run dev            # http://localhost:5173
```

Allow that origin in backend `CORS_ORIGINS`.

## Testing

```bash
cd backend
npm run test:security
```

Local API must be running. See [backend/security-tests/README.md](backend/security-tests/README.md). Last documented baseline: **201 passed, 0 failed, 22 suites** (re-run after API changes).

Mobile util tests (Node, no Jest runner in package.json):

```bash
cd mobile
node src/utils/__tests__/listingOwnerCapabilities.test.js
# other files in src/utils/__tests__/
```

Admin: `cd admin-web && npm run lint` (oxlint). `npm run build` typechecks.

## Environment

Copy from `backend/env.example`, `mobile/.env.example`, `admin-web/.env.example`. Important API vars: `PORT`, `DB_*`, `JWT_SECRET` (prefer `JWT_CUSTOMER_SECRET` / `JWT_ADMIN_SECRET`), `BASE_URL`, `CORS_ORIGINS`, `TWILIO_*` for production SMS, optional `TRUST_PROXY=1` behind nginx.

Non-production OTP defaults to `1234` and may be returned in JSON. Production OTP is random and never echoed.

## Production notes

- `NODE_ENV=production`, strong secrets, HTTPS, Twilio, Postgres backups.
- First deploy of `schema_migrations` **must baseline** an existing populated DB. Procedure: [docs/06_DATABASE.md](docs/06_DATABASE.md).
- Rolling back to a binary that **replays all SQL on boot** is unsafe against live data.

## License

MIT
