const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataType, newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');
const { hashPassword, verifyPassword } = require('../utils/auth');
const { createApp } = require('../server');
const { seedDatabase } = require('../scripts/seed');

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

  // Run seed script against in-memory database
  await seedDatabase({ pool, demoPassword: 'TestPassword123!' });

  app = createApp({
    databaseCheck: async () => ({ available: true }),
    poolProvider: () => pool,
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    server.close();
  }
  if (pool) {
    await pool.end();
  }
});

test('password hashing uses secure scrypt and verifies matches accurately', async () => {
  const password = 'SuperSecret123!@#';
  const hashed = await hashPassword(password);
  assert.ok(hashed.startsWith('scrypt$'));

  const isMatch = await verifyPassword(password, hashed);
  assert.equal(isMatch, true);

  const isWrong = await verifyPassword('WrongPassword', hashed);
  assert.equal(isWrong, false);
});

test('idempotent database seeding populates Aulten Digital employees, projects, and tasks', async () => {
  const orgRes = await pool.query("SELECT id FROM organizations WHERE slug = 'aulten-digital'");
  assert.equal(orgRes.rows.length, 1);
  const orgId = orgRes.rows[0].id;

  const usersRes = await pool.query('SELECT COUNT(*) FROM users WHERE organization_id = $1', [orgId]);
  assert.ok(parseInt(usersRes.rows[0].count, 10) >= 15);

  const projectsRes = await pool.query('SELECT COUNT(*) FROM projects WHERE organization_id = $1', [orgId]);
  assert.ok(parseInt(projectsRes.rows[0].count, 10) >= 5);

  const tasksRes = await pool.query('SELECT COUNT(*) FROM tasks WHERE organization_id = $1', [orgId]);
  assert.ok(parseInt(tasksRes.rows[0].count, 10) >= 40);

  // Run seed a second time to verify idempotency without constraint errors
  await assert.doesNotReject(seedDatabase({ pool, demoPassword: 'TestPassword123!' }));
});

test('login rejects invalid credentials and accepts valid demo account', async () => {
  const invalidRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'WrongPassword!' }),
  });
  assert.equal(invalidRes.status, 401);

  const validRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'TestPassword123!' }),
  });
  assert.equal(validRes.status, 200);
  const data = await validRes.json();
  assert.ok(data.token);
  assert.equal(data.user.email, 'aarav.sharma@example.com');
  assert.equal(data.user.crm_role, 'super_admin');
});

test('role-based access control blocks employees from audit logs and allows admins', async () => {
  // 1. Login as Employee (Rahul Kumar)
  const empLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul.kumar@example.com', password: 'TestPassword123!' }),
  });
  const empData = await empLogin.json();
  const empToken = empData.token;

  // 2. Employee tries to access audit logs -> 403 Forbidden
  const forbiddenAudit = await fetch(`${baseUrl}/api/audit-logs`, {
    headers: { Authorization: `Bearer ${empToken}` },
  });
  assert.equal(forbiddenAudit.status, 403);

  // 3. Login as Super Admin (Aarav Sharma)
  const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'TestPassword123!' }),
  });
  const adminData = await adminLogin.json();
  const adminToken = adminData.token;

  // 4. Super Admin accesses audit logs -> 200 OK
  const allowedAudit = await fetch(`${baseUrl}/api/audit-logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(allowedAudit.status, 200);
  const auditJson = await allowedAudit.json();
  assert.ok(Array.isArray(auditJson.auditLogs));
});

test('task lifecycle: create, update status on kanban, add comment, and delete', async () => {
  // Login as Manager (Sneha Gupta)
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sneha.gupta@example.com', password: 'TestPassword123!' }),
  });
  const { token } = await loginRes.json();

  // Create Task
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Automated Test Task for Lifecycle Verification',
      description: 'Verifying end-to-end task creation, status transition, and comments.',
      crm_priority: 'high',
      crm_status: 'todo',
      due_date: '2026-11-20',
      estimated_hours: 6,
    }),
  });
  assert.equal(createRes.status, 201);
  const { task } = await createRes.json();
  assert.ok(task.id);
  assert.ok(task.task_code.startsWith('TASK-2026-'));

  // Move status on Kanban to 'in_progress'
  const patchRes = await fetch(`${baseUrl}/api/tasks/${task.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.equal(patched.task.crm_status, 'in_progress');

  // Add Comment
  const commentRes = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ comment: 'Automated test verification comment.' }),
  });
  assert.equal(commentRes.status, 201);

  // List comments
  const listCommentsRes = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(listCommentsRes.status, 200);
  const commentsData = await listCommentsRes.json();
  assert.equal(commentsData.comments.length, 1);
  assert.equal(commentsData.comments[0].comment, 'Automated test verification comment.');

  // Delete Task
  const deleteRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(deleteRes.status, 200);
});

test('reports dashboard returns real calculated metrics and CSV export works safely', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@example.com', password: 'TestPassword123!' }),
  });
  const { token } = await loginRes.json();

  const reportRes = await fetch(`${baseUrl}/api/reports/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(reportRes.status, 200);
  const data = await reportRes.json();
  assert.ok(data.kpis);
  assert.ok(parseInt(data.kpis.active_employees, 10) > 0);
  assert.ok(parseInt(data.kpis.open_tasks, 10) > 0);

  // Export CSV
  const csvRes = await fetch(`${baseUrl}/api/reports/export-csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(csvRes.status, 200);
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Task Code,Title,Status,Priority'));
  assert.ok(csvText.includes('TASK-2026-'));
});
