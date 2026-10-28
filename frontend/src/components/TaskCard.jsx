import React from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';

export default function TaskCard({ task, view = 'list' }) {
  const { id, title, employee, status, deadline, urgency, source, sourceUrl, daysFromToday } = task;
  const isOverdue = daysFromToday < 0 && status !== 'completed';
  const isToday = daysFromToday === 0;
  const dueLabel = isOverdue
    ? `${Math.abs(daysFromToday)}d overdue`
    : isToday ? 'Due today' : new Date(`${deadline}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const initials = employee.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const sourceKey = source.toLowerCase().replace(/\s+/g, '-');

  return (
    <article className={`task-row${view === 'board' ? ' task-row--board' : ''}${isOverdue ? ' task-row--overdue' : ''}`}>
      <div className="task-main">
        <span className={`source-mark source-mark--${sourceKey}`} aria-hidden="true">{source === 'CRM' ? 'C' : 'H'}</span>
        <div className="task-title-wrap">
          <a className="task-title" href={sourceUrl} target="_blank" rel="noreferrer" title={`Open in ${source}`}>{title}<span aria-hidden="true">↗</span></a>
          <span className="task-id">{id} <span className="task-source-inline">· {source}</span></span>
        </div>
      </div>
      <div className="task-assignee"><span className="assignee-avatar">{initials}</span><span>{employee}</span></div>
      <div className="task-priority"><UrgencyBadge urgency={urgency} /></div>
      <div className="task-status"><StatusBadge status={status} /></div>
      <div className={`task-due${isOverdue ? ' task-due--overdue' : ''}`}><span className="due-dot" />{dueLabel}{isOverdue && <span className="overdue-label">Overdue</span>}</div>
    </article>
  );
}
