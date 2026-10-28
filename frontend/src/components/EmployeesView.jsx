import React, { useState, useMemo } from 'react';

export default function EmployeesView({
  employees = [],
  departments = [],
  currentUser,
  onCreateEmployee,
  onSelectEmployeeTasks,
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedEmp, setSelectedEmp] = useState(null);

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

      return matchSearch && matchDept && matchRole;
    });
  }, [employees, search, deptFilter, roleFilter]);

  const canCreate = currentUser?.crm_role === 'super_admin' || currentUser?.crm_role === 'admin';

  return (
    <div className="employees-view">
      <div className="view-header">
        <div>
          <h2>Employee Directory</h2>
          <p>Aulten Digital staff, designations, departments, and active workloads</p>
        </div>
        {canCreate && onCreateEmployee && (
          <button type="button" className="button button--primary" onClick={onCreateEmployee}>
            + Add Employee
          </button>
        )}
      </div>

      <div className="employees-controls">
        <label className="filter-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Search by name, ID, email, or role..."
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

            return (
              <div
                key={emp.id}
                className="employee-card"
                onClick={() => setSelectedEmp(emp)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedEmp(emp)}
              >
                <div className="employee-card-header">
                  <span className="employee-avatar">
                    {emp.avatar || emp.full_name?.substring(0, 2).toUpperCase() || 'AD'}
                  </span>
                  <div className="employee-card-meta">
                    <span className="employee-id">{emp.employee_id || 'AD-EMP'}</span>
                    <span className={`role-badge role-badge--${emp.crm_role || 'employee'}`}>
                      {emp.crm_role === 'super_admin' ? 'Super Admin' : (emp.crm_role || 'employee')}
                    </span>
                  </div>
                </div>

                <h3 className="employee-name">{emp.full_name}</h3>
                <p className="employee-designation">{emp.designation || 'Staff Member'}</p>
                <p className="employee-dept">🏢 {emp.department_name || 'General'}</p>
                <p className="employee-email">✉ {emp.email}</p>

                <div className="employee-workload-bar">
                  <div className="workload-stat">
                    <span>Active Tasks</span>
                    <strong>{activeTasks}</strong>
                  </div>
                  {overdueTasks > 0 && (
                    <div className="workload-stat workload-stat--overdue">
                      <span>Overdue</span>
                      <strong>{overdueTasks} ⚠️</strong>
                    </div>
                  )}
                  <div className="workload-stat">
                    <span>Completed</span>
                    <strong>{emp.completed_tasks_count || 0}</strong>
                  </div>
                </div>

                {onSelectEmployeeTasks && (
                  <button
                    type="button"
                    className="button button--secondary button--full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEmployeeTasks(emp.full_name);
                    }}
                  >
                    View Tasks →
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedEmp && (
        <div className="modal-overlay" onClick={() => setSelectedEmp(null)}>
          <div className="modal-dialog employee-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-profile">
                <span className="profile-avatar large">
                  {selectedEmp.avatar || selectedEmp.full_name?.substring(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{selectedEmp.full_name}</h3>
                  <p>{selectedEmp.designation} · {selectedEmp.department_name}</p>
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedEmp(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div><strong>Employee ID:</strong> {selectedEmp.employee_id}</div>
                <div><strong>Email:</strong> {selectedEmp.email}</div>
                <div><strong>Phone:</strong> {selectedEmp.phone || 'Not provided'}</div>
                <div><strong>Manager:</strong> {selectedEmp.manager_name || 'Direct / None'}</div>
                <div><strong>Employment:</strong> {selectedEmp.employment_status || 'Active'}</div>
                <div><strong>System Role:</strong> {selectedEmp.crm_role}</div>
              </div>

              <div className="detail-section">
                <h4>Performance & Workload Summary</h4>
                <div className="kpi-grid">
                  <div className="kpi-card mini">
                    <span>Active Tasks</span>
                    <strong>{selectedEmp.active_tasks_count || 0}</strong>
                  </div>
                  <div className="kpi-card mini">
                    <span>Overdue</span>
                    <strong className={selectedEmp.overdue_tasks_count > 0 ? 'text-red' : ''}>
                      {selectedEmp.overdue_tasks_count || 0}
                    </strong>
                  </div>
                  <div className="kpi-card mini">
                    <span>Completed</span>
                    <strong>{selectedEmp.completed_tasks_count || 0}</strong>
                  </div>
                </div>
              </div>

              {onSelectEmployeeTasks && (
                <button
                  type="button"
                  className="button button--primary button--full"
                  onClick={() => {
                    setSelectedEmp(null);
                    onSelectEmployeeTasks(selectedEmp.full_name);
                  }}
                >
                  Filter Dashboard to {selectedEmp.full_name}’s Tasks
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
