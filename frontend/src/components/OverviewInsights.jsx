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
      <header className="analytics-panel__header">
        <div>
          <h2>{title}</h2>
          <p>Plant shopfloor distribution</p>
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
    </section>
  );
}

export default function OverviewInsights({ tasks, onApplyFilters }) {
  const metrics = getTaskMetrics(tasks);
  const distributions = useMemo(() => ({
    status: entriesFor(tasks, (task) => task.crm_status || task.status || 'unknown', (task) => {
      const s = task.crm_status || task.status;
      if (s === 'in_progress' || s === 'in-progress') return 'In Machining';
      if (s === 'todo' || s === 'pending') return 'Shift Queue';
      if (s === 'in_review') return 'QA Review';
      if (s === 'blocked') return 'Maintenance Hold';
      if (s === 'done' || s === 'completed') return 'Completed / Dispatched';
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

  return (
    <section className="overview-insights" aria-label="Plant work order distribution">
      <header className="overview-insights__heading">
        <div>
          <h2>Plant Operations & Floor Telemetry</h2>
          <p>
            Current throughput • <strong>{metrics.completionRate}%</strong> completion rate ({metrics.completed} completed • {metrics.total} total work orders)
          </p>
        </div>
      </header>
      <div className="overview-insights__grid">
        <DistributionPanel title="By Shopfloor Status" items={distributions.status} onSelect={onApplyFilters} emptyLabel="No status data available." />
        <DistributionPanel title="By Manufacturing Division" items={distributions.department} onSelect={onApplyFilters} emptyLabel="No division data available." />
        <DistributionPanel title="By Safety & Urgency Level" items={distributions.priority} onSelect={onApplyFilters} emptyLabel="No priority data available." />
        <DistributionPanel title="By Specialist Assignee" items={distributions.assignee} onSelect={onApplyFilters} emptyLabel="No assignee data available." />
      </div>
      <p className="overview-insights__overdue">
        ⚠️ <strong>{metrics.overdue}</strong> critical work orders currently overdue • Requires floor supervisor review
      </p>
    </section>
  );
}
