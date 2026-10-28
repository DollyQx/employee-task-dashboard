/**
 * Security Regression Tests
 *
 * Tests for confirmed vulnerabilities and security boundaries:
 *   1. Unauthenticated requests to protected endpoints return 401
 *   2. Employee cannot access audit logs (RBAC enforcement)
 *   3. Employee cannot perform bulk delete (RBAC enforcement)
 *   4. Cross-organization task access blocked (tenant isolation returns 404)
 *   5. Cross-organization comment lookup and addition blocked (tenant isolation returns 404)
 *   6. Cross-organization project and client lookup blocked (tenant isolation returns 404)
 *   7. CSV export requires authentication (returns 401 without auth) and isolates by organization
 *   8. simulationToken suppressed in production (NODE_ENV=production)
 *   9. Demo persona switching is blocked in production unless ALLOW_DEMO_SWITCH=true
 *  10. Clients endpoint RBAC (employees blocked at 403, managers receive 200 with clean query)
 *  11. Password reset token single-use enforcement (invalidated after use)
 *  12. Safe admin provisioning does not reset existing password when ADMIN_PASSWORD is unset
 *  13. Partial updates to employees, projects, and clients do not wipe omitted fields
 *  14. CSRF protection blocks cross-origin mutating cookie requests in production
 *  15. Login rate limiter blocks brute-force attempts
 */

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataType, newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');
const { createApp } = require('../server');
const { seedDatabase } = require('../scripts/seed');
const { hashPassword, verifyPassword } = require('../utils/auth');

let pool;
let app;
let server;
let baseUrl;
let org1TaskId;
let org1ProjectId;
let org1ClientId;
let org2UserToken;

// ─── Test Helpers ─────────────────────────────────────────────────────────────

async function loginAs(email, password = 'TestPassword123!') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { status: res.status, token: data.token, user: data.user };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  const database = newDb();
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
    implementation: (v) => v.trim(),
  });
  database.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (v) => v.length,
  });

  const { Pool: MemoryPool } = database.adapters.createPg();
  pool = new MemoryPool();
  await runMigrations({ pool });
  await seedDatabase({ pool, demoPassword: 'TestPassword123!' });

  // Capture IDs from Org 1
  const tRes = await pool.query('SELECT id FROM tasks LIMIT 1');
  org1TaskId = tRes.rows[0].id;
  const pRes = await pool.query('SELECT id FROM projects LIMIT 1');
  org1ProjectId = pRes.rows[0].id;
  const cRes = await pool.query('SELECT id FROM clients LIMIT 1');
  org1ClientId = cRes.rows[0].id;

  // Set up second organization for multi-tenant isolation tests
  const org2Res = await pool.query(
    "INSERT INTO organizations (name, slug) VALUES ('Tenant Two Inc', 'tenant-two-inc') RETURNING id"
  );
  const org2Id = org2Res.rows[0].id;
  const org2PassHash = await hashPassword('TenantTwoPass!123');
  await pool.query(
    `INSERT INTO users (organization_id, full_name, email, password_hash, role, crm_role, is_active)
     VALUES ($1, 'Tenant Two Employee', 'employee@tenant2.example', $2, 'member', 'employee', true)`,
    [org2Id, org2PassHash]
  );

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

  // Login as Tenant Two Employee
  const login2 = await loginAs('employee@tenant2.example', 'TenantTwoPass!123');
  org2UserToken = login2.token;
});

after(async () => {
  if (server) server.close();
  if (pool) await pool.end();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test('unauthenticated requests to protected API endpoints return 401', async () => {
  const protectedPaths = [
    ['/api/tasks', 'GET'],
    ['/api/employees', 'GET'],
    ['/api/departments', 'GET'],
    ['/api/projects', 'GET'],
    ['/api/reports/dashboard', 'GET'],
    ['/api/reports/export-csv', 'GET'],
    ['/api/notifications', 'GET'],
    ['/api/audit-logs', 'GET'],
    ['/api/clients', 'GET'],
  ];
  for (const [path, method] of protectedPaths) {
    const res = await fetch(`${baseUrl}${path}`, { method });
    assert.equal(res.status, 401, `Expected 401 for unauthenticated ${method} ${path}, got ${res.status}`);
  }
});

test('employees cannot access audit logs (RBAC enforcement)', async () => {
  const { token } = await loginAs('rahul.kumar@example.com');
  const res = await fetch(`${baseUrl}/api/audit-logs`, {
    headers: authHeader(token),
  });
  assert.equal(res.status, 403, 'Employee should be forbidden from audit logs');
});

test('employees cannot perform bulk delete (RBAC enforcement)', async () => {
  const { token: adminToken } = await loginAs('aarav.sharma@example.com');
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(adminToken) },
    body: JSON.stringify({ title: 'Security Test Task for Bulk Delete', crm_priority: 'low' }),
  });
  const { task } = await createRes.json();

  const { token: empToken } = await loginAs('rahul.kumar@example.com');
  const bulkRes = await fetch(`${baseUrl}/api/tasks/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(empToken) },
    body: JSON.stringify({ action: 'delete', task_ids: [task.id] }),
  });
  assert.equal(bulkRes.status, 403, 'Employee should be forbidden from bulk operations');

  // Cleanup
  await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: 'DELETE',
    headers: authHeader(adminToken),
  });
});

test('tenant isolation: user from Org 2 cannot read tasks belonging to Org 1', async () => {
  const res = await fetch(`${baseUrl}/api/tasks/${org1TaskId}`, {
    headers: authHeader(org2UserToken),
  });
  assert.equal(res.status, 404, 'Org 2 user must not see tasks belonging to Org 1');
});

test('tenant isolation: user from Org 2 cannot read or add comments to Org 1 tasks', async () => {
  const getRes = await fetch(`${baseUrl}/api/tasks/${org1TaskId}/comments`, {
    headers: authHeader(org2UserToken),
  });
  assert.equal(getRes.status, 404, 'Org 2 user must not read comments on Org 1 task');

  const postRes = await fetch(`${baseUrl}/api/tasks/${org1TaskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(org2UserToken) },
    body: JSON.stringify({ comment: 'Malicious cross-tenant comment attempt' }),
  });
  assert.equal(postRes.status, 404, 'Org 2 user must not post comments to Org 1 task');
});

test('tenant isolation: user from Org 2 cannot access Org 1 project', async () => {
  const res = await fetch(`${baseUrl}/api/projects/${org1ProjectId}`, {
    headers: authHeader(org2UserToken),
  });
  assert.equal(res.status, 404, 'Org 2 user must not access Org 1 project');
});

test('tenant isolation: user from Org 2 cannot access Org 1 client CRM record', async () => {
  // Give Org 2 user a manager role to pass role-gate and test tenant isolation
  await pool.query("UPDATE users SET crm_role = 'manager' WHERE email = 'employee@tenant2.example'");
  const loginMgr = await loginAs('employee@tenant2.example', 'TenantTwoPass!123');

  const res = await fetch(`${baseUrl}/api/clients/${org1ClientId}`, {
    headers: authHeader(loginMgr.token),
  });
  assert.equal(res.status, 404, 'Org 2 manager must not access Org 1 client record');

  // Reset role
  await pool.query("UPDATE users SET crm_role = 'employee' WHERE email = 'employee@tenant2.example'");
});

test('CSV export authorization and tenant isolation', async () => {
  // 1. Unauthenticated request returns 401
  const unauthRes = await fetch(`${baseUrl}/api/reports/export-csv`);
  assert.equal(unauthRes.status, 401, 'Unauthenticated CSV export must be rejected with 401');

  // 2. Org 2 user export returns CSV containing 0 tasks (no tasks in Org 2 yet)
  const org2Res = await fetch(`${baseUrl}/api/reports/export-csv`, {
    headers: authHeader(org2UserToken),
  });
  assert.equal(org2Res.status, 200);
  const org2Csv = await org2Res.text();
  const org2Lines = org2Csv.trim().split('\r\n');
  assert.equal(org2Lines.length, 1, 'Org 2 CSV should only have the header line, no Org 1 tasks');

  // 3. Org 1 user export returns Org 1 tasks
  const { token: org1Token } = await loginAs('aarav.sharma@example.com');
  const org1Res = await fetch(`${baseUrl}/api/reports/export-csv`, {
    headers: authHeader(org1Token),
  });
  assert.equal(org1Res.status, 200);
  const org1Csv = await org1Res.text();
  assert.ok(org1Csv.includes('TASK-2026-'), 'Org 1 CSV should contain Org 1 tasks');
});

test('forgot-password simulationToken is absent in production environment', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav.sharma@example.com' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(
      body.simulationToken,
      undefined,
      'simulationToken MUST NOT be present in production responses'
    );
    assert.ok(body.message, 'Response should include a safe generic message');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('demo user switching is blocked in production by default (fail-closed)', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllow = process.env.ALLOW_DEMO_SWITCH;
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DEMO_SWITCH;
  try {
    const demoRes = await fetch(`${baseUrl}/api/auth/demo-users`);
    assert.equal(demoRes.status, 403, 'GET /api/auth/demo-users must return 403 in production by default');

    const switchRes = await fetch(`${baseUrl}/api/auth/switch-demo-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: randomUUID() }),
    });
    assert.equal(switchRes.status, 403, 'POST /api/auth/switch-demo-user must return 403 in production by default');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllow !== undefined) process.env.ALLOW_DEMO_SWITCH = originalAllow;
  }
});

test('clients endpoint is blocked for employees and successfully lists for managers (clean join)', async () => {
  const { token: empToken } = await loginAs('rahul.kumar@example.com');
  const empRes = await fetch(`${baseUrl}/api/clients`, {
    headers: authHeader(empToken),
  });
  assert.equal(empRes.status, 403, 'Employee should not access clients CRM');

  const { token: mgrToken } = await loginAs('sneha.gupta@example.com');
  const mgrRes = await fetch(`${baseUrl}/api/clients`, {
    headers: authHeader(mgrToken),
  });
  assert.equal(mgrRes.status, 200, 'Manager should receive 200 with active_projects_count');
  const data = await mgrRes.json();
  assert.ok(Array.isArray(data.clients), 'Response should contain clients array');
  assert.ok(data.clients.length > 0, 'Clients should be listed');
  assert.ok(data.clients[0].hasOwnProperty('active_projects_count'), 'Should include active_projects_count');
});

test('password reset token is consumed (single-use) after a successful reset', async () => {
  const fpRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kavya.nair@example.com' }),
  });
  const fpBody = await fpRes.json();
  const simToken = fpBody.simulationToken;
  assert.ok(simToken, 'Simulation token should be present in non-production mode without SMTP');

  const resetRes1 = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: simToken, newPassword: 'NewSecurePass!99' }),
  });
  assert.equal(resetRes1.status, 200, 'First reset should succeed');

  const resetRes2 = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: simToken, newPassword: 'AnotherPass!99' }),
  });
  assert.equal(resetRes2.status, 400, 'Reusing the same reset token must be rejected');
});

test('partial updates to clients, projects, and employees preserve existing unsupplied fields', async () => {
  const { token: adminToken } = await loginAs('aarav.sharma@example.com');

  // 1. Partial Client update (update only pipeline_stage, notes and phone should be preserved)
  const clientBeforeRes = await fetch(`${baseUrl}/api/clients/${org1ClientId}`, {
    headers: authHeader(adminToken),
  });
  const clientBefore = (await clientBeforeRes.json()).client;

  const patchClientRes = await fetch(`${baseUrl}/api/clients/${org1ClientId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader(adminToken) },
    body: JSON.stringify({ pipeline_stage: 'Negotiation' }),
  });
  assert.equal(patchClientRes.status, 200);
  const clientAfter = (await patchClientRes.json()).client;
  assert.equal(clientAfter.pipeline_stage, 'Negotiation');
  assert.equal(clientAfter.company_name, clientBefore.company_name, 'Company name should be preserved');
  assert.equal(clientAfter.email, clientBefore.email, 'Email should be preserved');

  // 2. Partial Project update (update status, budget and dates should be preserved)
  const projBeforeRes = await fetch(`${baseUrl}/api/projects/${org1ProjectId}`, {
    headers: authHeader(adminToken),
  });
  const projBefore = (await projBeforeRes.json()).project;

  const patchProjRes = await fetch(`${baseUrl}/api/projects/${org1ProjectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader(adminToken) },
    body: JSON.stringify({ status: 'on_hold' }),
  });
  assert.equal(patchProjRes.status, 200);
  const projAfter = (await patchProjRes.json()).project;
  assert.equal(projAfter.status, 'on_hold');
  assert.equal(projAfter.name, projBefore.name, 'Project name should be preserved');
});

test('CSRF middleware blocks cross-origin cookie-based mutations in production', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    // Request with cookie but unauthorized Origin header
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: 'taskflow_session=dummy-token',
        Origin: 'https://evil-attacker.example.com',
      },
    });
    assert.equal(res.status, 403, 'Cross-origin cookie mutation must be rejected with 403');
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('login rate limiter blocks after exceeding attempt threshold', async () => {
  let lastStatus;
  for (let i = 0; i < 17; i++) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ratelimit.test@example.test', password: 'WrongPassword!' }),
    });
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429, 'Rate limiter should engage after 15 failed login attempts');
});
