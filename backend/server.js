const express = require('express');
const cors = require('cors');

const crmRoutes = require('./routes/crm');
const helpdeskRoutes = require('./routes/helpdesk');
const { checkDatabaseConnection, closeDatabasePool, getPool } = require('./db/pool');
const { createAuthMiddleware, csrfProtection } = require('./middleware/auth');
const { createAuthRoutes } = require('./routes/auth');
const { createTasksRoutes } = require('./routes/tasks');
const { createEmployeesRoutes } = require('./routes/employees');
const { createDepartmentsRoutes } = require('./routes/departments');
const { createProjectsRoutes } = require('./routes/projects');
const { createClientsRoutes } = require('./routes/clients');
const { createReportsRoutes } = require('./routes/reports');
const { createNotificationsRoutes } = require('./routes/notifications');
const { createAuditRoutes } = require('./routes/audit');

const PORT = process.env.PORT || 3001;
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://employee-task-dashboard-chi.vercel.app',
];

function resolveAllowedOrigins() {
  const origins = new Set(defaultOrigins);
  if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean).forEach((o) => origins.add(o));
  }
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean).forEach((o) => origins.add(o));
  }
  return Array.from(origins);
}

function createApp({
  databaseCheck = checkDatabaseConnection,
  poolProvider = getPool,
  allowedOrigins = resolveAllowedOrigins(),
} = {}) {
  const app = express();
  app.disable('x-powered-by');

// ─── Security Headers Middleware ──────────────────────────────────────────────
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

// ─── Dynamic CORS Middleware ──────────────────────────────────────────────────
  const dynamicCors = (req, callback) => {
    const isMockRoute = req.path.startsWith('/api/crm') || req.path.startsWith('/api/helpdesk');
    const corsOptions = {
      origin: allowedOrigins,
      methods: isMockRoute ? ['GET'] : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
    callback(null, corsOptions);
  };
  app.use(cors(dynamicCors));

// ─── Body Parsers ─────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Authentication Context Middleware ────────────────────────────────────────
  const authenticate = createAuthMiddleware({ poolProvider });
  app.use(authenticate);

// ─── CSRF Protection ──────────────────────────────────────────────────────────
// Validates Origin/Referer on mutating cookie-based requests in production.
// Bearer-token requests (Authorization header) are exempt per the CSRF spec.
  app.use(csrfProtection(allowedOrigins));

// ─── Legacy Mock Integrations ─────────────────────────────────────────────────
// NOTE: Preserved for existing test suites and backward compatibility
  app.use('/api/crm', crmRoutes);
  app.use('/api/helpdesk', helpdeskRoutes);

// ─── Production Enterprise TaskFlow CRM Endpoints ─────────────────────────────
  app.use('/api/auth', createAuthRoutes({ poolProvider }));
  app.use('/api/tasks', createTasksRoutes({ poolProvider }));
  app.use('/api/employees', createEmployeesRoutes({ poolProvider }));
  app.use('/api/departments', createDepartmentsRoutes({ poolProvider }));
  app.use('/api/projects', createProjectsRoutes({ poolProvider }));
  app.use('/api/clients', createClientsRoutes({ poolProvider }));
  app.use('/api/reports', createReportsRoutes({ poolProvider }));
  app.use('/api/notifications', createNotificationsRoutes({ poolProvider }));
  app.use('/api/audit-logs', createAuditRoutes({ poolProvider }));

// ─── Health & Readiness Checks ────────────────────────────────────────────────
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
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is required in production.');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Aulten Digital - TaskFlow Enterprise CRM API`);
    console.log(`   Server running at http://localhost:${PORT}`);
    console.log(`   Health check:    http://localhost:${PORT}/api/health`);
    console.log(`   Readiness probe: http://localhost:${PORT}/api/ready`);
    console.log(`   CRM API:         http://localhost:${PORT}/api/tasks`);
    console.log(`   Employees:       http://localhost:${PORT}/api/employees`);
    console.log(`   Projects:        http://localhost:${PORT}/api/projects`);
    console.log(`   Clients CRM:     http://localhost:${PORT}/api/clients`);
    console.log(`   Legacy feeds:    http://localhost:${PORT}/api/crm/tasks`);
    console.log(`======================================================\n`);
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
