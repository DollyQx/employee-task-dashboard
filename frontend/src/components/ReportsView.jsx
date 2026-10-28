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
          <h2>Plant Telemetry & OEE Analytics</h2>
          <p>Real-time manufacturing KPIs, division workloads, shift yield, and CSV export</p>
        </div>
        <div className="view-actions">
          <button type="button" className="button button--secondary" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
          <button type="button" className="button button--primary" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? 'Generating CSV...' : '📥 Export Work Orders CSV'}
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-top">
            <span>Plant Workforce</span>
            <span className="kpi-icon kpi-icon--blue">👷</span>
          </span>
          <strong>{kpis.active_employees || 18}</strong>
          <span className="kpi-note">18 Indian specialists active</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top">
            <span>Active Work Orders</span>
            <span className="kpi-icon kpi-icon--violet">⚙️</span>
          </span>
          <strong>{kpis.open_tasks || 36}</strong>
          <span className="kpi-note">Across 12 plant divisions</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top">
            <span>Orders Dispatched</span>
            <span className="kpi-icon kpi-icon--green">✓</span>
          </span>
          <strong>{kpis.completed_tasks || 16}</strong>
          <span className="kpi-note">Passed QA inspection</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-top">
            <span>Critical Overdue</span>
            <span className="kpi-icon kpi-icon--red">⚠️</span>
          </span>
          <strong className={(kpis.overdue_tasks || 4) > 0 ? 'text-red' : ''}>
            {kpis.overdue_tasks || 4}
          </strong>
          <span className="kpi-note">{kpis.due_today || 5} due today</span>
        </div>
      </div>

      <div className="analytics-grid-two">
        {/* Status Distribution */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3>Work Order Status Breakdown</h3>
            <span>{totalStatusTasks} Orders Tracked</span>
          </div>
          <div className="breakdown-list">
            {statusDistribution.map((item) => {
              const count = parseInt(item.count, 10);
              const pct = Math.round((count / totalStatusTasks) * 100);
              const label =
                item.status === 'in_progress' ? 'In Machining' :
                item.status === 'todo' ? 'Shift Queue' :
                item.status === 'in_review' ? 'QA & Metrology' :
                item.status === 'blocked' ? 'Maintenance Hold' :
                item.status === 'done' ? 'Completed & Dispatched' : 'Backlog';

              return (
                <div key={item.status} className="breakdown-row">
                  <div className="breakdown-row-top">
                    <span className="breakdown-label">{label}</span>
                    <span className="breakdown-val"><strong>{count}</strong> ({pct}%)</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3>Urgency & Safety Criticality</h3>
            <span>Target: Zero High-Severity Delays</span>
          </div>
          <div className="breakdown-list">
            {priorityDistribution.map((item) => {
              const count = parseInt(item.count, 10);
              const pct = Math.round((count / totalPriorityTasks) * 100);
              return (
                <div key={item.priority} className="breakdown-row">
                  <div className="breakdown-row-top">
                    <span className="breakdown-label" style={{ textTransform: 'uppercase' }}>
                      {item.priority === 'urgent' ? '🔴 CRITICAL / HAZARD' :
                       item.priority === 'high' ? '🟠 HIGH PRIORITY' :
                       item.priority === 'medium' ? '🟡 STANDARD SHIFT' : '🟢 LOW / ROUTINE'}
                    </span>
                    <span className="breakdown-val"><strong>{count}</strong> ({pct}%)</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          item.priority === 'urgent' ? 'var(--red)' :
                          item.priority === 'high' ? 'var(--amber)' :
                          item.priority === 'medium' ? 'var(--blue)' : 'var(--green)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department Workload */}
      <div className="analytics-card" style={{ marginTop: '24px' }}>
        <div className="analytics-card-header">
          <h3>Shopfloor Division Work Order Load</h3>
          <span>Resource & Equipment Balancing</span>
        </div>
        <div className="department-workload-grid">
          {departmentWorkload.map((dw) => (
            <div key={dw.department} className="workload-tile">
              <span className="dept-tile-name">🏭 {dw.department}</span>
              <strong className="dept-tile-count">{dw.count} active</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
