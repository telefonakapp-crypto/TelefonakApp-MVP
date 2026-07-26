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
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

5. Start the backend server:
```bash
npm start
# or for development
npm run dev
```

The server should now be running on `http://localhost:3000`

### 3. Mobile App Setup

1. Install Expo CLI globally (if not installed):
```bash
npm install -g expo-cli
```

2. Navigate to mobile directory:
```bash
cd mobile
```

3. Install dependencies:
```bash
npm install
```

4. Update API URLs in the following files:
   - `src/screens/LoginScreen.js`
   - `src/screens/OTPScreen.js`
   - `src/screens/RegisterScreen.js`

   Change `API_BASE_URL` to match your setup:
   - **Android Emulator**: `http://10.0.2.2:3000/api`
   - **iOS Simulator**: `http://localhost:3000/api`
   - **Physical Device**: `http://YOUR_COMPUTER_IP:3000/api` (e.g., `http://192.168.1.100:3000/api`)

5. Start the Expo development server:
```bash
npm start
```

6. Run on your device:
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app on physical device

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
  - Check backend is running
  - Verify API_BASE_URL is correct for your setup
  - For physical devices, ensure phone and computer are on same network
- **Expo errors**: 
  - Clear cache: `expo start -c`
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

- OTP expires after 10 minutes
- JWT tokens expire after 30 days (for authenticated users)
- Phone numbers must be in Jordanian format
- In development, OTP is shown in response for testing

