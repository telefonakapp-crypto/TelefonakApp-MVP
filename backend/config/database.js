const { Pool, types } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/**
 * PostgreSQL DATE is a calendar day with no time and no timezone.
 * pg's default parser turns it into a local-midnight JS Date, which
 * res.json() then serializes via toISOString() — shifting the day by one
 * for any client whose offset isn't UTC. Keep the raw YYYY-MM-DD text so a
 * date-only value (e.g. users.date_of_birth) survives the round trip intact.
 */
const PG_TYPE_DATE = 1082;
types.setTypeParser(PG_TYPE_DATE, (value) => value);

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

