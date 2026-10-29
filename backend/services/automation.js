const { logAudit } = require('../utils/audit');

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// Concurrency mutex lock to prevent overlapping runs
let isJobRunning = false;

function getLocalDateString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function getLocalTimeString(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().substring(11, 16);
  }
}

/**
 * Ensures default automation rules exist for the organization.
 */
async function ensureDefaultRules(pool, organizationId) {
  const defaultRules = [
    {
      rule_key: 'task_sla_monitor',
      name: 'Task SLA & Deadline Monitor',
      description: 'Scans for overdue, due-soon, and blocked tasks. Dispatches deduplicated alerts to assignees.',
      schedule_cron: '*/15 * * * *',
      config_json: JSON.stringify({ dueSoonHours: 24, alertOnBlocked: true }),
    },
    {
      rule_key: 'recurring_task_generator',
      name: 'Recurring Task Generator',
      description: 'Generates routine tasks idempotently from active templates based on recurrence patterns.',
      schedule_cron: '0 6 * * *',
      config_json: JSON.stringify({ runAtHourUTC: 0 }),
    },
    {
      rule_key: 'missing_checkout_detector',
      name: 'Missing Checkout Detector',
      description: 'Detects active sessions open beyond the maximum shift threshold and notifies employees.',
      schedule_cron: '0 * * * *',
      config_json: JSON.stringify({ maxShiftHours: 12 }),
    },
    {
      rule_key: 'late_attendance_detector',
      name: 'Late Attendance Detector',
      description: 'Flags check-ins after the configured shift start time without penalizing employees.',
      schedule_cron: '*/30 * * * *',
      config_json: JSON.stringify({ standardStartTime: '09:30' }),
    },
  ];

  for (const rule of defaultRules) {
    const check = await pool.query(
      'SELECT id FROM automation_rules WHERE organization_id = $1 AND rule_key = $2',
      [organizationId, rule.rule_key]
    );
    if (check.rows.length === 0) {
      await pool.query(
        `INSERT INTO automation_rules (
          organization_id, rule_key, name, description, is_enabled, schedule_cron, config_json
        ) VALUES ($1, $2, $3, $4, true, $5, $6)`,
        [organizationId, rule.rule_key, rule.name, rule.description, rule.schedule_cron, rule.config_json]
      );
    }
  }
}

/**
 * Safely inserts a deduplicated notification.
 */
async function insertDeduplicatedNotification(pool, {
  organizationId,
  userId,
  title,
  message,
  type = 'info',
  entityType,
  entityId,
  dedupKey,
}) {
  if (dedupKey) {
    const existing = await pool.query(
      'SELECT id FROM notifications WHERE organization_id = $1 AND dedup_key = $2',
      [organizationId, dedupKey]
    );
    if (existing.rows.length > 0) {
      return null; // Already notified today
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO notifications (
      organization_id, user_id, title, message, type, entity_type, entity_id, dedup_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [organizationId, userId, title, message, type, entityType, entityId, dedupKey || null]
  );
  return rows[0] || null;
}

/**
 * 1. Task SLA Monitor
 */
async function runTaskSlaMonitor(pool, organizationId, config = {}) {
  const todayStr = getLocalDateString();
  let actionsTaken = 0;

  // Find open tasks
  const tasksRes = await pool.query(
    `SELECT t.id, t.title, t.task_code, t.due_date, t.crm_status, t.crm_priority, t.created_by
     FROM tasks t
     WHERE t.organization_id = $1 AND t.crm_status != 'done'`,
    [organizationId]
  );

  for (const task of tasksRes.rows) {
    // Get assignees
    const assigneesRes = await pool.query(
      'SELECT user_id FROM task_assignments WHERE organization_id = $1 AND task_id = $2',
      [organizationId, task.id]
    );
    const recipients = new Set(assigneesRes.rows.map((r) => r.user_id));
    if (task.created_by) recipients.add(task.created_by);

    const taskCodeDisplay = task.task_code || `TASK-${task.id.substring(0, 6).toUpperCase()}`;

    // Overdue check
    if (task.due_date) {
      const taskDueDateStr = typeof task.due_date === 'string'
        ? task.due_date.substring(0, 10)
        : getLocalDateString(new Date(task.due_date));

      if (taskDueDateStr < todayStr) {
        for (const userId of recipients) {
          const dedupKey = `overdue:${task.id}:${userId}:${todayStr}`;
          const res = await insertDeduplicatedNotification(pool, {
            organizationId,
            userId,
            title: `Task Overdue: ${taskCodeDisplay}`,
            message: `Task "${task.title}" was due on ${taskDueDateStr}. Please review and update status.`,
            type: 'warning',
            entityType: 'task',
            entityId: task.id,
            dedupKey,
          });
          if (res) actionsTaken++;
        }
      } else if (taskDueDateStr === todayStr) {
        for (const userId of recipients) {
          const dedupKey = `due_today:${task.id}:${userId}:${todayStr}`;
          const res = await insertDeduplicatedNotification(pool, {
            organizationId,
            userId,
            title: `Task Due Today: ${taskCodeDisplay}`,
            message: `Task "${task.title}" is due today. Please ensure all milestones are in progress.`,
            type: 'info',
            entityType: 'task',
            entityId: task.id,
            dedupKey,
          });
          if (res) actionsTaken++;
        }
      }
    }

    // Blocked check
    if (task.crm_status === 'blocked' && config.alertOnBlocked !== false) {
      for (const userId of recipients) {
        const dedupKey = `blocked:${task.id}:${userId}:${todayStr}`;
        const res = await insertDeduplicatedNotification(pool, {
          organizationId,
          userId,
          title: `Task Blocked: ${taskCodeDisplay}`,
          message: `Task "${task.title}" is currently flagged as blocked and requires attention.`,
          type: 'warning',
          entityType: 'task',
          entityId: task.id,
          dedupKey,
        });
        if (res) actionsTaken++;
      }
    }
  }

  return { actionsTaken, message: `Processed ${tasksRes.rows.length} tasks; generated ${actionsTaken} SLA notifications.` };
}

/**
 * 2. Recurring Task Generator
 */
async function runRecurringTaskGenerator(pool, organizationId) {
  const todayStr = getLocalDateString();
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon...
  const dayOfMonth = now.getDate(); // 1-31
  let actionsTaken = 0;

  const templatesRes = await pool.query(
    `SELECT * FROM recurring_task_templates
     WHERE organization_id = $1 AND is_active = true`,
    [organizationId]
  );

  for (const template of templatesRes.rows) {
    // Idempotency: skip if already generated today
    if (template.last_generated_date) {
      const lastGenStr = typeof template.last_generated_date === 'string'
        ? template.last_generated_date.substring(0, 10)
        : getLocalDateString(new Date(template.last_generated_date));
      if (lastGenStr === todayStr) {
        continue;
      }
    }

    // Check pattern match
    let shouldGenerate = false;
    if (template.recurrence_pattern === 'daily') {
      shouldGenerate = true;
    } else if (template.recurrence_pattern === 'weekly') {
      shouldGenerate = template.day_of_week === dayOfWeek;
    } else if (template.recurrence_pattern === 'monthly') {
      shouldGenerate = template.day_of_month === dayOfMonth;
    }

    if (shouldGenerate) {
      // Generate task code
      const countRes = await pool.query(
        'SELECT COUNT(*) + 1 AS next_code FROM tasks WHERE organization_id = $1',
        [organizationId]
      );
      const codeNum = String(countRes.rows[0].next_code).padStart(4, '0');
      const taskCode = `REC-${codeNum}`;

      // Determine core priority compatible with core schema check (low, medium, high)
      const corePriority = template.priority === 'urgent' ? 'high' : (['low', 'medium', 'high'].includes(template.priority) ? template.priority : 'medium');

      // Insert task
      const insertTaskRes = await pool.query(
        `INSERT INTO tasks (
          organization_id, created_by, title, description, status, priority,
          crm_status, crm_priority, due_date, task_code, project_id, department_id,
          estimated_hours, category, source
        ) VALUES (
          $1, $2, $3, $4, 'pending', $5, 'todo', $6, $7, $8, $9, $10, $11, 'Recurring', 'Automation'
        ) RETURNING id, title`,
        [
          organizationId,
          template.creator_id,
          template.title,
          template.description,
          corePriority,
          template.priority,
          todayStr,
          taskCode,
          template.project_id || null,
          template.department_id || null,
          template.estimated_hours || 0,
        ]
      );
      const createdTask = insertTaskRes.rows[0];

      // Assign if assignee specified
      if (template.assignee_id) {
        await pool.query(
          `INSERT INTO task_assignments (organization_id, task_id, user_id, assigned_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id, task_id, user_id) DO NOTHING`,
          [organizationId, createdTask.id, template.assignee_id, template.creator_id]
        );

        await insertDeduplicatedNotification(pool, {
          organizationId,
          userId: template.assignee_id,
          title: `Recurring Task Created: ${taskCode}`,
          message: `Scheduled recurring task "${createdTask.title}" has been assigned to you.`,
          type: 'assignment',
          entityType: 'task',
          entityId: createdTask.id,
          dedupKey: `rec_assigned:${createdTask.id}:${template.assignee_id}`,
        });
      }

      // Update template last_generated_date to prevent duplicate generation
      await pool.query(
        `UPDATE recurring_task_templates
         SET last_generated_date = $1, updated_at = now()
         WHERE id = $2`,
        [todayStr, template.id]
      );

      actionsTaken++;
    }
  }

  return { actionsTaken, message: `Checked ${templatesRes.rows.length} templates; generated ${actionsTaken} recurring tasks.` };
}

/**
 * 3. Missing Checkout Detector
 */
async function runMissingCheckoutDetector(pool, organizationId, config = {}) {
  const todayStr = getLocalDateString();
  const maxShiftHours = config.maxShiftHours || 12;
  let actionsTaken = 0;

  // Unclosed sessions from prior days OR older than maxShiftHours
  const recordsRes = await pool.query(
    `SELECT a.id, a.user_id, a.date, a.check_in_at, u.full_name
     FROM attendance_records a
     JOIN users u ON a.user_id = u.id
     WHERE a.organization_id = $1
       AND a.check_out_at IS NULL
       AND (a.date < $2 OR a.check_in_at < (now() - INTERVAL '12 hours'))`,
    [organizationId, todayStr]
  );

  for (const record of recordsRes.rows) {
    const recordDateStr = typeof record.date === 'string'
      ? record.date.substring(0, 10)
      : getLocalDateString(new Date(record.date));

    const dedupKey = `missing_checkout:${record.id}:${todayStr}`;
    const notif = await insertDeduplicatedNotification(pool, {
      organizationId,
      userId: record.user_id,
      title: 'Action Needed: Missing Attendance Checkout',
      message: `You have an open attendance record from ${recordDateStr}. Please request an attendance correction or checkout.`,
      type: 'warning',
      entityType: 'attendance',
      entityId: record.id,
      dedupKey,
    });

    if (notif) actionsTaken++;
  }

  return { actionsTaken, message: `Scanned attendance; identified ${recordsRes.rows.length} open sessions, sent ${actionsTaken} reminders.` };
}

/**
 * 4. Late Attendance Detector
 */
async function runLateAttendanceDetector(pool, organizationId, config = {}) {
  const todayStr = getLocalDateString();
  const standardStartTime = config.standardStartTime || '09:30';
  let actionsTaken = 0;

  // Fetch today's check-ins without notes already mentioning late
  const checkinsRes = await pool.query(
    `SELECT a.id, a.user_id, a.check_in_at, a.notes, u.full_name
     FROM attendance_records a
     JOIN users u ON a.user_id = u.id
     WHERE a.organization_id = $1 AND a.date = $2`,
    [organizationId, todayStr]
  );

  for (const att of checkinsRes.rows) {
    const checkInLocalTime = getLocalTimeString(new Date(att.check_in_at));
    if (checkInLocalTime > standardStartTime && (!att.notes || !att.notes.includes('[Late Check-in]'))) {
      const updatedNotes = att.notes
        ? `${att.notes} [Late Check-in: ${checkInLocalTime} IST]`
        : `[Late Check-in: ${checkInLocalTime} IST]`;

      await pool.query(
        'UPDATE attendance_records SET notes = $1, updated_at = now() WHERE id = $2',
        [updatedNotes, att.id]
      );

      const dedupKey = `late_notice:${att.id}`;
      await insertDeduplicatedNotification(pool, {
        organizationId,
        userId: att.user_id,
        title: 'Late Check-in Logged',
        message: `Your check-in at ${checkInLocalTime} IST was recorded past the standard start time (${standardStartTime} IST).`,
        type: 'info',
        entityType: 'attendance',
        entityId: att.id,
        dedupKey,
      });

      actionsTaken++;
    }
  }

  return { actionsTaken, message: `Checked ${checkinsRes.rows.length} check-ins; flagged ${actionsTaken} late arrivals.` };
}

/**
 * Main Automation Runner Orchestrator
 * Executes all enabled rules with mutual exclusion lock.
 */
async function runAutomations(pool, organizationId, { actorName = 'System Scheduler', triggerType = 'manual' } = {}) {
  if (isJobRunning) {
    return {
      status: 'skipped',
      message: 'An automation job is currently running. Execution skipped to prevent concurrent collisions.',
      rulesExecuted: 0,
      actionsTaken: 0,
    };
  }

  isJobRunning = true;
  const startTime = Date.now();
  const results = [];
  let totalActions = 0;

  try {
    await ensureDefaultRules(pool, organizationId);

    // Fetch enabled rules
    const rulesRes = await pool.query(
      'SELECT * FROM automation_rules WHERE organization_id = $1 ORDER BY rule_key ASC',
      [organizationId]
    );

    for (const rule of rulesRes.rows) {
      if (!rule.is_enabled) {
        results.push({ rule_key: rule.rule_key, status: 'disabled', actionsTaken: 0 });
        continue;
      }

      const ruleStartTime = Date.now();
      let ruleResult = { actionsTaken: 0, message: '' };
      let ruleStatus = 'success';
      let ruleError = null;

      try {
        let parsedConfig = {};
        try {
          parsedConfig = typeof rule.config_json === 'string' ? JSON.parse(rule.config_json) : rule.config_json || {};
        } catch {}

        if (rule.rule_key === 'task_sla_monitor') {
          ruleResult = await runTaskSlaMonitor(pool, organizationId, parsedConfig);
        } else if (rule.rule_key === 'recurring_task_generator') {
          ruleResult = await runRecurringTaskGenerator(pool, organizationId);
        } else if (rule.rule_key === 'missing_checkout_detector') {
          ruleResult = await runMissingCheckoutDetector(pool, organizationId, parsedConfig);
        } else if (rule.rule_key === 'late_attendance_detector') {
          ruleResult = await runLateAttendanceDetector(pool, organizationId, parsedConfig);
        }
      } catch (err) {
        ruleStatus = 'failure';
        ruleError = err.message;
        console.error(`Rule execution failure for ${rule.rule_key}:`, err.message);
      }

      const ruleDuration = Date.now() - ruleStartTime;
      totalActions += ruleResult.actionsTaken;

      // Update automation_rules record
      await pool.query(
        `UPDATE automation_rules SET
          last_run_at = now(),
          last_run_status = $1,
          last_run_duration_ms = $2,
          last_run_details = $3,
          failure_count = CASE WHEN $1 = 'failure' THEN failure_count + 1 ELSE failure_count END,
          updated_at = now()
        WHERE id = $4`,
        [ruleStatus, ruleDuration, ruleError ? `Error: ${ruleError}` : ruleResult.message, rule.id]
      );

      // Record in automation_logs
      await pool.query(
        `INSERT INTO automation_logs (
          organization_id, rule_key, status, actions_taken, details, duration_ms
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          organizationId,
          rule.rule_key,
          ruleStatus,
          ruleResult.actionsTaken,
          ruleError ? `Error: ${ruleError}` : ruleResult.message,
          ruleDuration,
        ]
      );

      results.push({
        rule_key: rule.rule_key,
        status: ruleStatus,
        actionsTaken: ruleResult.actionsTaken,
        durationMs: ruleDuration,
        message: ruleError || ruleResult.message,
      });
    }

    const totalDuration = Date.now() - startTime;

    await logAudit(pool, {
      organizationId,
      actorName,
      action: 'RUN_AUTOMATIONS',
      entityType: 'automation',
      details: { triggerType, totalActions, totalDuration, resultsCount: results.length },
    });

    return {
      status: 'completed',
      totalDurationMs: totalDuration,
      actionsTaken: totalActions,
      results,
    };
  } finally {
    isJobRunning = false;
  }
}

module.exports = {
  isJobRunning: () => isJobRunning,
  ensureDefaultRules,
  runAutomations,
  runTaskSlaMonitor,
  runRecurringTaskGenerator,
  runMissingCheckoutDetector,
  runLateAttendanceDetector,
  getLocalDateString,
  getLocalTimeString,
};
