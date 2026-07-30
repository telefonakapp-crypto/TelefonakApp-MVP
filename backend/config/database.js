const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telefonak',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

let hasLoggedConnect = false;

pool.on('connect', () => {
  if (!hasLoggedConnect) {
    hasLoggedConnect = true;
    console.log('[db] PostgreSQL pool ready');
  }
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message || err);
  process.exit(-1);
});

module.exports = pool;

