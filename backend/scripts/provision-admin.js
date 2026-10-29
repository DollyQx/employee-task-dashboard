const crypto = require('node:crypto');
const { getPool, closeDatabasePool } = require('../db/pool');
const { hashPassword } = require('../utils/auth');

async function provisionAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || process.argv[2] || 'admin@startizlabs.com';
  const name = process.env.SUPER_ADMIN_NAME || process.env.ADMIN_NAME || process.argv[4] || 'Dolly';
  const orgSlug = process.env.ORG_SLUG || 'startiz-labs';
  const orgName = process.env.ORG_NAME || 'Startiz Labs';

  let rawPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.argv[3];
  let generated = false;
  let passwordPreserved = false;
  if (!rawPassword) {
    rawPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, 'X') + '!9a';
    generated = true;
  }

  const pool = getPool();
  try {
    // 1. Ensure Organization exists
    let orgRes = await pool.query('SELECT id FROM organizations WHERE slug = $1', [orgSlug]);
    let orgId;
    if (orgRes.rows.length === 0) {
      const newOrg = await pool.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
        [orgName, orgSlug]
      );
      orgId = newOrg.rows[0].id;
      console.log(`Created organization: ${orgName} (${orgSlug})`);
    } else {
      orgId = orgRes.rows[0].id;
    }

    // 2. Hash password
    const passwordHash = await hashPassword(rawPassword);

    // 3. Upsert Super Admin User (Dolly)
    const existingUser = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      const existingRecord = existingUser.rows[0];
      const shouldUpdatePassword = !existingRecord.password_hash || Boolean(process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.argv[3]);
      if (shouldUpdatePassword) {
        await pool.query(
          `UPDATE users SET
             full_name = $1,
             password_hash = $2,
             crm_role = 'super_admin',
             role = 'owner',
             is_active = true,
             updated_at = now()
           WHERE id = $3`,
          [name, passwordHash, existingRecord.id]
        );
        console.log(`Updated existing user to Super Admin: ${email} (${name})`);
      } else {
        await pool.query(
          `UPDATE users SET
             full_name = $1,
             crm_role = 'super_admin',
             role = 'owner',
             is_active = true,
             updated_at = now()
           WHERE id = $2`,
          [name, existingRecord.id]
        );
        console.log(`Promoted existing user to Super Admin (password unchanged): ${email} (${name})`);
        generated = false;
        passwordPreserved = true;
      }
    } else {
      await pool.query(
        `INSERT INTO users (
           organization_id, full_name, email, password_hash, role, crm_role,
           employee_id, designation, employment_status, is_active
         ) VALUES ($1, $2, $3, $4, 'owner', 'super_admin', 'AD-0001', 'Super Administrator', 'active', true)`,
        [orgId, name, email.toLowerCase(), passwordHash]
      );
      console.log(`Provisioned new Super Admin: ${email} (${name})`);
    }

    console.log('\n======================================================');
    console.log('✅ Super Admin Provisioning Complete');
    console.log(`   Organization: ${orgName}`);
    console.log(`   Name:         ${name}`);
    console.log(`   Email:        ${email}`);
    console.log(`   Role:         Super Admin`);
    if (generated) {
      console.log(`   Generated Password: ${rawPassword}`);
      console.log('   ⚠️  Save this password securely immediately! It will not be shown again.');
    } else if (passwordPreserved) {
      console.log('   Password:     [Preserved existing user password]');
    } else {
      console.log('   Password:     [Provided in environment variable / argument]');
    }
    console.log('======================================================\n');
  } finally {
    await closeDatabasePool();
  }
}

if (require.main === module) {
  provisionAdmin().catch((err) => {
    console.error('Provisioning failed:', err.message);
    process.exit(1);
  });
}

module.exports = { provisionAdmin };
