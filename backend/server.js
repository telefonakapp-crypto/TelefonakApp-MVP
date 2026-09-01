const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { validateEnv, isProduction, getCustomerJwtSecret, getAdminJwtSecret } = require('./config/env');
const pool = require('./config/database');
const { ensureDatabase } = require('./scripts/ensureDatabase');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const phoneChangeRoutes = require('./routes/phoneChange');
const listingsRoutes = require('./routes/listings');
const adminAuthRoutes = require('./routes/adminAuth');
const adminDashboardRoutes = require('./routes/adminDashboard');
const adminListingsRoutes = require('./routes/adminListings');
const adminBannersRoutes = require('./routes/adminBanners');
const adminAdminsRoutes = require('./routes/adminAdmins');
const adminUsersRoutes = require('./routes/adminUsers');
const adminReportsRoutes = require('./routes/adminReports');
const adminModerationHistoryRoutes = require('./routes/adminModerationHistory');
const adminSettingsRoutes = require('./routes/adminSettings');
const adminAuditLogsRoutes = require('./routes/adminAuditLogs');
const adminUploadRoutes = require('./routes/adminUpload');
const adminNotificationsRoutes = require('./routes/adminNotifications');
const bannersRoutes = require('./routes/banners');
const favoritesRoutes = require('./routes/favorites');
const notificationsRoutes = require('./routes/notifications');
const offersRoutes = require('./routes/offers');
const uploadRoutes = require('./routes/upload');
const catalogRoutes = require('./routes/catalog');
const statusRoutes = require('./routes/status');
const publicSettingsRoutes = require('./routes/publicSettings');
const checkMaintenanceMode = require('./middleware/checkMaintenanceMode');
const { isMaintenanceModeEnabled } = require('./utils/settings');

try {
  validateEnv();
  getCustomerJwtSecret();
  getAdminJwtSecret();
} catch (error) {
  console.error('[env]', error.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Needed so express-rate-limit sees the real client IP behind nginx/load balancers.
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    // Admin Web and mobile load /uploads images cross-origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

function buildCorsOptions() {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'ngrok-skip-browser-warning',
  ];

  if (!raw) {
    if (isProduction()) {
      // validateEnv already requires CORS_ORIGINS in production; this is a safety net.
      return { origin: false, credentials: true, methods, allowedHeaders };
    }
    // Development: allow any origin (mobile devices / Expo / Vite).
    return {
      origin: true,
      credentials: true,
      methods,
      allowedHeaders,
    };
  }

  const allowlist = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    origin(origin, callback) {
      // Non-browser clients (curl, mobile native) often omit Origin.
      if (!origin || allowlist.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods,
    allowedHeaders,
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global maintenance gate for customer APIs. Admin + status/health are exempt.
app.use('/api', checkMaintenanceMode);

app.use('/api/status', statusRoutes);
app.use('/api/settings/public', publicSettingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/profile/change-phone', phoneChangeRoutes);
app.use('/api', listingsRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/listings', adminListingsRoutes);
app.use('/api/admin/banners', adminBannersRoutes);
app.use('/api/admin/admins', adminAdminsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/reports', adminReportsRoutes);
app.use('/api/admin/moderation-history', adminModerationHistoryRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/audit-logs', adminAuditLogsRoutes);
app.use('/api/admin/upload', adminUploadRoutes);
app.use('/api/admin/notifications', adminNotificationsRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', catalogRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const maintenance = await isMaintenanceModeEnabled();
    res.json({
      status: maintenance ? 'maintenance' : 'OK',
      maintenance,
      message: maintenance
        ? 'Telefonak is currently undergoing maintenance.'
        : 'Telefonak API is running',
    });
  } catch (error) {
    res.json({ status: 'OK', maintenance: false, message: 'Telefonak API is running' });
  }
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — never leak stack traces or internal messages in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('[error]', err);
  const status = err.status || err.statusCode || 500;
  const message =
    isProduction() && status >= 500
      ? 'Internal server error'
      : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

async function start() {
  try {
    await ensureDatabase(pool);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`[env] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[db] Refusing to start server because database initialization failed.');
    console.error('[db] Fix the database error above, then restart the backend.');
    process.exit(1);
  }
}

start();
