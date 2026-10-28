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
          <h2>Plant Workforce Directory</h2>
          <p>Precision engineering specialists, CNC machinists, shift supervisors, and qualifications</p>
        </div>
        {canCreate && onCreateEmployee && (
          <button type="button" className="button button--primary" onClick={onCreateEmployee}>
            + Add Employee
          </button>
        )}
      </div>

      <div className="employees-controls">
        <label className="filter-search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            placeholder="Search by Indian name, ID, designation, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <div className="filter-dropdowns">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">All Manufacturing Divisions</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin / Plant Director</option>
            <option value="admin">Admin / QA Head</option>
            <option value="manager">Manager / Shift Lead</option>
            <option value="employee">Specialist / Machinist</option>
          </select>
        </div>
      </div>

      <div className="employees-grid">
        {filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <p>No manufacturing personnel match the current filters.</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const activeTasks = parseInt(emp.active_tasks_count || 0, 10);
            const overdueTasks = parseInt(emp.overdue_tasks_count || 0, 10);
            const deptObj = departments.find((d) => d.id === emp.department_id);
            const deptName = emp.department_name || deptObj?.name || emp.department || 'Plant Operations';

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
                  <span className="employee-avatar" title={emp.full_name}>
                    {emp.avatar || emp.full_name?.substring(0, 2).toUpperCase() || 'IN'}
                  </span>
                  <div className="employee-card-meta">
                    <span className="employee-id">{emp.employee_id || 'MFG-0100'}</span>
                    <span className={`role-badge role-badge--${emp.crm_role || 'employee'}`}>
                      {emp.crm_role === 'super_admin' ? 'Plant Director' :
                       emp.crm_role === 'admin' ? 'Admin' :
                       emp.crm_role === 'manager' ? 'Shift Manager' : 'Specialist'}
                    </span>
                  </div>
                </div>

                <h3 className="employee-name">{emp.full_name}</h3>
                <p className="employee-designation">{emp.designation || 'Manufacturing Specialist'}</p>
                <p className="employee-dept">🏭 {deptName}</p>
                <p className="employee-email">✉️ {emp.email}</p>
                {emp.phone && <p className="employee-phone">📞 {emp.phone}</p>}

                <div className="employee-workload-bar">
                  <div className="workload-stat">
                    <span>Work Orders</span>
                    <strong>{activeTasks || (emp.crm_role === 'employee' ? 3 : 5)}</strong>
                  </div>
                  {overdueTasks > 0 ? (
                    <div className="workload-stat workload-stat--overdue">
                      <span>Overdue</span>
                      <strong>{overdueTasks} ⚠️</strong>
                    </div>
                  ) : (
                    <div className="workload-stat">
                      <span>Shift</span>
                      <strong style={{ fontSize: '11px', color: 'var(--green)' }}>Shift 1</strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="employee-view-tasks-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEmployeeTasks?.(emp.full_name);
                  }}
                >
                  View Floor Tasks →
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Employee Quick Detail Modal */}
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
              <button
                type="button"
                className="close-button"
                onClick={() => setSelectedEmp(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="emp-detail-grid">
                <div>
                  <label>Division / Shopfloor</label>
                  <p>🏭 {selectedEmp.department_name || selectedEmp.department || 'Plant Operations'}</p>
                </div>
                <div>
                  <label>Work Email</label>
                  <p>✉️ {selectedEmp.email}</p>
                </div>
                <div>
                  <label>Plant Direct Line</label>
                  <p>📞 {selectedEmp.phone || '+91 20 6613 4000'}</p>
                </div>
                <div>
                  <label>Plant Role & Permissions</label>
                  <p><span className={`role-badge role-badge--${selectedEmp.crm_role}`}>{selectedEmp.crm_role}</span></p>
                </div>
                <div>
                  <label>Current Shift Allocation</label>
                  <p>⏰ Shift 1 (06:00 - 14:30 IST)</p>
                </div>
                <div>
                  <label>Plant Facility</label>
                  <p>📍 Chakan Industrial Complex, Pune</p>
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
                View Active Work Orders →
              </button>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setSelectedEmp(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
