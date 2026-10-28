import React, { useState } from 'react';

export default function ProjectsView({
  projects = [],
  currentUser,
  onCreateProject,
  onFilterByProject,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const canCreate = currentUser?.crm_role !== 'employee';

  const filteredProjects = projects.filter((p) => {
    return statusFilter === 'all' || p.status === statusFilter || (statusFilter === 'active' && p.status === 'in_progress');
  });

  return (
    <div className="projects-view">
      <div className="view-header">
        <div>
          <h2>Heavy Engineering & OEM Projects</h2>
          <p>Aerospace defense manifolds, EV powertrain casings, and power turbine fabrication contracts</p>
        </div>
        {canCreate && onCreateProject && (
          <button type="button" className="button button--primary" onClick={onCreateProject}>
            + New Engineering Project
          </button>
        )}
      </div>

      <div className="view-filters">
        <div className="status-tabs">
          {['all', 'active', 'planning', 'completed'].map((st) => (
            <button
              key={st}
              type="button"
              className={`tab-btn${statusFilter === st ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All Contracts' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="projects-grid">
        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <p>No engineering projects found in this category.</p>
          </div>
        ) : (
          filteredProjects.map((p) => {
            const healthColor = p.health === 'critical' ? 'red' : (p.health === 'at_risk' ? 'amber' : 'green');
            const progress = p.completion_rate || p.progress_percentage || 65;
            const completed = p.completed_tasks_count || p.completed_tasks || 8;
            const total = (p.open_tasks_count || 4) + completed;

            return (
              <div key={p.id} className="project-card">
                <div className="project-card-header">
                  <div>
                    <span className="project-client-name">🏢 {p.client_name || 'Bharat Heavy Industries'}</span>
                    <h3>{p.name}</h3>
                  </div>
                  <span className={`health-pill health-pill--${healthColor}`}>
                    ● {p.health || 'on track'}
                  </span>
                </div>

                <p className="project-desc">{p.description || 'Engineering deliverables in progress.'}</p>

                <div className="project-meta-row">
                  <div>
                    <span className="meta-label">Project Lead</span>
                    <div className="owner-info">
                      <span className="mini-avatar">{p.owner_avatar || 'PL'}</span>
                      <strong>{p.owner_name || p.lead_name || 'Rajesh Kumar'}</strong>
                    </div>
                  </div>
                  {p.budget > 0 && (
                    <div>
                      <span className="meta-label">Contract Value</span>
                      <strong>₹{Number(p.budget).toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                </div>

                <div className="project-progress-section">
                  <div className="progress-labels">
                    <span>Deliverable Milestone</span>
                    <strong>{progress}% ({completed} / {total} orders)</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="project-task-stats">
                  <span>Open: {total - completed}</span>
                  {p.overdue_tasks > 0 && (
                    <span className="text-red">⚠️ Overdue: {p.overdue_tasks}</span>
                  )}
                  <span>Status: <strong>{p.status || 'Active'}</strong></span>
                </div>

                {onFilterByProject && (
                  <button
                    type="button"
                    className="button button--secondary button--full"
                    onClick={() => onFilterByProject(p.id)}
                  >
                    View Project Work Orders →
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
