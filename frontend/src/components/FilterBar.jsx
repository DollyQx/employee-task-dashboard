import React, { useMemo } from 'react';

export default function FilterBar({
  tasks,
  search,
  employeeFilter,
  statusFilter,
  priorityFilter,
  sourceFilter,
  onSearchChange,
  onEmployeeChange,
  onStatusChange,
  onPriorityChange,
  onSourceChange,
  onReset,
}) {
  const employees = useMemo(() => {
    return [...new Set(tasks.map((task) => task.employee?.trim()).filter(Boolean))].sort();
  }, [tasks]);
  const hasUnassigned = tasks.some((task) => !task.employee?.trim());

  const hasActiveFilter = Boolean(search) || employeeFilter !== 'all' || statusFilter !== 'all'
    || priorityFilter !== 'all' || sourceFilter !== 'all';

  return (
    <div className="filter-bar" aria-label="Filter tasks">
      <label className="filter-search"><span aria-hidden="true">⌕</span><input aria-label="Search task list" placeholder="Filter by keyword..." value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
      <select
        id="employee-filter"
        className="filter-select"
        value={employeeFilter}
        onChange={(e) => onEmployeeChange(e.target.value)}
        aria-label="Assignee"
      >
        <option value="all">All assignees</option>
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
        <option value="all">All statuses</option>
        <option value="pending">Pending</option>
        <option value="in-progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <select id="priority-filter" className="filter-select" value={priorityFilter} onChange={(event) => onPriorityChange(event.target.value)} aria-label="Priority">
        <option value="all">All priorities</option>
        <option value="high">High priority</option>
        <option value="medium">Medium priority</option>
        <option value="low">Low priority</option>
      </select>
      <select id="source-filter" className="filter-select" value={sourceFilter} onChange={(event) => onSourceChange(event.target.value)} aria-label="Source">
        <option value="all">All sources</option>
        <option value="crm">CRM</option>
        <option value="helpdesk">Helpdesk</option>
      </select>
      {hasActiveFilter && (
        <button
          id="reset-filters-btn"
          className="text-button"
          onClick={onReset}
          type="button"
          aria-label="Clear all filters"
        >
          Clear
        </button>
      )}
    </div>
  );
}
