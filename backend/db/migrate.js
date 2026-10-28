const fs = require('node:fs/promises');
const path = require('node:path');
const { getPool } = require('./pool');

const MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');

async function migrationFiles(directory) {
  const names = await fs.readdir(directory);
  return names
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();
}

async function runMigrations({ pool = getPool(), directory = MIGRATIONS_DIRECTORY } = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL
    )
  `);

  const files = await migrationFiles(directory);
  const { rows: appliedRows } = await pool.query('SELECT migration_name FROM schema_migrations');
  const applied = new Set(appliedRows.map((row) => row.migration_name));
  const completed = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await fs.readFile(path.join(directory, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (migration_name, applied_at) VALUES ($1, $2)',
        [file, new Date()]
      );
      await client.query('COMMIT');
      completed.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
    } finally {
      client.release();
    }
  }

  return completed;
}

module.exports = { runMigrations };
