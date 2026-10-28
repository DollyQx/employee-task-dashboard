const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

function createAuditRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // Audit logs are visible to Super Admin and Admin only
  router.get('/', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const { entity_type, action, limit = 50, page = 1 } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      const where = ['organization_id = $1'];
      const values = [orgId];
      let pIdx = 2;

      if (entity_type) {
        where.push(`entity_type = $${pIdx}`);
        values.push(entity_type);
        pIdx++;
      }

      if (action) {
        where.push(`action = $${pIdx}`);
        values.push(action);
        pIdx++;
      }

      const countRes = await pool.query(`SELECT COUNT(*) FROM audit_logs WHERE ${where.join(' AND ')}`, values);
      const total = parseInt(countRes.rows[0].count, 10);

      const query = `
        SELECT id, user_id, actor_name, action, entity_type, entity_id, details, ip_address, created_at
        FROM audit_logs
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${pIdx} OFFSET $${pIdx + 1}
      `;
      const { rows } = await pool.query(query, [...values, limitNum, offset]);

      return res.json({
        auditLogs: rows.map((r) => {
          let parsedDetails = r.details;
          try {
            if (typeof r.details === 'string') parsedDetails = JSON.parse(r.details);
          } catch {}
          return { ...r, details: parsedDetails };
        }),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      });
    } catch (err) {
      console.error('List audit logs error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
    }
  });

  return router;
}

module.exports = { createAuditRoutes };
