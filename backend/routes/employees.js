const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword } = require('../utils/auth');
const { logAudit } = require('../utils/audit');

function createEmployeesRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // List employees with department & workload metrics
  router.get('/', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const { search, department_id, crm_role, status = 'active' } = req.query;

      const where = ['u.organization_id = $1'];
      const values = [orgId];
      let pIdx = 2;

      if (search && search.trim()) {
        where.push(`(u.full_name ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR u.employee_id ILIKE $${pIdx} OR u.designation ILIKE $${pIdx})`);
        values.push(`%${search.trim()}%`);
        pIdx++;
      }

      if (department_id) {
        where.push(`u.department_id = $${pIdx}`);
        values.push(department_id);
        pIdx++;
      }

      if (crm_role) {
        where.push(`u.crm_role = $${pIdx}`);
        values.push(crm_role);
        pIdx++;
      }

      if (status !== 'all') {
        where.push(`u.employment_status = $${pIdx}`);
        values.push(status);
        pIdx++;
      }

      const query = `
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.employee_id,
          u.crm_role,
          u.designation,
          u.department_id,
          u.phone,
          u.avatar,
          u.employment_status,
          u.joining_date,
          u.is_active,
          u.created_at,
          d.name AS department_name,
          d.code AS department_code,
          mgr.full_name AS manager_name,
          (
            SELECT COUNT(*) 
            FROM task_assignments ta
            JOIN tasks t ON ta.task_id = t.id
            WHERE ta.user_id = u.id AND t.organization_id = $1 AND t.crm_status != 'done'
          ) AS active_tasks_count,
          (
            SELECT COUNT(*) 
            FROM task_assignments ta
            JOIN tasks t ON ta.task_id = t.id
            WHERE ta.user_id = u.id AND t.organization_id = $1 AND t.crm_status = 'done'
          ) AS completed_tasks_count,
          (
            SELECT COUNT(*) 
            FROM task_assignments ta
            JOIN tasks t ON ta.task_id = t.id
            WHERE ta.user_id = u.id 
              AND t.organization_id = $1
              AND t.due_date IS NOT NULL 
              AND t.due_date < CURRENT_DATE 
              AND t.crm_status != 'done'
          ) AS overdue_tasks_count
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users mgr ON u.manager_id = mgr.id
        WHERE ${where.join(' AND ')}
        ORDER BY u.full_name ASC
      `;

      const { rows } = await pool.query(query, values);
      return res.json({ employees: rows });
    } catch (err) {
      console.error('List employees error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch employees.' });
    }
  });

  // Single Employee Profile & Workload
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const empId = req.params.id;

      const userQuery = `
        SELECT 
          u.*,
          d.name AS department_name,
          mgr.full_name AS manager_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users mgr ON u.manager_id = mgr.id
        WHERE u.id = $1 AND u.organization_id = $2
      `;
      const { rows } = await pool.query(userQuery, [empId, orgId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });

      // Fetch assigned tasks
      const tasksQuery = `
        SELECT 
          t.id,
          t.task_code,
          t.title,
          t.crm_status,
          t.crm_priority,
          t.due_date,
          t.completion_percentage,
          p.name AS project_name
        FROM task_assignments ta
        JOIN tasks t ON ta.task_id = t.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE ta.user_id = $1
        ORDER BY t.created_at DESC
        LIMIT 20
      `;
      const tasksResult = await pool.query(tasksQuery, [empId]);

      const safeUser = { ...rows[0] };
      delete safeUser.password_hash;
      delete safeUser.reset_token_hash;

      return res.json({ employee: safeUser, recentTasks: tasksResult.rows });
    } catch (err) {
      console.error('Get employee error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch employee details.' });
    }
  });

  // Create Employee (Admin only)
  router.post('/', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    const {
      full_name,
      email,
      password = 'TemporaryPassword123!',
      crm_role = 'employee',
      employee_id,
      department_id,
      designation,
      manager_id,
      phone,
      employment_status = 'active',
      joining_date,
    } = req.body || {};

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const normalizedEmail = email.trim().toLowerCase();

      // Check unique email in org
      const existCheck = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A user with this email already exists.' });
      }

      // Generate employee ID if omitted
      let empCode = employee_id;
      if (!empCode) {
        const countRes = await pool.query('SELECT COUNT(*) + 1 AS next_emp FROM users WHERE organization_id = $1', [orgId]);
        empCode = `AD-${String(countRes.rows[0].next_emp).padStart(4, '0')}`;
      }

      const hash = await hashPassword(password);
      const initials = full_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

      const insertSql = `
        INSERT INTO users (
          organization_id,
          full_name,
          email,
          password_hash,
          role,
          crm_role,
          employee_id,
          department_id,
          designation,
          manager_id,
          phone,
          avatar,
          employment_status,
          joining_date,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, full_name, email, crm_role, employee_id, designation, department_id, created_at
      `;

      // Map role for 001 compatibility ('owner', 'admin', 'member')
      const coreRole = crm_role === 'super_admin' ? 'owner' : (crm_role === 'admin' ? 'admin' : 'member');

      const values = [
        orgId,
        full_name.trim(),
        normalizedEmail,
        hash,
        coreRole,
        crm_role,
        empCode,
        department_id || null,
        designation || 'Staff Member',
        manager_id || null,
        phone || null,
        initials,
        employment_status,
        joining_date || new Date(),
        true,
      ];

      const { rows } = await pool.query(insertSql, values);

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_EMPLOYEE',
        entityType: 'user',
        entityId: rows[0].id,
        details: { email: rows[0].email, role: crm_role },
        ipAddress: req.ip,
      });

      return res.status(201).json({ message: 'Employee created successfully.', employee: rows[0] });
    } catch (err) {
      console.error('Create employee error:', err.message);
      return res.status(500).json({ error: 'Failed to create employee: ' + err.message });
    }
  });

  // Update Employee (Admin only)
  router.put('/:id', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    const empId = req.params.id;
    const {
      full_name,
      crm_role,
      department_id,
      designation,
      manager_id,
      phone,
      employment_status,
      joining_date,
    } = req.body || {};

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const existingRes = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [empId, orgId]);
      if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
      const existing = existingRes.rows[0];

      const newFullName = full_name ? full_name.trim() : existing.full_name;
      const newCrmRole = crm_role || existing.crm_role;
      const newCoreRole = crm_role ? (crm_role === 'super_admin' ? 'owner' : (crm_role === 'admin' ? 'admin' : 'member')) : existing.role;
      const newDeptId = department_id !== undefined ? (department_id || null) : existing.department_id;
      const newDesignation = designation !== undefined ? designation : existing.designation;
      const newManagerId = manager_id !== undefined ? (manager_id || null) : existing.manager_id;
      const newPhone = phone !== undefined ? phone : existing.phone;
      const newStatus = employment_status !== undefined ? employment_status : existing.employment_status;
      const newJoiningDate = joining_date !== undefined ? joining_date : existing.joining_date;

      const updateSql = `
        UPDATE users SET
          full_name = $1,
          crm_role = $2,
          role = $3,
          department_id = $4,
          designation = $5,
          manager_id = $6,
          phone = $7,
          employment_status = $8,
          joining_date = $9,
          updated_at = now()
        WHERE id = $10 AND organization_id = $11
        RETURNING id, full_name, email, crm_role, employee_id, designation, department_id, employment_status
      `;

      const values = [
        newFullName,
        newCrmRole,
        newCoreRole,
        newDeptId,
        newDesignation,
        newManagerId,
        newPhone,
        newStatus,
        newJoiningDate,
        empId,
        orgId,
      ];

      const { rows } = await pool.query(updateSql, values);

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'UPDATE_EMPLOYEE',
        entityType: 'user',
        entityId: empId,
        details: { role: crm_role, designation },
        ipAddress: req.ip,
      });

      return res.json({ message: 'Employee updated successfully.', employee: rows[0] });
    } catch (err) {
      console.error('Update employee error:', err.message);
      return res.status(500).json({ error: 'Failed to update employee.' });
    }
  });

  return router;
}

module.exports = { createEmployeesRoutes };
