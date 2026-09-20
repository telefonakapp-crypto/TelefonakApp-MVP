# Authentication architecture

Telefonak keeps customer and staff authentication completely separate.

## Customers (mobile)

| | |
|---|---|
| Table | `users` |
| Credentials | Jordanian phone (`07[789]xxxxxxx`) + OTP |
| Routes | `POST /api/auth/request-otp`, `verify-otp`, `refresh`, `logout` |
| Middleware | `verifyToken` (`backend/middleware/verifyToken.js`) |
| Tokens | Short-lived access JWT (default 15m) + refresh token in `auth_refresh_sessions` (default 30 days) |
| Storage | expo-secure-store via `mobile/src/utils/authSession.js` |
| Implementation | `backend/utils/customerAuth.js`, `backend/utils/otp.js` |

Customer endpoints never read the `admins` table. An admin JWT presented to a customer route is rejected.

Registration: `POST /api/user/register` after OTP, then profile fields. Phone change: `/api/profile/change-phone/*`.

**OTP in development:** non-production defaults to code `1234` and may echo the code in JSON. In `NODE_ENV=production`, OTP is random, not returned in responses, and Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) is required — the process refuses to start if they are missing or invalid. OTP request APIs do not report success if SMS delivery fails. `OTP_DEV_MODE` is ignored in production.

## Admin Web staff

| | |
|---|---|
| Table | `admins` |
| Credentials | Email + bcrypt password |
| Routes | `POST /api/admin/auth/login`, `GET /api/admin/auth/me`, `POST /api/admin/auth/change-password` |
| Middleware | `verifyAdminAuth` (+ `requireSuperAdmin` on admins CRUD and settings write) |
| Token claims | `adminId`, `email`, `role` |
| Lifetime | Access JWT default **8h** (`ADMIN_ACCESS_TOKEN_TTL`; production max 24h). No refresh rotation. Logout clears Admin Web `localStorage` only — the JWT stays valid until `exp`. |
| Bootstrap | `npm run create-super-admin` |

Admin mounts under `/api/admin/*` authenticate **only** against `admins`.

Staff alerts (`new_listing`) are stored in `notifications` with `admin_id` set. Customer alerts use `user_id`.

There is **no** mobile admin path and **no** `users.is_admin` column.

## Secrets

See `backend/env.example`. Customer JWTs use `JWT_CUSTOMER_SECRET`; admin JWTs use `JWT_ADMIN_SECRET`. In production both must be set, strong (16+ characters), and different — there is no fallback to `JWT_SECRET`. Local development may fall back to `JWT_SECRET` with a warning if a dedicated secret is unset.

Verification always requires issuer and audience (`jwt.verify` options). There is no compatibility path for tokens that only have a valid signature. Missing, wrong, or unsigned (`alg=none`) claims are rejected in every environment, including development.

| Token | Secret | Issuer | Audience | `typ` |
|---|---|---|---|---|
| Customer access / registration | `JWT_CUSTOMER_SECRET` | `telefonak-customer` | `telefonak-mobile` | `access` or `registration` |
| Admin Web | `JWT_ADMIN_SECRET` | `telefonak-admin` | `telefonak-admin-api` | `admin` |

OTP codes at rest are HMAC'd with `OTP_PEPPER`. Production requires a dedicated strong pepper (not a JWT secret). Development may fall back to the customer JWT secret if `OTP_PEPPER` is unset.

Admin access tokens default to 8 hours (`ADMIN_ACCESS_TOKEN_TTL`). Production startup fails if the configured TTL is longer than 24 hours.

## Rate limiting

Sensitive HTTP routes use **process-local** `express-rate-limit` MemoryStores (one store per limiter). This is suitable for a **single backend instance**. If Telefonak is deployed across multiple API instances, these IP limiters must be replaced with a shared store such as Redis.

| Limiter | Identifier | Window | Max (production) |
|---|---|---|---|
| OTP request | Client IP (`req.ip`) | 1 hour | 50 |
| OTP verify | Client IP (`req.ip`) | 15 minutes | 60 |
| Admin login | Client IP (`req.ip`) | 15 minutes | 20 |

OTP request and verify are also limited **per canonical phone** (`07XXXXXXXX`) in `utils/otp.js` (resend cooldown, hourly quota, 5 verify attempts per code). `TRUST_PROXY=1` trusts a single reverse-proxy hop; client `X-Forwarded-For` is not used when trust proxy is off.
