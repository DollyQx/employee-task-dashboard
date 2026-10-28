const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

function sanitizeCsv(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Protect against CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function createReportsRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // Role-Specific Dashboard Metrics
  router.get('/dashboard', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const role = req.user.crm_role || 'employee';

      // 1. Core KPIs
      const kpisQuery = `
        SELECT
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND employment_status = 'active') AS active_employees,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status != 'done') AS open_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status = 'done') AS completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND crm_status != 'done') AS overdue_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND due_date = CURRENT_DATE AND crm_status != 'done') AS due_today,
          (SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND status = 'active') AS active_projects
      `;
      const kpisRes = await pool.query(kpisQuery, [orgId]);

      // 2. Status distribution
      const statusDistQuery = `
        SELECT crm_status AS status, COUNT(*) AS count
        FROM tasks
        WHERE organization_id = $1
        GROUP BY crm_status
        ORDER BY count DESC
      `;
      const statusRes = await pool.query(statusDistQuery, [orgId]);

      // 3. Priority distribution
      const priorityDistQuery = `
        SELECT crm_priority AS priority, COUNT(*) AS count
        FROM tasks
        WHERE organization_id = $1
        GROUP BY crm_priority
        ORDER BY count DESC
      `;
      const priorityRes = await pool.query(priorityDistQuery, [orgId]);

      // 4. Department Workload
      const deptWorkloadQuery = `
        SELECT 
          d.id,
          d.name AS department_name,
          d.code AS department_code,
          COUNT(t.id) AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status != 'done') AS open_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'done') AS completed_tasks
        FROM departments d
        LEFT JOIN tasks t ON t.department_id = d.id AND t.organization_id = $1
        WHERE d.organization_id = $1
        GROUP BY d.id, d.name, d.code
        ORDER BY open_tasks DESC
      `;
      const deptRes = await pool.query(deptWorkloadQuery, [orgId]);

      // 5. Employee-specific metrics (for Employee or Manager role)
      const myTasksQuery = `
        SELECT 
          COUNT(t.id) AS my_open_tasks,
          COUNT(t.id) FILTER (WHERE t.due_date = CURRENT_DATE AND t.crm_status != 'done') AS my_due_today,
          COUNT(t.id) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done') AS my_overdue,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'in_review') AS my_in_review,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'done') AS my_completed
        FROM task_assignments ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE ta.user_id = $1
      `;
      const myTasksRes = await pool.query(myTasksQuery, [req.user.id]);

      // 6. Recent audit events
      const recentActivityQuery = `
        SELECT id, actor_name, action, entity_type, details, created_at
        FROM audit_logs
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 8
      `;
      const activityRes = await pool.query(recentActivityQuery, [orgId]);

      return res.json({
        kpis: kpisRes.rows[0],
        statusDistribution: statusRes.rows,
        priorityDistribution: priorityRes.rows,
        departmentWorkload: deptRes.rows,
        myMetrics: myTasksRes.rows[0],
        recentActivity: activityRes.rows,
        userRole: role,
      });
    } catch (err) {
      console.error('Reports dashboard error:', err.message);
      return res.status(500).json({ error: 'Failed to generate dashboard reports.' });
    }
  });

  // Export Tasks to CSV
  router.get('/export-csv', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const { status, priority, department_id } = req.query;

      const where = ['t.organization_id = $1'];
      const values = [orgId];
      let pIdx = 2;

      if (status) {
        where.push(`t.crm_status = $${pIdx}`);
        values.push(status);
        pIdx++;
      }
      if (priority) {
        where.push(`t.crm_priority = $${pIdx}`);
        values.push(priority);
        pIdx++;
      }
      if (department_id) {
        where.push(`t.department_id = $${pIdx}`);
        values.push(department_id);
        pIdx++;
      }

      const query = `
        SELECT 
          t.task_code,
          t.title,
          t.crm_status,
          t.crm_priority,
          t.category,
          p.name AS project_name,
          d.name AS department_name,
          t.due_date,
          t.start_date,
          t.estimated_hours,
          t.actual_hours,
          t.completion_percentage,
          t.created_at
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE ${where.join(' AND ')}
        ORDER BY t.created_at DESC
      `;

      const { rows } = await pool.query(query, values);

      const headers = [
        'Task Code',
        'Title',
        'Status',
        'Priority',
        'Category',
        'Project',
        'Department',
        'Due Date',
        'Start Date',
        'Estimated Hours',
        'Actual Hours',
        'Completion %',
        'Created At',
      ];

      const csvRows = [headers.join(',')];
      for (const row of rows) {
        const line = [
          sanitizeCsv(row.task_code),
          sanitizeCsv(row.title),
          sanitizeCsv(row.crm_status),
          sanitizeCsv(row.crm_priority),
          sanitizeCsv(row.category),
          sanitizeCsv(row.project_name || 'None'),
          sanitizeCsv(row.department_name || 'General'),
          sanitizeCsv(row.due_date ? String(row.due_date).split('T')[0] : 'None'),
          sanitizeCsv(row.start_date ? String(row.start_date).split('T')[0] : 'None'),
          sanitizeCsv(row.estimated_hours || 0),
          sanitizeCsv(row.actual_hours || 0),
          sanitizeCsv(row.completion_percentage || 0),
          sanitizeCsv(row.created_at ? new Date(row.created_at).toISOString() : ''),
        ];
        csvRows.push(line.join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="taskflow_export.csv"');
      return res.send(csvRows.join('\r\n'));
    } catch (err) {
      console.error('Export CSV error:', err.message);
      return res.status(500).json({ error: 'Failed to export CSV.' });
    }
  });

  return router;
}

module.exports = { createReportsRoutes };
