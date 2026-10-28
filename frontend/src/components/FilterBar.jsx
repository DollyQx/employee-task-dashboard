import React, { useMemo } from 'react';

export default function FilterBar({
  tasks,
  search,
  employeeFilter,
  statusFilter,
  priorityFilter,
  sourceFilter,
  overdueOnly,
  onSearchChange,
  onEmployeeChange,
  onStatusChange,
  onPriorityChange,
  onSourceChange,
  onOverdueChange,
  onReset,
}) {
  const employees = useMemo(() => {
    return [...new Set(tasks.map((task) => task.employee?.trim()).filter(Boolean))].sort();
  }, [tasks]);
  const hasUnassigned = tasks.some((task) => !task.employee?.trim());

  const hasActiveFilter = Boolean(search) || employeeFilter !== 'all' || statusFilter !== 'all'
    || priorityFilter !== 'all' || (sourceFilter && sourceFilter !== 'all') || overdueOnly;

  return (
    <div className="filter-bar" aria-label="Filter tasks">
      <label className="filter-search">
        <span aria-hidden="true">🔍</span>
        <input
          aria-label="Search task list"
          placeholder="Filter by work order, machine asset, or keyword..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <select
        id="employee-filter"
        className="filter-select"
        value={employeeFilter}
        onChange={(e) => onEmployeeChange(e.target.value)}
        aria-label="Assignee"
      >
        <option value="all">All Specialists ({employees.length})</option>
        {hasUnassigned && <option value="__unassigned__">Unassigned</option>}
        {employees.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <select
        id="status-filter"
        className="filter-select"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Status"
      >
        <option value="all">All Floor Statuses</option>
        <option value="pending">Shift Queue / Pending</option>
        <option value="in-progress">In Machining / Progress</option>
        <option value="completed">Completed / Dispatched</option>
      </select>
      <select
        id="priority-filter"
        className="filter-select"
        value={priorityFilter}
        onChange={(event) => onPriorityChange(event.target.value)}
        aria-label="Priority"
      >
        <option value="all">All Criticality Levels</option>
        <option value="urgent">🔴 Urgent / Critical</option>
        <option value="high">🟠 High Priority</option>
        <option value="medium">🟡 Standard Shift</option>
        <option value="low">🟢 Routine</option>
      </select>
      <label className="overdue-filter">
        <input
          type="checkbox"
          checked={overdueOnly}
          onChange={(event) => onOverdueChange(event.target.checked)}
        />
        ⚠️ Overdue Only
      </label>
      {hasActiveFilter && (
        <button
          id="reset-filters-btn"
          className="text-button"
          onClick={onReset}
          type="button"
          aria-label="Clear all filters"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
