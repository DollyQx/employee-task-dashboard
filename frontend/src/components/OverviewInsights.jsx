import React, { useMemo } from 'react';
import { UNASSIGNED_EMPLOYEE, getTaskMetrics } from '../utils/taskMetrics';

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
    <section className="analytics-panel overview-distribution">
      <header className="analytics-panel__header"><div><h2>{title}</h2><p>Current task snapshot</p></div></header>
      {items.length ? <div className="overview-distribution__items">
        {items.map((item) => (
          <button type="button" className="overview-distribution__item" key={item.key} onClick={() => onSelect(item.filter)} aria-label={`View ${item.count} ${item.label} tasks`}>
            <span className="overview-distribution__label">{item.label}</span>
            <span className="analytics-bar-track" aria-hidden="true"><i style={{ width: `${(item.count / max) * 100}%` }} /></span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </div> : <p className="overview-distribution__empty">{emptyLabel}</p>}
    </section>
  );
}

export default function OverviewInsights({ tasks, onApplyFilters }) {
  const metrics = getTaskMetrics(tasks);
  const distributions = useMemo(() => ({
    status: entriesFor(tasks, (task) => task.status || 'unknown', (task) => task.status || 'Unknown')
      .map((item) => ({ ...item, label: item.key === 'in-progress' ? 'In progress' : item.key === 'pending' ? 'To do' : item.label, filter: { statusFilter: item.key } })),
    source: entriesFor(tasks, (task) => task.source?.toLowerCase() || 'unknown', (task) => task.source || 'Unknown')
      .map((item) => ({ ...item, filter: { sourceFilter: item.key } })),
    priority: entriesFor(tasks, (task) => task.urgency?.toLowerCase() || 'unknown', (task) => task.urgency || 'Unknown')
      .map((item) => ({ ...item, filter: { priorityFilter: item.key } })),
    assignee: entriesFor(tasks, (task) => task.employee?.trim() || UNASSIGNED_EMPLOYEE, (task) => task.employee?.trim() || 'Unassigned')
      .map((item) => ({ ...item, filter: { employeeFilter: item.key } })),
  }), [tasks]);

  return (
    <section className="overview-insights" aria-label="Current task distribution">
      <header className="overview-insights__heading"><div><h2>Workload at a glance</h2><p>Current snapshot · completion rate: {metrics.completionRate}% ({metrics.completed} completed ÷ {metrics.total} total)</p></div></header>
      <div className="overview-insights__grid">
        <DistributionPanel title="By status" items={distributions.status} onSelect={onApplyFilters} emptyLabel="No status data available." />
        <DistributionPanel title="By source" items={distributions.source} onSelect={onApplyFilters} emptyLabel="No source data available." />
        <DistributionPanel title="By priority" items={distributions.priority} onSelect={onApplyFilters} emptyLabel="No priority data available." />
        <DistributionPanel title="By assignee" items={distributions.assignee} onSelect={onApplyFilters} emptyLabel="No assignee data available." />
      </div>
      <p className="overview-insights__overdue">{metrics.overdue} currently overdue · completed tasks excluded</p>
    </section>
  );
}
