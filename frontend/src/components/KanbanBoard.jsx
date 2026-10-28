import React, { useState } from 'react';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: '#64748B' },
  { id: 'todo', label: 'To Do', color: '#0284C7' },
  { id: 'in_progress', label: 'In Progress', color: '#2563EB' },
  { id: 'in_review', label: 'In Review', color: '#D97706' },
  { id: 'blocked', label: 'Blocked', color: '#DC2626' },
  { id: 'done', label: 'Completed', color: '#16A34A' },
];

export default function KanbanBoard({ tasks = [], onStatusChange, onSelectTask, onNewTask }) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId && onStatusChange) {
      onStatusChange(taskId, targetStatus);
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="kanban-wrapper" role="region" aria-label="Kanban task board">
      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => (t.crm_status || 'todo') === col.id);
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              className={`kanban-column${isOver ? ' kanban-column--dragover' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="kanban-column-header">
                <span className="kanban-column-dot" style={{ background: col.color }} />
                <h3>{col.label}</h3>
                <span className="kanban-column-count">{colTasks.length}</span>
                {col.id === 'todo' && onNewTask && (
                  <button
                    type="button"
                    className="kanban-add-btn"
                    onClick={() => onNewTask({ crm_status: 'todo' })}
                    title="Add task in To Do"
                    aria-label="Add task"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="kanban-column-cards">
                {colTasks.length === 0 ? (
                  <div className="kanban-empty-dropzone">
                    <span>No tasks in {col.label}</span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const dueDate = task.due_date ? String(task.due_date).split('T')[0] : task.deadline;
                    const isOverdue = task.is_overdue || (dueDate && dueDate < todayStr && col.id !== 'done');
                    const priorityClass = `priority-pill--${task.crm_priority || task.urgency || 'medium'}`;

                    return (
                      <div
                        key={task.id}
                        className={`kanban-card${isOverdue ? ' kanban-card--overdue' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => onSelectTask(task)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectTask(task)}
                      >
                        <div className="kanban-card-top">
                          <span className="kanban-card-code">{task.task_code || task.id || 'TSK'}</span>
                          <span className={`priority-pill ${priorityClass}`}>
                            {task.crm_priority || task.urgency || 'medium'}
                          </span>
                        </div>

                        <h4 className="kanban-card-title">{task.title}</h4>

                        {task.project_name ? (
                          <div className="kanban-card-asset">
                            <span>📁 {task.project_name}</span>
                          </div>
                        ) : task.asset ? (
                          <div className="kanban-card-asset">
                            <span>⚙ {task.asset}</span>
                          </div>
                        ) : null}

                        {task.blocked_reason && col.id === 'blocked' && (
                          <div className="kanban-card-blocked">
                            <strong>Hold Reason:</strong> {task.blocked_reason}
                          </div>
                        )}

                        <div className="kanban-card-footer">
                          <div className="kanban-card-assignees">
                            {task.assignees && task.assignees.length > 0 ? (
                              task.assignees.slice(0, 3).map((a, i) => (
                                <span
                                  key={a.id || i}
                                  className="mini-avatar"
                                  title={a.full_name || a.email}
                                >
                                  {a.avatar || (a.full_name ? a.full_name.substring(0, 2).toUpperCase() : 'IN')}
                                </span>
                              ))
                            ) : (
                              <span className="unassigned-text">{task.employee || 'Unassigned'}</span>
                            )}
                          </div>

                          {dueDate && (
                            <span className={`kanban-card-due${isOverdue ? ' is-overdue' : ''}`}>
                              {isOverdue ? '⚠️ Overdue ' : '🕒 '}
                              {new Date(`${dueDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {/* Fast column shift controls for accessible & touch navigation */}
                        <div className="kanban-card-actions" onClick={(e) => e.stopPropagation()}>
                          {col.id !== 'backlog' && (
                            <button
                              type="button"
                              className="kanban-shift-btn"
                              title="Move left"
                              onClick={() => {
                                const prevIdx = COLUMNS.findIndex((c) => c.id === col.id) - 1;
                                if (prevIdx >= 0) onStatusChange(task.id, COLUMNS[prevIdx].id);
                              }}
                            >
                              ←
                            </button>
                          )}
                          {col.id !== 'done' && (
                            <button
                              type="button"
                              className="kanban-shift-btn"
                              title="Move right"
                              onClick={() => {
                                const nextIdx = COLUMNS.findIndex((c) => c.id === col.id) + 1;
                                if (nextIdx < COLUMNS.length) onStatusChange(task.id, COLUMNS[nextIdx].id);
                              }}
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
