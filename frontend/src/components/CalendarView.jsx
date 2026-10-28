import React, { useState, useMemo } from 'react';

export default function CalendarView({ tasks = [], onSelectTask, onNewTask }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayTasks, setSelectedDayTasks] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const gotoToday = () => setCurrentDate(new Date());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Map tasks by date YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      if (task.due_date) {
        const dateStr = String(task.due_date).split('T')[0];
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(task);
      }
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const days = [];
    // Leading empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: null });
    }
    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, dayTasks: tasksByDate[dateStr] || [] });
    }
    return days;
  }, [year, month, daysInMonth, firstDayIndex, tasksByDate]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="calendar-container" role="region" aria-label="Tasks Calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button type="button" className="button button--secondary" onClick={prevMonth} aria-label="Previous month">
            ◀
          </button>
          <button type="button" className="button button--secondary" onClick={gotoToday}>
            Today
          </button>
          <button type="button" className="button button--secondary" onClick={nextMonth} aria-label="Next month">
            ▶
          </button>
          <h2>{monthName} {year}</h2>
        </div>
        {onNewTask && (
          <button type="button" className="button button--primary" onClick={() => onNewTask()}>
            + New Task
          </button>
        )}
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
          <div key={dayName} className="calendar-day-header">
            {dayName}
          </div>
        ))}

        {calendarDays.map((item, idx) => {
          if (!item.day) {
            return <div key={`empty-${idx}`} className="calendar-cell calendar-cell--empty" />;
          }

          const isToday = item.dateStr === todayStr;
          const hasTasks = item.dayTasks && item.dayTasks.length > 0;

          return (
            <div
              key={item.dateStr}
              className={`calendar-cell${isToday ? ' calendar-cell--today' : ''}${hasTasks ? ' calendar-cell--has-tasks' : ''}`}
              onClick={() => {
                if (hasTasks) setSelectedDayTasks({ date: item.dateStr, tasks: item.dayTasks });
              }}
            >
              <div className="calendar-cell-top">
                <span className={`calendar-date-number${isToday ? ' calendar-date-number--today' : ''}`}>
                  {item.day}
                </span>
                {hasTasks && <span className="calendar-day-count">{item.dayTasks.length}</span>}
              </div>

              <div className="calendar-task-list">
                {item.dayTasks.slice(0, 3).map((task) => {
                  const isDone = task.crm_status === 'done';
                  const priorityClass = `calendar-chip--${task.crm_priority || 'medium'}`;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={`calendar-task-chip ${priorityClass}${isDone ? ' is-done' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask(task);
                      }}
                      title={`${task.title} (${task.crm_status})`}
                    >
                      <span className="chip-code">{task.task_code || '•'}</span>
                      <span className="chip-title">{task.title}</span>
                    </button>
                  );
                })}
                {item.dayTasks.length > 3 && (
                  <span className="calendar-more-badge">+{item.dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDayTasks && (
        <div className="modal-overlay" onClick={() => setSelectedDayTasks(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tasks Due on {new Date(selectedDayTasks.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
              <button type="button" className="modal-close" onClick={() => setSelectedDayTasks(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="dialog-task-list">
                {selectedDayTasks.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="dialog-task-item"
                    onClick={() => {
                      setSelectedDayTasks(null);
                      onSelectTask(task);
                    }}
                  >
                    <div>
                      <span className="task-code">{task.task_code}</span>
                      <h4>{task.title}</h4>
                      <small>{task.project_name || 'No project'} · {task.department_name || 'General'}</small>
                    </div>
                    <span className={`status-pill status-pill--${task.crm_status || 'todo'}`}>
                      {task.crm_status || 'todo'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
