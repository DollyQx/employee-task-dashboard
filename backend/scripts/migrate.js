const { runMigrations } = require('../db/migrate');
const { closeDatabasePool } = require('../db/pool');

async function main() {
  try {
    const completed = await runMigrations();
    if (completed.length === 0) {
      console.log('Database schema is up to date.');
    } else {
      completed.forEach((name) => console.log(`Applied ${name}`));
    }
  } finally {
    await closeDatabasePool();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
