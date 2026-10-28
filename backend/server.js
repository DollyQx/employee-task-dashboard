const express = require('express');
const cors = require('cors');

const crmRoutes = require('./routes/crm');
const helpdeskRoutes = require('./routes/helpdesk');

const app = express();
const PORT = process.env.PORT || 3001;
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://employee-task-dashboard-chivel.vercel.app',
];

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: allowedOrigins,
}));
app.use(express.json());

// ─── API Routes ──────────────────────────────────────────────────────────────
// NOTE: These are MOCK integrations — not real CRM or Helpdesk systems.
app.use('/api/crm', crmRoutes);
app.use('/api/helpdesk', helpdeskRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// ─── Start Server ────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n✅ Employee Task Dashboard API`);
    console.log(`   Server running at http://localhost:${PORT}`);
    console.log(`   CRM tasks:      http://localhost:${PORT}/api/crm/tasks`);
    console.log(`   Helpdesk tasks: http://localhost:${PORT}/api/helpdesk/tasks`);
    console.log(`\n   ⚠️  Mock integrations only — not real external APIs\n`);
  });
}

module.exports = app;
