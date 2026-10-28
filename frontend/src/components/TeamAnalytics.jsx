import React, { useMemo, useState } from 'react';

const UNASSIGNED_KEY = '__unassigned__';

function isOverdue(task) {
  if (task.status === 'completed') return false;

  if (Number.isFinite(task.daysFromToday)) {
    return task.daysFromToday < 0;
  }

  if (!task.deadline || Number.isNaN(Date.parse(`${task.deadline}T00:00:00`))) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${task.deadline}T00:00:00`);
  return deadline < today;
}

function rate(completed, total) {
  return total ? Math.round((completed / total) * 100) : 0;
}

function employeeLabel(employee) {
  return employee?.trim() || 'Unassigned';
}

function statusLabel(status) {
  if (status === 'in-progress') return 'In progress';
  if (status === 'pending') return 'To do';
  if (status === 'completed') return 'Completed';
  return status;
}

export default function TeamAnalytics({ tasks, onSelectEmployee }) {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const scopedTasks = useMemo(() => tasks.filter((task) => {
    const matchesSource = sourceFilter === 'all'
      || task.source?.toLowerCase() === sourceFilter;
    const matchesPriority = priorityFilter === 'all'
      || task.urgency?.toLowerCase() === priorityFilter;
    return matchesSource && matchesPriority;
  }), [tasks, sourceFilter, priorityFilter]);

  const metrics = useMemo(() => {
    const completed = scopedTasks.filter((task) => task.status === 'completed').length;
    const overdue = scopedTasks.filter(isOverdue).length;
    return {
      total: scopedTasks.length,
      completed,
      open: scopedTasks.length - completed,
      overdue,
      completionRate: rate(completed, scopedTasks.length),
    };
  }, [scopedTasks]);

  const employeeStats = useMemo(() => {
    const groups = new Map();
    scopedTasks.forEach((task) => {
      const key = task.employee?.trim() || UNASSIGNED_KEY;
      const label = employeeLabel(task.employee);
      if (!groups.has(key)) {
        groups.set(key, { label, key, total: 0, open: 0, overdue: 0, completed: 0 });
      }
      const group = groups.get(key);
      group.total += 1;
      if (task.status === 'completed') group.completed += 1;
      else group.open += 1;
      if (isOverdue(task)) group.overdue += 1;
    });
    return [...groups.values()]
      .map((group) => ({ ...group, completionRate: rate(group.completed, group.total) }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [scopedTasks]);

  const statusStats = useMemo(() => {
    const counts = new Map();
    scopedTasks.forEach((task) => {
      const status = task.status || 'Unknown';
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [scopedTasks]);

  const maximumEmployeeTasks = Math.max(1, ...employeeStats.map((employee) => employee.total));
  const maximumStatusTasks = Math.max(1, ...statusStats.map(([, count]) => count));
  const hasUnassigned = scopedTasks.some((task) => !task.employee?.trim());

  return (
    <section className="analytics-page" aria-labelledby="analytics-title">
      <div className="welcome-row analytics-welcome">
        <div>
          <p className="eyebrow">TEAM PERFORMANCE</p>
          <h1 id="analytics-title">Team Analytics<span className="heading-period">.</span></h1>
          <p>Workload and completion, calculated from the tasks currently available.</p>
        </div>
        <div className="analytics-filters" aria-label="Analytics filters">
          <label className="analytics-filter">
            <span>Source</span>
            <select className="filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter analytics by source">
              <option value="all">All sources</option>
              <option value="crm">CRM</option>
              <option value="helpdesk">Helpdesk</option>
            </select>
          </label>
          <label className="analytics-filter">
            <span>Priority</span>
            <select className="filter-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter analytics by priority">
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
      </div>

      {scopedTasks.length === 0 ? (
        <div className="analytics-empty" role="status">
          <span className="analytics-empty__mark" aria-hidden="true">∅</span>
          <h2>No task data for these filters</h2>
          <p>Choose another source or priority to view available workload.</p>
        </div>
      ) : (
        <>
          <section className="analytics-summary" aria-label="Team task summary">
            <article className="analytics-metric"><span>Total tasks</span><strong>{metrics.total}</strong><small>In the selected scope</small></article>
            <article className="analytics-metric"><span>Open tasks</span><strong>{metrics.open}</strong><small>Not completed</small></article>
            <article className="analytics-metric analytics-metric--overdue"><span>Overdue tasks</span><strong>{metrics.overdue}</strong><small>Excludes completed tasks</small></article>
            <article className="analytics-metric analytics-metric--complete"><span>Completed</span><strong>{metrics.completed}</strong><small>Marked completed</small></article>
            <article className="analytics-metric analytics-metric--rate"><span>Completion rate</span><strong>{metrics.completionRate}%</strong><small>Completed / total</small></article>
          </section>

          <section className="analytics-charts" aria-label="Task distribution charts">
            <article className="analytics-panel">
              <header className="analytics-panel__header"><div><h2>Workload by assignee</h2><p>Tasks assigned in the selected scope</p></div><span className="chart-total">{metrics.total} tasks</span></header>
              <div className="analytics-bars" role="list" aria-label="Tasks by assignee">
                {employeeStats.map((employee) => (
                  <div className="analytics-bar-row" role="listitem" key={employee.label}>
                    <span className="analytics-bar-label" title={employee.label}>{employee.label}</span>
                    <div className="analytics-bar-track" role="img" aria-label={`${employee.label}: ${employee.total} ${employee.total === 1 ? 'task' : 'tasks'}`}><span className="analytics-bar-fill analytics-bar-fill--employee" style={{ width: `${(employee.total / maximumEmployeeTasks) * 100}%` }} /></div>
                    <strong className="analytics-bar-value">{employee.total}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="analytics-panel">
              <header className="analytics-panel__header"><div><h2>Tasks by status</h2><p>Current distribution</p></div><span className="chart-total">{metrics.total} tasks</span></header>
              <div className="analytics-bars" role="list" aria-label="Tasks by status">
                {statusStats.map(([status, count]) => (
                  <div className="analytics-bar-row analytics-bar-row--status" role="listitem" key={status}>
                    <span className="analytics-bar-label">{statusLabel(status)}</span>
                    <div className="analytics-bar-track" role="img" aria-label={`${statusLabel(status)}: ${count} ${count === 1 ? 'task' : 'tasks'}`}><span className={`analytics-bar-fill analytics-bar-fill--${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{ width: `${(count / maximumStatusTasks) * 100}%` }} /></div>
                    <strong className="analytics-bar-value">{count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="analytics-panel analytics-workload">
            <header className="analytics-panel__header"><div><h2>Employee workload</h2><p>Select an assignee to open their tasks.</p></div><span className="chart-total">{employeeStats.length} {employeeStats.length === 1 ? 'assignee' : 'assignees'}</span></header>
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead><tr><th scope="col">Employee</th><th scope="col">Total assigned</th><th scope="col">Open</th><th scope="col">Overdue</th><th scope="col">Completed</th><th scope="col">Completion rate</th></tr></thead>
                <tbody>{employeeStats.map((employee) => (
                  <tr key={employee.key}>
                    <th scope="row"><button className="analytics-employee-link" type="button" onClick={() => onSelectEmployee(employee.key)} aria-label={`View tasks for ${employee.label}`}><span className="analytics-avatar" aria-hidden="true">{employee.key === UNASSIGNED_KEY ? '?' : employee.label.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span>{employee.label}</span><span className="analytics-row-arrow" aria-hidden="true">↗</span></button></th>
                    <td>{employee.total}</td><td>{employee.open}</td><td className={employee.overdue > 0 ? 'analytics-overdue-value' : ''}>{employee.overdue}</td><td>{employee.completed}</td>
                    <td><span className="analytics-rate"><span className="analytics-rate__track"><i style={{ width: `${employee.completionRate}%` }} /></span><span>{employee.completionRate}%</span></span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {hasUnassigned && <p className="analytics-table-note">Unassigned tasks are grouped separately and included in the totals.</p>}
          </section>
        </>
      )}
    </section>
  );
}
