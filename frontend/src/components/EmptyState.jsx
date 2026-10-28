import React from 'react';

/**
 * EmptyState — shown when filters produce zero results.
 */
export default function EmptyState({ hasFilters, onReset }) {
  return (
    <div className="empty-container" role="status" aria-live="polite">
      <div className="empty-icon" aria-hidden="true">🔍</div>
      <h2 className="empty-title">
        {hasFilters ? 'No work orders match this view' : 'No work orders to display'}
      </h2>
      <p className="empty-subtitle">
        {hasFilters ? 'Adjust your floor filters or reset them to inspect all shopfloor orders.' : 'Work orders from connected plant sources will appear here.'}
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
