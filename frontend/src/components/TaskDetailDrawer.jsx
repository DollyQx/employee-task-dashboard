import React, { useEffect, useRef } from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';

function formatDeadline(deadline) {
  return new Date(`${deadline}T00:00:00`).toLocaleDateString('en-US', {
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

  const overdue = typeof task.daysFromToday === 'number'
    && task.daysFromToday < 0
    && task.status !== 'completed';

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
          {task.title && <h3 className="task-drawer__task-title">{task.title}</h3>}
          {task.id && <p className="task-drawer__id">Task ID <span>{task.id}</span></p>}

          <dl className="task-detail-list">
            {task.source && <div className="task-detail-row"><dt>Source</dt><dd><span className={`source-mark source-mark--${task.source.toLowerCase().replace(/\s+/g, '-')}`} aria-hidden="true">{task.source === 'CRM' ? 'C' : 'H'}</span>{task.source}</dd></div>}
            {task.employee && <div className="task-detail-row"><dt>Assignee</dt><dd><span className="assignee-avatar" aria-hidden="true">{task.employee.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>{task.employee}</dd></div>}
            {task.urgency && <div className="task-detail-row"><dt>Priority</dt><dd><UrgencyBadge urgency={task.urgency} /></dd></div>}
            {task.status && <div className="task-detail-row"><dt>Status</dt><dd><StatusBadge status={task.status} /></dd></div>}
            {task.deadline && <div className="task-detail-row"><dt>Due date</dt><dd className={overdue ? 'task-detail-row__overdue' : ''}>{formatDeadline(task.deadline)}</dd></div>}
            {typeof task.daysFromToday === 'number' && <div className="task-detail-row"><dt>Due status</dt><dd className={overdue ? 'task-detail-row__overdue' : ''}>{overdue ? `${Math.abs(task.daysFromToday)} day${Math.abs(task.daysFromToday) === 1 ? '' : 's'} overdue` : task.daysFromToday === 0 ? 'Due today' : task.daysFromToday > 0 ? 'Upcoming' : 'Completed'}</dd></div>}
          </dl>

          {task.sourceUrl && <a className="task-drawer__original-link" href={task.sourceUrl} target="_blank" rel="noreferrer">Open original task <span aria-hidden="true">↗</span></a>}
        </div>
      </aside>
    </div>
  );
}
