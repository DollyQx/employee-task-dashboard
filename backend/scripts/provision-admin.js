const crypto = require('node:crypto');
const { getPool, closeDatabasePool } = require('../db/pool');
const { hashPassword } = require('../utils/auth');

async function provisionAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@aulten.example.com';
  const name = process.env.ADMIN_NAME || 'System Administrator';
  const orgSlug = process.env.ORG_SLUG || 'aulten-digital';
  const orgName = process.env.ORG_NAME || 'Aulten Digital';

  let rawPassword = process.env.ADMIN_PASSWORD;
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

    // 3. Upsert Admin User
    const existingUser = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      const existingRecord = existingUser.rows[0];
      // Only reset the password if it is missing (null) or if ADMIN_PASSWORD was explicitly provided.
      // This prevents accidental password resets when re-running provisioning on a live system
      // where the admin has already set their own password.
      const shouldUpdatePassword = !existingRecord.password_hash || Boolean(process.env.ADMIN_PASSWORD);
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
        console.log(`Updated existing user to Super Admin: ${email}`);
      } else {
        // Promote role without touching the password
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
        console.log(`Promoted existing user to Super Admin (password unchanged): ${email}`);
        generated = false;
        passwordPreserved = true;
      }
    } else {
      await pool.query(
        `INSERT INTO users (
           organization_id, full_name, email, password_hash, role, crm_role,
           employee_id, designation, employment_status, is_active
         ) VALUES ($1, $2, $3, $4, 'owner', 'super_admin', 'AD-0001', 'Chief Administrator', 'active', true)`,
        [orgId, name, email.toLowerCase(), passwordHash]
      );
      console.log(`Provisioned new Super Admin: ${email}`);
    }

    console.log('\n======================================================');
    console.log('✅ Admin Provisioning Complete');
    console.log(`   Organization: ${orgName}`);
    console.log(`   Email:        ${email}`);
    if (generated) {
      console.log(`   Generated Password: ${rawPassword}`);
      console.log('   ⚠️  Save this password securely immediately! It will not be shown again.');
    } else if (passwordPreserved) {
      console.log('   Password:     [Preserved existing user password]');
    } else {
      console.log('   Password:     [Provided in environment variable]');
    }
    console.log('======================================================\n');
  } finally {
    await closeDatabasePool();
  }
}

if (require.main === module) {
  provisionAdmin().catch((err) => {
    console.error('Admin provisioning failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { provisionAdmin };
