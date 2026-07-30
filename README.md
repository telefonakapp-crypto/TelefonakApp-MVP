# Telefonak - Second-Hand Phone Marketplace

A mobile application for buying and selling second-hand phones in Jordan, built with React Native (frontend) and Node.js (backend) with PostgreSQL database.

## Features

- ✨ Beautiful splash screen
- 📱 Onboarding screens
- 🔐 Phone number authentication with OTP
- 👤 User registration with profile information
- 🎨 Modern gradient UI design

## Tech Stack

### Frontend
- React Native (Expo)
- React Navigation
- AsyncStorage
- Axios

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- Twilio (for SMS - configured but using mock in development)

## Project Structure

```
Telefonak/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── database/
│   │   └── schema.sql
│   ├── routes/
│   │   ├── auth.js
│   │   └── user.js
│   ├── .env.example
│   └── server.js
├── mobile/
│   ├── src/
│   │   └── screens/
│   │       ├── SplashScreen.js
│   │       ├── OnboardingScreen.js
│   │       ├── LoginScreen.js
│   │       ├── OTPScreen.js
│   │       ├── RegisterScreen.js
│   │       └── HomeScreen.js
│   ├── App.js
│   ├── app.json
│   └── package.json
└── README.md
```

## Setup Instructions

### Backend Setup

1. Install PostgreSQL and create a database:
```sql
CREATE DATABASE telefonak;
```

2. Navigate to backend directory:
```bash
cd backend
```

3. Install dependencies:
```bash
npm install
```

4. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

5. Update `.env` with your database credentials and JWT secret:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telefonak
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
BASE_URL=http://localhost:3000
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

`BASE_URL` is the public server origin used when the API builds absolute `/uploads/...` image URLs. On a physical device or staging host, set it to a reachable address (not `localhost`).

6. Run the database schema:
```bash
psql -U postgres -d telefonak -f database/schema.sql
```

7. Start the server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

### Mobile App Setup (native iOS)

Telefonak uses an Expo project with a generated native iOS app (`mobile/ios/`). **Expo Go is not the primary workflow.**

Full details: [`docs/13_IOS_DEVELOPMENT_WORKFLOW.md`](docs/13_IOS_DEVELOPMENT_WORKFLOW.md)

1. Navigate to mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Ensure the backend is running on port 3000. Configure the API URL:

```bash
cp .env.example .env
# Default EXPO_PUBLIC_API_URL=http://localhost:3000 works for iOS Simulator.
# Android emulator: http://10.0.2.2:3000
# Physical device:  http://YOUR_LAN_IP:3000
```

Then start Metro:
```bash
npm start
```

4. Build and launch the native Debug app on the iOS Simulator:
```bash
npx expo run:ios
```

Use the **Telefonak** app on the simulator (not Expo Go). For when to run `prebuild`, when a native rebuild is required, and troubleshooting (“No script URL provided”, Metro issues), see the workflow doc above.

## API Endpoints

### Authentication

- `POST /api/auth/request-otp` - Request OTP for phone number
  - Body: `{ "phone_number": "0791234567" }`

- `POST /api/auth/verify-otp` - Verify OTP
  - Body: `{ "phone_number": "0791234567", "otp": "123456" }`

### User

- `POST /api/user/register` - Register/Update user profile
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "first_name": "...", "last_name": "...", "gender": "male|female|other", ... }`

- `GET /api/user/profile` - Get user profile
  - Headers: `Authorization: Bearer <token>`

### Admin Web Authentication (email + password)

Admin Web uses a **separate** `admins` table and JWT. It does **not** use mobile OTP or the `users` table.

#### Final authentication architecture

| Audience | Table | Credentials | Middleware | Clients |
|----------|-------|-------------|------------|---------|
| Marketplace customers | `users` | Phone + OTP | `verifyToken` | Mobile app |
| Admin Web staff | `admins` | Email + password | `verifyAdminAuth` | Admin Web |

These two systems are **completely independent**. There is no mobile administrator role and no `users.is_admin` column.

**Create the first Super Admin** (run once; refuses if a `super_admin` already exists):

```bash
cd backend

# Non-interactive
SUPER_ADMIN_EMAIL=admin@telefonak.com \
SUPER_ADMIN_PASSWORD='your-secure-password' \
SUPER_ADMIN_FULL_NAME='Telefonak Super Admin' \
npm run create-super-admin

# Or interactive prompts
npm run create-super-admin
```

Required backend env (same as mobile API): `JWT_SECRET`, database vars in `backend/.env` (see `backend/env.example`). Optional seed vars: `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_FULL_NAME`.

**Login**

```bash
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@telefonak.com","password":"your-secure-password"}'
```

Example response:

```json
{
  "token": "<admin-jwt>",
  "admin": {
    "id": 1,
    "full_name": "Telefonak Super Admin",
    "email": "admin@telefonak.com",
    "role": "super_admin",
    "is_active": true,
    "last_login": "...",
    "created_at": "...",
    "updated_at": "...",
    "created_by": null,
    "updated_by": null
  }
}
```

**Current admin**

```bash
curl http://localhost:3000/api/admin/auth/me \
  -H "Authorization: Bearer <admin-jwt>"
```

**Change password**

```bash
curl -X POST http://localhost:3000/api/admin/auth/change-password \
  -H "Authorization: Bearer <admin-jwt>" \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"old-password","new_password":"new-secure-password"}'
```

Admin JWT payload: `{ adminId, email, role }` (30-day expiry). Roles are stored for later RBAC; only auth is enforced in this phase (`is_active`).

## Admin Web Setup

The Admin Dashboard is a separate Vite + React app in `admin-web/`. It talks to the same backend via Admin JWT (`/api/admin/auth/*`).

1. Ensure the backend is running and a Super Admin exists (`npm run create-super-admin` in `backend/`).
2. Configure CORS so the Admin Web origin is allowed (see `CORS_ORIGINS` in `backend/env.example`).
3. Start Admin Web:

```bash
cd admin-web
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with the Super Admin email/password.

Production build:

```bash
cd admin-web
npm run build
# Serve the contents of dist/ behind HTTPS (nginx, CDN, etc.)
```

Set `VITE_API_URL` to your public API base including `/api` before building.

## Production / Deployment Notes

- Set `NODE_ENV=production`.
- Require a strong `JWT_SECRET` (16+ chars), `BASE_URL`, and `CORS_ORIGINS`.
- Set `TRUST_PROXY=1` when the API sits behind nginx or a load balancer (needed for accurate rate limiting).
- Configure Twilio (`TWILIO_*`) for real OTP SMS. In production, OTP codes are random and are **not** returned in API responses.
- Database migrations apply automatically on backend start via `ensureDatabase` (idempotent SQL files under `backend/database/`).
- Keep regular PostgreSQL backups before and after deploys.
- Prefer reverse-proxy TLS (HTTPS) terminating at nginx/Cloudflare; do not expose Postgres publicly.

## Launch Readiness Checklist (summary)

See Phase 10 report in the project handover notes. Before go-live verify:

- [ ] Strong secrets and production env vars set
- [ ] Postgres backups + restore tested
- [ ] HTTPS on API and Admin Web
- [ ] Twilio OTP delivery verified
- [ ] Admin Super Admin credentials rotated from defaults
- [ ] `/api/health` monitored
- [ ] Rate limits and CORS allowlists confirmed

## Development Notes

- In non-production, OTP defaults to `1234` and may be returned in the API response for testing
- In production, OTP is random and never echoed in JSON; configure Twilio for SMS
- The app uses AsyncStorage to persist authentication state
- Phone numbers should be in Jordanian format (07XXXXXXXX)

## License

MIT

