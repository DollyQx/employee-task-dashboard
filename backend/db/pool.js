const { Pool } = require('pg');

let pool;

function getPoolConfig(connectionString = process.env.DATABASE_URL) {
  const config = {
    connectionString,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
  };

  const isProd = process.env.NODE_ENV === 'production';
  const isLocal = !connectionString || connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const explicitSsl = process.env.DATABASE_SSL;
  const isCloudProvider = connectionString && (
    connectionString.includes('neon.tech') ||
    connectionString.includes('render.com') ||
    connectionString.includes('rds.amazonaws.com') ||
    connectionString.includes('supabase.co')
  );

  // SSL configuration:
  // Render, Neon, Supabase, and AWS RDS require SSL in production or when connection string specifies sslmode=require.
  // rejectUnauthorized defaults to false unless DATABASE_SSL_REJECT_UNAUTHORIZED=true, accommodating self-signed / provider CA bundles.
  if (explicitSsl === 'false') {
    config.ssl = false;
  } else if (
    explicitSsl === 'true' ||
    isCloudProvider ||
    (connectionString && connectionString.includes('sslmode=require')) ||
    (isProd && !isLocal)
  ) {
    config.ssl = {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    };
  }

  return config;
}

function getPool(customConnectionString) {
  const connStr = customConnectionString || process.env.DATABASE_URL;
  if (!connStr) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (customConnectionString) {
    return new Pool(getPoolConfig(customConnectionString));
  }

  if (!pool) {
    pool = new Pool(getPoolConfig());
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

module.exports = { checkDatabaseConnection, closeDatabasePool, getPool, getPoolConfig };
