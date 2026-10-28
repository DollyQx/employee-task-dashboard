import React from 'react';

/**
 * EmptyState — shown when filters produce zero results.
 */
export default function EmptyState({ hasFilters, onReset }) {
  return (
    <div className="empty-container" role="status" aria-live="polite">
      <div className="empty-icon" aria-hidden="true">🔍</div>
      <h2 className="empty-title">
        {hasFilters ? 'No tasks match this view' : 'No tasks to display'}
      </h2>
      <p className="empty-subtitle">
        {hasFilters ? 'Try adjusting your filters or search terms to find what you are looking for.' : 'Tasks from connected project sources will appear here.'}
      </p>
      {hasFilters && (
        <button
          id="clear-filters-btn"
          className="button button--secondary"
          onClick={onReset}
          type="button"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
