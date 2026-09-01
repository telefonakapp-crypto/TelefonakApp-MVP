const dotenv = require('dotenv');
const pool = require('../config/database');
const { ensureDatabase } = require('./ensureDatabase');

dotenv.config();

async function initDatabase() {
  try {
    const result = await ensureDatabase(pool);
    console.log(
      `[db] init-db finished: ${result.filesApplied} applied, ${result.filesSkipped} skipped${result.baselined ? ' (baseline)' : ''} in ${result.durationMs}ms`
    );
    process.exit(0);
  } catch (error) {
    console.error('[db] init-db aborted.');
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

initDatabase();
