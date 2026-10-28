import React from 'react';
import StatusBadge from './StatusBadge';
import UrgencyBadge from './UrgencyBadge';

/**
 * TaskCard
 *
 * Displays a single task. Clicking it opens the task's sourceUrl in a new
 * browser tab (simulating navigation to the originating CRM/Helpdesk system).
 *
 * Overdue tasks get a special red highlight and warning banner.
 */
export default function TaskCard({ task }) {
  const {
    id,
    title,
    employee,
    status,
    deadline,
    urgency,
    source,
    sourceUrl,
    daysFromToday,
  } = task;

  const isOverdue = daysFromToday < 0;
  const isToday   = daysFromToday === 0;

  /**
   * Format the deadline for display.
   * e.g. "2026-10-28" → "Oct 28, 2026"
   */
  function formatDeadline(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Human-readable deadline label.
   */
  function deadlineLabel() {
    if (isOverdue) {
      const days = Math.abs(daysFromToday);
      return `${formatDeadline(deadline)} · ${days} day${days !== 1 ? 's' : ''} overdue`;
    }
    if (isToday) return 'Due today';
    if (daysFromToday === 1) return 'Due tomorrow';
    return `Due ${formatDeadline(deadline)}`;
  }

  function handleClick() {
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  const sourceCssKey = source.toLowerCase().replace(/\s+/g, '-');

  return (
    <article
      className={`task-card${isOverdue ? ' task-card--overdue' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open task: ${title} in ${source}`}
      title={`Click to open in ${source}`}
    >
      {/* ── Top row: source badge + urgency badge + status badge ── */}
      <div className="task-card__header">
        <span className={`badge badge--source-${sourceCssKey}`}>
          {source === 'CRM' ? '🏢' : '🎫'} {source}
        </span>
        <div className="task-card__badges">
          <UrgencyBadge urgency={urgency} />
          <StatusBadge status={status} />
        </div>
      </div>

      {/* ── Title ── */}
      <h2 className="task-card__title">{title}</h2>

      {/* ── Metadata ── */}
      <div className="task-card__meta">
        <div className="task-card__meta-row">
          <span className="task-card__meta-icon">👤</span>
          <span>{employee}</span>
        </div>
        <div className="task-card__meta-row">
          <span className="task-card__meta-icon">📅</span>
          <span style={{ color: isOverdue ? 'var(--clr-overdue)' : isToday ? 'var(--clr-in-progress)' : undefined }}>
            {deadlineLabel()}
          </span>
        </div>
      </div>

      {/* ── Overdue warning banner ── */}
      {isOverdue && status !== 'completed' && (
        <div className="task-card__overdue-warning" role="alert" aria-live="polite">
          ⚠️ Overdue — immediate attention required
        </div>
      )}

      {/* ── Footer: ID + open link hint ── */}
      <div className="task-card__footer">
        <span className="task-card__id">{id}</span>
        <span className="task-card__open-link" aria-hidden="true">
          Open in {source} ↗
        </span>
      </div>
    </article>
  );
}
