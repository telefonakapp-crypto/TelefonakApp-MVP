# Telefonak Setup Guide

## Prerequisites

1. **Node.js** (v14 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Expo CLI** (for mobile app)
4. **npm** or **yarn**

## Step-by-Step Setup

### 1. Database Setup

1. Install PostgreSQL if not already installed
2. Create a new database:
```sql
CREATE DATABASE telefonak;
```

3. Run the schema:
```bash
psql -U postgres -d telefonak -f backend/database/schema.sql
```

Or connect to PostgreSQL and run the SQL file manually.

### 2. Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp env.example .env
```

4. Edit `.env` with your settings:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telefonak
DB_USER=postgres
DB_PASSWORD=your_actual_password
JWT_CUSTOMER_SECRET=your_distinct_customer_jwt_secret_here
JWT_ADMIN_SECRET=your_distinct_admin_jwt_secret_here
# SMS provider is optional for local development (OTP defaults to 1234).
# Production (NODE_ENV=production) will not start unless these are valid.
# Leave SMS_PASSWORD empty here and set it only in the server environment.
SMS_API_URL=https://sms.thecaptainjo.com:8445/websmpp/websms
SMS_USERNAME=Telefonak
SMS_PASSWORD=
SMS_SENDER_ID=Telefonak
SMS_TYPE=3
```

5. Start the backend server:
```bash
npm start
# or for development
npm run dev
```

The server should now be running on `http://localhost:3000`

### 3. Mobile App Setup (native iOS)

> **Source of truth for day-to-day iOS work:** [`docs/13_IOS_DEVELOPMENT_WORKFLOW.md`](docs/13_IOS_DEVELOPMENT_WORKFLOW.md)
>
> This project uses a prebuilt native iOS app under `mobile/ios/`. Do **not** use Expo Go as the primary runner.

1. Prerequisites: Xcode + iOS Simulator installed.

2. Navigate to mobile directory:
```bash
cd mobile
```

3. Install dependencies:
```bash
npm install
```

4. With the backend already running on port 3000, start Metro:
```bash
npm start
```

5. In a second terminal, build and launch the native Debug app:
```bash
cd mobile
npx expo run:ios
```

Optional (Metro already running):
```bash
npx expo run:ios --no-bundler
```

Open the **Telefonak** app on the simulator. See the workflow doc for `prebuild`, rebuild rules, and troubleshooting.

## Testing

### Test Phone Numbers
Use Jordanian phone format: `07XXXXXXXX` (10 digits starting with 07)

### Development Mode
In development, the OTP code is returned in the API response for testing. Check the console or alert messages.

### Example Test Flow
1. Enter phone number: `0791234567`
2. Request OTP
3. Check console/alert for OTP code (in development)
4. Enter OTP
5. Complete registration form
6. Access home screen

## Troubleshooting

### Backend Issues
- **Database connection error**: Check PostgreSQL is running and credentials in `.env` are correct
- **Port already in use**: Change `PORT` in `.env` to a different port
- **Module not found**: Run `npm install` again in backend directory

### Mobile App Issues
- **Cannot connect to API**: 
  - Check backend is running on port 3000
  - For physical devices, ensure phone and computer are on same network
- **No script URL provided** / **Could not connect to the server** / stale native builds:
  - Follow [`docs/13_IOS_DEVELOPMENT_WORKFLOW.md`](docs/13_IOS_DEVELOPMENT_WORKFLOW.md) §7
  - Confirm Metro on `:8081`, then `npx expo run:ios` (rebuild if needed)
- **Metro / Expo bundler errors**: 
  - Clear cache: `npx expo start --clear`
  - Reinstall dependencies: `rm -rf node_modules && npm install`
- **Navigation errors**: 
  - Ensure all screens are properly imported
  - Check navigation flow in App.js

## Production Deployment

### Backend
1. Set `NODE_ENV=production` in `.env`
2. Configure proper Twilio credentials for SMS
3. Use a process manager like PM2
4. Set up HTTPS
5. Configure proper CORS settings

### Mobile App
1. Build standalone app with `expo build`
2. Update API_BASE_URL to production backend URL
3. Configure app icons and splash screens
4. Submit to App Store / Google Play

## Notes

- OTP expires after 5 minutes in production (see `backend/config/otp.js`)
- Customer access JWTs default to 15 minutes (refresh sessions 30 days)
- Admin Web access JWTs default to 8 hours (`ADMIN_ACCESS_TOKEN_TTL`; production max 24h)
- Phone numbers must be in Jordanian format
- In development, OTP is shown in response for testing

