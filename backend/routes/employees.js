const express = require('express');
const crypto = require('node:crypto');
const { getPool } = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword } = require('../utils/auth');
const { logAudit } = require('../utils/audit');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createEmployeesRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  // 1. List employees with department & workload metrics
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
        ORDER BY 
          CASE u.crm_role 
            WHEN 'super_admin' THEN 1 
            WHEN 'admin' THEN 2 
            WHEN 'manager' THEN 3 
            ELSE 4 
          END ASC,
          u.full_name ASC
      `;

      const { rows } = await pool.query(query, values);
      return res.json({ employees: rows });
    } catch (err) {
      console.error('List employees error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch employees.' });
    }
  });

  // 2. Single Employee Profile & Workload
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

  // 3. Create Employee (Super Admin and Admin)
  router.post('/', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    const {
      full_name,
      email,
      password,
      crm_role = 'employee',
      employee_id,
      department_id,
      designation,
      manager_id,
      phone,
      employment_status = 'active',
      joining_date,
    } = req.body || {};

    // Validate required fields
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'A valid work email address is required.' });
    }

    // Role boundary: only Super Admin can create Super Admins
    if (crm_role === 'super_admin' && req.user.crm_role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Only the Super Admin can assign the Super Admin role.' });
    }

    // Valid role check
    const validRoles = ['super_admin', 'admin', 'manager', 'employee'];
    if (!validRoles.includes(crm_role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${validRoles.join(', ')}` });
    }

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;
      const normalizedEmail = email.trim().toLowerCase();

      // Check unique email in org
      const existCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
        [normalizedEmail, orgId]
      );
      if (existCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A user with this work email already exists in the organization.' });
      }

      // Check unique employee_id if provided
      let empCode = employee_id ? employee_id.trim() : null;
      if (empCode) {
        const empCodeCheck = await pool.query(
          'SELECT id FROM users WHERE employee_id = $1 AND organization_id = $2',
          [empCode, orgId]
        );
        if (empCodeCheck.rows.length > 0) {
          return res.status(400).json({ error: `Employee ID "${empCode}" is already in use. Please specify a unique ID.` });
        }
      } else {
        const countRes = await pool.query('SELECT COUNT(*) + 1 AS next_emp FROM users WHERE organization_id = $1', [orgId]);
        empCode = `AD-${String(countRes.rows[0].next_emp).padStart(4, '0')}`;
      }

      // Secure password setup flow
      let setupPassword = password;
      let generated = false;
      if (!setupPassword) {
        setupPassword = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, 'X') + '!9a';
        generated = true;
      } else if (setupPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }

      const hash = await hashPassword(setupPassword);
      const initials = full_name.trim().split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

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
        RETURNING id, full_name, email, crm_role, employee_id, designation, department_id, employment_status, is_active, created_at
      `;

      const coreRole = crm_role === 'super_admin' ? 'owner' : (crm_role === 'admin' ? 'admin' : 'member');
      const isActive = employment_status === 'active';

      const values = [
        orgId,
        full_name.trim(),
        normalizedEmail,
        hash,
        coreRole,
        crm_role,
        empCode,
        department_id || null,
        designation?.trim() || 'Software Engineer',
        manager_id || null,
        phone?.trim() || null,
        initials,
        employment_status,
        joining_date || new Date(),
        isActive,
      ];

      const { rows } = await pool.query(insertSql, values);
      const newEmployee = rows[0];

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: 'CREATE_EMPLOYEE',
        entityType: 'user',
        entityId: newEmployee.id,
        details: { email: newEmployee.email, employeeId: empCode, role: crm_role },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        message: 'Employee created successfully.',
        employee: newEmployee,
        initialPassword: generated ? setupPassword : null,
      });
    } catch (err) {
      console.error('Create employee error:', err.message);
      return res.status(500).json({ error: 'Failed to create employee: ' + err.message });
    }
  });

  // 4. Update Employee (Super Admin and Admin)
  router.put('/:id', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    const empId = req.params.id;
    const {
      full_name,
      email,
      crm_role,
      employee_id,
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

      // RBAC Safeguards:
      // 1. Admin cannot edit a Super Admin account
      if (existing.crm_role === 'super_admin' && req.user.crm_role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: Admins cannot modify Super Admin accounts.' });
      }

      // 2. Admin cannot promote anyone to Super Admin
      if (crm_role === 'super_admin' && req.user.crm_role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: Admins cannot assign or promote users to Super Admin.' });
      }

      // 3. Admin cannot change their own role
      if (req.user.id === empId && crm_role && crm_role !== existing.crm_role) {
        return res.status(403).json({ error: 'Forbidden: Administrators cannot modify their own role.' });
      }

      // Check unique email if changing
      let newEmail = existing.email;
      if (email && email.trim().toLowerCase() !== existing.email) {
        if (!EMAIL_REGEX.test(email.trim())) {
          return res.status(400).json({ error: 'Invalid email address format.' });
        }
        newEmail = email.trim().toLowerCase();
        const emailCheck = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND organization_id = $2 AND id != $3',
          [newEmail, orgId, empId]
        );
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: 'A user with this work email already exists.' });
        }
      }

      // Check unique employee_id if changing
      let newEmpId = existing.employee_id;
      if (employee_id && employee_id.trim() !== existing.employee_id) {
        newEmpId = employee_id.trim();
        const idCheck = await pool.query(
          'SELECT id FROM users WHERE employee_id = $1 AND organization_id = $2 AND id != $3',
          [newEmpId, orgId, empId]
        );
        if (idCheck.rows.length > 0) {
          return res.status(400).json({ error: `Employee ID "${newEmpId}" is already in use.` });
        }
      }

      const newFullName = full_name ? full_name.trim() : existing.full_name;
      const newCrmRole = crm_role || existing.crm_role;
      const newCoreRole = crm_role ? (crm_role === 'super_admin' ? 'owner' : (crm_role === 'admin' ? 'admin' : 'member')) : existing.role;
      const newDeptId = department_id !== undefined ? (department_id || null) : existing.department_id;
      const newDesignation = designation !== undefined ? designation : existing.designation;
      const newManagerId = manager_id !== undefined ? (manager_id || null) : existing.manager_id;
      const newPhone = phone !== undefined ? phone : existing.phone;
      const newStatus = employment_status !== undefined ? employment_status : existing.employment_status;
      const newJoiningDate = joining_date !== undefined ? joining_date : existing.joining_date;
      const newIsActive = newStatus === 'active';

      const updateSql = `
        UPDATE users SET
          full_name = $1,
          email = $2,
          crm_role = $3,
          role = $4,
          employee_id = $5,
          department_id = $6,
          designation = $7,
          manager_id = $8,
          phone = $9,
          employment_status = $10,
          is_active = $11,
          joining_date = $12,
          updated_at = now()
        WHERE id = $13 AND organization_id = $14
        RETURNING id, full_name, email, crm_role, employee_id, designation, department_id, employment_status, is_active
      `;

      const values = [
        newFullName,
        newEmail,
        newCrmRole,
        newCoreRole,
        newEmpId,
        newDeptId,
        newDesignation,
        newManagerId,
        newPhone,
        newStatus,
        newIsActive,
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
        details: { role: newCrmRole, designation: newDesignation, status: newStatus },
        ipAddress: req.ip,
      });

      return res.json({ message: 'Employee updated successfully.', employee: rows[0] });
    } catch (err) {
      console.error('Update employee error:', err.message);
      return res.status(500).json({ error: 'Failed to update employee.' });
    }
  });

  // 5. Deactivate / Activate Employee (Without deleting historical tasks)
  router.patch('/:id/status', requireAuth, requireRole(['super_admin', 'admin']), async (req, res) => {
    const empId = req.params.id;
    const { is_active, status } = req.body || {};

    try {
      const pool = poolProvider();
      const orgId = req.user.organization_id;

      const userRes = await pool.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [empId, orgId]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: 'Employee not found.' });
      const targetUser = userRes.rows[0];

      // Super Admin protection: Cannot deactivate Super Admin Dolly
      if (targetUser.crm_role === 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: The Super Admin account cannot be deactivated.' });
      }

      // Admin protection: Admin cannot deactivate another Admin
      if (targetUser.crm_role === 'admin' && req.user.crm_role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: Only the Super Admin can deactivate administrators.' });
      }

      // Cannot deactivate self
      if (req.user.id === empId) {
        return res.status(400).json({ error: 'You cannot deactivate your own account.' });
      }

      const nextActive = is_active !== undefined ? Boolean(is_active) : (status === 'active');
      const nextStatus = nextActive ? 'active' : 'inactive';

      await pool.query(
        `UPDATE users SET 
           is_active = $1, 
           employment_status = $2, 
           updated_at = now() 
         WHERE id = $3 AND organization_id = $4`,
        [nextActive, nextStatus, empId, orgId]
      );

      // If deactivated, invalidate all active sessions immediately
      if (!nextActive) {
        await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [empId]);
      }

      await logAudit(pool, {
        organizationId: orgId,
        userId: req.user.id,
        actorName: req.user.full_name,
        action: nextActive ? 'REACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE',
        entityType: 'user',
        entityId: empId,
        details: { targetEmail: targetUser.email, targetName: targetUser.full_name },
        ipAddress: req.ip,
      });

      return res.json({
        message: `Employee ${targetUser.full_name} has been ${nextActive ? 'reactivated' : 'deactivated'}. Historical task records are preserved.`,
        is_active: nextActive,
        employment_status: nextStatus,
      });
    } catch (err) {
      console.error('Change employee status error:', err.message);
      return res.status(500).json({ error: 'Failed to update employee status.' });
    }
  });

  return router;
}

module.exports = { createEmployeesRoutes };
