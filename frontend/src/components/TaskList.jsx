import React from 'react';
import TaskCard from './TaskCard';
import EmptyState from './EmptyState';

/**
 * TaskList — renders the prioritised, filtered list of tasks.
 * Falls back to EmptyState when no tasks match the current filters.
 */
export default function TaskList({ tasks, view, hasFilters, onReset }) {
  if (tasks.length === 0) {
    return <EmptyState hasFilters={hasFilters} onReset={onReset} />;
  }

  if (view === 'board') {
    const columns = [
      ['pending', 'To do'],
      ['in-progress', 'In progress'],
      ['completed', 'Completed'],
    ];
    return <div className="board-grid">{columns.map(([status, title]) => {
      const columnTasks = tasks.filter((task) => task.status === status);
      return <section className="board-column" key={status} aria-label={`${title}: ${columnTasks.length} tasks`}>
        <header className="board-column__header"><span className={`column-dot column-dot--${status}`} />{title}<span className="column-count">{columnTasks.length}</span></header>
        <div className="board-column__items">{columnTasks.map((task) => <TaskCard key={task.id} task={task} view="board" />)}</div>
      </section>;
    })}</div>;
  }

  return (
    <div className="task-list-wrap"><div className="task-list-head" aria-hidden="true"><span>Task</span><span>Assignee</span><span>Priority</span><span>Status</span><span>Due date</span></div><div className="task-list" role="list" aria-label={`${tasks.length} tasks`}>{tasks.map((task) => <TaskCard key={task.id} task={task} />)}</div></div>
  );
}
