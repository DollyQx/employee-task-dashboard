#!/usr/bin/env node
/**
 * Standalone Automation Runner Script
 * Designed for execution via GitHub Actions (100% Free Tier Cron),
 * local CLI, or external webhooks.
 *
 * Usage:
 *   node backend/scripts/run-automations.js
 */

const { getPool, closeDatabasePool } = require('../db/pool');
const { runAutomations } = require('../services/automation');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL is not configured. Please set DATABASE_URL to run automations.');
    return;
  }

  console.log('Starting Startiz Labs automated rule cycle...');
  const pool = getPool();

  try {
    // Fetch organizations (support explicit ORG_SLUG or ORGANIZATION_ID scoping)
    let orgQuery = 'SELECT id, name, slug FROM organizations';
    const queryParams = [];
    if (process.env.ORGANIZATION_ID) {
      orgQuery += ' WHERE id = $1';
      queryParams.push(process.env.ORGANIZATION_ID);
    } else if (process.env.ORG_SLUG) {
      orgQuery += ' WHERE slug = $1';
      queryParams.push(process.env.ORG_SLUG);
    }

    const orgsRes = await pool.query(orgQuery, queryParams);
    if (orgsRes.rows.length === 0) {
      console.log(process.env.ORG_SLUG || process.env.ORGANIZATION_ID
        ? `No organization found matching scope "${process.env.ORG_SLUG || process.env.ORGANIZATION_ID}".`
        : 'No organizations found in database.');
      return;
    }

    for (const org of orgsRes.rows) {
      console.log(`\nExecuting automations for organization: ${org.name} (${org.slug})`);
      const result = await runAutomations(pool, org.id, {
        actorName: 'Scheduled Automation Script',
        triggerType: 'cli_cron',
      });

      console.log(`Status: ${result.status}`);
      console.log(`Actions taken: ${result.actionsTaken}`);
      if (result.results) {
        for (const r of result.results) {
          console.log(` - Rule: ${r.rule_key.padEnd(28)} Status: ${r.status.padEnd(8)} Actions: ${r.actionsTaken} (${r.durationMs}ms)`);
        }
      }
    }
    console.log('\n✅ Automation cycle completed successfully.');
  } catch (err) {
    console.error('❌ Automation runner error:', err.message);
    process.exitCode = 1;
  } finally {
    await closeDatabasePool();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
