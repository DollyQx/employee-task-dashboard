import React, { useState } from 'react';
import { exportTasksCsvApi } from '../api/crm';

export default function ReportsView({
  reportData = {},
  loading = false,
  onRefresh,
}) {
  const [exporting, setExporting] = useState(false);

  const {
    kpis = {},
    statusDistribution = [],
    priorityDistribution = [],
    departmentWorkload = [],
  } = reportData;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await exportTasksCsvApi();
    } catch (err) {
      alert('Failed to export CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const totalStatusTasks = statusDistribution.reduce((acc, cur) => acc + parseInt(cur.count, 10), 0) || 1;
  const totalPriorityTasks = priorityDistribution.reduce((acc, cur) => acc + parseInt(cur.count, 10), 0) || 1;

  return (
    <div className="reports-view">
      <div className="view-header">
        <div>
          <h2>Reports & Analytics</h2>
          <p>Real-time performance indicators, department workload distribution, and CSV export</p>
        </div>
        <div className="view-actions">
          <button type="button" className="button button--secondary" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh Data'}
          </button>
          <button type="button" className="button button--primary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? 'Exporting…' : '📥 Export Tasks CSV'}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-top"><span>Active Staff</span><span className="kpi-icon kpi-icon--blue">👥</span></span>
          <strong>{kpis.active_employees || 0}</strong>
          <span className="kpi-note">Aulten Digital team</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top"><span>Open Tasks</span><span className="kpi-icon kpi-icon--violet">☷</span></span>
          <strong>{kpis.open_tasks || 0}</strong>
          <span className="kpi-note">Across active projects</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top"><span>Tasks Completed</span><span className="kpi-icon kpi-icon--green">✓</span></span>
          <strong>{kpis.completed_tasks || 0}</strong>
          <span className="kpi-note">Closed successfully</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top"><span>Overdue Work</span><span className="kpi-icon kpi-icon--red">!</span></span>
          <strong className={kpis.overdue_tasks > 0 ? 'text-red' : ''}>{kpis.overdue_tasks || 0}</strong>
          <span className="kpi-note">{kpis.due_today || 0} due today</span>
        </div>
      </div>

      <div className="analytics-grid-two">
        {/* Status Distribution */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3>Workflow Status Distribution</h3>
            <span>{totalStatusTasks} total tasks</span>
          </div>
          <div className="chart-bars-list">
            {statusDistribution.map((st) => {
              const count = parseInt(st.count, 10);
              const pct = Math.round((count / totalStatusTasks) * 100);
              const colorMap = {
                backlog: '#8d98b2',
                todo: '#70a7ff',
                in_progress: '#8d82ff',
                in_review: '#e9b86c',
                blocked: '#ef737e',
                done: '#5ac99a',
              };
              const barColor = colorMap[st.status] || '#8d98b2';

              return (
                <div key={st.status} className="chart-bar-item">
                  <div className="chart-bar-label">
                    <span className="bar-tag">{st.status}</span>
                    <span className="bar-nums">{count} tasks ({pct}%)</span>
                  </div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3>Task Priority Distribution</h3>
            <span>Urgency breakdown</span>
          </div>
          <div className="chart-bars-list">
            {priorityDistribution.map((pr) => {
              const count = parseInt(pr.count, 10);
              const pct = Math.round((count / totalPriorityTasks) * 100);
              const colorMap = {
                urgent: '#ef737e',
                high: '#f28e2b',
                medium: '#70a7ff',
                low: '#5ac99a',
              };
              const barColor = colorMap[pr.priority] || '#70a7ff';

              return (
                <div key={pr.priority} className="chart-bar-item">
                  <div className="chart-bar-label">
                    <span className="bar-tag">{pr.priority}</span>
                    <span className="bar-nums">{count} tasks ({pct}%)</span>
                  </div>
                  <div className="chart-bar-track">
                    <div className="chart-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department Workload Table */}
      <div className="analytics-card full-width">
        <div className="analytics-card-header">
          <h3>Department Productivity & Workload</h3>
          <span>Operational task counts by business division</span>
        </div>
        <div className="table-responsive">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Total Tasks</th>
                <th>Open Tasks</th>
                <th>Closed</th>
                <th>Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {departmentWorkload.map((dept) => {
                const total = parseInt(dept.total_tasks || 0, 10);
                const open = parseInt(dept.open_tasks || 0, 10);
                const completed = parseInt(dept.completed_tasks || 0, 10);
                const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <tr key={dept.id}>
                    <td><strong>{dept.department_name}</strong></td>
                    <td><span className="dept-code-badge">{dept.department_code}</span></td>
                    <td>{total}</td>
                    <td><span className={open > 5 ? 'text-amber' : ''}>{open}</span></td>
                    <td><span className="text-green">{completed}</span></td>
                    <td>
                      <div className="table-progress">
                        <div className="table-progress-bar" style={{ width: `${rate}%` }} />
                        <span>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
