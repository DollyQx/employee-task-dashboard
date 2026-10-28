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
    return statusFilter === 'all' || p.status === statusFilter;
  });

  return (
    <div className="projects-view">
      <div className="view-header">
        <div>
          <h2>Projects Management</h2>
          <p>Active enterprise client engagements, milestone health, and progress metrics</p>
        </div>
        {canCreate && onCreateProject && (
          <button type="button" className="button button--primary" onClick={onCreateProject}>
            + New Project
          </button>
        )}
      </div>

      <div className="view-filters">
        <div className="status-tabs">
          {['all', 'active', 'planning', 'completed', 'on_hold'].map((st) => (
            <button
              key={st}
              type="button"
              className={`tab-btn${statusFilter === st ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All Projects' : st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="projects-grid">
        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <p>No projects in this category.</p>
          </div>
        ) : (
          filteredProjects.map((p) => {
            const healthColor = p.health === 'critical' ? 'red' : (p.health === 'at_risk' ? 'amber' : 'green');
            const progress = p.progress_percentage || 0;

            return (
              <div key={p.id} className="project-card">
                <div className="project-card-header">
                  <div>
                    <span className="project-client-name">🏢 {p.client_name || 'Internal Aulten'}</span>
                    <h3>{p.name}</h3>
                  </div>
                  <span className={`health-pill health-pill--${healthColor}`}>
                    ● {p.health}
                  </span>
                </div>

                <p className="project-desc">{p.description || 'Project deliverables in progress.'}</p>

                <div className="project-meta-row">
                  <div>
                    <span className="meta-label">Lead / Owner</span>
                    <div className="owner-info">
                      <span className="mini-avatar">{p.owner_avatar || 'PL'}</span>
                      <strong>{p.owner_name || 'Aulten Lead'}</strong>
                    </div>
                  </div>
                  {p.budget > 0 && (
                    <div>
                      <span className="meta-label">Budget</span>
                      <strong>₹{Number(p.budget).toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                </div>

                <div className="project-progress-section">
                  <div className="progress-labels">
                    <span>Deliverable Progress</span>
                    <strong>{progress}% ({p.completed_tasks} / {p.total_tasks} tasks)</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="project-task-stats">
                  <span>Open: {p.total_tasks - p.completed_tasks}</span>
                  {p.overdue_tasks > 0 && (
                    <span className="text-red">⚠️ Overdue: {p.overdue_tasks}</span>
                  )}
                  <span>Status: <strong>{p.status}</strong></span>
                </div>

                {onFilterByProject && (
                  <button
                    type="button"
                    className="button button--secondary button--full"
                    onClick={() => onFilterByProject(p.id)}
                  >
                    View Project Tasks →
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
