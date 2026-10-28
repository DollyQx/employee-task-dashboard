import React from 'react';

/**
 * UrgencyBadge — shows task urgency as a coloured pill.
 * Possible values: 'high' | 'medium' | 'low'
 */
export default function UrgencyBadge({ urgency }) {
  const icons = {
    high:   '🔴',
    medium: '🟡',
    low:    '🟢',
  };

  return (
    <span
      className={`badge badge--urgency-${urgency}`}
      aria-label={`Urgency: ${urgency}`}
    >
      {icons[urgency] ?? ''} {urgency}
    </span>
  );
}
