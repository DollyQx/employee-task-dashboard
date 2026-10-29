const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ensureDefaultRules, runAutomations } = require('../services/automation');
const { logAudit } = require('../utils/audit');

function createAutomationRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // All automation routes are STRICTLY Super Admin only (Dolly)
  router.use(requireAuth);
  router.use(requireRole(['super_admin']));

  // 1. List Automation Rules
  router.get('/rules', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      await ensureDefaultRules(pool, orgId);

      const { rows } = await pool.query(
        `SELECT id, rule_key, name, description, is_enabled, schedule_cron,
                config_json, last_run_at, last_run_status, last_run_duration_ms,
                last_run_details, failure_count, updated_at
         FROM automation_rules
         WHERE organization_id = $1
         ORDER BY rule_key ASC`,
        [orgId]
      );

      const rules = rows.map((r) => {
        let config = {};
        try {
          config = typeof r.config_json === 'string' ? JSON.parse(r.config_json) : r.config_json || {};
        } catch {}
        return { ...r, config };
      });

      return res.json({ rules });
    } catch (err) {
      console.error('List automation rules error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve automation rules.' });
    }
  });

  // 2. Toggle or Reconfigure a Rule
  router.patch('/rules/:key', async (req, res) => {
    const ruleKey = req.params.key;
    const { is_enabled, config, schedule_cron } = req.body || {};

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const existingRes = await pool.query(
        'SELECT id, name, is_enabled, config_json FROM automation_rules WHERE organization_id = $1 AND rule_key = $2',
        [orgId, ruleKey]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: `Rule "${ruleKey}" not found.` });
      }

      const existing = existingRes.rows[0];
      const nextEnabled = is_enabled !== undefined ? Boolean(is_enabled) : existing.is_enabled;
      const nextConfigJson = config !== undefined ? JSON.stringify(config) : existing.config_json;

      const updateSql = `
        UPDATE automation_rules SET
          is_enabled = $1,
          config_json = $2,
          updated_at = now()
        WHERE organization_id = $3 AND rule_key = $4
        RETURNING *
      `;
      const { rows } = await pool.query(updateSql, [nextEnabled, nextConfigJson, orgId, ruleKey]);

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_AUTOMATION_RULE',
        entityType: 'automation',
        entityId: ruleKey,
        details: { ruleKey, is_enabled: nextEnabled, config },
        ipAddress: req.ip,
      });

      return res.json({
        message: `Automation rule "${existing.name}" updated successfully.`,
        rule: rows[0],
      });
    } catch (err) {
      console.error('Update automation rule error:', err.message);
      return res.status(500).json({ error: 'Failed to update automation rule.' });
    }
  });

  // 3. Trigger Safe "Run Now" Manual Execution
  router.post('/run-now', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const result = await runAutomations(pool, orgId, {
        actorName: req.user.full_name,
        triggerType: 'manual_ui',
      });

      if (result.status === 'skipped') {
        return res.status(409).json({
          error: 'An automation job is currently running. Please wait for the current cycle to complete.',
          result,
        });
      }

      return res.json({
        message: 'Automation cycle completed successfully.',
        result,
      });
    } catch (err) {
      console.error('Run automation error:', err.message);
      return res.status(500).json({ error: 'Failed to execute automations.' });
    }
  });

  // 4. View Automation Logs & History
  router.get('/logs', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const logsRes = await pool.query(
        `SELECT id, rule_key, status, actions_taken, details, duration_ms, created_at
         FROM automation_logs
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [orgId]
      );

      // Also get recent automated notifications
      const notifsRes = await pool.query(
        `SELECT n.id, n.title, n.message, n.type, n.dedup_key, n.is_read, n.created_at, u.full_name AS recipient_name
         FROM notifications n
         JOIN users u ON n.user_id = u.id
         WHERE n.organization_id = $1 AND n.dedup_key IS NOT NULL
         ORDER BY n.created_at DESC
         LIMIT 30`,
        [orgId]
      );

      return res.json({
        logs: logsRes.rows,
        dispatchedNotifications: notifsRes.rows,
      });
    } catch (err) {
      console.error('Get automation logs error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve automation logs.' });
    }
  });

  // 5. List Recurring Task Templates
  router.get('/templates', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `SELECT rtt.*, u.full_name AS assignee_name, creator.full_name AS creator_name, d.name AS department_name
         FROM recurring_task_templates rtt
         LEFT JOIN users u ON rtt.assignee_id = u.id
         LEFT JOIN users creator ON rtt.creator_id = creator.id
         LEFT JOIN departments d ON rtt.department_id = d.id
         WHERE rtt.organization_id = $1
         ORDER BY rtt.created_at DESC`,
        [orgId]
      );

      return res.json({ templates: rows });
    } catch (err) {
      console.error('List templates error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve recurring templates.' });
    }
  });

  // 6. Create Recurring Task Template
  router.post('/templates', async (req, res) => {
    const {
      title,
      description,
      department_id,
      project_id,
      priority = 'medium',
      recurrence_pattern = 'weekly',
      day_of_week = 1,
      day_of_month = 1,
      estimated_hours = 0,
      assignee_id,
    } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    if (!['daily', 'weekly', 'monthly'].includes(recurrence_pattern)) {
      return res.status(400).json({ error: 'Recurrence pattern must be "daily", "weekly", or "monthly".' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const insertSql = `
        INSERT INTO recurring_task_templates (
          organization_id, title, description, department_id, project_id,
          priority, recurrence_pattern, day_of_week, day_of_month,
          estimated_hours, assignee_id, creator_id, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true
        ) RETURNING *
      `;

      const { rows } = await pool.query(insertSql, [
        orgId,
        title.trim(),
        description || null,
        department_id || null,
        project_id || null,
        priority,
        recurrence_pattern,
        Number(day_of_week) || 1,
        Number(day_of_month) || 1,
        Number(estimated_hours) || 0,
        assignee_id || null,
        req.user.id,
      ]);

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_RECURRING_TEMPLATE',
        entityType: 'automation',
        entityId: rows[0].id,
        details: { title: rows[0].title, recurrence: recurrence_pattern },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        message: 'Recurring task template created successfully.',
        template: rows[0],
      });
    } catch (err) {
      console.error('Create template error:', err.message);
      return res.status(500).json({ error: 'Failed to create recurring task template.' });
    }
  });

  return router;
}

module.exports = { createAutomationRoutes };
