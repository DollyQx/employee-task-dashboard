const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { DataType, newDb } = require('pg-mem');
const { runMigrations } = require('../db/migrate');
const { checkDatabaseConnection } = require('../db/pool');
const { createApp } = require('../server');

let database;
let pool;

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
});

after(async () => {
  if (pool) await pool.end();
});

async function insertOrganization(name, slug) {
  const { rows } = await pool.query(
    'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
    [name, slug]
  );
  return rows[0].id;
}

async function insertUser(organizationId, email) {
  const { rows } = await pool.query(
    'INSERT INTO users (organization_id, full_name, email) VALUES ($1, $2, $3) RETURNING id',
    [organizationId, 'Test User', email]
  );
  return rows[0].id;
}

test('database migration is recorded after successful application', async () => {
  const { rows } = await pool.query('SELECT migration_name FROM schema_migrations');
  assert.deepEqual(rows.map((row) => row.migration_name), ['001_create_taskflow_core.sql']);
});

test('schema enforces required fields, unique organization slugs, and valid user roles', async () => {
  const organizationId = await insertOrganization('Example Organization', 'example-org');
  await assert.rejects(insertOrganization('Duplicate', 'example-org'));
  await assert.rejects(insertOrganization('   ', 'empty-name'));

  await pool.query(
    'INSERT INTO users (organization_id, full_name, email) VALUES ($1, $2, $3)',
    [organizationId, 'Test User', 'user@example.test']
  );
  await assert.rejects(pool.query(
    'INSERT INTO users (organization_id, full_name, email, role) VALUES ($1, $2, $3, $4)',
    [organizationId, 'Other User', 'other@example.test', 'superadmin']
  ));
});

test('tasks and assignments enforce organization-scoped foreign keys and unique assignment', async () => {
  const firstOrganization = await insertOrganization('First Org', `first-${randomUUID()}`);
  const secondOrganization = await insertOrganization('Second Org', `second-${randomUUID()}`);
  const firstUser = await insertUser(firstOrganization, 'first@example.test');
  const secondUser = await insertUser(secondOrganization, 'second@example.test');
  const { rows } = await pool.query(
    `INSERT INTO tasks (organization_id, created_by, title)
     VALUES ($1, $2, $3) RETURNING id`,
    [firstOrganization, firstUser, 'A task']
  );
  const taskId = rows[0].id;

  await assert.rejects(pool.query(
    `INSERT INTO tasks (organization_id, created_by, title, status)
     VALUES ($1, $2, $3, $4)`,
    [firstOrganization, firstUser, 'Invalid status', 'blocked']
  ));
  await assert.rejects(pool.query(
    'INSERT INTO task_assignments (organization_id, task_id, user_id) VALUES ($1, $2, $3)',
    [firstOrganization, taskId, secondUser]
  ));

  await pool.query(
    'INSERT INTO task_assignments (organization_id, task_id, user_id) VALUES ($1, $2, $3)',
    [firstOrganization, taskId, firstUser]
  );
  await assert.rejects(pool.query(
    'INSERT INTO task_assignments (organization_id, task_id, user_id) VALUES ($1, $2, $3)',
    [firstOrganization, taskId, firstUser]
  ));
});

test('database connectivity probe distinguishes an available database', async () => {
  const result = await checkDatabaseConnection({
    query: async () => ({ rows: [{ '?column?': 1 }] }),
  });
  assert.equal(result.available, true);
});

test('readiness returns 503 unless its database check succeeds', async (t) => {
  const readyApp = createApp({ databaseCheck: async () => ({ available: true }) });
  const unavailableApp = createApp({
    databaseCheck: async () => ({ available: false, reason: 'not_configured' }),
  });
  const start = (app) => new Promise((resolve) => {
    const server = app.listen(0, () => resolve({
      server,
      url: `http://127.0.0.1:${server.address().port}/api/ready`,
    }));
  });
  const ready = await start(readyApp);
  const unavailable = await start(unavailableApp);
  t.after(() => {
    ready.server.close();
    unavailable.server.close();
  });

  const readyResponse = await fetch(ready.url);
  assert.equal(readyResponse.status, 200);
  assert.deepEqual(await readyResponse.json().then(({ status, database: state }) => ({ status, database: state })), {
    status: 'ready',
    database: 'available',
  });

  const unavailableResponse = await fetch(unavailable.url);
  assert.equal(unavailableResponse.status, 503);
  assert.deepEqual(await unavailableResponse.json().then(({ status, database: state, reason }) => ({ status, database: state, reason })), {
    status: 'not_ready',
    database: 'unavailable',
    reason: 'not_configured',
  });
});
