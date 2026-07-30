# Authentication Architecture

Telefonak keeps customer and staff authentication completely separate.

## Customers (Mobile)

| | |
|---|---|
| Table | `users` |
| Credentials | Jordanian phone number + OTP |
| Middleware | `verifyToken` |
| Token claims | `userId`, `phoneNumber` (and short-lived `verified` during registration) |

Customer endpoints never read the `admins` table.

## Admin Web staff

| | |
|---|---|
| Table | `admins` |
| Credentials | Email + password (bcrypt) |
| Middleware | `verifyAdminAuth` (+ `requireSuperAdmin` where needed) |
| Token claims | `adminId`, `email`, `role` |
| Bootstrap | `npm run create-super-admin` |

Admin Web endpoints under `/api/admin/auth`, `/api/admin/dashboard`, `/api/admin/listings`, `/api/admin/banners`, `/api/admin/users`, `/api/admin/admins`, `/api/admin/reports`, `/api/admin/settings`, `/api/admin/audit-logs`, `/api/admin/notifications`, and `/api/admin/upload` authenticate **only** against `admins`.

Staff moderation alerts (`new_listing`) are stored in the shared `notifications` table with `admin_id` set (not `user_id`). Marketplace customer alerts continue to use `user_id`.

There is **no** mobile admin path and **no** `users.is_admin` column.
