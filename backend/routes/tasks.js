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

  // 1. List & Search Tasks with Pagination & Multi-filtering
  router.get('/', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

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
        sort_by = 'created_at',
        sort_order = 'desc',
      } = req.query;

      const whereClauses = ['t.organization_id = $1'];
      const values = [orgId];
      let paramIndex = 2;

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

      if (assignee_id) {
        whereClauses.push(`EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = $${paramIndex})`);
        values.push(assignee_id);
        paramIndex++;
      }

      if (my_tasks === 'true') {
        whereClauses.push(`EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = $${paramIndex})`);
        values.push(req.user.id);
        paramIndex++;
      }

      if (overdue === 'true') {
        whereClauses.push(`t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.crm_status != 'done'`);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count
      const countResult = await pool.query(`SELECT COUNT(*) FROM tasks t WHERE ${whereSql}`, values);
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

      // Query tasks with joins for project, department, creator, and assignees
      const tasksQuery = `
        SELECT 
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
          t.blocked_reason,
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
          ) AS is_overdue,
          (
            SELECT json_agg(json_build_object(
              'id', ass_u.id,
              'full_name', ass_u.full_name,
              'email', ass_u.email,
              'avatar', ass_u.avatar,
              'crm_role', ass_u.crm_role
            ))
            FROM task_assignments ta
            JOIN users ass_u ON ta.user_id = ass_u.id
            WHERE ta.task_id = t.id
          ) AS assignees,
          (
            SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id
          ) AS comments_count
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE ${whereSql}
        ORDER BY ${orderColumn} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const tasksValues = [...values, limit, offset];
      const { rows: taskRows } = await pool.query(tasksQuery, tasksValues);

      // Status counters snapshot
      const countsQuery = `
        SELECT 
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE crm_status = 'backlog') AS backlog,
          COUNT(*) FILTER (WHERE crm_status = 'todo') AS todo,
          COUNT(*) FILTER (WHERE crm_status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE crm_status = 'in_review') AS in_review,
          COUNT(*) FILTER (WHERE crm_status = 'blocked') AS blocked,
          COUNT(*) FILTER (WHERE crm_status = 'done') AS done,
          COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE AND crm_status != 'done') AS overdue
        FROM tasks
        WHERE organization_id = $1
      `;
      const countsResult = await pool.query(countsQuery, [orgId]);

      return res.json({
        tasks: taskRows.map((t) => ({
          ...t,
          assignees: t.assignees || [],
          comments_count: parseInt(t.comments_count || 0, 10),
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

  // 2. Single Task Details
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const taskId = req.params.id;

      const taskQuery = `
        SELECT 
          t.*,
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

      // Fetch assignees
      const assigneesQuery = `
        SELECT ass_u.id, ass_u.full_name, ass_u.email, ass_u.avatar, ass_u.crm_role
        FROM task_assignments ta
        JOIN users ass_u ON ta.user_id = ass_u.id
        WHERE ta.task_id = $1
      `;
      const assigneesResult = await pool.query(assigneesQuery, [taskId]);

      // Fetch comments
      const commentsQuery = `
        SELECT 
          tc.id,
          tc.comment,
          tc.created_at,
          u.id AS user_id,
          u.full_name,
          u.avatar,
          u.crm_role
        FROM task_comments tc
        JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = $1
        ORDER BY tc.created_at ASC
      `;
      const commentsResult = await pool.query(commentsQuery, [taskId]);

      // Fetch attachments
      const attachmentsQuery = `
        SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at ASC
      `;
      const attachmentsResult = await pool.query(attachmentsQuery, [taskId]);

      return res.json({
        task: {
          ...rows[0],
          assignees: assigneesResult.rows,
          comments: commentsResult.rows,
          attachments: attachmentsResult.rows,
        },
      });
    } catch (err) {
      console.error('Get task error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve task.' });
    }
  });

  // 3. Create Task
  router.post('/', requireAuth, async (req, res) => {
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
          source
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
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
        'TaskFlow',
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
        details: { taskCode, title: createdTask.title, priority: crm_priority },
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

  // 4. Update Task
  router.put('/:id', requireAuth, async (req, res) => {
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
          updated_at = now()
        WHERE id = $18 AND organization_id = $19
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
        details: { status: newStatus, priority: newPriority },
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

  // 5. Fast Status Patch (Kanban board drag-and-drop)
  router.patch('/:id/status', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    const { status } = req.body || {};

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

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
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      const updated = rows[0];

      // Audit log
      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_STATUS',
        entityType: 'task',
        entityId: taskId,
        details: { oldStatus: updated.crm_status, newStatus: status, taskCode: updated.task_code },
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

  // 7. Delete Task
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

  // 8. Add Comment
  router.post('/:id/comments', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    const { comment } = req.body || {};

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

      const { rows } = await pool.query(
        `INSERT INTO task_comments (task_id, user_id, comment)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [taskId, req.user.id, comment.trim()]
      );

      // Notify task creator if someone else commented
      if (task.created_by && task.created_by !== req.user.id) {
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
        message: 'Comment added.',
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

  // 9. List Comments
  router.get('/:id/comments', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const taskId = req.params.id;
      const orgId = req.user.organization_id;

      // Verify task belongs to the caller's organization before returning comments
      const taskCheck = await pool.query(
        'SELECT id FROM tasks WHERE id = $1 AND organization_id = $2',
        [taskId, orgId]
      );
      if (taskCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      const { rows } = await pool.query(
        `SELECT 
           tc.id,
           tc.comment,
           tc.created_at,
           u.id AS user_id,
           u.full_name,
           u.avatar,
           u.crm_role
         FROM task_comments tc
         JOIN users u ON tc.user_id = u.id
         WHERE tc.task_id = $1
         ORDER BY tc.created_at ASC`,
        [taskId]
      );

      return res.json({ comments: rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch comments.' });
    }
  });

  return router;
}

module.exports = { createTasksRoutes };
