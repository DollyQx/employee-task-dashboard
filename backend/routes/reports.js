const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

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

  // Role-Specific Dashboard Metrics (Super Admin, Admin, Manager, Employee)
  router.get('/dashboard', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const role = req.user.crm_role || 'employee';
      const userId = req.user.id;

      // 1. Organization & Task Overall KPIs
      const kpisQuery = `
        SELECT
          (SELECT COUNT(*) FROM users WHERE organization_id = $1) AS total_employees,
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) AS active_employees,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1) AS total_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status != 'done') AS open_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status = 'done') AS completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND crm_status != 'done') AS overdue_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND due_date = CURRENT_DATE AND crm_status != 'done') AS due_today,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_priority = 'urgent' AND crm_status != 'done') AS urgent_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status IN ('in_review', 'blocked', 'todo')) AS awaiting_action_tasks,
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

      // 4. Employee workload distribution
      const workloadQuery = `
        SELECT 
          u.id, 
          u.full_name, 
          u.employee_id, 
          u.crm_role, 
          u.designation,
          u.avatar,
          d.name AS department_name,
          COUNT(t.id) FILTER (WHERE t.crm_status != 'done') AS active_tasks,
          COUNT(t.id) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done') AS overdue_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'done') AS completed_tasks
        FROM users u
        LEFT JOIN task_assignments ta ON ta.user_id = u.id AND ta.organization_id = $1
        LEFT JOIN tasks t ON ta.task_id = t.id AND t.organization_id = $1
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.organization_id = $1 AND u.is_active = true
        GROUP BY u.id, u.full_name, u.employee_id, u.crm_role, u.designation, u.avatar, d.name
        ORDER BY active_tasks DESC
        LIMIT 10
      `;
      const workloadRes = await pool.query(workloadQuery, [orgId]);

      // 5. Department Workload
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

      // 6. Employee-specific metrics (My Tasks, Due Today, Upcoming Deadlines, Overdue, Completed)
      const myTasksQuery = `
        SELECT 
          COUNT(t.id) AS my_total_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status != 'done') AS my_open_tasks,
          COUNT(t.id) FILTER (WHERE t.due_date = CURRENT_DATE AND t.crm_status != 'done') AS my_due_today,
          COUNT(t.id) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done') AS my_overdue,
          COUNT(t.id) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date > CURRENT_DATE AND t.due_date <= (CURRENT_DATE + INTERVAL '7 days') AND t.crm_status != 'done') AS my_upcoming,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'in_review') AS my_in_review,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'done') AS my_completed
        FROM task_assignments ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE ta.user_id = $1 AND ta.organization_id = $2 AND t.organization_id = $2
      `;
      const myTasksRes = await pool.query(myTasksQuery, [userId, orgId]);

      // 7. Recent updates and notes on tasks assigned to current user
      const myRecentUpdatesQuery = `
        SELECT 
          tc.id,
          tc.comment,
          tc.created_at,
          u.full_name AS author_name,
          u.avatar AS author_avatar,
          t.id AS task_id,
          t.title AS task_title,
          t.task_code
        FROM task_comments tc
        JOIN tasks t ON tc.task_id = t.id
        JOIN users u ON tc.user_id = u.id
        JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = $1
        WHERE t.organization_id = $2 AND (tc.is_internal = false OR tc.is_internal IS NULL)
        ORDER BY tc.created_at DESC
        LIMIT 6
      `;
      const myUpdatesRes = await pool.query(myRecentUpdatesQuery, [userId, orgId]);

      // 8. Recent Organization Audit Activity
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
        employeeWorkload: workloadRes.rows,
        departmentWorkload: deptRes.rows,
        myMetrics: myTasksRes.rows[0],
        myRecentUpdates: myUpdatesRes.rows,
        recentActivity: activityRes.rows,
        userRole: role,
        userName: req.user.full_name,
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

  // Admin Dashboard: Work Monitoring (Summary Cards + Employee-wise Progress Table)
  router.get('/work-monitoring', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const { employee_id, department_id, status, priority } = req.query;
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Summary Cards
      const summaryQuery = `
        SELECT
          (SELECT COUNT(*) FROM users WHERE organization_id = $1) AS total_employees,
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) AS active_employees,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1) AS tasks_assigned,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status = 'in_progress') AS tasks_in_progress,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status = 'in_review') AS tasks_awaiting_review,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status = 'done') AS completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status IN ('todo', 'backlog')) AS pending_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND crm_status != 'done') AS overdue_tasks
      `;
      const summaryRes = await pool.query(summaryQuery, [orgId]);
      const summary = summaryRes.rows[0];

      // 2. Employee Work Progress Query
      let whereClauses = ['u.organization_id = $1', 'u.is_active = true'];
      let queryParams = [orgId];
      let pIdx = 2;

      if (employee_id) {
        whereClauses.push(`(u.id = $${pIdx} OR u.employee_id = $${pIdx})`);
        queryParams.push(employee_id);
        pIdx++;
      }

      if (department_id) {
        whereClauses.push(`u.department_id = $${pIdx}`);
        queryParams.push(department_id);
        pIdx++;
      }

      // If filtering by task status or priority, filter joined tasks
      let taskFilterJoin = '';
      if (status) {
        taskFilterJoin += ` AND t.crm_status = $${pIdx}`;
        queryParams.push(status);
        pIdx++;
      }
      if (priority) {
        taskFilterJoin += ` AND t.crm_priority = $${pIdx}`;
        queryParams.push(priority);
        pIdx++;
      }

      const empQuery = `
        SELECT 
          u.id, 
          u.full_name, 
          u.employee_id, 
          u.crm_role, 
          u.designation,
          u.avatar,
          d.name AS department_name,
          COUNT(t.id) AS assigned_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'done') AS completed_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'in_progress') AS in_progress_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status IN ('todo', 'backlog')) AS pending_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'in_review') AS in_review_tasks,
          COUNT(t.id) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done') AS overdue_tasks,
          AVG(t.completion_percentage) AS avg_progress_percentage
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN task_assignments ta ON ta.user_id = u.id AND ta.organization_id = $1
        LEFT JOIN tasks t ON ta.task_id = t.id AND t.organization_id = $1 ${taskFilterJoin}
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY u.id, u.full_name, u.employee_id, u.crm_role, u.designation, u.avatar, d.name
        ORDER BY assigned_tasks DESC, u.full_name ASC
      `;
      const empRes = await pool.query(empQuery, queryParams);

      // 3. Fetch today's attendance status for all employees
      const attendanceRes = await pool.query(
        `SELECT user_id, status, check_in_at, check_out_at, duration_minutes
         FROM attendance_records
         WHERE organization_id = $1 AND date = $2
         ORDER BY check_in_at DESC`,
        [orgId, todayStr]
      );
      const attendanceMap = {};
      attendanceRes.rows.forEach((att) => {
        if (!attendanceMap[att.user_id]) {
          attendanceMap[att.user_id] = att.check_out_at ? 'checked_out' : 'present';
        }
      });

      // 4. Fetch latest progress update per employee
      const progressRes = await pool.query(
        `SELECT tpu.user_id, tpu.current_progress, tpu.status, tpu.notes, tpu.created_at, t.title AS task_title
         FROM task_progress_updates tpu
         JOIN tasks t ON tpu.task_id = t.id
         WHERE t.organization_id = $1
         ORDER BY tpu.created_at DESC`,
        [orgId]
      );
      const latestProgressMap = {};
      progressRes.rows.forEach((pu) => {
        if (!latestProgressMap[pu.user_id]) {
          latestProgressMap[pu.user_id] = {
            progress: pu.current_progress,
            status: pu.status,
            notes: pu.notes,
            task_title: pu.task_title,
            updated_at: pu.created_at,
          };
        }
      });

      // Combine employee records
      const employees = empRes.rows.map((emp) => ({
        ...emp,
        assigned_tasks: parseInt(emp.assigned_tasks, 10) || 0,
        completed_tasks: parseInt(emp.completed_tasks, 10) || 0,
        in_progress_tasks: parseInt(emp.in_progress_tasks, 10) || 0,
        pending_tasks: parseInt(emp.pending_tasks, 10) || 0,
        in_review_tasks: parseInt(emp.in_review_tasks, 10) || 0,
        overdue_tasks: parseInt(emp.overdue_tasks, 10) || 0,
        avg_progress_percentage: Math.round(Number(emp.avg_progress_percentage) || 0),
        today_attendance: attendanceMap[emp.id] || 'not_checked_in',
        latest_progress: latestProgressMap[emp.id] || null,
      }));

      return res.json({
        summary: {
          total_employees: parseInt(summary.total_employees, 10) || 0,
          active_employees: parseInt(summary.active_employees, 10) || 0,
          tasks_assigned: parseInt(summary.tasks_assigned, 10) || 0,
          tasks_in_progress: parseInt(summary.tasks_in_progress, 10) || 0,
          tasks_awaiting_review: parseInt(summary.tasks_awaiting_review, 10) || 0,
          completed_tasks: parseInt(summary.completed_tasks, 10) || 0,
          pending_tasks: parseInt(summary.pending_tasks, 10) || 0,
          overdue_tasks: parseInt(summary.overdue_tasks, 10) || 0,
        },
        employees,
      });
    } catch (err) {
      console.error('Work monitoring error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve work monitoring data.' });
    }
  });

  // Export Work Monitoring to CSV
  router.get('/export/work-monitoring-csv', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const empQuery = `
        SELECT 
          u.full_name, 
          u.employee_id, 
          u.crm_role, 
          u.designation,
          d.name AS department_name,
          COUNT(t.id) AS assigned_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'done') AS completed_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status = 'in_progress') AS in_progress_tasks,
          COUNT(t.id) FILTER (WHERE t.crm_status IN ('todo', 'backlog')) AS pending_tasks,
          COUNT(t.id) FILTER (WHERE t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done') AS overdue_tasks,
          AVG(t.completion_percentage) AS avg_progress
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN task_assignments ta ON ta.user_id = u.id AND ta.organization_id = $1
        LEFT JOIN tasks t ON ta.task_id = t.id AND t.organization_id = $1
        WHERE u.organization_id = $1 AND u.is_active = true
        GROUP BY u.id, u.full_name, u.employee_id, u.crm_role, u.designation, d.name
        ORDER BY assigned_tasks DESC, u.full_name ASC
      `;
      const empRes = await pool.query(empQuery, [orgId]);

      const csvRows = [
        ['Employee Name', 'Employee ID', 'Role', 'Designation', 'Department', 'Assigned Tasks', 'Completed', 'In Progress', 'Pending', 'Overdue', 'Avg Progress (%)'].join(','),
      ];

      for (const row of empRes.rows) {
        csvRows.push([
          sanitizeCsv(row.full_name),
          sanitizeCsv(row.employee_id),
          sanitizeCsv(row.crm_role),
          sanitizeCsv(row.designation),
          sanitizeCsv(row.department_name || 'General'),
          sanitizeCsv(row.assigned_tasks || 0),
          sanitizeCsv(row.completed_tasks || 0),
          sanitizeCsv(row.in_progress_tasks || 0),
          sanitizeCsv(row.pending_tasks || 0),
          sanitizeCsv(row.overdue_tasks || 0),
          sanitizeCsv(Math.round(Number(row.avg_progress) || 0)),
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="work_monitoring_export.csv"');
      return res.send(csvRows.join('\r\n'));
    } catch (err) {
      console.error('Export work monitoring CSV error:', err.message);
      return res.status(500).json({ error: 'Failed to export CSV.' });
    }
  });

  // Automated Reporting Summary
  router.get('/automation-summary', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const summaryQuery = `
        SELECT
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1) AS total_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND crm_status = 'done') AS completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE organization_id = $1 AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND crm_status != 'done') AS overdue_tasks,
          (SELECT COUNT(*) FROM leave_requests WHERE organization_id = $1 AND status = 'pending') AS pending_leaves,
          (SELECT COUNT(*) FROM attendance_records WHERE organization_id = $1 AND date = CURRENT_DATE AND check_out_at IS NULL) AS open_attendance_sessions,
          (SELECT COUNT(*) FROM recurring_task_templates WHERE organization_id = $1 AND is_active = true) AS active_recurring_templates
      `;
      const { rows } = await pool.query(summaryQuery, [orgId]);
      const s = rows[0] || {};

      const totalTasks = parseInt(s.total_tasks, 10) || 0;
      const completedTasks = parseInt(s.completed_tasks, 10) || 0;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return res.json({
        summary: {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          completion_rate: completionRate,
          overdue_tasks: parseInt(s.overdue_tasks, 10) || 0,
          pending_leaves: parseInt(s.pending_leaves, 10) || 0,
          open_attendance_sessions: parseInt(s.open_attendance_sessions, 10) || 0,
          active_recurring_templates: parseInt(s.active_recurring_templates, 10) || 0,
        },
      });
    } catch (err) {
      console.error('Automation summary error:', err.message);
      return res.status(500).json({ error: 'Failed to generate automation summary.' });
    }
  });

  return router;
}

module.exports = { createReportsRoutes };
