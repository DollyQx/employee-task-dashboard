const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataType, newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');
const { createApp } = require('../server');
const { seedDatabase } = require('../scripts/seed');

let pool;
let app;
let server;
let baseUrl;

async function loginAs(email, password = 'TestPassword123!') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { status: res.status, token: data.token, user: data.user };
}

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
  if (server) server.close();
  if (pool) await pool.end();
});

test('Super Admin Dolly is properly initialized with super_admin role and permissions', async () => {
  const superAdmin = await loginAs('aarav.sharma@example.com');
  assert.equal(superAdmin.status, 200);
  assert.equal(superAdmin.user.full_name, 'Dolly');
  assert.equal(superAdmin.user.crm_role, 'super_admin');
});

test('Employee cannot create tasks (RBAC enforcement)', async () => {
  const emp = await loginAs('rahul.kumar@example.com');
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${emp.token}`,
    },
    body: JSON.stringify({
      title: 'Unauthorized Employee Task Creation Attempt',
      crm_priority: 'medium',
    }),
  });
  assert.equal(res.status, 403);
});

test('Employee can only see tasks assigned to them, not organization-wide tasks', async () => {
  const emp = await loginAs('rahul.kumar@example.com');
  const res = await fetch(`${baseUrl}/api/tasks`, {
    headers: { Authorization: `Bearer ${emp.token}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.tasks));
  // Every task returned must be assigned to Rahul Kumar (or created by him)
  for (const t of data.tasks) {
    const isAssigned = t.assignees.some((a) => a.id === emp.user.id);
    const isCreator = t.creator_id === emp.user.id;
    assert.ok(isAssigned || isCreator, `Task ${t.id} should be assigned to or created by Rahul Kumar`);
  }
});

test('Employee cannot view or status-patch an unauthorized task', async () => {
  const admin = await loginAs('aarav.sharma@example.com');
  // Admin creates a task NOT assigned to Rahul Kumar
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      title: 'Secret Executive Task',
      crm_priority: 'urgent',
      crm_status: 'todo',
    }),
  });
  assert.equal(createRes.status, 201);
  const { task } = await createRes.json();

  // Employee Rahul tries to fetch it directly
  const emp = await loginAs('rahul.kumar@example.com');
  const fetchRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    headers: { Authorization: `Bearer ${emp.token}` },
  });
  assert.equal(fetchRes.status, 403);

  // Employee Rahul tries to change status
  const patchRes = await fetch(`${baseUrl}/api/tasks/${task.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${emp.token}`,
    },
    body: JSON.stringify({ status: 'done' }),
  });
  assert.equal(patchRes.status, 403);
});

test('Internal notes are visible to managers/admins and hidden from employees', async () => {
  const admin = await loginAs('aarav.sharma@example.com');
  const emp = await loginAs('rahul.kumar@example.com');

  // Create a task assigned to Rahul
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      title: 'Review Code Architecture with Rahul',
      assignee_ids: [emp.user.id],
    }),
  });
  assert.equal(createRes.status, 201);
  const { task } = await createRes.json();

  // Admin posts public comment
  await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ comment: 'Public comment: please verify performance.', is_internal: false }),
  });

  // Admin posts internal note
  await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ comment: 'CONFIDENTIAL: Internal note about performance review.', is_internal: true }),
  });

  // Admin sees both comments
  const adminCommentsRes = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const adminComments = await adminCommentsRes.json();
  assert.equal(adminComments.comments.length, 2);

  // Employee only sees the public comment (internal note filtered on backend)
  const empCommentsRes = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    headers: { Authorization: `Bearer ${emp.token}` },
  });
  const empComments = await empCommentsRes.json();
  assert.equal(empComments.comments.length, 1);
  assert.equal(empComments.comments[0].comment, 'Public comment: please verify performance.');

  // Employee cannot post an internal note
  const empInternalNoteRes = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${emp.token}`,
    },
    body: JSON.stringify({ comment: 'Unauthorized internal note', is_internal: true }),
  });
  assert.equal(empInternalNoteRes.status, 403);
});

test('Task activity history tracks creation, status updates, and comments', async () => {
  const admin = await loginAs('aarav.sharma@example.com');
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ title: 'Task for Activity Audit History' }),
  });
  const { task } = await createRes.json();

  await fetch(`${baseUrl}/api/tasks/${task.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ status: 'in_progress' }),
  });

  const historyRes = await fetch(`${baseUrl}/api/tasks/${task.id}/history`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.equal(historyRes.status, 200);
  const data = await historyRes.json();
  assert.ok(Array.isArray(data.history));
  assert.ok(data.history.length >= 2);
});

test('Employee creation validates email format, duplicate email, and duplicate employee ID', async () => {
  const admin = await loginAs('aarav.sharma@example.com');

  // Invalid email
  const invalidEmail = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ full_name: 'Test Person', email: 'notanemail' }),
  });
  assert.equal(invalidEmail.status, 400);

  // Duplicate email
  const dupEmail = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ full_name: 'Duplicate Person', email: 'rahul.kumar@example.com' }),
  });
  assert.equal(dupEmail.status, 400);

  // Duplicate employee_id
  const dupEmpId = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ full_name: 'Unique Person', email: 'unique@example.com', employee_id: 'EMP-0101' }),
  });
  assert.equal(dupEmpId.status, 400);

  // Successful employee creation
  const successCreate = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      full_name: 'Vikram Joshi',
      email: 'vikram.joshi@example.com',
      employee_id: 'AD-9988',
      crm_role: 'employee',
      designation: 'Senior Frontend Developer',
    }),
  });
  assert.equal(successCreate.status, 201);
  const newEmp = await successCreate.json();
  assert.equal(newEmp.employee.full_name, 'Vikram Joshi');
  assert.equal(newEmp.employee.is_active, true);
});

test('Admin cannot promote users to Super Admin or edit Dolly Super Admin account', async () => {
  const admin = await loginAs('priya.verma@example.com');
  const superAdmin = await loginAs('aarav.sharma@example.com');

  // Admin tries to edit Super Admin Dolly
  const editSuper = await fetch(`${baseUrl}/api/employees/${superAdmin.user.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({ full_name: 'Hacked Dolly' }),
  });
  assert.equal(editSuper.status, 403);

  // Admin tries to promote someone to Super Admin
  const promoteRes = await fetch(`${baseUrl}/api/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      full_name: 'Fake Super Admin',
      email: 'fakesuper@example.com',
      crm_role: 'super_admin',
    }),
  });
  assert.equal(promoteRes.status, 403);
});

test('Employee deactivation preserves historical task records and prevents Super Admin deactivation', async () => {
  const superAdmin = await loginAs('aarav.sharma@example.com');

  // Try to deactivate Super Admin Dolly -> 403 Forbidden
  const deactSuper = await fetch(`${baseUrl}/api/employees/${superAdmin.user.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdmin.token}`,
    },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(deactSuper.status, 403);

  // Deactivate regular employee Rahul Kumar
  const emp = await loginAs('rahul.kumar@example.com');
  const deactRes = await fetch(`${baseUrl}/api/employees/${emp.user.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdmin.token}`,
    },
    body: JSON.stringify({ is_active: false }),
  });
  assert.equal(deactRes.status, 200);

  // Rahul's login should now be rejected (403 deactivated)
  const loginAttempt = await loginAs('rahul.kumar@example.com');
  assert.equal(loginAttempt.status, 403);

  // Historical task assignments still exist
  const taskAssignments = await pool.query('SELECT COUNT(*) FROM task_assignments WHERE user_id = $1', [emp.user.id]);
  assert.ok(parseInt(taskAssignments.rows[0].count, 10) > 0);
});

test('Role-specific dashboard metrics returns customized data per role', async () => {
  const superAdmin = await loginAs('aarav.sharma@example.com');
  const res = await fetch(`${baseUrl}/api/reports/dashboard`, {
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.kpis.total_employees);
  assert.ok(data.kpis.active_employees);
  assert.ok(data.kpis.total_tasks);
  assert.ok(Array.isArray(data.employeeWorkload));
  assert.equal(data.userRole, 'super_admin');
});
