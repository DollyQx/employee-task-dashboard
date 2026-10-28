const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    pool.on('error', (error) => {
      console.error('Unexpected PostgreSQL pool error:', error.message);
    });
  }

  return pool;
}

async function checkDatabaseConnection(poolOverride) {
  if (!poolOverride && !process.env.DATABASE_URL) {
    return { available: false, reason: 'not_configured' };
  }

  try {
    await (poolOverride || getPool()).query('SELECT 1');
    return { available: true };
  } catch (error) {
    console.error('PostgreSQL readiness check failed:', error.message);
    return { available: false, reason: 'unavailable' };
  }
}

async function closeDatabasePool() {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}

module.exports = { checkDatabaseConnection, closeDatabasePool, getPool };
