import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="loading-container" role="status" aria-live="polite" aria-label="Loading tasks...">
      <div className="spinner" aria-hidden="true"></div>
      <p className="loading-text">Fetching tasks from CRM &amp; Helpdesk…</p>
    </div>
  );
}
