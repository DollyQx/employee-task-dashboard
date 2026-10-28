import React from 'react';

export default function DateRangeControls({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onStartChange,
  onEndChange,
  error,
  rangeLabel,
}) {
  return (
    <div className="analytics-date-controls" aria-label="Performance date range">
      <label className="analytics-filter">
        <span>Date range</span>
        <select className="filter-select" value={preset} onChange={(event) => onPresetChange(event.target.value)} aria-label="Select performance date range">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="custom">Custom range</option>
          <option value="all">All time</option>
        </select>
      </label>
      {preset === 'custom' && (
        <>
          <label className="analytics-filter analytics-date-input">
            <span>Start date</span>
            <input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => onStartChange(event.target.value)} aria-label="Custom range start date" aria-invalid={Boolean(error)} />
          </label>
          <label className="analytics-filter analytics-date-input">
            <span>End date</span>
            <input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => onEndChange(event.target.value)} aria-label="Custom range end date" aria-invalid={Boolean(error)} />
          </label>
        </>
      )}
      <p className="analytics-range-label" aria-live="polite">Showing: <strong>{rangeLabel}</strong></p>
      {error && <p className="analytics-range-error" role="alert">{error}</p>}
    </div>
  );
}
