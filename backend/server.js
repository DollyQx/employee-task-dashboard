const express = require('express');
const cors = require('cors');

const crmRoutes = require('./routes/crm');
const helpdeskRoutes = require('./routes/helpdesk');
const { checkDatabaseConnection, closeDatabasePool } = require('./db/pool');

const PORT = process.env.PORT || 3001;
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://employee-task-dashboard-chi.vercel.app',
];

function createApp({ databaseCheck = checkDatabaseConnection } = {}) {
  const app = express();
  app.disable('x-powered-by');

// ─── Middleware ──────────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
      'Cache-Control': 'no-store',
    });
    next();
  });
  app.use(cors({
    origin: allowedOrigins,
    methods: ['GET'],
  }));

// ─── API Routes ──────────────────────────────────────────────────────────────
// NOTE: These are MOCK integrations — not real CRM or Helpdesk systems.
  app.use('/api/crm', crmRoutes);
  app.use('/api/helpdesk', helpdeskRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/ready', async (req, res) => {
    const database = await databaseCheck();
    const timestamp = new Date().toISOString();
    if (!database.available) {
      return res.status(503).json({
        status: 'not_ready',
        database: 'unavailable',
        reason: database.reason,
        timestamp,
      });
    }
    return res.json({ status: 'ready', database: 'available', timestamp });
  });

// ─── 404 Handler ─────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

// ─── Global Error Handler ────────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

const app = createApp();

// ─── Start Server ────────────────────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`\n✅ Employee Task Dashboard API`);
    console.log(`   Server running at http://localhost:${PORT}`);
    console.log(`   CRM tasks:      http://localhost:${PORT}/api/crm/tasks`);
    console.log(`   Helpdesk tasks: http://localhost:${PORT}/api/helpdesk/tasks`);
    console.log(`\n   ⚠️  Mock integrations only — not real external APIs\n`);
  });

  const shutdown = () => {
    server.close(() => {
      closeDatabasePool().catch((error) => {
        console.error('Failed to close PostgreSQL pool:', error.message);
        process.exitCode = 1;
      });
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

module.exports = app;
module.exports.createApp = createApp;
