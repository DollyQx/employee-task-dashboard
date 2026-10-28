import React from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';

export default function TaskCard({ task, view = 'list', onViewDetails }) {
  const { id, title, employee, status, deadline, urgency, source, sourceUrl, daysFromToday } = task;
  const isOverdue = daysFromToday < 0 && status !== 'completed';
  const isToday = daysFromToday === 0;
  const dueState = isOverdue ? 'overdue' : isToday ? 'today' : daysFromToday > 0 ? 'upcoming' : 'completed';
  const dueLabel = isOverdue
    ? `${Math.abs(daysFromToday)}d overdue`
    : isToday ? 'Due today' : new Date(`${deadline}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const employeeLabel = employee?.trim() || 'Unassigned';
  const initials = employee?.trim().split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const sourceKey = source.toLowerCase().replace(/\s+/g, '-');

  return (
    <article className={`task-row${view === 'board' ? ' task-row--board' : ''}${isOverdue ? ' task-row--overdue' : ''}`}>
      <div className="task-main">
        <span className={`source-mark source-mark--${sourceKey}`} aria-hidden="true">{source === 'CRM' ? 'C' : 'H'}</span>
        <div className="task-title-wrap">
          <button className="task-title" type="button" onClick={() => onViewDetails(task)} aria-label={`View details for ${title}`} title="View task details">{title}<span aria-hidden="true">›</span></button>
          <span className="task-id">{id} <span className="task-source-inline">· {source}</span></span>
        </div>
      </div>
      <div className="task-assignee">{initials && <span className="assignee-avatar">{initials}</span>}<span>{employeeLabel}</span></div>
      <div className="task-priority"><UrgencyBadge urgency={urgency} /></div>
      <div className="task-status"><StatusBadge status={status} /></div>
      <div className={`task-due task-due--${dueState}`} title={`Due ${deadline}${isOverdue ? `, ${Math.abs(daysFromToday)} days overdue` : ''}`}>
        <span className="due-dot" aria-hidden="true" />
        <span>{dueLabel}</span>
        {isOverdue && <span className="overdue-label">Overdue</span>}
      </div>
    </article>
  );
}
