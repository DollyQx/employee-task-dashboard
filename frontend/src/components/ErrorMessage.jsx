import React from 'react';

/**
 * ErrorMessage — shown when one or both API requests fail.
 * Provides a retry button to reload without a full page refresh.
 */
export default function ErrorMessage({ error, onRetry }) {
  return (
    <div className="error-container" role="alert" aria-live="assertive">
      <div className="error-icon" aria-hidden="true">⚠️</div>
      <h2 className="error-title">Could not load tasks</h2>
      <p className="error-message">
        The backend API could not be reached. Make sure the backend server is
        running on <strong>http://localhost:3001</strong> and try again.
      </p>
      {error && (
        <code className="error-detail">{error}</code>
      )}
      <button
        id="retry-btn"
        className="retry-btn"
        onClick={onRetry}
        type="button"
      >
        ↺ Retry
      </button>
    </div>
  );
}
