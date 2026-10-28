import React from 'react';
import TaskCard from './TaskCard';
import EmptyState from './EmptyState';

/**
 * TaskList — renders the prioritised, filtered list of tasks.
 * Falls back to EmptyState when no tasks match the current filters.
 */
export default function TaskList({ tasks, employeeFilter, statusFilter, onResetFilters }) {
  if (tasks.length === 0) {
    return (
      <div className="task-grid task-grid--empty">
        <EmptyState
          employeeFilter={employeeFilter}
          statusFilter={statusFilter}
          onReset={onResetFilters}
        />
      </div>
    );
  }

  return (
    <div className="task-grid" role="list" aria-label={`${tasks.length} tasks`}>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
