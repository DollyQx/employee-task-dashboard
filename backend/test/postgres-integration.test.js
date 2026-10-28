/**
 * PostgreSQL Live Integration Test Suite
 *
 * This test suite connects to a real PostgreSQL database configured via TEST_DATABASE_URL.
 * It verifies schema migration, foreign key constraints, transactions, session storage,
 * TLS configuration, database readiness probe, and CRM queries against a live PostgreSQL engine.
 *
 * STRICT SAFETY GUARDS:
 * 1. Only runs when TEST_DATABASE_URL is explicitly set.
 * 2. Uses assertSafeStagingDatabase to strictly forbid running against production.
 * 3. Never deletes pre-existing data; all tests run inside an isolated, disposable organization.
 * 4. Cleans up all test data on completion.
 *
 * How to run:
 *   Windows PowerShell:
 *     $env:TEST_DATABASE_URL = "postgresql://user:pass@host:5432/test_db?sslmode=require"
 *     npm run test:integration
 */

const assert = require('node:assert/strict');
const { after, before, test, describe } = require('node:test');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { runMigrations } = require('../db/migrate');
const { getPoolConfig, checkDatabaseConnection } = require('../db/pool');
const { hashPassword, verifyPassword, generateSessionToken } = require('../utils/auth');
const { assertSafeStagingDatabase } = require('../utils/databaseSafety');

const testDbUrl = process.env.TEST_DATABASE_URL;
const shouldRun = Boolean(testDbUrl);

describe('Live PostgreSQL Integration Suite', { skip: !shouldRun ? 'TEST_DATABASE_URL is not set. Skipping live PostgreSQL integration tests. See README for instructions.' : false }, () => {
  let pool;
  let testOrgId;
  let testAdminId;

  before(async () => {
    // Strict safety check: Refuses to run if TEST_DATABASE_URL is unsafe or targets production
    assertSafeStagingDatabase(testDbUrl, process.env.DATABASE_URL);

    const config = getPoolConfig(testDbUrl);
    pool = new Pool(config);

    // 1. Verify connection
    const check = await pool.query('SELECT current_database(), version()');
    console.log(`[Integration Test] Connected to database: ${check.rows[0].current_database}`);

    // 2. Run migrations
    await runMigrations({ pool });

    // 3. Create isolated disposable test organization
    const orgSlug = `test-org-${randomUUID().slice(0, 8)}`;
    const orgRes = await pool.query(
      `INSERT INTO organizations (name, slug)
       VALUES ('Integration Test Org', $1)
       RETURNING id`,
      [orgSlug]
    );
    testOrgId = orgRes.rows[0].id;
  });

  after(async () => {
    if (pool && testOrgId) {
      // Clean up isolated test organization (cascades to all child records)
      try {
        await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
      } catch (err) {
        console.error('Failed to clean up test organization:', err.message);
      }
    }
    if (pool) {
      await pool.end();
    }
  });

  test('migrations table records both 001 and 002 migrations', async () => {
    const { rows } = await pool.query(
      'SELECT migration_name FROM schema_migrations ORDER BY migration_name ASC'
    );
    const names = rows.map((r) => r.migration_name);
    assert.ok(names.includes('001_create_taskflow_core.sql'), 'Missing core migration 001');
    assert.ok(names.includes('002_aulten_digital_crm_schema.sql'), 'Missing CRM migration 002');
  });

  test('all required enterprise CRM tables exist in PostgreSQL information_schema', async () => {
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existing = new Set(rows.map((r) => r.table_name));
    const requiredTables = [
      'organizations',
      'users',
      'tasks',
      'task_assignments',
      'departments',
      'projects',
      'clients',
      'task_comments',
      'task_attachments',
      'notifications',
      'audit_logs',
      'user_sessions',
    ];
    for (const tbl of requiredTables) {
      assert.ok(existing.has(tbl), `Table "${tbl}" was not created by migrations.`);
    }
  });

  test('schema constraints: enforces unique organization slugs, format checks, and user roles', async () => {
    // 1. Slug uniqueness
    const slug = `slug-${randomUUID().slice(0, 8)}`;
    await pool.query('INSERT INTO organizations (name, slug) VALUES ($1, $2)', ['Org A', slug]);
    await assert.rejects(
      pool.query('INSERT INTO organizations (name, slug) VALUES ($1, $2)', ['Org B', slug]),
      /unique/i,
      'Duplicate slug must be rejected'
    );

    // 2. Slug check constraint (reject spaces or uppercase)
    await assert.rejects(
      pool.query('INSERT INTO organizations (name, slug) VALUES ($1, $2)', ['Bad Org', 'Bad Slug With Spaces']),
      /check constraint/i,
      'Invalid slug format must be rejected by CHECK constraint'
    );

    // 3. User role check constraint
    await assert.rejects(
      pool.query(
        `INSERT INTO users (organization_id, full_name, email, role)
         VALUES ($1, 'Bad Role User', $2, 'invalid_role')`,
        [testOrgId, `badrole-${randomUUID().slice(0, 8)}@test.example`]
      ),
      /check constraint/i,
      'Invalid user role must be rejected by CHECK constraint'
    );

    // 4. Foreign key integrity constraint
    const nonExistentOrgId = randomUUID();
    await assert.rejects(
      pool.query(
        `INSERT INTO users (organization_id, full_name, email)
         VALUES ($1, 'Orphan User', 'orphan@test.example')`,
        [nonExistentOrgId]
      ),
      /foreign key/i,
      'Foreign key constraint must prevent inserting user with non-existent organization'
    );
  });

  test('transactions: verifies atomic commit and rollback behavior in PostgreSQL', async () => {
    const client = await pool.connect();
    try {
      // 1. Test Rollback
      await client.query('BEGIN');
      const rollbackEmail = `rollback-${randomUUID().slice(0, 8)}@test.example`;
      await client.query(
        `INSERT INTO users (organization_id, full_name, email)
         VALUES ($1, 'Rollback User', $2)`,
        [testOrgId, rollbackEmail]
      );
      await client.query('ROLLBACK');

      const checkRollback = await pool.query('SELECT id FROM users WHERE email = $1', [rollbackEmail]);
      assert.equal(checkRollback.rows.length, 0, 'Rolled back row must not be persisted');

      // 2. Test Commit
      await client.query('BEGIN');
      const commitEmail = `commit-${randomUUID().slice(0, 8)}@test.example`;
      await client.query(
        `INSERT INTO users (organization_id, full_name, email)
         VALUES ($1, 'Committed User', $2)`,
        [testOrgId, commitEmail]
      );
      await client.query('COMMIT');

      const checkCommit = await pool.query('SELECT id FROM users WHERE email = $1', [commitEmail]);
      assert.equal(checkCommit.rows.length, 1, 'Committed row must be persisted');
    } finally {
      client.release();
    }
  });

  test('TLS configuration: verifies pool config enables SSL for cloud and remote connections', () => {
    const config = getPoolConfig(testDbUrl);
    const isRemote = !testDbUrl.includes('localhost') && !testDbUrl.includes('127.0.0.1');
    if (isRemote) {
      assert.ok(config.ssl !== false, 'SSL should be enabled for remote PostgreSQL connections');
    }
  });

  test('database readiness check endpoint responds available against live connection', async () => {
    const status = await checkDatabaseConnection(pool);
    assert.deepEqual(status, { available: true });
  });

  test('user authentication flow in live PostgreSQL with scrypt hashing', async () => {
    const testPassword = 'LiveIntegrationTestPass!2026';
    const hash = await hashPassword(testPassword);
    const email = `admin-${randomUUID().slice(0, 8)}@test.example`;

    const insertRes = await pool.query(
      `INSERT INTO users (
         organization_id, full_name, email, password_hash, role, crm_role, is_active
       ) VALUES ($1, 'Live Test Admin', $2, $3, 'owner', 'super_admin', true)
       RETURNING id, email, password_hash`,
      [testOrgId, email, hash]
    );
    testAdminId = insertRes.rows[0].id;
    assert.ok(testAdminId);

    // Verify hash match
    const isValid = await verifyPassword(testPassword, insertRes.rows[0].password_hash);
    assert.equal(isValid, true);

    const isWrong = await verifyPassword('IncorrectPassword123!', insertRes.rows[0].password_hash);
    assert.equal(isWrong, false);
  });

  test('user session persistence, expiry check, and revocation in PostgreSQL', async () => {
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hr

    await pool.query(
      `INSERT INTO user_sessions (session_token, user_id, organization_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionToken, testAdminId, testOrgId, expiresAt]
    );

    // Query active session
    const activeRes = await pool.query(
      `SELECT s.id, u.full_name, u.crm_role
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires_at > now()`,
      [sessionToken]
    );
    assert.equal(activeRes.rows.length, 1);
    assert.equal(activeRes.rows[0].full_name, 'Live Test Admin');

    // Revocation (logout)
    await pool.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
    const revokedRes = await pool.query('SELECT id FROM user_sessions WHERE session_token = $1', [sessionToken]);
    assert.equal(revokedRes.rows.length, 0);
  });

  test('live PostgreSQL client CRM query with project count join works reliably', async () => {
    // 1. Create client
    const clientRes = await pool.query(
      `INSERT INTO clients (
         organization_id, company_name, contact_person, email, pipeline_stage, deal_value
       ) VALUES ($1, 'Acme Live Corp', 'John Doe', $2, 'Qualified', 50000)
       RETURNING id`,
      [testOrgId, `client-${randomUUID().slice(0, 8)}@acme.example`]
    );
    const clientId = clientRes.rows[0].id;

    // 2. Create associated project
    await pool.query(
      `INSERT INTO projects (
         organization_id, name, client_id, status, budget
       ) VALUES ($1, 'Acme Redesign', $2, 'active', 50000)`,
      [testOrgId, clientId]
    );

    // 3. Query client with active_projects_count join
    const query = `
      SELECT 
        c.id,
        c.company_name,
        COALESCE(proj_counts.cnt, 0) AS active_projects_count
      FROM clients c
      LEFT JOIN (
        SELECT client_id, COUNT(*) AS cnt
        FROM projects
        WHERE organization_id = $1
        GROUP BY client_id
      ) proj_counts ON proj_counts.client_id = c.id
      WHERE c.organization_id = $1 AND c.id = $2
    `;
    const res = await pool.query(query, [testOrgId, clientId]);
    assert.equal(res.rows.length, 1);
    assert.equal(parseInt(res.rows[0].active_projects_count, 10), 1);
  });
});
