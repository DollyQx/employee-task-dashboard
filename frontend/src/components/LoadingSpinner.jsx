import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="loading-state" role="status" aria-live="polite" aria-label="Loading tasks">
      <span className="sr-only">Loading tasks from CRM and Helpdesk…</span>
      <div className="skeleton-list" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <div className="skeleton-row" key={index}><span className="skeleton skeleton-icon" /><span className="skeleton-copy"><i className="skeleton skeleton-title" /><i className="skeleton skeleton-subtitle" /></span><span className="skeleton skeleton-pill" /><span className="skeleton skeleton-pill skeleton-pill--short" /></div>)}</div>
    </div>
  );
}
