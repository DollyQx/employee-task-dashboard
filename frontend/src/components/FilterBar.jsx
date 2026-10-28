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
  _onSourceChange,
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
          placeholder="Filter by title, project, or keyword..."
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
        <option value="all">All Assignees ({employees.length})</option>
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
        <option value="all">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <select
        id="priority-filter"
        className="filter-select"
        value={priorityFilter}
        onChange={(event) => onPriorityChange(event.target.value)}
        aria-label="Priority"
      >
        <option value="all">All Priorities</option>
        <option value="urgent">🔴 Urgent</option>
        <option value="high">🟠 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">🟢 Low</option>
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
