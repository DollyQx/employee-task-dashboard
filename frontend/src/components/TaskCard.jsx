import React from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';
import { daysFromToday, isTaskOverdue } from '../utils/taskMetrics';

export default function TaskCard({ task, view = 'list', onViewDetails }) {
  const { id, task_code, title, employee, status, deadline, urgency, source, asset, department_name } = task;
  const daysUntilDeadline = daysFromToday(deadline);
  const isOverdue = isTaskOverdue(task);
  const isToday = daysUntilDeadline === 0;
  const validDeadline = daysUntilDeadline !== null;
  const dueState = isOverdue ? 'overdue' : isToday ? 'today' : daysUntilDeadline > 0 ? 'upcoming' : validDeadline ? 'completed' : 'unknown';
  const dueLabel = isOverdue
    ? `${Math.abs(daysUntilDeadline)}d overdue`
    : isToday
    ? 'Due today'
    : validDeadline
    ? new Date(deadline.length === 10 ? `${deadline}T00:00:00` : deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    : 'No due date';

  const employeeLabel = employee?.trim() || 'Unassigned';
  const initials = employee?.trim().split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const displayCode = task_code || id || 'WO';
  const sourceLabel = source || 'Plant Order';
  const sourceKey = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'plant';

  return (
    <article className={`task-row${view === 'board' ? ' task-row--board' : ''}${isOverdue ? ' task-row--overdue' : ''}`}>
      <div className="task-main">
        <span className={`source-mark source-mark--${sourceKey}`} aria-hidden="true">
          {displayCode.startsWith('WO') ? '⚙' : sourceLabel === 'CRM' ? 'C' : sourceLabel === 'Helpdesk' ? 'H' : '⚙'}
        </span>
        <div className="task-title-wrap">
          <button
            className="task-title"
            type="button"
            onClick={() => onViewDetails?.(task)}
            aria-label={`View details for ${title || 'untitled work order'}`}
            title="View work order details"
          >
            {title || 'Untitled Work Order'}
            <span className="task-arrow" aria-hidden="true">→</span>
          </button>
          <div className="task-meta-line">
            <span className="task-id-badge">{displayCode}</span>
            {asset && <span className="task-asset-tag">🔧 {asset}</span>}
            {department_name && <span className="task-dept-tag">{department_name}</span>}
            <span className="task-source-inline">• {sourceLabel}</span>
          </div>
        </div>
      </div>
      <div className="task-assignee">
        {initials && <span className="assignee-avatar" title={employeeLabel}>{initials}</span>}
        <span>{employeeLabel}</span>
      </div>
      <div className="task-priority">
        <UrgencyBadge urgency={urgency} />
      </div>
      <div className="task-status">
        <StatusBadge status={status} />
      </div>
      <div
        className={`task-due task-due--${dueState}`}
        title={validDeadline ? `Due ${deadline}${isOverdue ? `, ${Math.abs(daysUntilDeadline)} days overdue` : ''}` : 'No valid due date'}
      >
        <span className="due-dot" aria-hidden="true" />
        <span>{dueLabel}</span>
        {isOverdue && <span className="overdue-label">Overdue</span>}
      </div>
    </article>
  );
}
