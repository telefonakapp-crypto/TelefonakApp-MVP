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

**OTP in development:** non-production defaults to code `1234` and may echo the code in JSON. In `NODE_ENV=production`, OTP is random, not returned in responses, and Twilio is required for SMS. `OTP_DEV_MODE` is ignored in production.

## Admin Web staff

| | |
|---|---|
| Table | `admins` |
| Credentials | Email + bcrypt password |
| Routes | `POST /api/admin/auth/login`, `GET /api/admin/auth/me`, `POST /api/admin/auth/change-password` |
| Middleware | `verifyAdminAuth` (+ `requireSuperAdmin` on admins CRUD and settings write) |
| Token claims | `adminId`, `email`, `role` |
| Lifetime | Long-lived access JWT (~30 days); no refresh rotation |
| Bootstrap | `npm run create-super-admin` |

Admin mounts under `/api/admin/*` authenticate **only** against `admins`.

Staff alerts (`new_listing`) are stored in `notifications` with `admin_id` set. Customer alerts use `user_id`.

There is **no** mobile admin path and **no** `users.is_admin` column.

## Secrets

See `backend/env.example`. Prefer dedicated `JWT_CUSTOMER_SECRET` and `JWT_ADMIN_SECRET`. `JWT_SECRET` remains a shared fallback for local/dev. Production should use strong distinct secrets (16+ characters).
