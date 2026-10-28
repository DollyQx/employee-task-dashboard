const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

function createProjectsRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const { status, health, search } = req.query;

      const where = ['p.organization_id = $1'];
      const values = [orgId];
      let pIdx = 2;

      if (status) {
        where.push(`p.status = $${pIdx}`);
        values.push(status);
        pIdx++;
      }

      if (health) {
        where.push(`p.health = $${pIdx}`);
        values.push(health);
        pIdx++;
      }

      if (search && search.trim()) {
        where.push(`(p.name ILIKE $${pIdx} OR p.description ILIKE $${pIdx})`);
        values.push(`%${search.trim()}%`);
        pIdx++;
      }

      const query = `
        SELECT 
          p.id,
          p.name,
          p.description,
          p.status,
          p.health,
          p.start_date,
          p.end_date,
          p.budget,
          p.created_at,
          c.id AS client_id,
          c.company_name AS client_name,
          owner.full_name AS owner_name,
          owner.avatar AS owner_avatar,
          (
            SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id
          ) AS total_tasks,
          (
            SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.crm_status = 'done'
          ) AS completed_tasks,
          (
            SELECT COUNT(*) FROM tasks t 
            WHERE t.project_id = p.id 
              AND t.due_date IS NOT NULL 
              AND t.due_date < CURRENT_DATE 
              AND t.crm_status != 'done'
          ) AS overdue_tasks
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN users owner ON p.owner_id = owner.id
        WHERE ${where.join(' AND ')}
        ORDER BY p.created_at DESC
      `;

      const { rows } = await pool.query(query, values);
      const projectsWithProgress = rows.map((p) => {
        const total = parseInt(p.total_tasks || 0, 10);
        const completed = parseInt(p.completed_tasks || 0, 10);
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          ...p,
          total_tasks: total,
          completed_tasks: completed,
          overdue_tasks: parseInt(p.overdue_tasks || 0, 10),
          progress_percentage: progress,
        };
      });

      return res.json({ projects: projectsWithProgress });
    } catch (err) {
      console.error('List projects error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch projects.' });
    }
  });

  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const projId = req.params.id;

      const query = `
        SELECT 
          p.*,
          c.company_name AS client_name,
          owner.full_name AS owner_name
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN users owner ON p.owner_id = owner.id
        WHERE p.id = $1 AND p.organization_id = $2
      `;
      const { rows } = await pool.query(query, [projId, orgId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

      // Fetch project tasks
      const tasksRes = await pool.query(
        `SELECT id, task_code, title, crm_status, crm_priority, due_date, completion_percentage
         FROM tasks WHERE project_id = $1 ORDER BY created_at DESC`,
        [projId]
      );

      return res.json({ project: rows[0], tasks: tasksRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch project details.' });
    }
  });

  router.post('/', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    const { name, description, client_id, owner_id, status = 'active', health = 'good', start_date, end_date, budget = 0 } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `INSERT INTO projects (
           organization_id, name, description, client_id, owner_id, status, health, start_date, end_date, budget
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [orgId, name.trim(), description || null, client_id || null, owner_id || req.user.id, status, health, start_date || null, end_date || null, Number(budget) || 0]
      );

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_PROJECT',
        entityType: 'project',
        entityId: rows[0].id,
        details: { name: rows[0].name },
        ipAddress: req.ip,
      });

      return res.status(201).json({ message: 'Project created successfully.', project: rows[0] });
    } catch (err) {
      console.error('Create project error:', err.message);
      return res.status(500).json({ error: 'Failed to create project.' });
    }
  });

  router.put('/:id', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    const projId = req.params.id;
    const { name, description, client_id, owner_id, status, health, start_date, end_date, budget } = req.body || {};

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `UPDATE projects SET
           name = COALESCE($1, name),
           description = COALESCE($2, description),
           client_id = $3,
           owner_id = COALESCE($4, owner_id),
           status = COALESCE($5, status),
           health = COALESCE($6, health),
           start_date = $7,
           end_date = $8,
           budget = COALESCE($9, budget),
           updated_at = now()
         WHERE id = $10 AND organization_id = $11
         RETURNING *`,
        [
          name ? name.trim() : null,
          description !== undefined ? description : null,
          client_id !== undefined ? (client_id || null) : null,
          owner_id || null,
          status || null,
          health || null,
          start_date !== undefined ? (start_date || null) : null,
          end_date !== undefined ? (end_date || null) : null,
          budget !== undefined ? Number(budget) : null,
          projId,
          orgId,
        ]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_PROJECT',
        entityType: 'project',
        entityId: projId,
        details: { name: rows[0].name, status: rows[0].status },
        ipAddress: req.ip,
      });

      return res.json({ message: 'Project updated.', project: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update project.' });
    }
  });

  return router;
}

module.exports = { createProjectsRoutes };
