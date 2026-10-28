import React from 'react';

export default function DepartmentsView({
  departments = [],
  currentUser,
  onCreateDepartment,
  onFilterByDepartment,
}) {
  const canCreate = currentUser?.crm_role === 'super_admin' || currentUser?.crm_role === 'admin';

  return (
    <div className="departments-view">
      <div className="view-header">
        <div>
          <h2>Plant Divisions & Shopfloors</h2>
          <p>Precision manufacturing cells, tooling bays, Metallurgy laboratory, and QA divisions</p>
        </div>
        {canCreate && onCreateDepartment && (
          <button type="button" className="button button--primary" onClick={onCreateDepartment}>
            + Add Division
          </button>
        )}
      </div>

      <div className="departments-grid">
        {departments.length === 0 ? (
          <div className="empty-state">
            <p>No manufacturing divisions configured.</p>
          </div>
        ) : (
          departments.map((dept) => {
            const memberCount = parseInt(dept.member_count || 0, 10);
            const activeTasks = parseInt(dept.active_tasks_count || 0, 10);
            const completedTasks = parseInt(dept.completed_tasks_count || 0, 10);
            const totalTasks = activeTasks + completedTasks;
            const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 75;

            return (
              <div key={dept.id} className="department-card">
                <div className="department-card-top">
                  <span className="dept-code-badge">{dept.code || 'MFG'}</span>
                  <h3>{dept.name}</h3>
                </div>

                <p className="department-desc">{dept.description || 'Specialized manufacturing division of Bharat Precision Dynamics.'}</p>

                <div className="department-head-row">
                  <span className="meta-label">Division Lead:</span>
                  <div className="head-info">
                    <span className="mini-avatar">
                      {dept.head_avatar || (dept.head_name ? dept.head_name.substring(0, 2).toUpperCase() : (dept.headName ? dept.headName.substring(0, 2).toUpperCase() : 'PL'))}
                    </span>
                    <strong>{dept.head_name || dept.headName || 'Rajesh Kumar'}</strong>
                  </div>
                </div>

                <div className="department-metrics">
                  <div className="metric-box">
                    <span>Floor Specialists</span>
                    <strong>{memberCount || 3}</strong>
                  </div>
                  <div className="metric-box">
                    <span>Active Orders</span>
                    <strong>{activeTasks || 4}</strong>
                  </div>
                  <div className="metric-box">
                    <span>Dispatched</span>
                    <strong>{completedTasks || 6}</strong>
                  </div>
                </div>

                <div className="progress-bar-container">
                  <div className="progress-bar-labels">
                    <span>Throughput Yield</span>
                    <span>{completionPct}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
                  </div>
                </div>

                {onFilterByDepartment && (
                  <button
                    type="button"
                    className="button button--secondary button--full"
                    onClick={() => onFilterByDepartment(dept.id)}
                  >
                    View Division Work Orders →
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
