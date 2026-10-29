import React, { useState, useMemo } from 'react';
import { createEmployeeApi, updateEmployeeApi, deactivateEmployeeApi } from '../api/crm';

export default function EmployeesView({
  employees = [],
  departments = [],
  currentUser,
  onRefresh,
  onSelectEmployeeTasks,
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmp, setSelectedEmp] = useState(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [deactivatingEmp, setDeactivatingEmp] = useState(null);
  const [createdEmpResult, setCreatedEmpResult] = useState(null);

  // Add form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [empId, setEmpId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState('employee');
  const [managerId, setManagerId] = useState('');
  const [phone, setPhone] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Permissions
  const userRole = currentUser?.crm_role || 'employee';
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = isSuperAdmin || userRole === 'admin';

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        !search ||
        emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.email?.toLowerCase().includes(search.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(search.toLowerCase());

      const matchDept = deptFilter === 'all' || emp.department_id === deptFilter;
      const matchRole = roleFilter === 'all' || emp.crm_role === roleFilter;
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && emp.is_active) || 
        (statusFilter === 'inactive' && !emp.is_active);

      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [employees, search, deptFilter, roleFilter, statusFilter]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setEmpId('');
    setDeptId('');
    setDesignation('');
    setRole('employee');
    setManagerId('');
    setPhone('');
    setInitialPassword('');
    setFormError('');
    setCreatedEmpResult(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    // Default employee ID suggestion
    const nextNum = employees.length + 1;
    setEmpId(`EMP-${String(nextNum).padStart(4, '0')}`);
    setAddModalOpen(true);
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setFormError('Full name and work email are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        employee_id: empId.trim() || undefined,
        department_id: deptId || null,
        designation: designation.trim() || 'Software Engineer',
        crm_role: role,
        manager_id: managerId || null,
        phone: phone.trim() || null,
        password: initialPassword.trim() || undefined,
        employment_status: 'active',
      };

      const res = await createEmployeeApi(payload);
      setCreatedEmpResult({
        employee: res.employee,
        initialPassword: res.initialPassword || initialPassword || '(Configured by user)',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message || 'Failed to create employee account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (emp) => {
    setEditEmp({
      id: emp.id,
      full_name: emp.full_name,
      email: emp.email,
      employee_id: emp.employee_id || '',
      department_id: emp.department_id || '',
      designation: emp.designation || '',
      crm_role: emp.crm_role || 'employee',
      manager_id: emp.manager_id || '',
      phone: emp.phone || '',
      is_active: emp.is_active,
    });
    setFormError('');
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!editEmp.full_name.trim() || !editEmp.email.trim()) {
      setFormError('Full name and email are required.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await updateEmployeeApi(editEmp.id, {
        full_name: editEmp.full_name.trim(),
        email: editEmp.email.trim().toLowerCase(),
        employee_id: editEmp.employee_id.trim(),
        department_id: editEmp.department_id || null,
        designation: editEmp.designation.trim(),
        crm_role: editEmp.crm_role,
        manager_id: editEmp.manager_id || null,
        phone: editEmp.phone.trim() || null,
        employment_status: editEmp.is_active ? 'active' : 'inactive',
      });
      setEditEmp(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.message || 'Failed to update employee details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingEmp) return;
    setSubmitting(true);
    try {
      const nextActive = !deactivatingEmp.is_active;
      await deactivateEmployeeApi(deactivatingEmp.id, nextActive);
      setDeactivatingEmp(null);
      if (selectedEmp?.id === deactivatingEmp.id) {
        setSelectedEmp(null);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to change employee active status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="employees-view">
      <div className="view-header">
        <div>
          <h2>Employee Directory &amp; RBAC</h2>
          <p>Manage team personnel, role permissions, and active task workloads</p>
        </div>
        {isAdmin && (
          <button type="button" className="button button--primary" onClick={handleOpenAdd}>
            + Add Employee
          </button>
        )}
      </div>

      <div className="employees-controls">
        <label className="filter-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Search by name, email, employee ID, designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="filter-dropdowns">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Deactivated Only</option>
          </select>
        </div>
      </div>

      <div className="employees-grid">
        {filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <p>No employees match the current filters.</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const activeTasks = parseInt(emp.active_tasks_count || 0, 10);
            const overdueTasks = parseInt(emp.overdue_tasks_count || 0, 10);
            const deptObj = departments.find((d) => d.id === emp.department_id);
            const deptName = emp.department_name || deptObj?.name || 'General';
            const isActive = emp.is_active !== false;

            return (
              <div
                key={emp.id}
                className={`employee-card${!isActive ? ' employee-card--inactive' : ''}`}
                onClick={() => setSelectedEmp(emp)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedEmp(emp)}
              >
                <div className="employee-card-header">
                  <span className="employee-avatar" title={emp.full_name}>
                    {emp.avatar || emp.full_name?.substring(0, 2).toUpperCase() || 'EM'}
                  </span>
                  <div className="employee-card-meta">
                    <span className="employee-id">{emp.employee_id || 'AD-0000'}</span>
                    <span className={`role-badge role-badge--${emp.crm_role || 'employee'}`}>
                      {emp.crm_role === 'super_admin' ? 'Super Admin' :
                       emp.crm_role === 'admin' ? 'Admin' :
                       emp.crm_role === 'manager' ? 'Manager' : 'Employee'}
                    </span>
                  </div>
                </div>

                <div className="employee-name-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <h3 className="employee-name" style={{ margin: 0 }}>{emp.full_name}</h3>
                  <span className={`status-pill ${isActive ? 'status-pill--active' : 'status-pill--inactive'}`}>
                    {isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>

                <p className="employee-designation">{emp.designation || 'Software Engineer'}</p>
                <p className="employee-dept">🏢 {deptName}</p>
                <p className="employee-email">✉️ {emp.email}</p>
                {emp.phone && <p className="employee-phone">📞 {emp.phone}</p>}

                <div className="employee-workload-bar">
                  <div className="workload-stat">
                    <span>Active Tasks</span>
                    <strong>{activeTasks}</strong>
                  </div>
                  {overdueTasks > 0 ? (
                    <div className="workload-stat workload-stat--overdue">
                      <span>Overdue</span>
                      <strong>{overdueTasks} ⚠️</strong>
                    </div>
                  ) : (
                    <div className="workload-stat">
                      <span>Status</span>
                      <strong style={{ fontSize: '11px', color: isActive ? 'var(--green)' : 'var(--text-secondary)' }}>
                        {isActive ? 'Healthy' : 'Inactive'}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="employee-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="button button--secondary button--sm"
                    onClick={() => onSelectEmployeeTasks?.(emp.full_name)}
                  >
                    Tasks ({activeTasks})
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="button button--secondary button--sm"
                      onClick={() => handleOpenEdit(emp)}
                      title="Edit employee details and role permissions"
                    >
                      ✏️ Edit
                    </button>
                  )}
                  {isAdmin && emp.crm_role !== 'super_admin' && (
                    <button
                      type="button"
                      className={`button button--sm ${isActive ? 'button--outline-danger' : 'button--outline-success'}`}
                      onClick={() => setDeactivatingEmp(emp)}
                      title={isActive ? 'Deactivate account without deleting tasks' : 'Reactivate employee account'}
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Add Employee Modal ────────────────────────────────────── */}
      {addModalOpen && (
        <div className="modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="modal modal--emp-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add New Employee</h3>
                <p>Register employee profile, assign role permissions, and create initial access credentials</p>
              </div>
              <button type="button" className="close-button" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>

            {createdEmpResult ? (
              <div className="modal-body">
                <div className="credentials-created-card">
                  <div className="credential-icon">🎉</div>
                  <h4>Employee Account Provisioned!</h4>
                  <p>The employee account has been created successfully in the database.</p>
                  <div className="credential-box">
                    <div><strong>Full Name:</strong> {createdEmpResult.employee.full_name}</div>
                    <div><strong>Work Email:</strong> {createdEmpResult.employee.email}</div>
                    <div><strong>Employee ID:</strong> {createdEmpResult.employee.employee_id}</div>
                    <div><strong>Assigned Role:</strong> <span className={`role-badge role-badge--${createdEmpResult.employee.crm_role}`}>{createdEmpResult.employee.crm_role}</span></div>
                    <div><strong>Initial Password / Token:</strong> <code>{createdEmpResult.initialPassword}</code></div>
                  </div>
                  <small className="credential-note">
                    ⚠️ Passwords are securely hashed with memory-hard Scrypt in the database. Share this initial password with the employee immediately.
                  </small>
                </div>
                <div className="modal-footer" style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      setAddModalOpen(false);
                      setCreatedEmpResult(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateEmployee}>
                <div className="modal-body">
                  {formError && <div className="form-error-banner">{formError}</div>}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="emp-name">Full Name *</label>
                      <input
                        id="emp-name"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Vikram Joshi"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="emp-email">Work Email *</label>
                      <input
                        id="emp-email"
                        type="email"
                        className="form-input"
                        placeholder="e.g. vikram.joshi@startizlabs.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="emp-id-input">Employee ID *</label>
                      <input
                        id="emp-id-input"
                        type="text"
                        className="form-input"
                        placeholder="e.g. EMP-0105"
                        value={empId}
                        onChange={(e) => setEmpId(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="emp-role">Role &amp; Permissions *</label>
                      <select
                        id="emp-role"
                        className="form-input"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        <option value="employee">Employee (View self tasks, update status, comment)</option>
                        <option value="manager">Manager (Manage team tasks, assign, monitor workload)</option>
                        {isSuperAdmin && <option value="admin">Admin (Manage team, employees, and reports)</option>}
                        {isSuperAdmin && <option value="super_admin">Super Admin (Full organization authority)</option>}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="emp-dept">Department / Team *</label>
                      <select
                        id="emp-dept"
                        className="form-input"
                        value={deptId}
                        onChange={(e) => setDeptId(e.target.value)}
                      >
                        <option value="">Select Department...</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="emp-desig">Designation / Title *</label>
                      <input
                        id="emp-desig"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Senior Backend Engineer"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="emp-manager">Reporting Manager</label>
                      <select
                        id="emp-manager"
                        className="form-input"
                        value={managerId}
                        onChange={(e) => setManagerId(e.target.value)}
                      >
                        <option value="">None / Executive Level</option>
                        {employees.filter((u) => u.crm_role === 'manager' || u.crm_role === 'admin' || u.crm_role === 'super_admin').map((mgr) => (
                          <option key={mgr.id} value={mgr.id}>{mgr.full_name} ({mgr.crm_role})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="emp-phone">Phone Number (Optional)</label>
                      <input
                        id="emp-phone"
                        type="tel"
                        className="form-input"
                        placeholder="e.g. +91 98123 45678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="emp-password">Initial Password / Activation Setup</label>
                    <input
                      id="emp-password"
                      type="text"
                      className="form-input"
                      placeholder="Leave blank to automatically generate a secure setup password"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                    />
                    <small style={{ color: 'var(--text-secondary)' }}>
                      If left blank, the system generates a secure temporary activation credential.
                    </small>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="button button--secondary" onClick={() => setAddModalOpen(false)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="button button--primary" disabled={submitting}>
                    {submitting ? 'Creating Employee...' : 'Save & Provision Employee'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Employee Modal ───────────────────────────────────── */}
      {editEmp && (
        <div className="modal-backdrop" onClick={() => setEditEmp(null)}>
          <div className="modal modal--emp-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Edit Employee Details</h3>
                <p>Update designation, department, reporting manager, or role permissions</p>
              </div>
              <button type="button" className="close-button" onClick={() => setEditEmp(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateEmployee}>
              <div className="modal-body">
                {formError && <div className="form-error-banner">{formError}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editEmp.full_name}
                      onChange={(e) => setEditEmp({ ...editEmp, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Work Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editEmp.email}
                      onChange={(e) => setEditEmp({ ...editEmp, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Employee ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editEmp.employee_id}
                      onChange={(e) => setEditEmp({ ...editEmp, employee_id: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Role</label>
                    <select
                      className="form-input"
                      value={editEmp.crm_role}
                      onChange={(e) => setEditEmp({ ...editEmp, crm_role: e.target.value })}
                      disabled={editEmp.crm_role === 'super_admin' && !isSuperAdmin}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      {isSuperAdmin && <option value="admin">Admin</option>}
                      {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select
                      className="form-input"
                      value={editEmp.department_id}
                      onChange={(e) => setEditEmp({ ...editEmp, department_id: e.target.value })}
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Designation</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editEmp.designation}
                      onChange={(e) => setEditEmp({ ...editEmp, designation: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Reporting Manager</label>
                    <select
                      className="form-input"
                      value={editEmp.manager_id}
                      onChange={(e) => setEditEmp({ ...editEmp, manager_id: e.target.value })}
                    >
                      <option value="">None / Executive Level</option>
                      {employees.filter((u) => u.id !== editEmp.id && (u.crm_role === 'manager' || u.crm_role === 'admin' || u.crm_role === 'super_admin')).map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>{mgr.full_name} ({mgr.crm_role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={editEmp.phone}
                      onChange={(e) => setEditEmp({ ...editEmp, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Account Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="account_status"
                        checked={editEmp.is_active === true}
                        onChange={() => setEditEmp({ ...editEmp, is_active: true })}
                      />
                      <span>Active</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="account_status"
                        checked={editEmp.is_active === false}
                        onChange={() => setEditEmp({ ...editEmp, is_active: false })}
                      />
                      <span>Deactivated (Preserves task records)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="button button--secondary" onClick={() => setEditEmp(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="button button--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Deactivation Confirmation Dialog ──────────────────────── */}
      {deactivatingEmp && (
        <div className="modal-backdrop" onClick={() => setDeactivatingEmp(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {deactivatingEmp.is_active ? '⚠️ Deactivate Employee Account' : 'Reactivate Employee Account'}
              </h3>
              <button type="button" className="close-button" onClick={() => setDeactivatingEmp(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to {deactivatingEmp.is_active ? 'deactivate' : 'reactivate'}{' '}
                <strong>{deactivatingEmp.full_name}</strong> ({deactivatingEmp.email})?
              </p>
              {deactivatingEmp.is_active ? (
                <div className="deactivation-notice">
                  <strong>Safe Deactivation Policy:</strong>
                  <ul>
                    <li>The employee will be immediately signed out and blocked from logging in.</li>
                    <li><strong>Historical task records, assignments, and comments will NOT be deleted.</strong></li>
                    <li>You can reactivate this account at any time.</li>
                  </ul>
                </div>
              ) : (
                <p>This will restore the employee's active status and enable them to sign into the system again.</p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="button button--secondary" onClick={() => setDeactivatingEmp(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className={`button ${deactivatingEmp.is_active ? 'button--outline-danger' : 'button--primary'}`}
                onClick={handleConfirmDeactivate}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : (deactivatingEmp.is_active ? 'Yes, Deactivate Account' : 'Yes, Reactivate Account')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Detail View Modal ────────────────────────────── */}
      {selectedEmp && (
        <div className="modal-backdrop" onClick={() => setSelectedEmp(null)}>
          <div className="modal modal--emp-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="emp-detail-header">
                <span className="employee-avatar employee-avatar--lg">
                  {selectedEmp.avatar || selectedEmp.full_name?.substring(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{selectedEmp.full_name}</h3>
                  <p className="emp-detail-desig">{selectedEmp.designation}</p>
                  <span className="employee-id">{selectedEmp.employee_id}</span>
                </div>
              </div>
              <button type="button" className="close-button" onClick={() => setSelectedEmp(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="emp-detail-grid">
                <div>
                  <label>Department</label>
                  <p>🏢 {selectedEmp.department_name || 'General'}</p>
                </div>
                <div>
                  <label>Work Email</label>
                  <p>✉️ {selectedEmp.email}</p>
                </div>
                <div>
                  <label>Direct Phone</label>
                  <p>📞 {selectedEmp.phone || '+91 11 4050 2000'}</p>
                </div>
                <div>
                  <label>Role &amp; Permissions</label>
                  <p><span className={`role-badge role-badge--${selectedEmp.crm_role}`}>{selectedEmp.crm_role}</span></p>
                </div>
                <div>
                  <label>Account Status</label>
                  <p>
                    <span className={`status-pill ${selectedEmp.is_active ? 'status-pill--active' : 'status-pill--inactive'}`}>
                      {selectedEmp.is_active ? 'Active Employee' : 'Deactivated Account'}
                    </span>
                  </p>
                </div>
                <div>
                  <label>Reporting Manager</label>
                  <p>{selectedEmp.manager_name || 'Direct to Super Admin (Dolly)'}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  const name = selectedEmp.full_name;
                  setSelectedEmp(null);
                  onSelectEmployeeTasks?.(name);
                }}
              >
                View Active Tasks →
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    const emp = selectedEmp;
                    setSelectedEmp(null);
                    handleOpenEdit(emp);
                  }}
                >
                  Edit Employee
                </button>
              )}
              <button type="button" className="button button--secondary" onClick={() => setSelectedEmp(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
