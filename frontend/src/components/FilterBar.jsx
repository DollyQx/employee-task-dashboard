import React, { useMemo } from 'react';

/**
 * FilterBar
 *
 * Renders two dropdowns:
 *  1. Employee filter — populated from unique employee names in task list
 *  2. Status filter   — fixed options (all / pending / in-progress / completed)
 *
 * Props:
 *  tasks           — full unfiltered task array (to derive employee options)
 *  employeeFilter  — current employee filter value
 *  statusFilter    — current status filter value
 *  onEmployeeChange — callback when employee dropdown changes
 *  onStatusChange   — callback when status dropdown changes
 *  onReset          — callback to clear all filters
 */
export default function FilterBar({
  tasks,
  employeeFilter,
  statusFilter,
  onEmployeeChange,
  onStatusChange,
  onReset,
}) {
  // Derive sorted unique employee names from the task list
  const employees = useMemo(() => {
    const names = [...new Set(tasks.map((t) => t.employee))].sort();
    return names;
  }, [tasks]);

  const hasActiveFilter = employeeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="filter-bar" role="search" aria-label="Filter tasks">
      <span className="filter-bar__label">Filter:</span>

      {/* Employee filter */}
      <label htmlFor="employee-filter" className="sr-only">Filter by employee</label>
      <select
        id="employee-filter"
        className="filter-select"
        value={employeeFilter}
        onChange={(e) => onEmployeeChange(e.target.value)}
        aria-label="Filter by employee"
      >
        <option value="all">All Employees</option>
        {employees.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      {/* Status filter */}
      <label htmlFor="status-filter" className="sr-only">Filter by status</label>
      <select
        id="status-filter"
        className="filter-select"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="all">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>

      {/* Reset button — only shown when a filter is active */}
      {hasActiveFilter && (
        <button
          id="reset-filters-btn"
          className="filter-reset-btn"
          onClick={onReset}
          type="button"
          aria-label="Clear all filters"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}
