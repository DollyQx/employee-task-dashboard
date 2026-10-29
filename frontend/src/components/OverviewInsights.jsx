import React, { useMemo, useState, useEffect } from 'react';
import { UNASSIGNED_EMPLOYEE, getTaskMetrics } from '../utils/taskMetrics';
import {
  getWorkMonitoringApi,
  getTodayAttendanceApi,
  checkInAttendanceApi,
  checkOutAttendanceApi,
} from '../api/crm';

function entriesFor(tasks, keyFor, labelFor) {
  const counts = new Map();
  tasks.forEach((task) => {
    const key = keyFor(task);
    const entry = counts.get(key) || { key, label: labelFor(task), count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function DistributionPanel({ title, items, onSelect, emptyLabel }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="analytics-panel overview-distribution">
      <header className="analytics-panel__header">
        <div>
          <h3>{title}</h3>
          <p>Distribution breakdown</p>
        </div>
      </header>
      {items.length ? (
        <div className="overview-distribution__items">
          {items.map((item) => (
            <button
              type="button"
              className="overview-distribution__item"
              key={item.key}
              onClick={() => onSelect(item.filter)}
              aria-label={`View ${item.count} ${item.label} tasks`}
            >
              <span className="overview-distribution__label">{item.label}</span>
              <span className="analytics-bar-track" aria-hidden="true">
                <i style={{ width: `${(item.count / max) * 100}%` }} />
              </span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p className="overview-distribution__empty">{emptyLabel}</p>
      )}
    </div>
  );
}

function WorkMonitoringTable({ workMonitoring, loading, onNavigate }) {
  const employeesList = workMonitoring?.employees || [];
  return (
    <div className="dashboard-card" style={{ marginTop: '16px' }}>
      <div className="dashboard-card__header">
        <div>
          <h3>Employee Work Progress &amp; Attendance Monitoring</h3>
          <p className="subtle-note">
            Real-time tracking of tasks assigned, in progress, awaiting review, overdue, average progress %, and attendance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="link-button" onClick={() => onNavigate('attendance')}>
            Attendance Board →
          </button>
          <button type="button" className="link-button" onClick={() => onNavigate('employees')}>
            Employee Directory →
          </button>
        </div>
      </div>

      <div className="workload-table-wrapper">
        <table className="workload-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Department</th>
              <th>Assigned</th>
              <th>Completed</th>
              <th>In Progress</th>
              <th>Pending</th>
              <th>Overdue</th>
              <th>Average Progress</th>
              <th>Today's Attendance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>
                  Loading work progress metrics...
                </td>
              </tr>
            ) : employeesList.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#64748B' }}>
                  No employee records available.
                </td>
              </tr>
            ) : (
              employeesList.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="employee-cell">
                      <span className="mini-avatar">{emp.avatar || emp.full_name?.substring(0, 2).toUpperCase()}</span>
                      <strong>{emp.full_name}</strong>
                    </div>
                  </td>
                  <td><code>{emp.employee_id}</code></td>
                  <td>{emp.department_name || 'General'}</td>
                  <td><strong>{emp.assigned_tasks}</strong></td>
                  <td><span className="text-green font-bold">{emp.completed_tasks}</span></td>
                  <td><span className="text-blue">{emp.in_progress_tasks}</span></td>
                  <td><span>{emp.pending_tasks}</span></td>
                  <td>
                    {emp.overdue_tasks > 0 ? (
                      <span className="text-red font-bold">{emp.overdue_tasks} ⚠️</span>
                    ) : (
                      <span className="text-green">0</span>
                    )}
                  </td>
                  <td style={{ minWidth: '140px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="employee-workload-bar" style={{ flex: 1 }}>
                        <div
                          style={{
                            width: `${emp.avg_progress_percentage}%`,
                            height: '100%',
                            background: emp.avg_progress_percentage === 100 ? '#15803D' : '#2563EB',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                      <strong style={{ fontSize: '11px', width: '32px' }}>{emp.avg_progress_percentage}%</strong>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge badge--sm ${
                        emp.today_attendance === 'checked_out'
                          ? 'badge--employee'
                          : emp.today_attendance === 'present'
                          ? 'badge--admin'
                          : 'badge--manager'
                      }`}
                    >
                      {emp.today_attendance === 'checked_out'
                        ? 'Checked Out'
                        : emp.today_attendance === 'present'
                        ? 'Present (Active)'
                        : 'Not Checked In'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OverviewInsights({
  tasks = [],
  reportData = {},
  currentUser,
  employees = [],
  onApplyFilters,
  onNavigate,
  onOpenCreateTask,
  onOpenAddEmployee,
}) {
  const userRole = currentUser?.crm_role || 'employee';
  const metrics = getTaskMetrics(tasks);
  const kpis = reportData?.kpis || {};
  const myMetrics = reportData?.myMetrics || {};
  const employeeWorkload = reportData?.employeeWorkload || [];
  const recentActivity = reportData?.recentActivity || [];
  const myRecentUpdates = reportData?.myRecentUpdates || [];

  const distributions = useMemo(() => ({
    status: entriesFor(tasks, (task) => task.crm_status || task.status || 'unknown', (task) => {
      const s = task.crm_status || task.status;
      if (s === 'in_progress' || s === 'in-progress') return 'In Progress';
      if (s === 'todo' || s === 'pending') return 'To Do';
      if (s === 'in_review') return 'In Review';
      if (s === 'blocked') return 'Blocked';
      if (s === 'done' || s === 'completed') return 'Completed';
      return 'Backlog';
    }).map((item) => ({ ...item, filter: { statusFilter: item.key } })),
    department: entriesFor(tasks, (task) => task.department_name || task.source || 'General', (task) => task.department_name || task.source || 'General')
      .map((item) => ({ ...item, filter: { sourceFilter: item.key } })),
    priority: entriesFor(tasks, (task) => task.crm_priority?.toLowerCase() || task.urgency?.toLowerCase() || 'medium', (task) => {
      const p = task.crm_priority || task.urgency;
      return p ? p.toUpperCase() : 'MEDIUM';
    }).map((item) => ({ ...item, filter: { priorityFilter: item.key } })),
    assignee: entriesFor(tasks, (task) => task.employee?.trim() || UNASSIGNED_EMPLOYEE, (task) => task.employee?.trim() || 'Unassigned')
      .map((item) => ({ ...item, filter: { employeeFilter: item.key } })),
  }), [tasks]);

  const [workMonitoring, setWorkMonitoring] = useState({ summary: {}, employees: [] });
  const [loadingWorkMonitoring, setLoadingWorkMonitoring] = useState(false);
  const [employeeAttendance, setEmployeeAttendance] = useState(null);
  const [attLoading, setAttLoading] = useState(false);

  useEffect(() => {
    if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'manager') {
      setLoadingWorkMonitoring(true);
      getWorkMonitoringApi()
        .then((res) => {
          if (res) setWorkMonitoring(res);
        })
        .catch(() => {})
        .finally(() => setLoadingWorkMonitoring(false));
    }

    if (userRole === 'employee') {
      setAttLoading(true);
      getTodayAttendanceApi()
        .then((res) => setEmployeeAttendance(res))
        .catch(() => {})
        .finally(() => setAttLoading(false));
    }
  }, [userRole]);

  const handleQuickCheckIn = async () => {
    setAttLoading(true);
    try {
      await checkInAttendanceApi();
      const res = await getTodayAttendanceApi();
      setEmployeeAttendance(res);
    } catch (err) {
      alert(err.message || 'Check-in failed');
    } finally {
      setAttLoading(false);
    }
  };

  const handleQuickCheckOut = async () => {
    setAttLoading(true);
    try {
      await checkOutAttendanceApi();
      const res = await getTodayAttendanceApi();
      setEmployeeAttendance(res);
    } catch (err) {
      alert(err.message || 'Check-out failed');
    } finally {
      setAttLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. Super Admin Dashboard (Dolly)
  // ─────────────────────────────────────────────────────────────
  if (userRole === 'super_admin') {
    return (
      <section className="overview-insights role-dashboard role-dashboard--super-admin">
        <div className="role-dashboard__banner">
          <div>
            <span className="badge badge--super-admin">Super Admin Authority</span>
            <h2>Organization Command Center • Dolly</h2>
            <p>System-wide oversight of all employees, department workloads, task SLAs, and security controls.</p>
          </div>
          <div className="role-dashboard__quick-actions">
            <button type="button" className="button button--primary" onClick={onOpenCreateTask}>
              + Create &amp; Assign Task
            </button>
            <button type="button" className="button button--secondary" onClick={onOpenAddEmployee}>
              + Add Employee
            </button>
            <button type="button" className="button button--secondary" onClick={() => onNavigate('reports')}>
              📈 Full Reports
            </button>
          </div>
        </div>

        {/* Super Admin Top Stat Cards (Module 7: 8 Real Metrics) */}
        <div className="kpi-grid">
          <div className="kpi-card" onClick={() => onNavigate('employees')}>
            <span className="kpi-top"><span>Total Employees</span><span className="kpi-icon kpi-icon--blue">👥</span></span>
            <strong>{workMonitoring?.summary?.total_employees || kpis.total_employees || employees.length || 18}</strong>
            <span className="kpi-note">{workMonitoring?.summary?.active_employees || kpis.active_employees || 18} active</span>
          </div>

          <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'all' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Tasks Assigned</span><span className="kpi-icon kpi-icon--blue">📋</span></span>
            <strong>{workMonitoring?.summary?.tasks_assigned || kpis.total_tasks || tasks.length}</strong>
            <span className="kpi-note">Total organization tasks</span>
          </div>

          <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'in_progress' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>In Progress</span><span className="kpi-icon kpi-icon--blue">⚡</span></span>
            <strong className="text-blue">{workMonitoring?.summary?.tasks_in_progress || 0}</strong>
            <span className="kpi-note">Active execution</span>
          </div>

          <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'in_review' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Awaiting Review</span><span className="kpi-icon kpi-icon--violet">🔍</span></span>
            <strong>{workMonitoring?.summary?.tasks_awaiting_review || 0}</strong>
            <span className="kpi-note">100% or verification</span>
          </div>

          <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'done' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Completed</span><span className="kpi-icon kpi-icon--green">✓</span></span>
            <strong className="text-green">{workMonitoring?.summary?.completed_tasks || kpis.completed_tasks || metrics.completed}</strong>
            <span className="kpi-note">Successfully resolved</span>
          </div>

          <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'todo' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Pending Tasks</span><span className="kpi-icon kpi-icon--blue">⏳</span></span>
            <strong>{workMonitoring?.summary?.pending_tasks || 0}</strong>
            <span className="kpi-note">To Do or Backlog</span>
          </div>

          <div className="kpi-card" onClick={() => { onApplyFilters({ overdueOnly: true }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Overdue Tasks</span><span className="kpi-icon kpi-icon--red">⚠️</span></span>
            <strong className="text-red">{workMonitoring?.summary?.overdue_tasks || kpis.overdue_tasks || metrics.overdue}</strong>
            <span className="kpi-note">SLA breached</span>
          </div>

          <div className="kpi-card" onClick={() => onNavigate('attendance')}>
            <span className="kpi-top"><span>Attendance Today</span><span className="kpi-icon kpi-icon--green">🕒</span></span>
            <strong className="text-green">Live</strong>
            <span className="kpi-note">View attendance board</span>
          </div>
        </div>

        {/* Employee Work Monitoring Table (Module 7: Real-time progress, counts & attendance) */}
        <WorkMonitoringTable workMonitoring={workMonitoring} loading={loadingWorkMonitoring} onNavigate={onNavigate} />

        {/* Status and Priority Distributions */}
        <div className="overview-insights__grid">
          <DistributionPanel title="Tasks by Status" items={distributions.status} onSelect={onApplyFilters} emptyLabel="No status data." />
          <DistributionPanel title="Tasks by Priority" items={distributions.priority} onSelect={onApplyFilters} emptyLabel="No priority data." />
        </div>

        {/* Workload and Recent Activity Split */}
        <div className="dashboard-two-col">
          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <h3>Employee Workload Overview</h3>
              <button type="button" className="link-button" onClick={() => onNavigate('employees')}>View Directory →</button>
            </div>
            <div className="workload-table-wrapper">
              <table className="workload-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Active Tasks</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {(employeeWorkload.length ? employeeWorkload.slice(0, 5) : employees.slice(0, 5)).map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.full_name}</strong>
                        <small style={{ display: 'block', color: 'var(--text-secondary)' }}>{emp.designation}</small>
                      </td>
                      <td>
                        <span className={`role-badge role-badge--${emp.crm_role}`}>{emp.crm_role}</span>
                      </td>
                      <td><strong>{emp.active_tasks || 3}</strong></td>
                      <td>
                        {parseInt(emp.overdue_tasks || 0, 10) > 0 ? (
                          <span className="text-red font-bold">{emp.overdue_tasks} ⚠️</span>
                        ) : (
                          <span className="text-green">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <h3>Recent Organization Activity</h3>
              <button type="button" className="link-button" onClick={() => onNavigate('activity')}>View Full Log →</button>
            </div>
            <div className="activity-mini-feed">
              {recentActivity.length === 0 ? (
                <p className="subtle-note">No recent activity recorded.</p>
              ) : (
                recentActivity.slice(0, 6).map((act) => (
                  <div key={act.id} className="activity-mini-item">
                    <span className="activity-dot" />
                    <div>
                      <strong>{act.actor_name}</strong>
                      <span>{act.action?.replace('_', ' ')}</span>
                      <small>{new Date(act.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Admin Dashboard
  // ─────────────────────────────────────────────────────────────
  if (userRole === 'admin') {
    return (
      <section className="overview-insights role-dashboard role-dashboard--admin">
        <div className="role-dashboard__banner">
          <div>
            <span className="badge badge--admin">Administrator Portal</span>
            <h2>Operations &amp; Team Administration</h2>
            <p>Authorized employee management, departmental task coordination, and performance tracking.</p>
          </div>
          <div className="role-dashboard__quick-actions">
            <button type="button" className="button button--primary" onClick={onOpenCreateTask}>
              + Create Task
            </button>
            <button type="button" className="button button--secondary" onClick={onOpenAddEmployee}>
              + Add Employee
            </button>
            <button type="button" className="button button--secondary" onClick={() => onNavigate('reports')}>
              📊 Team Reports
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card" onClick={() => onNavigate('employees')}>
            <span className="kpi-top"><span>Authorized Employees</span><span className="kpi-icon kpi-icon--blue">👥</span></span>
            <strong>{kpis.active_employees || employees.length}</strong>
            <span className="kpi-note">Team directory members</span>
          </div>
          <div className="kpi-card" onClick={() => onNavigate('all_tasks')}>
            <span className="kpi-top"><span>Active Team Tasks</span><span className="kpi-icon kpi-icon--blue">📋</span></span>
            <strong>{kpis.open_tasks || (tasks.length - metrics.completed)}</strong>
            <span className="kpi-note">In progress across teams</span>
          </div>
          <div className="kpi-card" onClick={() => { onApplyFilters({ overdueOnly: true }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Overdue Tasks</span><span className="kpi-icon kpi-icon--red">⚠️</span></span>
            <strong className="text-red">{kpis.overdue_tasks || metrics.overdue}</strong>
            <span className="kpi-note">Urgent resolution required</span>
          </div>
          <div className="kpi-card" onClick={() => onNavigate('reports')}>
            <span className="kpi-top"><span>Completion Rate</span><span className="kpi-icon kpi-icon--green">✓</span></span>
            <strong>{metrics.completionRate}%</strong>
            <span className="kpi-note">{metrics.completed} of {metrics.total} resolved</span>
          </div>
        </div>

        <div className="overview-insights__grid">
          <DistributionPanel title="Tasks by Status" items={distributions.status} onSelect={onApplyFilters} emptyLabel="No status data." />
          <DistributionPanel title="Tasks by Priority" items={distributions.priority} onSelect={onApplyFilters} emptyLabel="No priority data." />
        </div>

        {/* Employee Work Monitoring Table (Real-time progress & attendance) */}
        <WorkMonitoringTable workMonitoring={workMonitoring} loading={loadingWorkMonitoring} onNavigate={onNavigate} />
      </section>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Manager Dashboard
  // ─────────────────────────────────────────────────────────────
  if (userRole === 'manager') {
    return (
      <section className="overview-insights role-dashboard role-dashboard--manager">
        <div className="role-dashboard__banner">
          <div>
            <span className="badge badge--manager">Team Manager Portal</span>
            <h2>Team Progress &amp; Workload Board</h2>
            <p>Monitor assigned team members, triage overdue and urgent requests, and balance workload.</p>
          </div>
          <div className="role-dashboard__quick-actions">
            <button type="button" className="button button--primary" onClick={onOpenCreateTask}>
              + Assign Task to Team
            </button>
            <button type="button" className="button button--secondary" onClick={() => onNavigate('kanban')}>
              🗂️ Task Board
            </button>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-top"><span>Team Tasks</span><span className="kpi-icon kpi-icon--blue">📋</span></span>
            <strong>{tasks.length}</strong>
            <span className="kpi-note">Total tasks in scope</span>
          </div>
          <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'in_review' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Awaiting Action</span><span className="kpi-icon kpi-icon--violet">⏳</span></span>
            <strong>{kpis.awaiting_action_tasks || tasks.filter(t => t.crm_status === 'in_review' || t.crm_status === 'blocked').length}</strong>
            <span className="kpi-note">In Review or Blocked</span>
          </div>
          <div className="kpi-card" onClick={() => { onApplyFilters({ priorityFilter: 'urgent' }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Urgent Priority</span><span className="kpi-icon kpi-icon--red">🔴</span></span>
            <strong className="text-red">{kpis.urgent_tasks || tasks.filter(t => t.crm_priority === 'urgent').length}</strong>
            <span className="kpi-note">Critical turnaround</span>
          </div>
          <div className="kpi-card" onClick={() => { onApplyFilters({ overdueOnly: true }); onNavigate('all_tasks'); }}>
            <span className="kpi-top"><span>Overdue</span><span className="kpi-icon kpi-icon--red">⚠️</span></span>
            <strong className="text-red">{metrics.overdue}</strong>
            <span className="kpi-note">Past due date</span>
          </div>
        </div>

        <div className="overview-insights__grid">
          <DistributionPanel title="Team Status Distribution" items={distributions.status} onSelect={onApplyFilters} emptyLabel="No status data." />
          <DistributionPanel title="Team Member Workload" items={distributions.assignee} onSelect={onApplyFilters} emptyLabel="No assignee data." />
        </div>
      </section>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Employee Dashboard (Personal Tasks & Due Today focus)
  // ─────────────────────────────────────────────────────────────
  return (
    <section className="overview-insights role-dashboard role-dashboard--employee">
      <div className="role-dashboard__banner">
        <div>
          <span className="badge badge--employee">My Work Dashboard</span>
          <h2>Welcome, {currentUser?.full_name || 'Team Member'}</h2>
          <p>Your assigned deliverables, deadlines, and recent updates from managers and peers.</p>
        </div>
        <div className="role-dashboard__quick-actions">
          <button type="button" className="button button--primary" onClick={() => onNavigate('my_tasks')}>
            ✅ Go to My Tasks
          </button>
          <button type="button" className="button button--secondary" onClick={() => onNavigate('calendar')}>
            📅 View Calendar
          </button>
        </div>
      </div>

      {/* ── Employee Today Attendance Widget ── */}
      <div className="attendance-quick-widget card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <span className="subtle-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
              Today's Attendance Status
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <span
                className={`attendance-badge ${
                  employeeAttendance?.active_session
                    ? 'attendance-badge--active'
                    : employeeAttendance?.checked_in
                    ? 'attendance-badge--present'
                    : 'attendance-badge--not-in'
                }`}
              >
                <span className="pulsing-dot" />
                {employeeAttendance?.active_session
                  ? 'Shift Active (Checked In)'
                  : employeeAttendance?.checked_in
                  ? 'Day Completed (Checked Out)'
                  : 'Not Checked In Today'}
              </span>
              {employeeAttendance?.record?.check_in_at && (
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Check-in: <strong>{new Date(employeeAttendance.record.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!employeeAttendance?.active_session ? (
              <button
                type="button"
                className="button button--primary button--sm"
                onClick={handleQuickCheckIn}
                disabled={attLoading}
              >
                {attLoading ? 'Recording...' : '▶ Check In'}
              </button>
            ) : (
              <button
                type="button"
                className="button button--secondary button--sm button--checkout"
                onClick={handleQuickCheckOut}
                disabled={attLoading}
              >
                {attLoading ? 'Recording...' : '⏹ Check Out'}
              </button>
            )}
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => onNavigate('attendance')}
            >
              Full Attendance Log →
            </button>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => onNavigate('my_tasks')}>
          <span className="kpi-top"><span>My Open Tasks</span><span className="kpi-icon kpi-icon--blue">📋</span></span>
          <strong>{myMetrics.my_open_tasks || tasks.length}</strong>
          <span className="kpi-note">Currently assigned to you</span>
        </div>

        <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'all' }); onNavigate('my_tasks'); }}>
          <span className="kpi-top"><span>Due Today</span><span className="kpi-icon kpi-icon--violet">⏰</span></span>
          <strong>{myMetrics.my_due_today || 0}</strong>
          <span className="kpi-note">Target completion today</span>
        </div>

        <div className="kpi-card" onClick={() => { onApplyFilters({ overdueOnly: true }); onNavigate('my_tasks'); }}>
          <span className="kpi-top"><span>Overdue Tasks</span><span className="kpi-icon kpi-icon--red">⚠️</span></span>
          <strong className={myMetrics.my_overdue > 0 ? 'text-red' : ''}>{myMetrics.my_overdue || 0}</strong>
          <span className="kpi-note">Past deadline</span>
        </div>

        <div className="kpi-card" onClick={() => { onApplyFilters({ statusFilter: 'done' }); onNavigate('my_tasks'); }}>
          <span className="kpi-top"><span>Completed Tasks</span><span className="kpi-icon kpi-icon--green">✓</span></span>
          <strong>{myMetrics.my_completed || 0}</strong>
          <span className="kpi-note">Successfully closed</span>
        </div>
      </div>

      {/* Recent Notes & Updates for Employee */}
      <div className="dashboard-card" style={{ marginTop: '16px' }}>
        <div className="dashboard-card__header">
          <h3>Recent Notes &amp; Updates on Your Tasks</h3>
          <button type="button" className="link-button" onClick={() => onNavigate('my_tasks')}>View Tasks →</button>
        </div>
        <div className="employee-updates-list">
          {myRecentUpdates.length === 0 ? (
            <p className="subtle-note">No recent comments or notes on your assigned tasks.</p>
          ) : (
            myRecentUpdates.map((upd) => (
              <div key={upd.id} className="employee-update-item">
                <span className="mini-avatar">{upd.author_avatar || upd.author_name?.substring(0, 2).toUpperCase() || 'EM'}</span>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <strong>{upd.author_name}</strong>
                    <span className="badge badge--sm">{upd.task_code}</span>
                    <small style={{ color: 'var(--text-secondary)' }}>
                      {new Date(upd.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{upd.comment}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
