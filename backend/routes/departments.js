const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

function createDepartmentsRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // List all departments with head and metrics
  router.get('/', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const query = `
        SELECT 
          d.id,
          d.name,
          d.code,
          d.description,
          d.head_id,
          d.created_at,
          head.full_name AS head_name,
          head.avatar AS head_avatar,
          (
            SELECT COUNT(*) FROM users u 
            WHERE u.department_id = d.id AND u.employment_status = 'active'
          ) AS member_count,
          (
            SELECT COUNT(*) FROM tasks t 
            WHERE t.department_id = d.id AND t.crm_status != 'done'
          ) AS active_tasks_count,
          (
            SELECT COUNT(*) FROM tasks t 
            WHERE t.department_id = d.id AND t.crm_status = 'done'
          ) AS completed_tasks_count
        FROM departments d
        LEFT JOIN users head ON d.head_id = head.id
        WHERE d.organization_id = $1
        ORDER BY d.name ASC
      `;

      const { rows } = await pool.query(query, [orgId]);
      return res.json({ departments: rows });
    } catch (err) {
      console.error('List departments error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch departments.' });
    }
  });

  // Create Department (Admin only)
  router.post('/', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    const { name, code, description, head_id } = req.body || {};
    if (!name || !code) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `INSERT INTO departments (organization_id, name, code, description, head_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [orgId, name.trim(), code.trim().toUpperCase(), description || null, head_id || null]
      );

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_DEPARTMENT',
        entityType: 'department',
        entityId: rows[0].id,
        details: { name: rows[0].name, code: rows[0].code },
        ipAddress: req.ip,
      });

      return res.status(201).json({ message: 'Department created.', department: rows[0] });
    } catch (err) {
      console.error('Create department error:', err.message);
      return res.status(500).json({ error: 'Failed to create department: ' + err.message });
    }
  });

  return router;
}

module.exports = { createDepartmentsRoutes };
