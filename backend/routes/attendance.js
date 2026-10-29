const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

/**
 * Returns YYYY-MM-DD string for current time in configured timezone (default Asia/Kolkata).
 */
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

function createAttendanceRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // All attendance routes require authentication
  router.use(requireAuth);

  // ─── 1. Employee Check-In ──────────────────────────────────────────────────
  router.post('/check-in', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userId = req.user.id;
      const todayStr = getLocalDateString();
      const now = new Date();

      // Check if employee already has an active session (not checked out)
      const activeCheck = await pool.query(
        `SELECT id, check_in_at FROM attendance_records
         WHERE organization_id = $1 AND user_id = $2 AND check_out_at IS NULL
         ORDER BY check_in_at DESC LIMIT 1`,
        [orgId, userId]
      );

      if (activeCheck.rows.length > 0) {
        return res.status(400).json({
          error: 'You already have an active check-in session. Please check out before checking in again.',
          activeSession: activeCheck.rows[0],
        });
      }

      // Create attendance session
      const insertQuery = `
        INSERT INTO attendance_records (
          organization_id, user_id, date, check_in_at, status
        ) VALUES ($1, $2, $3, $4, 'present')
        RETURNING *
      `;
      const { rows } = await pool.query(insertQuery, [orgId, userId, todayStr, now]);
      const record = rows[0];

      await logAudit(pool, {
        organizationId: orgId,
        userId,
        actorName: req.user.full_name,
        action: 'ATTENDANCE_CHECK_IN',
        entityType: 'attendance',
        entityId: record.id,
        details: { checkInAt: now.toISOString(), date: todayStr },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        message: 'Checked in successfully.',
        record,
      });
    } catch (err) {
      console.error('Check-in error:', err.message);
      return res.status(500).json({ error: 'Failed to record check-in.' });
    }
  });

  // ─── 2. Employee Check-Out ─────────────────────────────────────────────────
  router.post('/check-out', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userId = req.user.id;
      const now = new Date();

      // Find active check-in session
      const activeCheck = await pool.query(
        `SELECT id, check_in_at FROM attendance_records
         WHERE organization_id = $1 AND user_id = $2 AND check_out_at IS NULL
         ORDER BY check_in_at DESC LIMIT 1`,
        [orgId, userId]
      );

      if (activeCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'No active check-in session found to check out from.',
        });
      }

      const activeRecord = activeCheck.rows[0];
      const checkInTime = new Date(activeRecord.check_in_at);
      const durationMinutes = Math.max(1, Math.round((now.getTime() - checkInTime.getTime()) / 60000));

      const updateQuery = `
        UPDATE attendance_records SET
          check_out_at = $1,
          duration_minutes = $2,
          status = 'checked_out',
          updated_at = now()
        WHERE id = $3
        RETURNING *
      `;
      const { rows } = await pool.query(updateQuery, [now, durationMinutes, activeRecord.id]);
      const updated = rows[0];

      await logAudit(pool, {
        organizationId: orgId,
        userId,
        actorName: req.user.full_name,
        action: 'ATTENDANCE_CHECK_OUT',
        entityType: 'attendance',
        entityId: updated.id,
        details: { checkOutAt: now.toISOString(), durationMinutes },
        ipAddress: req.ip,
      });

      return res.json({
        message: 'Checked out successfully.',
        record: updated,
      });
    } catch (err) {
      console.error('Check-out error:', err.message);
      return res.status(500).json({ error: 'Failed to record check-out.' });
    }
  });

  // ─── 3. Today's Attendance Status (for calling employee) ───────────────────
  router.get('/today', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userId = req.user.id;
      const todayStr = getLocalDateString();

      const query = `
        SELECT * FROM attendance_records
        WHERE organization_id = $1 AND user_id = $2 AND date = $3
        ORDER BY check_in_at DESC LIMIT 1
      `;
      const { rows } = await pool.query(query, [orgId, userId, todayStr]);

      if (rows.length === 0) {
        // Also check if there's any open session regardless of date
        const openQuery = `
          SELECT * FROM attendance_records
          WHERE organization_id = $1 AND user_id = $2 AND check_out_at IS NULL
          ORDER BY check_in_at DESC LIMIT 1
        `;
        const openRes = await pool.query(openQuery, [orgId, userId]);
        if (openRes.rows.length > 0) {
          const rec = openRes.rows[0];
          return res.json({
            checked_in: true,
            active_session: true,
            record: rec,
          });
        }

        return res.json({
          checked_in: false,
          active_session: false,
          record: null,
          status: 'not_checked_in',
        });
      }

      const record = rows[0];
      return res.json({
        checked_in: true,
        active_session: record.check_out_at === null,
        record,
      });
    } catch (err) {
      console.error('Get today status error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch attendance status.' });
    }
  });

  // ─── 4. Employee Personal History ──────────────────────────────────────────
  router.get('/my-history', async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const userId = req.user.id;
      const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
      const offset = parseInt(req.query.offset, 10) || 0;

      const query = `
        SELECT id, date, check_in_at, check_out_at, duration_minutes, status, notes
        FROM attendance_records
        WHERE organization_id = $1 AND user_id = $2
        ORDER BY date DESC, check_in_at DESC
        LIMIT $3 OFFSET $4
      `;
      const { rows } = await pool.query(query, [orgId, userId, limit, offset]);
      return res.json({ records: rows });
    } catch (err) {
      console.error('My history error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch attendance history.' });
    }
  });

  // ─── 5. Admin / Manager Attendance Records ─────────────────────────────────
  router.get('/records', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const role = req.user.crm_role;
      const { date, range = 'all', employee_id, department_id, status } = req.query;

      let whereConditions = ['a.organization_id = $1'];
      let params = [orgId];
      let pIdx = 2;

      // Scope restriction for Managers: only direct reports or self
      if (role === 'manager') {
        whereConditions.push(`(u.manager_id = $${pIdx} OR u.id = $${pIdx})`);
        params.push(req.user.id);
        pIdx++;
      }

      if (employee_id) {
        whereConditions.push(`(u.id = $${pIdx} OR u.employee_id = $${pIdx})`);
        params.push(employee_id);
        pIdx++;
      }

      if (department_id) {
        whereConditions.push(`u.department_id = $${pIdx}`);
        params.push(department_id);
        pIdx++;
      }

      if (status) {
        whereConditions.push(`a.status = $${pIdx}`);
        params.push(status);
        pIdx++;
      }

      // Date filtering
      if (date) {
        whereConditions.push(`a.date = $${pIdx}`);
        params.push(date);
        pIdx++;
      } else if (range === 'today') {
        const todayStr = getLocalDateString();
        whereConditions.push(`a.date = $${pIdx}`);
        params.push(todayStr);
        pIdx++;
      } else if (range === 'week') {
        whereConditions.push(`a.date >= (CURRENT_DATE - INTERVAL '7 days')`);
      } else if (range === 'month') {
        whereConditions.push(`a.date >= (CURRENT_DATE - INTERVAL '30 days')`);
      }

      const query = `
        SELECT 
          a.id,
          a.user_id,
          a.date,
          a.check_in_at,
          a.check_out_at,
          a.duration_minutes,
          a.status,
          a.notes,
          a.created_at,
          u.full_name AS employee_name,
          u.employee_id,
          u.crm_role,
          u.designation,
          u.avatar,
          d.name AS department_name
        FROM attendance_records a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY a.date DESC, a.check_in_at DESC
        LIMIT 200
      `;

      const { rows } = await pool.query(query, params);
      return res.json({ records: rows, count: rows.length });
    } catch (err) {
      console.error('List records error:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve attendance records.' });
    }
  });

  // ─── 6. Attendance Summary (Today / Overview) ──────────────────────────────
  router.get('/summary', requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const todayStr = getLocalDateString();

      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) AS total_active_employees,
          COUNT(DISTINCT a.user_id) FILTER (WHERE a.date = $2 AND a.check_out_at IS NULL) AS currently_active,
          COUNT(DISTINCT a.user_id) FILTER (WHERE a.date = $2 AND a.status = 'checked_out') AS checked_out_today,
          COUNT(DISTINCT a.user_id) FILTER (WHERE a.date = $2) AS total_present_today
        FROM attendance_records a
        WHERE a.organization_id = $1
      `;
      const { rows } = await pool.query(statsQuery, [orgId, todayStr]);
      const stats = rows[0] || {};

      const totalEmployees = parseInt(stats.total_active_employees, 10) || 0;
      const presentToday = parseInt(stats.total_present_today, 10) || 0;
      const currentlyActive = parseInt(stats.currently_active, 10) || 0;
      const checkedOut = parseInt(stats.checked_out_today, 10) || 0;
      const notCheckedIn = Math.max(0, totalEmployees - presentToday);

      return res.json({
        date: todayStr,
        total_active_employees: totalEmployees,
        currently_active: currentlyActive,
        checked_out_today: checkedOut,
        total_present_today: presentToday,
        not_checked_in_today: notCheckedIn,
      });
    } catch (err) {
      console.error('Attendance summary error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch attendance summary.' });
    }
  });

  // ─── 7. Admin Attendance Correction ────────────────────────────────────────
  router.post('/:id/correct', requireRole(['super_admin', 'admin']), async (req, res) => {
    const { id } = req.params;
    const { check_in_at, check_out_at, status, reason } = req.body || {};

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'A valid reason is required for administrative attendance corrections.' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      // Find original record
      const checkRes = await pool.query(
        'SELECT * FROM attendance_records WHERE id = $1 AND organization_id = $2',
        [id, orgId]
      );
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: 'Attendance record not found.' });
      }

      const original = checkRes.rows[0];
      const newCheckIn = check_in_at ? new Date(check_in_at) : new Date(original.check_in_at);
      const newCheckOut = check_out_at !== undefined ? (check_out_at ? new Date(check_out_at) : null) : original.check_out_at;
      const newStatus = status || (newCheckOut ? 'checked_out' : 'present');

      let durationMinutes = 0;
      if (newCheckIn && newCheckOut) {
        durationMinutes = Math.max(1, Math.round((newCheckOut.getTime() - newCheckIn.getTime()) / 60000));
      }

      // Update record
      const updateQuery = `
        UPDATE attendance_records SET
          check_in_at = $1,
          check_out_at = $2,
          duration_minutes = $3,
          status = $4,
          updated_at = now()
        WHERE id = $5 AND organization_id = $6
        RETURNING *
      `;
      const { rows } = await pool.query(updateQuery, [
        newCheckIn,
        newCheckOut,
        durationMinutes,
        newStatus,
        id,
        orgId,
      ]);
      const updated = rows[0];

      // Record in attendance_corrections
      await pool.query(
        `INSERT INTO attendance_corrections (
          attendance_id, editor_id, previous_check_in, previous_check_out,
          new_check_in, new_check_out, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          req.user.id,
          original.check_in_at,
          original.check_out_at,
          newCheckIn,
          newCheckOut,
          reason.trim(),
        ]
      );

      // Log in audit_logs
      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'ATTENDANCE_CORRECTION',
        entityType: 'attendance',
        entityId: id,
        details: {
          reason: reason.trim(),
          previousCheckIn: original.check_in_at,
          previousCheckOut: original.check_out_at,
          newCheckIn,
          newCheckOut,
        },
        ipAddress: req.ip,
      });

      return res.json({
        message: 'Attendance record corrected successfully.',
        record: updated,
      });
    } catch (err) {
      console.error('Attendance correction error:', err.message);
      return res.status(500).json({ error: 'Failed to correct attendance record.' });
    }
  });

  return router;
}

module.exports = { createAttendanceRoutes };
