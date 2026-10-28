import React from 'react';
import TaskCard from './TaskCard';
import EmptyState from './EmptyState';

/**
 * TaskList — renders the prioritised, filtered list of tasks / work orders.
 * Falls back to EmptyState when no tasks match the current filters.
 */
export default function TaskList({ tasks, view, hasFilters, onReset, onSelectTask }) {
  if (tasks.length === 0) {
    return <EmptyState hasFilters={hasFilters} onReset={onReset} />;
  }

  if (view === 'board') {
    const knownStatuses = ['pending', 'in-progress', 'completed'];
    const unknownStatuses = [...new Set(tasks.map((task) => task.status || 'unknown'))]
      .filter((status) => !knownStatuses.includes(status));
    const columns = [
      ['pending', 'Shift Queue'],
      ['in-progress', 'In Machining'],
      ['completed', 'Completed / Dispatched'],
      ...unknownStatuses.map((status) => [status, 'Other Status']),
    ];
    return (
      <div className="board-grid">
        {columns.map(([status, title]) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <section className="board-column" key={status} aria-label={`${title}: ${columnTasks.length} tasks`}>
              <header className="board-column__header">
                <span className={`column-dot column-dot--${status}`} />
                {title}
                <span className="column-count">{columnTasks.length}</span>
              </header>
              <div className="board-column__items">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} view="board" onViewDetails={onSelectTask} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="task-list-wrap">
      <div className="task-list-head" aria-hidden="true">
        <span>Work Order & Asset</span>
        <span>Specialist</span>
        <span>Criticality</span>
        <span>Floor Status</span>
        <span>Target Date</span>
      </div>
      <div className="task-list" role="list" aria-label={`${tasks.length} work orders`}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onViewDetails={onSelectTask} />
        ))}
      </div>
    </div>
  );
}
