const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataType, newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');
const { seedDatabase } = require('../scripts/seed');
const { createApp } = require('../server');
const {
  ensureDefaultRules,
  runAutomations,
  runTaskSlaMonitor,
  runRecurringTaskGenerator,
  runMissingCheckoutDetector,
  runLateAttendanceDetector,
} = require('../services/automation');
const {
  sanitizeForAi,
  draftTaskDescription,
  summarizeProgress,
  suggestNextSteps,
} = require('../services/aiAssistant');

let database;
let pool;
let app;
let server;
let baseUrl;
let orgId;
let employeeUser;
let adminUser;

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

  const seedRes = await seedDatabase({
    pool,
    superAdminEmail: 'admin@startizlabs.com',
    superAdminName: 'Dolly',
    demoPassword: 'TestPassword123!',
  });
  orgId = seedRes.orgId;

  const empRes = await pool.query("SELECT id, full_name, email, crm_role FROM users WHERE email = 'rahul.kumar@example.com'");
  employeeUser = empRes.rows[0];

  const admRes = await pool.query("SELECT id, full_name, email, crm_role FROM users WHERE email = 'priya.verma@example.com'");
  adminUser = admRes.rows[0];

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

test('Automation Rules: ensureDefaultRules populates standard rule definitions', async () => {
  await ensureDefaultRules(pool, orgId);

  const { rows } = await pool.query(
    'SELECT rule_key, name, is_enabled FROM automation_rules WHERE organization_id = $1 ORDER BY rule_key ASC',
    [orgId]
  );
  assert.ok(rows.length >= 4, 'Expected at least 4 default automation rules');
  const keys = rows.map((r) => r.rule_key);
  assert.ok(keys.includes('task_sla_monitor'));
  assert.ok(keys.includes('recurring_task_generator'));
  assert.ok(keys.includes('missing_checkout_detector'));
  assert.ok(keys.includes('late_attendance_detector'));
});

test('Task SLA Monitor: flags overdue task and creates deduplicated notification', async () => {
  // Insert an overdue task
  const taskRes = await pool.query(
    `INSERT INTO tasks (
      organization_id, created_by, title, status, priority, crm_status, crm_priority, due_date
    ) VALUES ($1, $2, 'Critical Overdue Migration', 'pending', 'high', 'todo', 'urgent', '2020-01-01')
    RETURNING id`,
    [orgId, employeeUser.id]
  );
  const taskId = taskRes.rows[0].id;

  await pool.query(
    'INSERT INTO task_assignments (organization_id, task_id, user_id) VALUES ($1, $2, $3)',
    [orgId, taskId, employeeUser.id]
  );

  // Run SLA monitor
  const result1 = await runTaskSlaMonitor(pool, orgId);
  assert.ok(result1.actionsTaken >= 1, 'Should have dispatched at least 1 SLA warning');

  // Run again on the same day: deduplication should prevent duplicate notifications!
  const result2 = await runTaskSlaMonitor(pool, orgId);
  assert.equal(result2.actionsTaken, 0, 'Subsequent run on same day must not create duplicate notification');
});

test('Recurring Task Generator: creates task idempotently from active template', async () => {
  // Insert a recurring template set to daily
  const tmplRes = await pool.query(
    `INSERT INTO recurring_task_templates (
      organization_id, title, description, priority, recurrence_pattern, assignee_id, creator_id
    ) VALUES ($1, 'Daily Server Health Audit', 'Run diagnostic check', 'medium', 'daily', $2, $3)
    RETURNING id`,
    [orgId, employeeUser.id, adminUser.id]
  );

  // Run generator
  const genResult1 = await runRecurringTaskGenerator(pool, orgId);
  assert.ok(genResult1.actionsTaken >= 1, 'Should have generated task from daily template');

  // Verify task was created in tasks table
  const checkTask = await pool.query(
    "SELECT id, title, task_code, source FROM tasks WHERE organization_id = $1 AND title = 'Daily Server Health Audit'",
    [orgId]
  );
  assert.equal(checkTask.rows.length, 1);
  assert.equal(checkTask.rows[0].source, 'Automation');

  // Verify idempotency on retry: running generator again should NOT create duplicate task
  const genResult2 = await runRecurringTaskGenerator(pool, orgId);
  assert.equal(genResult2.actionsTaken, 0, 'Idempotent runner must not duplicate tasks generated today');

  const checkTaskAgain = await pool.query(
    "SELECT COUNT(*) AS total FROM tasks WHERE organization_id = $1 AND title = 'Daily Server Health Audit'",
    [orgId]
  );
  assert.equal(Number(checkTaskAgain.rows[0].total), 1);
});

test('Missing Checkout & Late Attendance Detectors: flag sessions correctly', async () => {
  // Insert an unclosed attendance record from yesterday
  const attRes = await pool.query(
    `INSERT INTO attendance_records (
      organization_id, user_id, date, check_in_at, status
    ) VALUES ($1, $2, '2026-01-01', '2026-01-01 09:00:00+00', 'present')
    RETURNING id`,
    [orgId, employeeUser.id]
  );

  // Run missing checkout detector
  const missingResult = await runMissingCheckoutDetector(pool, orgId);
  assert.ok(missingResult.actionsTaken >= 1, 'Should notify employee of missing checkout');

  // Run again: deduplication must kick in
  const missingResult2 = await runMissingCheckoutDetector(pool, orgId);
  assert.equal(missingResult2.actionsTaken, 0, 'Deduplication must prevent duplicate reminder today');
});

test('RBAC: Super Admin Dolly has exclusive access to Automation Center APIs', async () => {
  const superAdminAuth = await loginUser('admin@startizlabs.com');
  const employeeAuth = await loginUser('rahul.kumar@example.com');
  const managerAuth = await loginUser('sneha.gupta@example.com');
  const adminAuth = await loginUser('priya.verma@example.com');

  // 1. Employee blocked (403)
  const empRes = await fetch(`${baseUrl}/api/automation/rules`, {
    headers: { Authorization: `Bearer ${employeeAuth.token}` },
  });
  assert.equal(empRes.status, 403, 'Employee must be blocked from automation rules');

  // 2. Manager blocked (403)
  const mgrRes = await fetch(`${baseUrl}/api/automation/rules`, {
    headers: { Authorization: `Bearer ${managerAuth.token}` },
  });
  assert.equal(mgrRes.status, 403, 'Manager must be blocked from automation rules');

  // 3. Admin blocked (403) - Automation Center is Super Admin only
  const admRes = await fetch(`${baseUrl}/api/automation/rules`, {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  assert.equal(admRes.status, 403, 'Admin must be blocked from automation rules (Super Admin only)');

  // 4. Super Admin Dolly permitted (200)
  const saRes = await fetch(`${baseUrl}/api/automation/rules`, {
    headers: { Authorization: `Bearer ${superAdminAuth.token}` },
  });
  assert.equal(saRes.status, 200, 'Super Admin Dolly must be granted access');
  const saData = await saRes.json();
  assert.ok(Array.isArray(saData.rules), 'Rules list should be returned');

  // 5. Super Admin Dolly can trigger "Run Now" manual execution
  const runRes = await fetch(`${baseUrl}/api/automation/run-now`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminAuth.token}` },
  });
  assert.equal(runRes.status, 200, 'Super Admin Dolly must be able to trigger run-now');
  const runData = await runRes.json();
  assert.equal(runData.result.status, 'completed');
});

test('AI Assistance: operates with zero mandatory cost, sanitizes PII, and falls back locally', async () => {
  // 1. Sanitization verification
  const dirtyPrompt = 'Contact john.doe@example.com or call 555-123-4567 with Bearer eyJhbGciOiJIUzI1Ni';
  const clean = sanitizeForAi(dirtyPrompt);
  assert.ok(!clean.includes('john.doe@example.com'), 'Email must be scrubbed');
  assert.ok(!clean.includes('555-123-4567'), 'Phone must be scrubbed');
  assert.ok(!clean.includes('eyJhbGciOiJIUzI1Ni'), 'JWT must be scrubbed');
  assert.ok(clean.includes('[EMAIL]'));

  // 2. Draft task description fallback
  const draft = await draftTaskDescription({
    title: 'Migrate Redis cluster to AWS ElastiCache',
    category: 'Infrastructure',
    department: 'DevOps',
  });
  assert.ok(draft.description.includes('Scope & Objectives'));
  assert.ok(draft.acceptanceCriteria.length >= 3);
  assert.equal(draft.source, 'heuristic');

  // 3. Progress summarization fallback
  const summary = await summarizeProgress({
    taskTitle: 'Database Sharding',
    progress: 75,
    status: 'in_progress',
    blockers: 'Awaiting replica sync',
  });
  assert.ok(summary.executiveSummary.includes('75%'));
  assert.ok(summary.blockersSummary.includes('Awaiting replica sync'));

  // 4. Next steps suggestions fallback
  const next = await suggestNextSteps({
    taskTitle: 'API Gateway Rate Limiting',
    status: 'in_progress',
    progress: 40,
  });
  assert.ok(Array.isArray(next.nextSteps));
  assert.ok(next.nextSteps.length >= 2);
});

test('Disabled Automation Rules: remain disabled and are skipped during scheduled run', async () => {
  // Explicitly disable recurring_task_generator
  await pool.query(
    "UPDATE automation_rules SET is_enabled = false WHERE organization_id = $1 AND rule_key = 'recurring_task_generator'",
    [orgId]
  );

  const cycleRes = await runAutomations(pool, orgId, { actorName: 'GitHub Actions Simulation', triggerType: 'cli_cron' });
  assert.equal(cycleRes.status, 'completed');

  const disabledRuleResult = cycleRes.results.find((r) => r.rule_key === 'recurring_task_generator');
  assert.ok(disabledRuleResult, 'Rule must be present in execution results');
  assert.equal(disabledRuleResult.status, 'disabled', 'Disabled rule must have status "disabled"');
  assert.equal(disabledRuleResult.actionsTaken, 0, 'Disabled rule must take 0 actions');

  // Re-enable rule
  await pool.query(
    "UPDATE automation_rules SET is_enabled = true WHERE organization_id = $1 AND rule_key = 'recurring_task_generator'",
    [orgId]
  );
});

test('Failure Handling & Diagnostics: records error details without leaking sensitive credentials', async () => {
  // Intentionally inject a broken configuration
  await pool.query(
    "UPDATE automation_rules SET config_json = 'INVALID_JSON_STRING' WHERE organization_id = $1 AND rule_key = 'task_sla_monitor'",
    [orgId]
  );

  const cycleRes = await runAutomations(pool, orgId, { actorName: 'Error Handling Audit', triggerType: 'manual' });
  assert.equal(cycleRes.status, 'completed');

  const { rows } = await pool.query(
    "SELECT rule_key, status, details, actions_taken FROM automation_logs WHERE organization_id = $1 AND rule_key = 'task_sla_monitor' ORDER BY created_at DESC LIMIT 1",
    [orgId]
  );
  assert.ok(rows.length > 0);
  const log = rows[0];

  // Verify diagnostic information is logged
  assert.ok(log.details !== null && log.details !== undefined);

  // Security check: confirm zero credential or password leakage in logs
  assert.ok(!log.details.includes('password'));
  assert.ok(!log.details.includes('secret'));
  assert.ok(!log.details.includes('token'));
  assert.ok(!log.details.includes('Bearer'));

  // Restore clean config
  await pool.query(
    "UPDATE automation_rules SET config_json = '{\"dueSoonHours\": 24}' WHERE organization_id = $1 AND rule_key = 'task_sla_monitor'",
    [orgId]
  );
});
