import React from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';
import { daysFromToday, isTaskOverdue } from '../utils/taskMetrics';

export default function TaskCard({ task, view = 'list', onViewDetails }) {
  const { id, title, employee, status, deadline, urgency, source } = task;
  const daysUntilDeadline = daysFromToday(deadline);
  const isOverdue = isTaskOverdue(task);
  const isToday = daysUntilDeadline === 0;
  const validDeadline = daysUntilDeadline !== null;
  const dueState = isOverdue ? 'overdue' : isToday ? 'today' : daysUntilDeadline > 0 ? 'upcoming' : validDeadline ? 'completed' : 'unknown';
  const dueLabel = isOverdue
    ? `${Math.abs(daysUntilDeadline)}d overdue`
    : isToday ? 'Due today' : validDeadline ? new Date(deadline.length === 10 ? `${deadline}T00:00:00` : deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date';
  const employeeLabel = employee?.trim() || 'Unassigned';
  const initials = employee?.trim().split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const sourceLabel = source || 'Unknown source';
  const sourceKey = sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'unknown';
  return (
    <article className={`task-row${view === 'board' ? ' task-row--board' : ''}${isOverdue ? ' task-row--overdue' : ''}`}>
      <div className="task-main">
        <span className={`source-mark source-mark--${sourceKey}`} aria-hidden="true">{sourceLabel === 'CRM' ? 'C' : sourceLabel === 'Helpdesk' ? 'H' : '?'}</span>
        <div className="task-title-wrap">
          <button className="task-title" type="button" onClick={() => onViewDetails?.(task)} aria-label={`View details for ${title || 'untitled task'}`} title="View task details">{title || 'Untitled task'}<span aria-hidden="true">›</span></button>
          <span className="task-id">{id || 'No ID'} <span className="task-source-inline">· {sourceLabel}</span></span>
        </div>
      </div>
      <div className="task-assignee">{initials && <span className="assignee-avatar">{initials}</span>}<span>{employeeLabel}</span></div>
      <div className="task-priority"><UrgencyBadge urgency={urgency} /></div>
      <div className="task-status"><StatusBadge status={status} /></div>
      <div className={`task-due task-due--${dueState}`} title={validDeadline ? `Due ${deadline}${isOverdue ? `, ${Math.abs(daysUntilDeadline)} days overdue` : ''}` : 'No valid due date'}>
        <span className="due-dot" aria-hidden="true" />
        <span>{dueLabel}</span>
        {isOverdue && <span className="overdue-label">Overdue</span>}
      </div>
    </article>
  );
}
