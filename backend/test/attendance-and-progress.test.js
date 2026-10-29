const test = require('node:test');
const assert = require('node:assert/strict');
const { newDb, DataType } = require('pg-mem');
const { randomUUID } = require('node:crypto');
const { runMigrations } = require('../db/migrate');
const { seedDatabase } = require('../scripts/seed');
const { createApp } = require('../server');

let app;
let pool;
let serverUrl;
let serverInstance;

test.before(async () => {
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
  });
  db.public.registerFunction({
    name: 'btrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value) => value.trim(),
  });
  db.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value) => value.length,
  });

  const { Pool: MemoryPool } = db.adapters.createPg();
  pool = new MemoryPool();

  await runMigrations({ pool });
  await seedDatabase({ pool, demoPassword: 'TestPassword123!' });

  app = createApp({ poolProvider: () => pool });
  await new Promise((resolve) => {
    serverInstance = app.listen(0, () => {
      const port = serverInstance.address().port;
      serverUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
  }
  if (pool) {
    await pool.end();
  }
});

async function loginAs(email, password = 'TestPassword123!') {
  const res = await fetch(`${serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  return { token: data.token, user: data.user };
}

// ─── 1. Employee Check-In and Check-Out ──────────────────────────────────────
test('Employee can check in and check out with accurate server-recorded timestamps', async () => {
  const employee = await loginAs('rahul.kumar@example.com');

  // Check out any active seed session first to start clean
  await fetch(`${serverUrl}/api/attendance/check-out`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employee.token}` },
  });

  // 1. Check in
  const checkInRes = await fetch(`${serverUrl}/api/attendance/check-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(checkInRes.status, 201);
  const checkInData = await checkInRes.json();
  assert.equal(checkInData.message, 'Checked in successfully.');
  assert.equal(checkInData.record.status, 'present');
  assert.ok(checkInData.record.check_in_at);
  assert.equal(checkInData.record.check_out_at, null);

  // 2. Today status should show active session
  const todayRes = await fetch(`${serverUrl}/api/attendance/today`, {
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(todayRes.status, 200);
  const todayData = await todayRes.json();
  assert.equal(todayData.checked_in, true);
  assert.equal(todayData.active_session, true);

  // 3. Duplicate check-in must be rejected
  const dupRes = await fetch(`${serverUrl}/api/attendance/check-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(dupRes.status, 400);
  const dupData = await dupRes.json();
  assert.match(dupData.error, /already have an active check-in/i);

  // 4. Check out
  const checkOutRes = await fetch(`${serverUrl}/api/attendance/check-out`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(checkOutRes.status, 200);
  const checkOutData = await checkOutRes.json();
  assert.equal(checkOutData.message, 'Checked out successfully.');
  assert.equal(checkOutData.record.status, 'checked_out');
  assert.ok(checkOutData.record.check_out_at);
  assert.ok(checkOutData.record.duration_minutes >= 1);

  // 5. Subsequent checkout without active session must be rejected
  const secondCheckOutRes = await fetch(`${serverUrl}/api/attendance/check-out`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(secondCheckOutRes.status, 400);
  const secondCheckOutData = await secondCheckOutRes.json();
  assert.match(secondCheckOutData.error, /No active check-in session/i);
});

// ─── 2. Attendance RBAC: Employees Cannot Access Org Records ─────────────────
test('Employees cannot access organization-wide attendance records (RBAC 403)', async () => {
  const employee = await loginAs('rahul.kumar@example.com');
  const admin = await loginAs('priya.verma@example.com');

  // Employee calling GET /api/attendance/records is blocked
  const empRes = await fetch(`${serverUrl}/api/attendance/records`, {
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(empRes.status, 403);

  // Admin calling GET /api/attendance/records succeeds
  const adminRes = await fetch(`${serverUrl}/api/attendance/records`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.ok(Array.isArray(adminData.records));
});

// ─── 3. Admin Attendance Correction with Audit Trail ─────────────────────────
test('Admin can correct attendance record with required reason and audit log', async () => {
  const admin = await loginAs('priya.verma@example.com');
  const employee = await loginAs('rahul.kumar@example.com');

  // Get an existing attendance record
  const listRes = await fetch(`${serverUrl}/api/attendance/records`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const listData = await listRes.json();
  assert.ok(listData.records.length > 0);
  const recordToCorrect = listData.records[0];

  // Employee attempting correction gets 403
  const empCorrectRes = await fetch(`${serverUrl}/api/attendance/${recordToCorrect.id}/correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({
      reason: 'Employee trying to fix own attendance',
    }),
  });
  assert.equal(empCorrectRes.status, 403);

  // Admin correction without reason is rejected
  const noReasonRes = await fetch(`${serverUrl}/api/attendance/${recordToCorrect.id}/correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      status: 'checked_out',
    }),
  });
  assert.equal(noReasonRes.status, 400);

  // Admin correction with reason succeeds
  const correctRes = await fetch(`${serverUrl}/api/attendance/${recordToCorrect.id}/correct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      check_in_at: new Date('2026-10-28T09:00:00Z').toISOString(),
      check_out_at: new Date('2026-10-28T17:30:00Z').toISOString(),
      status: 'checked_out',
      reason: 'Badge scanner offline at facility entrance; verified via work notes.',
    }),
  });
  assert.equal(correctRes.status, 200);
  const correctData = await correctRes.json();
  assert.equal(correctData.message, 'Attendance record corrected successfully.');
  assert.equal(correctData.record.duration_minutes, 510);
});

// ─── 4. Task Progress Tracking (0% to 100%, Presets, Notes, History) ─────────
test('Task progress update validates 0-100%, enforces role boundaries, and records history', async () => {
  const superAdmin = await loginAs('admin@startizlabs.com');
  const employee = await loginAs('rahul.kumar@example.com');

  // 1. Super Admin Dolly creates a task assigned to Rahul
  const createRes = await fetch(`${serverUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdmin.token}`,
    },
    body: JSON.stringify({
      title: 'Implement Startiz Labs SSO Integration',
      description: 'Integrate SAML/OAuth2 with Startiz Labs directory',
      priority: 'high',
      status: 'todo',
      assignee_ids: [employee.user.id],
    }),
  });
  assert.equal(createRes.status, 201);
  const createdData = await createRes.json();
  const taskId = createdData.task.id;

  // 2. Validate progress bounds (reject < 0, > 100, NaN)
  const badProgressRes = await fetch(`${serverUrl}/api/tasks/${taskId}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({ progress: 150 }),
  });
  assert.equal(badProgressRes.status, 400);

  // 3. Employee updates progress to 40% with notes and blockers
  const progress40Res = await fetch(`${serverUrl}/api/tasks/${taskId}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({
      progress: 40,
      notes: 'Completed initial SAML certificate validation endpoints.',
      blockers: 'Awaiting staging IdP credentials from DevOps.',
      pending_work: 'Token exchange callback and session binding.',
    }),
  });
  assert.equal(progress40Res.status, 200);
  const data40 = await progress40Res.json();
  assert.equal(data40.task.completion_percentage, 40);
  assert.equal(data40.task.crm_status, 'in_progress');
  assert.equal(data40.progressUpdate.previous_progress, 0);
  assert.equal(data40.progressUpdate.current_progress, 40);

  // 4. Employee moves progress to 100% -> should move to in_review (not done without manager approval)
  const progress100Res = await fetch(`${serverUrl}/api/tasks/${taskId}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({
      progress: 100,
      notes: 'All integration tests passing. Requesting code review and staging verification.',
    }),
  });
  assert.equal(progress100Res.status, 200);
  const data100 = await progress100Res.json();
  assert.equal(data100.task.completion_percentage, 100);
  assert.equal(data100.task.crm_status, 'in_review');

  // 5. Verify progress history timeline
  const historyRes = await fetch(`${serverUrl}/api/tasks/${taskId}/progress-history`, {
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert.equal(historyData.history.length, 2);
  assert.equal(historyData.history[0].current_progress, 100);
  assert.equal(historyData.history[1].current_progress, 40);
  assert.equal(historyData.history[1].blockers, 'Awaiting staging IdP credentials from DevOps.');
});

// ─── 5. Work Monitoring Dashboard ────────────────────────────────────────────
test('Work Monitoring endpoint returns summary cards and employee-wise progress breakdown', async () => {
  const superAdmin = await loginAs('admin@startizlabs.com');
  const employee = await loginAs('rahul.kumar@example.com');

  // Employee blocked from work monitoring
  const empRes = await fetch(`${serverUrl}/api/reports/work-monitoring`, {
    headers: { Authorization: `Bearer ${employee.token}` },
  });
  assert.equal(empRes.status, 403);

  // Super Admin Dolly gets work monitoring data
  const adminRes = await fetch(`${serverUrl}/api/reports/work-monitoring`, {
    headers: { Authorization: `Bearer ${superAdmin.token}` },
  });
  assert.equal(adminRes.status, 200);
  const data = await adminRes.json();

  assert.ok(data.summary);
  assert.ok(data.summary.total_employees >= 1);
  assert.ok(data.summary.active_employees >= 1);
  assert.ok(Array.isArray(data.employees));
  assert.ok(data.employees.length > 0);

  const firstEmp = data.employees[0];
  assert.ok(firstEmp.full_name);
  assert.ok(firstEmp.employee_id);
  assert.ok(firstEmp.assigned_tasks !== undefined);
  assert.ok(firstEmp.avg_progress_percentage !== undefined);
  assert.ok(firstEmp.today_attendance);
});
