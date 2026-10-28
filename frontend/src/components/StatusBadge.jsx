import React from 'react';

/**
 * StatusBadge — shows the task status as a coloured pill.
 * Possible values: 'pending' | 'in-progress' | 'completed'
 */
export default function StatusBadge({ status }) {
  const labels = {
    completed: 'Completed',
    'in-progress': 'In progress',
    pending: 'To do',
  };

  const label = labels[status] ?? status;
  // Convert "in-progress" → "in-progress" for CSS class (dashes preserved)
  const cssKey = status;

  return (
    <span
      className={`badge badge--status-${cssKey}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
