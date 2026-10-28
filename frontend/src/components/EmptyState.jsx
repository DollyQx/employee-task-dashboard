import React from 'react';

/**
 * EmptyState — shown when filters produce zero results.
 */
export default function EmptyState({ employeeFilter, statusFilter, onReset }) {
  const hasActiveFilter = employeeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="empty-container" role="status" aria-live="polite">
      <div className="empty-icon" aria-hidden="true">🔍</div>
      <h2 className="empty-title">
        {hasActiveFilter ? 'No tasks match your filters' : 'No tasks found'}
      </h2>
      <p className="empty-subtitle">
        {hasActiveFilter
          ? 'Try adjusting or clearing your filters to see more tasks.'
          : 'There are no tasks to display right now.'}
      </p>
      {hasActiveFilter && (
        <button
          id="clear-filters-btn"
          className="retry-btn"
          onClick={onReset}
          style={{ marginTop: '1rem' }}
          type="button"
        >
          ✕ Clear Filters
        </button>
      )}
    </div>
  );
}
