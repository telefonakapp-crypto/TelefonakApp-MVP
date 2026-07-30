const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const pool = require('./config/database');
const { ensureDatabase } = require('./scripts/ensureDatabase');
const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/user');
const phoneChangeRoutes = require('./routes/phoneChange');
const listingsRoutes = require('./routes/listings');
const adminRoutes   = require('./routes/admin');
const adsRoutes     = require('./routes/ads');
const bannersRoutes = require('./routes/banners');
const favoritesRoutes = require('./routes/favorites');
const notificationsRoutes = require('./routes/notifications');
const offersRoutes = require('./routes/offers');
const uploadRoutes  = require('./routes/upload');
const catalogRoutes = require('./routes/catalog');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (including ngrok)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/profile/change-phone', phoneChangeRoutes);
app.use('/api', listingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', catalogRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Telefonak API is running' });
});

async function start() {
  try {
    // Apply any missing schema/seed/migrations before accepting traffic.
    // Scripts are idempotent — safe on every restart (including nodemon).
    await ensureDatabase(pool);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[db] Refusing to start server because database initialization failed.');
    console.error('[db] Fix the database error above, then restart the backend.');
    process.exit(1);
  }
}

start();
