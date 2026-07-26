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
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

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

### Mobile App Setup

1. Navigate to mobile directory:
```bash
cd mobile
```

2. Install dependencies:
```bash
npm install
```

3. Update API_BASE_URL in the screen files (LoginScreen.js, OTPScreen.js, RegisterScreen.js):
   - For Android emulator: `http://10.0.2.2:3000/api`
   - For iOS simulator: `http://localhost:3000/api`
   - For physical device: `http://YOUR_COMPUTER_IP:3000/api`

4. Start the Expo development server:
```bash
npm start
```

5. Scan the QR code with Expo Go app or press `a` for Android / `i` for iOS simulator.

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

## Development Notes

- In development mode, the OTP is returned in the API response for testing purposes
- For production, configure Twilio credentials in `.env` to enable SMS sending
- The app uses AsyncStorage to persist authentication state
- Phone numbers should be in Jordanian format (07XXXXXXXX)

## License

MIT

