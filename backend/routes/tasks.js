const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');

const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function mapToCoreStatus(crmStatus) {
  if (crmStatus === 'done') return 'completed';
  if (crmStatus === 'in_progress') return 'in-progress';
  return 'pending';
}

function mapToCorePriority(crmPriority) {
  if (crmPriority === 'urgent') return 'high';
  if (crmPriority === 'low' || crmPriority === 'medium' || crmPriority === 'high') return crmPriority;
  return 'medium';
}

function createTasksRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // 1. List & Search Tasks with Pagination & Role-Based Filtering
  router.get('/', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userRole = req.user.crm_role || 'employee';

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      const {
        search,
        status,
        priority,
        project_id,
        department_id,
        assignee_id,
        my_tasks,
        overdue,
        source,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = req.query;

      const joins = [
        'LEFT JOIN projects p ON t.project_id = p.id',
        'LEFT JOIN departments d ON t.department_id = d.id',
        'LEFT JOIN users u ON t.created_by = u.id',
      ];

      const whereClauses = ['t.organization_id = $1'];
      const values = [orgId];
      let paramIndex = 2;

      // ── RBAC Enforcement ──────────────────────────────────────────────
      // Employee role is strictly restricted to viewing only their assigned or self-created tasks.
      if (userRole === 'employee') {
        joins.push(`LEFT JOIN task_assignments emp_ta ON emp_ta.task_id = t.id AND emp_ta.user_id = $${paramIndex}`);
        whereClauses.push(`(emp_ta.user_id IS NOT NULL OR t.created_by = $${paramIndex})`);
        values.push(req.user.id);
        paramIndex++;
      } else if (my_tasks === 'true') {
        joins.push(`JOIN task_assignments my_ta ON my_ta.task_id = t.id AND my_ta.user_id = $${paramIndex}`);
        values.push(req.user.id);
        paramIndex++;
      } else if (assignee_id) {
        joins.push(`JOIN task_assignments ass_filter_ta ON ass_filter_ta.task_id = t.id AND ass_filter_ta.user_id = $${paramIndex}`);
        values.push(assignee_id);
        paramIndex++;
      }

      if (search && search.trim()) {
        whereClauses.push(`(t.title ILIKE $${paramIndex} OR t.task_code ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
        values.push(`%${search.trim()}%`);
        paramIndex++;
      }

      if (status && VALID_STATUSES.includes(status)) {
        whereClauses.push(`t.crm_status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (priority && VALID_PRIORITIES.includes(priority)) {
        whereClauses.push(`t.crm_priority = $${paramIndex}`);
        values.push(priority);
        paramIndex++;
      }

      if (project_id) {
        whereClauses.push(`t.project_id = $${paramIndex}`);
        values.push(project_id);
        paramIndex++;
      }

      if (department_id) {
        whereClauses.push(`t.department_id = $${paramIndex}`);
        values.push(department_id);
        paramIndex++;
      }

      if (source && source !== 'all') {
        whereClauses.push(`t.source ILIKE $${paramIndex}`);
        values.push(source);
        paramIndex++;
      }

      if (overdue === 'true') {
        whereClauses.push(`t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done'`);
      }

      const joinSql = joins.join(' ');
      const whereSql = whereClauses.join(' AND ');

      // Total count
      const countResult = await pool.query(
        `SELECT COUNT(DISTINCT t.id) FROM tasks t ${joinSql} WHERE ${whereSql}`,
        values
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Safe sorting
      const sortColumnMap = {
        created_at: 't.created_at',
        due_date: 't.due_date',
        priority: `CASE t.crm_priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`,
        status: `CASE t.crm_status WHEN 'blocked' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'todo' THEN 3 WHEN 'in_review' THEN 4 WHEN 'backlog' THEN 5 ELSE 6 END`,
        task_code: 't.task_code',
        title: 't.title',
      };
      const orderColumn = sortColumnMap[sort_by] || 't.created_at';
      const orderDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Query tasks with joins
      const tasksQuery = `
        SELECT DISTINCT
          t.id,
          t.organization_id,
          t.task_code,
          t.title,
          t.description,
          t.status AS core_status,
          t.priority AS core_priority,
          t.crm_status,
          t.crm_priority,
          t.category,
          t.due_date,
          t.start_date,
          t.completed_at,
          t.estimated_hours,
          t.actual_hours,
          t.completion_percentage,
          t.tags,
          t.source,
          t.source_url,
          t.source_link,
          t.blocked_reason,
          ${userRole === 'employee' ? 'NULL AS internal_notes' : 't.internal_notes'},
          t.created_at,
          t.updated_at,
          p.id AS project_id,
          p.name AS project_name,
          d.id AS department_id,
          d.name AS department_name,
          u.id AS creator_id,
          u.full_name AS creator_name,
          (
            t.due_date IS NOT NULL 
            AND t.due_date < CURRENT_DATE 
            AND t.crm_status != 'done'
          ) AS is_overdue
        FROM tasks t
        ${joinSql}
        WHERE ${whereSql}
        ORDER BY ${orderColumn} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const tasksValues = [...values, limit, offset];
      const { rows: taskRows } = await pool.query(tasksQuery, tasksValues);

      // Fetch assignees for each returned task
      const taskIds = taskRows.map((t) => t.id);
      let assigneesByTask = {};
      let commentsCountByTask = {};

      if (taskIds.length > 0) {
        const assigneesRes = await pool.query(
          `SELECT ta.task_id, ass_u.id, ass_u.full_name, ass_u.email, ass_u.avatar, ass_u.crm_role
           FROM task_assignments ta
           JOIN users ass_u ON ta.user_id = ass_u.id
           WHERE ta.task_id = ANY($1::uuid[])`,
          [taskIds]
        );
        assigneesRes.rows.forEach((r) => {
          if (!assigneesByTask[r.task_id]) assigneesByTask[r.task_id] = [];
          assigneesByTask[r.task_id].push({
            id: r.id,
            full_name: r.full_name,
            email: r.email,
            avatar: r.avatar,
            crm_role: r.crm_role,
          });
        });

        const commentsRes = await pool.query(
          `SELECT tc.task_id, COUNT(*) AS count
           FROM task_comments tc
           WHERE tc.task_id = ANY($1::uuid[])
             ${userRole === 'employee' ? 'AND (tc.is_internal = false OR tc.is_internal IS NULL)' : ''}
           GROUP BY tc.task_id`,
          [taskIds]
        );
        commentsRes.rows.forEach((r) => {
          commentsCountByTask[r.task_id] = parseInt(r.count, 10);
        });
      }

      // Status counters snapshot
      const countsQuery = `
        SELECT 
          COUNT(DISTINCT t.id) AS total,
          COUNT(DISTINCT t.id) FILTER (WHERE crm_status = 'backlog') AS backlog,
          COUNT(DISTINCT t.id) FILTER (WHERE crm_status = 'todo') AS todo,
          COUNT(DISTINCT t.id) FILTER (WHERE crm_status = 'in_progress') AS in_progress,
          COUNT(DISTINCT t.id) FILTER (WHERE crm_status = 'in_review') AS in_review,
          COUNT(DISTINCT t.id) FILTER (WHERE crm_status = 'blocked') AS blocked,
          COUNT(DISTINCT t.id) FILTER (WHERE crm_status = 'done') AS done,
          COUNT(DISTINCT t.id) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE AND crm_status != 'done') AS overdue
        FROM tasks t
        ${joinSql}
        WHERE ${whereSql}
      `;
      const countsResult = await pool.query(countsQuery, values);

      return res.json({
        tasks: taskRows.map((t) => ({
          ...t,
          assignees: assigneesByTask[t.id] || [],
          comments_count: commentsCountByTask[t.id] || 0,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        counts: countsResult.rows[0],
      });
    } catch (err) {
      console.error('List tasks error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve tasks.' });
    }
  });

  // 2. Single Task Details (with RBAC enforcement)
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const taskId = req.params.id;
      const userRole = req.user.crm_role || 'employee';

      const taskQuery = `
        SELECT 
          t.*,
          ${userRole === 'employee' ? 'NULL AS internal_notes' : 't.internal_notes'},
          p.name AS project_name,
          d.name AS department_name,
          u.full_name AS creator_name,
          (
            t.due_date IS NOT NULL 
            AND t.due_date < CURRENT_DATE 
            AND t.crm_status != 'done'
          ) AS is_overdue
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = $1 AND t.organization_id = $2
      `;
      const { rows } = await pool.query(taskQuery, [taskId, orgId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      const task = rows[0];

      // Employee permission check: must be assigned or creator
      if (userRole === 'employee') {
        const accessCheck = await pool.query(
          `SELECT 1 FROM task_assignments ta 
           WHERE ta.task_id = $1 AND ta.user_id = $2`,
          [taskId, req.user.id]
        );
        if (accessCheck.rows.length === 0 && task.created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to access this task.' });
        }
      }

      // Fetch assignees
      const assigneesQuery = `
        SELECT ass_u.id, ass_u.full_name, ass_u.email, ass_u.avatar, ass_u.crm_role
        FROM task_assignments ta
        JOIN users ass_u ON ta.user_id = ass_u.id
        WHERE ta.task_id = $1
      `;
      const assigneesResult = await pool.query(assigneesQuery, [taskId]);

      // Fetch comments (distinguish public comments from internal notes)
      const commentsQuery = `
        SELECT 
          tc.id,
          tc.comment,
          tc.is_internal,
          tc.created_at,
          u.id AS user_id,
          u.full_name,
          u.avatar,
          u.crm_role
        FROM task_comments tc
        JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = $1 ${userRole === 'employee' ? 'AND (tc.is_internal = false OR tc.is_internal IS NULL)' : ''}
        ORDER BY tc.created_at ASC
      `;
      const commentsResult = await pool.query(commentsQuery, [taskId]);

      // Fetch attachments
      const attachmentsQuery = `
        SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at ASC
      `;
      const attachmentsResult = await pool.query(attachmentsQuery, [taskId]);

      // Fetch activity history
      const historyQuery = `
        SELECT id, actor_name, action, details, created_at
        FROM audit_logs
        WHERE organization_id = $1 AND entity_type = 'task' AND entity_id = $2
        ORDER BY created_at DESC
        LIMIT 25
      `;
      const historyResult = await pool.query(historyQuery, [orgId, taskId]);

      return res.json({
        task: {
          ...task,
          assignees: assigneesResult.rows,
          comments: commentsResult.rows,
          attachments: attachmentsResult.rows,
          history: historyResult.rows.map((r) => {
            let details = r.details;
            try {
              if (typeof r.details === 'string') details = JSON.parse(r.details);
            } catch {}
            return { ...r, details };
          }),
        },
      });
    } catch (err) {
      console.error('Get task error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve task.' });
    }
  });

  // 3. Create Task (Super Admin, Admin, Manager only)
  router.post('/', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    const {
      title,
      description,
      crm_status = 'todo',
      crm_priority = 'medium',
      category = 'Development',
      project_id = null,
      department_id = null,
      due_date = null,
      start_date = null,
      estimated_hours = 0,
      tags = '',
      source = 'Internal',
      source_url = null,
      source_link = null,
      internal_notes = null,
      assignee_ids = [],
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const pool = poolProvider();
    const orgId = req.user.organization_id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Generate sequential task code
      const codeSeqResult = await client.query(
        'SELECT COUNT(*) + 1 AS next_code FROM tasks WHERE organization_id = $1',
        [orgId]
      );
      const codeNum = String(codeSeqResult.rows[0].next_code).padStart(4, '0');
      const taskCode = `TASK-2026-${codeNum}`;

      const coreStatus = mapToCoreStatus(crm_status);
      const corePriority = mapToCorePriority(crm_priority);

      const insertTaskSql = `
        INSERT INTO tasks (
          organization_id,
          created_by,
          title,
          description,
          status,
          priority,
          due_date,
          task_code,
          project_id,
          department_id,
          crm_status,
          crm_priority,
          category,
          start_date,
          estimated_hours,
          tags,
          source,
          source_url,
          source_link,
          internal_notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
      `;
      const taskValues = [
        orgId,
        req.user.id,
        title.trim(),
        description || null,
        coreStatus,
        corePriority,
        due_date || null,
        taskCode,
        project_id || null,
        department_id || null,
        VALID_STATUSES.includes(crm_status) ? crm_status : 'todo',
        VALID_PRIORITIES.includes(crm_priority) ? crm_priority : 'medium',
        category,
        start_date || null,
        Number(estimated_hours) || 0,
        Array.isArray(tags) ? tags.join(',') : tags || '',
        source || 'Internal',
        source_url || source_link || null,
        source_link || source_url || null,
        internal_notes || null,
      ];

      const { rows } = await client.query(insertTaskSql, taskValues);
      const createdTask = rows[0];

      // Assign users
      if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
        for (const userId of assignee_ids) {
          await client.query(
            `INSERT INTO task_assignments (organization_id, task_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id, task_id, user_id) DO NOTHING`,
            [orgId, createdTask.id, userId, req.user.id]
          );
          // Notify assignee
          await createNotification(client, {
            organizationId: orgId,
            userId,
            title: 'New Task Assigned',
            message: `${req.user.full_name} assigned you to "${createdTask.title}" (${taskCode})`,
            type: 'assignment',
            entityType: 'task',
            entityId: createdTask.id,
          });
        }
      }

      // Audit log
      await logAudit(client, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_TASK',
        entityType: 'task',
        entityId: createdTask.id,
        details: { taskCode, title: createdTask.title, priority: crm_priority, source: createdTask.source },
        ipAddress: req.ip,
      });

      await client.query('COMMIT');
      return res.status(201).json({ message: 'Task created successfully.', task: createdTask });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create task error:', err.message);
      return res.status(500).json({ error: 'Failed to create task: ' + err.message });
    } finally {
      client.release();
    }
  });

  // 4. Update Task (Super Admin, Admin, Manager only)
  router.put('/:id', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    const taskId = req.params.id;
    const {
      title,
      description,
      crm_status,
      crm_priority,
      category,
      project_id,
      department_id,
      due_date,
      start_date,
      estimated_hours,
      actual_hours,
      completion_percentage,
      tags,
      blocked_reason,
      source,
      source_url,
      source_link,
      internal_notes,
      assignee_ids,
    } = req.body || {};

    const pool = poolProvider();
    const orgId = req.user.organization_id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query('SELECT * FROM tasks WHERE id = $1 AND organization_id = $2', [taskId, orgId]);
      if (existingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Task not found.' });
      }
      const existing = existingResult.rows[0];

      const newStatus = crm_status && VALID_STATUSES.includes(crm_status) ? crm_status : existing.crm_status;
      const newPriority = crm_priority && VALID_PRIORITIES.includes(crm_priority) ? crm_priority : existing.crm_priority;
      const coreStatus = mapToCoreStatus(newStatus);
      const corePriority = mapToCorePriority(newPriority);
      const completedAt = newStatus === 'done' ? (existing.completed_at || new Date()) : null;

      const updateSql = `
        UPDATE tasks SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          crm_status = $3,
          crm_priority = $4,
          status = $5,
          priority = $6,
          category = COALESCE($7, category),
          project_id = $8,
          department_id = $9,
          due_date = $10,
          start_date = $11,
          estimated_hours = COALESCE($12, estimated_hours),
          actual_hours = COALESCE($13, actual_hours),
          completion_percentage = COALESCE($14, completion_percentage),
          tags = COALESCE($15, tags),
          blocked_reason = $16,
          completed_at = $17,
          source = COALESCE($18, source),
          source_url = COALESCE($19, source_url),
          source_link = COALESCE($20, source_link),
          internal_notes = COALESCE($21, internal_notes),
          updated_at = now()
        WHERE id = $22 AND organization_id = $23
        RETURNING *
      `;

      const updateValues = [
        title ? title.trim() : null,
        description !== undefined ? description : null,
        newStatus,
        newPriority,
        coreStatus,
        corePriority,
        category || null,
        project_id !== undefined ? (project_id || null) : existing.project_id,
        department_id !== undefined ? (department_id || null) : existing.department_id,
        due_date !== undefined ? (due_date || null) : existing.due_date,
        start_date !== undefined ? (start_date || null) : existing.start_date,
        estimated_hours !== undefined ? Number(estimated_hours) : null,
        actual_hours !== undefined ? Number(actual_hours) : null,
        completion_percentage !== undefined ? Number(completion_percentage) : null,
        tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : null,
        blocked_reason !== undefined ? blocked_reason : existing.blocked_reason,
        completedAt,
        source || null,
        source_url || source_link || null,
        source_link || source_url || null,
        internal_notes !== undefined ? internal_notes : null,
        taskId,
        orgId,
      ];

      const { rows } = await client.query(updateSql, updateValues);

      // Handle assignee updates if provided
      if (Array.isArray(assignee_ids)) {
        await client.query('DELETE FROM task_assignments WHERE task_id = $1 AND organization_id = $2', [taskId, orgId]);
        for (const uid of assignee_ids) {
          await client.query(
            `INSERT INTO task_assignments (organization_id, task_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [orgId, taskId, uid, req.user.id]
          );
        }
      }

      await logAudit(client, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_TASK',
        entityType: 'task',
        entityId: taskId,
        details: { status: newStatus, priority: newPriority, taskCode: rows[0].task_code },
        ipAddress: req.ip,
      });

      await client.query('COMMIT');
      return res.json({ message: 'Task updated successfully.', task: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update task error:', err.message);
      return res.status(500).json({ error: 'Failed to update task: ' + err.message });
    } finally {
      client.release();
    }
  });

  // 5. Fast Status Patch (Employees allowed on their assigned tasks; Managers/Admins on all)
  router.patch('/:id/status', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    const { status } = req.body || {};

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userRole = req.user.crm_role || 'employee';

      // Verify task exists in org
      const taskCheck = await pool.query('SELECT * FROM tasks WHERE id = $1 AND organization_id = $2', [taskId, orgId]);
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }
      const existingTask = taskCheck.rows[0];

      // Employee permission check: must be assigned to the task or creator
      if (userRole === 'employee') {
        const assignCheck = await pool.query(
          'SELECT 1 FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [taskId, req.user.id]
        );
        if (assignCheck.rows.length === 0 && existingTask.created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You can only update the status of tasks assigned to you.' });
        }
      }

      const coreStatus = mapToCoreStatus(status);
      const isDone = status === 'done';
      const completedAt = isDone ? new Date() : null;
      const completionPercentage = isDone ? 100 : (status === 'in_progress' ? 50 : (status === 'in_review' ? 85 : undefined));

      let query = `
        UPDATE tasks SET
          crm_status = $1,
          status = $2,
          completed_at = $3,
          updated_at = now()
      `;
      const values = [status, coreStatus, completedAt];
      let pIdx = 4;

      if (completionPercentage !== undefined) {
        query += `, completion_percentage = $${pIdx}`;
        values.push(completionPercentage);
        pIdx++;
      }

      query += ` WHERE id = $${pIdx} AND organization_id = $${pIdx + 1} RETURNING *`;
      values.push(taskId, orgId);

      const { rows } = await pool.query(query, values);
      const updated = rows[0];

      // Audit log
      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_STATUS',
        entityType: 'task',
        entityId: taskId,
        details: { oldStatus: existingTask.crm_status, newStatus: status, taskCode: updated.task_code },
        ipAddress: req.ip,
      });

      return res.json({ message: 'Status updated.', task: updated });
    } catch (err) {
      console.error('Patch status error:', err.message);
      return res.status(500).json({ error: 'Failed to update status.' });
    }
  });

  // 6. Bulk Operations
  router.post('/bulk', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    const { action, task_ids, value } = req.body || {};
    if (!action || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ error: 'Valid action and task_ids are required.' });
    }

    const pool = poolProvider();
    const orgId = req.user.organization_id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (action === 'update_status') {
        if (!VALID_STATUSES.includes(value)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid status value.' });
        }
        const coreStatus = mapToCoreStatus(value);
        const completedAt = value === 'done' ? new Date() : null;

        await client.query(
          `UPDATE tasks SET
             crm_status = $1,
             status = $2,
             completed_at = $3,
             completion_percentage = CASE WHEN $1 = 'done' THEN 100 ELSE completion_percentage END,
             updated_at = now()
           WHERE id = ANY($4::uuid[]) AND organization_id = $5`,
          [value, coreStatus, completedAt, task_ids, orgId]
        );
      } else if (action === 'assign') {
        if (!value) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Assignee user ID required.' });
        }
        for (const tid of task_ids) {
          await client.query(
            `INSERT INTO task_assignments (organization_id, task_id, user_id, assigned_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id, task_id, user_id) DO NOTHING`,
            [orgId, tid, value, req.user.id]
          );
        }
      } else if (action === 'delete') {
        if (req.user.crm_role !== 'super_admin' && req.user.crm_role !== 'admin') {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Only admins can perform bulk delete.' });
        }
        await client.query('DELETE FROM tasks WHERE id = ANY($1::uuid[]) AND organization_id = $2', [task_ids, orgId]);
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Unsupported bulk action.' });
      }

      await logAudit(client, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'BULK_' + action.toUpperCase(),
        entityType: 'task',
        details: { count: task_ids.length, value },
        ipAddress: req.ip,
      });

      await client.query('COMMIT');
      return res.json({ message: `Bulk action "${action}" completed for ${task_ids.length} tasks.` });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Bulk tasks error:', err.message);
      return res.status(500).json({ error: 'Failed to process bulk task update.' });
    } finally {
      client.release();
    }
  });

  // 7. Delete Task (Super Admin, Admin, Manager only)
  router.delete('/:id', requireAuth, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const taskId = req.params.id;

      const { rows } = await pool.query(
        'DELETE FROM tasks WHERE id = $1 AND organization_id = $2 RETURNING title, task_code',
        [taskId, orgId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'DELETE_TASK',
        entityType: 'task',
        entityId: taskId,
        details: { title: rows[0].title, taskCode: rows[0].task_code },
        ipAddress: req.ip,
      });

      return res.json({ message: 'Task deleted successfully.' });
    } catch (err) {
      console.error('Delete task error:', err.message);
      return res.status(500).json({ error: 'Failed to delete task.' });
    }
  });

  // 8. Add Comment / Internal Note
  router.post('/:id/comments', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    const { comment, is_internal = false } = req.body || {};
    const userRole = req.user.crm_role || 'employee';

    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      // Verify task exists in org
      const taskCheck = await pool.query('SELECT id, title, task_code, created_by FROM tasks WHERE id = $1 AND organization_id = $2', [taskId, orgId]);
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }
      const task = taskCheck.rows[0];

      // Employee permission check
      if (userRole === 'employee') {
        const assignCheck = await pool.query(
          'SELECT 1 FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [taskId, req.user.id]
        );
        if (assignCheck.rows.length === 0 && task.created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to comment on this task.' });
        }
        if (is_internal) {
          return res.status(403).json({ error: 'Forbidden: Employees cannot create internal-only notes.' });
        }
      }

      const internalFlag = Boolean(is_internal && userRole !== 'employee');

      const { rows } = await pool.query(
        `INSERT INTO task_comments (task_id, user_id, comment, is_internal)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [taskId, req.user.id, comment.trim(), internalFlag]
      );

      // Audit log note creation
      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: internalFlag ? 'ADD_INTERNAL_NOTE' : 'ADD_COMMENT',
        entityType: 'task',
        entityId: taskId,
        details: { taskCode: task.task_code, isInternal: internalFlag },
        ipAddress: req.ip,
      });

      // Notify task creator if someone else commented on public comment
      if (!internalFlag && task.created_by && task.created_by !== req.user.id) {
        await createNotification(pool, {
          organizationId: orgId,
          userId: task.created_by,
          title: 'New Comment on Task',
          message: `${req.user.full_name} commented on "${task.title}"`,
          type: 'mention',
          entityType: 'task',
          entityId: taskId,
        });
      }

      return res.status(201).json({
        message: internalFlag ? 'Internal note added.' : 'Comment added.',
        comment: {
          ...rows[0],
          user_id: req.user.id,
          full_name: req.user.full_name,
          avatar: req.user.avatar,
          crm_role: req.user.crm_role,
        },
      });
    } catch (err) {
      console.error('Add comment error:', err.message);
      return res.status(500).json({ error: 'Failed to add comment.' });
    }
  });

  // 9. List Comments (Enforces internal note visibility)
  router.get('/:id/comments', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const taskId = req.params.id;
      const orgId = req.user.organization_id;
      const userRole = req.user.crm_role || 'employee';

      // Verify task belongs to the caller's organization
      const taskCheck = await pool.query(
        'SELECT id, created_by FROM tasks WHERE id = $1 AND organization_id = $2',
        [taskId, orgId]
      );
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      // If employee, verify access
      if (userRole === 'employee') {
        const assignCheck = await pool.query(
          'SELECT 1 FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [taskId, req.user.id]
        );
        if (assignCheck.rows.length === 0 && taskCheck.rows[0].created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to view comments on this task.' });
        }
      }

      // Backend visibility rule: Employees CANNOT see internal notes
      const commentsSql = `
        SELECT 
          tc.id,
          tc.comment,
          tc.is_internal,
          tc.created_at,
          u.id AS user_id,
          u.full_name,
          u.avatar,
          u.crm_role
        FROM task_comments tc
        JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = $1 ${userRole === 'employee' ? 'AND (tc.is_internal = false OR tc.is_internal IS NULL)' : ''}
        ORDER BY tc.created_at ASC
      `;

      const { rows } = await pool.query(commentsSql, [taskId]);
      return res.json({ comments: rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch comments.' });
    }
  });

  // 10. Task Activity History (Chronological change log)
  router.get('/:id/history', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const taskId = req.params.id;
      const orgId = req.user.organization_id;
      const userRole = req.user.crm_role || 'employee';

      const taskCheck = await pool.query(
        'SELECT id, created_by FROM tasks WHERE id = $1 AND organization_id = $2',
        [taskId, orgId]
      );
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      if (userRole === 'employee') {
        const assignCheck = await pool.query(
          'SELECT 1 FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [taskId, req.user.id]
        );
        if (assignCheck.rows.length === 0 && taskCheck.rows[0].created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You do not have access to this task history.' });
        }
      }

      const { rows } = await pool.query(
        `SELECT id, actor_name, action, details, created_at
         FROM audit_logs
         WHERE organization_id = $1 AND entity_type = 'task' AND entity_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [orgId, taskId]
      );

      return res.json({
        history: rows.map((r) => {
          let details = r.details;
          try {
            if (typeof r.details === 'string') details = JSON.parse(r.details);
          } catch {}
          return { ...r, details };
        }),
      });
    } catch (err) {
      console.error('Task history error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch task history.' });
    }
  });

  // 11. Submit Task Progress & Updates (0% to 100%, Notes, Blockers)
  router.post('/:id/progress', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    const { progress, status, notes, blockers, pending_work } = req.body || {};

    if (progress === undefined || progress === null || isNaN(Number(progress)) || Number(progress) < 0 || Number(progress) > 100) {
      return res.status(400).json({ error: 'Progress must be a valid number between 0 and 100.' });
    }

    const newProgress = Math.round(Number(progress));

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userRole = req.user.crm_role || 'employee';

      // 1. Check task existence
      const taskRes = await pool.query(
        'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
        [taskId, orgId]
      );
      if (taskRes.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }
      const existingTask = taskRes.rows[0];

      // 2. Authorization check: Employees can only update progress on their own assigned tasks
      if (userRole === 'employee') {
        const assignCheck = await pool.query(
          'SELECT user_id FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [taskId, req.user.id]
        );
        if (assignCheck.rows.length === 0 && existingTask.created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You can only update progress on tasks assigned to you.' });
        }
      }

      // 3. Workflow status resolution:
      // Prompt Rule: "Do not automatically mark a task as Completed just because a user moved a slider to 100%
      // if the workflow requires manager approval."
      let targetStatus = existingTask.crm_status;
      if (status && VALID_STATUSES.includes(status)) {
        targetStatus = status;
      } else if (newProgress === 100) {
        // If employee moves to 100% without explicit approved status, move to in_review
        targetStatus = (userRole === 'employee') ? 'in_review' : 'done';
      } else if (newProgress > 0 && targetStatus === 'todo') {
        targetStatus = 'in_progress';
      }

      const coreStatus = mapToCoreStatus(targetStatus);
      const completedAt = targetStatus === 'done' ? new Date() : (targetStatus === 'in_review' ? null : existingTask.completed_at);

      // 4. Update task record
      const updateQuery = `
        UPDATE tasks SET
          completion_percentage = $1,
          crm_status = $2,
          status = $3,
          completed_at = $4,
          updated_at = now()
        WHERE id = $5 AND organization_id = $6
        RETURNING *
      `;
      const updateRes = await pool.query(updateQuery, [
        newProgress,
        targetStatus,
        coreStatus,
        completedAt,
        taskId,
        orgId,
      ]);
      const updatedTask = updateRes.rows[0];

      // 5. Insert into task_progress_updates
      const previousProgress = existingTask.completion_percentage || 0;
      const progressInsertQuery = `
        INSERT INTO task_progress_updates (
          task_id, user_id, previous_progress, current_progress, status, notes, blockers, pending_work
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const progressRes = await pool.query(progressInsertQuery, [
        taskId,
        req.user.id,
        previousProgress,
        newProgress,
        targetStatus,
        notes ? notes.trim() : null,
        blockers ? blockers.trim() : null,
        pending_work ? pending_work.trim() : null,
      ]);
      const progressRecord = progressRes.rows[0];

      // Also add as task comment if a progress note was provided
      if (notes && notes.trim().length > 0) {
        const commentPrefix = `[Progress Update: ${newProgress}%] `;
        await pool.query(
          `INSERT INTO task_comments (task_id, user_id, comment, is_internal)
           VALUES ($1, $2, $3, false)`,
          [taskId, req.user.id, commentPrefix + notes.trim()]
        );
      }

      // 6. Audit logging
      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'TASK_PROGRESS_UPDATE',
        entityType: 'task',
        entityId: taskId,
        details: {
          previousProgress,
          newProgress,
          status: targetStatus,
          notes: notes ? notes.trim() : null,
          blockers: blockers ? blockers.trim() : null,
        },
        ipAddress: req.ip,
      });

      return res.json({
        message: 'Task progress updated successfully.',
        task: updatedTask,
        progressUpdate: progressRecord,
      });
    } catch (err) {
      console.error('Task progress update error:', err.message);
      return res.status(500).json({ error: 'Failed to update task progress.' });
    }
  });

  // 12. Retrieve Task Progress History
  router.get('/:id/progress-history', requireAuth, async (req, res) => {
    const taskId = req.params.id;

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userRole = req.user.crm_role || 'employee';

      // Verify task existence
      const taskCheck = await pool.query(
        'SELECT id, created_by FROM tasks WHERE id = $1 AND organization_id = $2',
        [taskId, orgId]
      );
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      // Authorization check for employees
      if (userRole === 'employee') {
        const assignCheck = await pool.query(
          'SELECT user_id FROM task_assignments WHERE task_id = $1 AND user_id = $2',
          [taskId, req.user.id]
        );
        if (assignCheck.rows.length === 0 && taskCheck.rows[0].created_by !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: You do not have access to this task progress history.' });
        }
      }

      const query = `
        SELECT 
          tpu.id,
          tpu.task_id,
          tpu.user_id,
          tpu.previous_progress,
          tpu.current_progress,
          tpu.status,
          tpu.notes,
          tpu.blockers,
          tpu.pending_work,
          tpu.created_at,
          u.full_name AS author_name,
          u.crm_role AS author_role,
          u.avatar AS author_avatar
        FROM task_progress_updates tpu
        JOIN users u ON tpu.user_id = u.id
        WHERE tpu.task_id = $1
        ORDER BY tpu.created_at DESC
      `;
      const { rows } = await pool.query(query, [taskId]);
      return res.json({ history: rows });
    } catch (err) {
      console.error('Fetch progress history error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch progress history.' });
    }
  });

  return router;
}

module.exports = { createTasksRoutes };
