const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataType, newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');
const { seedDatabase } = require('../scripts/seed');
const { createApp } = require('../server');

let database;
let pool;
let app;
let server;
let baseUrl;

before(async () => {
  database = newDb();
  database.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
  });
  database.public.registerFunction({
    name: 'btrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value) => value.trim(),
  });
  database.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value) => value.length,
  });

  const { Pool: MemoryPool } = database.adapters.createPg();
  pool = new MemoryPool();
  await runMigrations({ pool });

  await seedDatabase({
    pool,
    superAdminEmail: 'admin@startizlabs.com',
    superAdminName: 'Dolly',
    demoPassword: 'TestPassword123!',
  });

  app = createApp({
    databaseCheck: async () => ({ available: true }),
    poolProvider: () => pool,
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

async function loginUser(email, password = 'TestPassword123!') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { token: data.token, user: data.user };
}

test('Leave Management: employee submits leave, views history, and manager approves', async () => {
  const employeeAuth = await loginUser('rahul.kumar@example.com');
  const superAdminAuth = await loginUser('admin@startizlabs.com');

  // 1. Employee submits leave request
  const submitRes = await fetch(`${baseUrl}/api/leaves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employeeAuth.token}`,
    },
    body: JSON.stringify({
      leave_type: 'casual',
      start_date: '2026-11-01',
      end_date: '2026-11-03',
      reason: 'Attending annual family event',
    }),
  });
  assert.equal(submitRes.status, 201, 'Leave submission should return 201');
  const submitData = await submitRes.json();
  assert.equal(submitData.leave.status, 'pending');
  assert.equal(Number(submitData.leave.days_count), 3);
  const leaveId = submitData.leave.id;

  // 2. Employee views own leaves
  const myRes = await fetch(`${baseUrl}/api/leaves/my`, {
    headers: { Authorization: `Bearer ${employeeAuth.token}` },
  });
  assert.equal(myRes.status, 200);
  const myData = await myRes.json();
  assert.ok(myData.leaves.some((l) => l.id === leaveId));

  // 3. Employee cannot review their own leave (403 RBAC)
  const empReviewRes = await fetch(`${baseUrl}/api/leaves/${leaveId}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employeeAuth.token}`,
    },
    body: JSON.stringify({ status: 'approved' }),
  });
  assert.equal(empReviewRes.status, 403, 'Employees must not be permitted to review leaves');

  // 4. Super Admin reviews and approves leave
  const reviewRes = await fetch(`${baseUrl}/api/leaves/${leaveId}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminAuth.token}`,
    },
    body: JSON.stringify({
      status: 'approved',
      review_notes: 'Approved. Enjoy your time off.',
    }),
  });
  assert.equal(reviewRes.status, 200);
  const reviewData = await reviewRes.json();
  assert.equal(reviewData.leave.status, 'approved');
  assert.equal(reviewData.leave.review_notes, 'Approved. Enjoy your time off.');
});

test('In-App Notifications: lists notifications, tracks unread counts, and marks read', async () => {
  const employeeAuth = await loginUser('rahul.kumar@example.com');

  // Fetch notifications
  const listRes = await fetch(`${baseUrl}/api/notifications`, {
    headers: { Authorization: `Bearer ${employeeAuth.token}` },
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(Array.isArray(listData.notifications));
  assert.equal(typeof listData.unreadCount, 'number');

  if (listData.notifications.length > 0) {
    const targetNotif = listData.notifications[0];
    const markRes = await fetch(`${baseUrl}/api/notifications/${targetNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${employeeAuth.token}` },
    });
    assert.equal(markRes.status, 200);
  }

  // Mark all read
  const markAllRes = await fetch(`${baseUrl}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeAuth.token}` },
  });
  assert.equal(markAllRes.status, 200);
});

test('Reporting & CSV Exports: work monitoring export and automation summary', async () => {
  const superAdminAuth = await loginUser('admin@startizlabs.com');
  const employeeAuth = await loginUser('rahul.kumar@example.com');

  // 1. Employee cannot export work monitoring CSV (403)
  const empExportRes = await fetch(`${baseUrl}/api/reports/export/work-monitoring-csv`, {
    headers: { Authorization: `Bearer ${employeeAuth.token}` },
  });
  assert.equal(empExportRes.status, 403);

  // 2. Super Admin exports work monitoring CSV (200)
  const saExportRes = await fetch(`${baseUrl}/api/reports/export/work-monitoring-csv`, {
    headers: { Authorization: `Bearer ${superAdminAuth.token}` },
  });
  assert.equal(saExportRes.status, 200);
  assert.ok(saExportRes.headers.get('content-type').includes('text/csv'));
  const csvContent = await saExportRes.text();
  assert.ok(csvContent.includes('Employee Name,Employee ID,Role'));

  // 3. Automation summary endpoint returns real database counts
  const sumRes = await fetch(`${baseUrl}/api/reports/automation-summary`, {
    headers: { Authorization: `Bearer ${superAdminAuth.token}` },
  });
  assert.equal(sumRes.status, 200);
  const sumData = await sumRes.json();
  assert.ok(sumData.summary.total_tasks >= 50);
  assert.equal(typeof sumData.summary.completion_rate, 'number');
});
