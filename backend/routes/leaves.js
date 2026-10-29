const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

function createLeavesRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();
  router.use(requireAuth);

  // 1. Employee submits a leave request
  router.post('/', async (req, res) => {
    const { leave_type = 'casual', start_date, end_date, reason } = req.body || {};
    if (!start_date || !end_date || !reason || !reason.trim()) {
      return res.status(400).json({ error: 'Start date, end date, and reason are required.' });
    }

    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({ error: 'Valid start date and end date are required.' });
    }

    if (endDateObj < startDateObj) {
      return res.status(400).json({ error: 'End date cannot be earlier than start date.' });
    }

    // Calculate business/calendar days (minimum 1 day)
    const diffTime = Math.abs(endDateObj - startDateObj);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userId = req.user.id;

      const insertSql = `
        INSERT INTO leave_requests (
          organization_id, user_id, leave_type, start_date, end_date, days_count, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `;
      const { rows } = await pool.query(insertSql, [
        orgId,
        userId,
        leave_type,
        start_date,
        end_date,
        diffDays,
        reason.trim(),
      ]);
      const leaveRequest = rows[0];

      // Audit log
      await logAudit(pool, {
        organizationId: orgId,
        userId,
        actorName: req.user.full_name,
        action: 'SUBMIT_LEAVE_REQUEST',
        entityType: 'leave',
        entityId: leaveRequest.id,
        details: { leaveType: leave_type, startDate: start_date, endDate: end_date, days: diffDays },
        ipAddress: req.ip,
      });

      // Notify manager or admin
      const notifyRecipients = [];
      if (req.user.manager_id) {
        notifyRecipients.push(req.user.manager_id);
      }
      // Also notify Super Admin or Admins
      const adminRes = await pool.query(
        "SELECT id FROM users WHERE organization_id = $1 AND crm_role IN ('super_admin', 'admin') AND id != $2 LIMIT 3",
        [orgId, userId]
      );
      adminRes.rows.forEach((r) => {
        if (!notifyRecipients.includes(r.id)) notifyRecipients.push(r.id);
      });

      for (const recId of notifyRecipients) {
        await pool.query(
          `INSERT INTO notifications (
            organization_id, user_id, title, message, type, entity_type, entity_id
          ) VALUES ($1, $2, $3, $4, 'info', 'leave', $5)`,
          [
            orgId,
            recId,
            `Leave Request: ${req.user.full_name}`,
            `${req.user.full_name} submitted a ${leave_type} leave request from ${start_date} to ${end_date} (${diffDays} days).`,
            leaveRequest.id,
          ]
        );
      }

      return res.status(201).json({
        message: 'Leave request submitted successfully.',
        leave: leaveRequest,
      });
    } catch (err) {
      console.error('Submit leave error:', err.message);
      return res.status(500).json({ error: 'Failed to submit leave request.' });
    }
  });

  // 2. Employee views their own leave requests
  router.get('/my', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userId = req.user.id;

      const { rows } = await pool.query(
        `SELECT l.*, reviewer.full_name AS reviewer_name
         FROM leave_requests l
         LEFT JOIN users reviewer ON l.reviewed_by = reviewer.id
         WHERE l.organization_id = $1 AND l.user_id = $2
         ORDER BY l.created_at DESC`,
        [orgId, userId]
      );

      return res.json({ leaves: rows });
    } catch (err) {
      console.error('Get my leaves error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch your leave requests.' });
    }
  });

  // 3. Managers & Admins view leave requests
  router.get('/', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const role = req.user.crm_role;
      const { status } = req.query;

      const where = ['l.organization_id = $1'];
      const values = [orgId];
      let pIdx = 2;

      // Scope restriction for Managers: only direct reports or self
      if (role === 'manager') {
        where.push(`(u.manager_id = $${pIdx} OR u.id = $${pIdx})`);
        values.push(req.user.id);
        pIdx++;
      }

      if (status && status !== 'all') {
        where.push(`l.status = $${pIdx}`);
        values.push(status);
        pIdx++;
      }

      const query = `
        SELECT 
          l.*,
          u.full_name AS employee_name,
          u.employee_id,
          u.designation,
          u.avatar,
          d.name AS department_name,
          reviewer.full_name AS reviewer_name
        FROM leave_requests l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users reviewer ON l.reviewed_by = reviewer.id
        WHERE ${where.join(' AND ')}
        ORDER BY l.created_at DESC
      `;
      const { rows } = await pool.query(query, values);

      return res.json({ leaves: rows });
    } catch (err) {
      console.error('List leaves error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch leave requests.' });
    }
  });

  // 4. Review Leave Request (Approve / Reject)
  router.patch('/:id/review', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    const leaveId = req.params.id;
    const { status, review_notes } = req.body || {};

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either "approved" or "rejected".' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      // Check request
      const existingRes = await pool.query(
        'SELECT * FROM leave_requests WHERE id = $1 AND organization_id = $2',
        [leaveId, orgId]
      );
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Leave request not found.' });
      }
      const existing = existingRes.rows[0];

      // Manager scope check: ensure the target user is a direct report or self
      if (req.user.crm_role === 'manager') {
        const empCheck = await pool.query(
          'SELECT manager_id FROM users WHERE id = $1 AND organization_id = $2',
          [existing.user_id, orgId]
        );
        if (empCheck.rows.length === 0 || (empCheck.rows[0].manager_id !== req.user.id && existing.user_id !== req.user.id)) {
          return res.status(403).json({ error: 'Forbidden: You can only review leave requests for your direct reports.' });
        }
      }

      const updateSql = `
        UPDATE leave_requests SET
          status = $1,
          reviewed_by = $2,
          review_notes = $3,
          updated_at = now()
        WHERE id = $4 AND organization_id = $5
        RETURNING *
      `;
      const { rows } = await pool.query(updateSql, [
        status,
        req.user.id,
        review_notes ? review_notes.trim() : null,
        leaveId,
        orgId,
      ]);
      const updatedLeave = rows[0];

      // Audit log
      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: `LEAVE_REQUEST_${status.toUpperCase()}`,
        entityType: 'leave',
        entityId: leaveId,
        details: { applicantId: existing.user_id, status, reviewNotes: review_notes },
        ipAddress: req.ip,
      });

      // Notify the employee
      await pool.query(
        `INSERT INTO notifications (
          organization_id, user_id, title, message, type, entity_type, entity_id
        ) VALUES ($1, $2, $3, $4, $5, 'leave', $6)`,
        [
          orgId,
          existing.user_id,
          `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          `Your ${existing.leave_type} leave from ${existing.start_date} to ${existing.end_date} has been ${status} by ${req.user.full_name}.${review_notes ? ' Note: ' + review_notes : ''}`,
          status === 'approved' ? 'info' : 'warning',
          leaveId,
        ]
      );

      return res.json({
        message: `Leave request has been ${status}.`,
        leave: updatedLeave,
      });
    } catch (err) {
      console.error('Review leave error:', err.message);
      return res.status(500).json({ error: 'Failed to update leave request.' });
    }
  });

  return router;
}

module.exports = { createLeavesRoutes };
