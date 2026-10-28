import React, { useEffect, useRef } from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';
import { daysFromToday, isTaskOverdue } from '../utils/taskMetrics';
import { safeExternalUrl } from '../utils/safeUrl';

function formatDeadline(deadline) {
  const parsed = daysFromToday(deadline);
  if (parsed === null) return 'Invalid due date';
  const date = new Date(deadline.length === 10 ? `${deadline}T00:00:00` : deadline);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TaskDetailDrawer({ task, onClose }) {
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const overdue = isTaskOverdue(task);
  const daysUntilDeadline = daysFromToday(task.deadline);
  const sourceLabel = task.source || 'This task source';
  const originalTaskUrl = safeExternalUrl(task.sourceUrl);

  return (
    <div className="task-drawer-layer">
      <button className="task-drawer-backdrop" type="button" aria-label="Close task details" onClick={onClose} tabIndex={-1} />
      <aside
        className="task-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-drawer-title"
        ref={drawerRef}
      >
        <header className="task-drawer__header">
          <div>
            <p className="task-drawer__eyebrow">{task.source || 'Task'} details</p>
            <h2 id="task-drawer-title">Task details</h2>
          </div>
          <button ref={closeButtonRef} className="task-drawer__close" type="button" onClick={onClose} aria-label="Close task details">×</button>
        </header>

        <div className="task-drawer__content">
          <h3 className="task-drawer__task-title">{task.title || 'Untitled task'}</h3>
          <p className="task-drawer__id">Task ID <span>{task.id || 'Not provided'}</span></p>

          <dl className="task-detail-list">
            <div className="task-detail-row"><dt>Source</dt><dd>{task.source ? <><span className={`source-mark source-mark--${task.source.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'unknown'}`} aria-hidden="true">{task.source === 'CRM' ? 'C' : task.source === 'Helpdesk' ? 'H' : '?'}</span>{task.source}</> : 'Unknown source'}</dd></div>
            {<div className="task-detail-row"><dt>Assignee</dt><dd>{task.employee?.trim() ? <><span className="assignee-avatar" aria-hidden="true">{task.employee.trim().split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>{task.employee.trim()}</> : 'Unassigned'}</dd></div>}
            {task.urgency && <div className="task-detail-row"><dt>Priority</dt><dd><UrgencyBadge urgency={task.urgency} /></dd></div>}
            {task.status && <div className="task-detail-row"><dt>Status</dt><dd><StatusBadge status={task.status} /></dd></div>}
            <div className="task-detail-row"><dt>Due date</dt><dd className={overdue ? 'task-detail-row__overdue' : ''}>{task.deadline ? formatDeadline(task.deadline) : 'No due date'}</dd></div>
            <div className="task-detail-row"><dt>Due status</dt><dd className={overdue ? 'task-detail-row__overdue' : ''}>{overdue ? `${Math.abs(daysUntilDeadline)} day${Math.abs(daysUntilDeadline) === 1 ? '' : 's'} overdue` : daysUntilDeadline === 0 ? 'Due today' : daysUntilDeadline > 0 ? 'Upcoming' : task.status === 'completed' ? 'Completed' : task.deadline ? 'Invalid due date' : 'No due date'}</dd></div>
          </dl>

          <p className="task-drawer__readonly">{sourceLabel} tasks are read-only in TaskFlow. Make changes in the original source when available.</p>
          {originalTaskUrl && <a className="task-drawer__original-link" href={originalTaskUrl} target="_blank" rel="noopener noreferrer">Open original task <span aria-hidden="true">↗</span></a>}
          {!originalTaskUrl && <p className="task-drawer__readonly" role="status">Original task link unavailable.</p>}
        </div>
      </aside>
    </div>
  );
}
