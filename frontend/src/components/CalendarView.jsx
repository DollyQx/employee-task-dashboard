import React, { useState, useMemo } from 'react';

export default function CalendarView({ tasks = [], onSelectTask, onNewTask }) {
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 9, 28)); // October 2026
  const [selectedDayTasks, setSelectedDayTasks] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const gotoToday = () => setCurrentDate(new Date(2026, 9, 28));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Map tasks by date YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map = {};
    for (const task of tasks) {
      const d = task.deadline || (task.due_date ? String(task.due_date).split('T')[0] : null);
      if (d) {
        const dateStr = String(d).split('T')[0];
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

  const todayStr = '2026-10-28';

  return (
    <div className="calendar-container" role="region" aria-label="Tasks Calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button type="button" className="button button--secondary" onClick={prevMonth} aria-label="Previous month">
            ← Prev
          </button>
          <button type="button" className="button button--secondary" onClick={gotoToday}>
            Current Shift
          </button>
          <button type="button" className="button button--secondary" onClick={nextMonth} aria-label="Next month">
            Next →
          </button>
          <h2>{monthName} {year}</h2>
        </div>
        {onNewTask && (
          <button type="button" className="button button--primary" onClick={() => onNewTask()}>
            + Schedule Work Order
          </button>
        )}
      </div>

      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="calendar-day-header">{d}</div>
        ))}

        {calendarDays.map((cell, idx) => {
          if (!cell.day) {
            return <div key={`empty-${idx}`} className="calendar-cell calendar-cell--empty" />;
          }

          const isToday = cell.dateStr === todayStr;
          const hasTasks = cell.dayTasks && cell.dayTasks.length > 0;

          return (
            <div
              key={cell.dateStr}
              className={`calendar-cell${isToday ? ' calendar-cell--today' : ''}${hasTasks ? ' calendar-cell--has-tasks' : ''}`}
              onClick={() => hasTasks && setSelectedDayTasks({ date: cell.dateStr, tasks: cell.dayTasks })}
            >
              <div className="calendar-cell-top">
                <span className="calendar-day-num">{cell.day}</span>
                {isToday && <span className="calendar-today-badge">Today</span>}
                {hasTasks && (
                  <span className="calendar-task-count">{cell.dayTasks.length}</span>
                )}
              </div>

              <div className="calendar-cell-tasks">
                {cell.dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`calendar-task-pill priority-pill--${t.crm_priority || t.urgency || 'medium'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTask(t);
                    }}
                    title={t.title}
                  >
                    {t.task_code || 'WO'}: {t.title}
                  </button>
                ))}
                {cell.dayTasks.length > 3 && (
                  <span className="calendar-more-count">+{cell.dayTasks.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedDayTasks && (
        <div className="modal-backdrop" onClick={() => setSelectedDayTasks(null)}>
          <div className="modal modal--emp-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Scheduled Work Orders for {selectedDayTasks.date}</h3>
                <p>{selectedDayTasks.tasks.length} operations allocated</p>
              </div>
              <button type="button" className="close-button" onClick={() => setSelectedDayTasks(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="day-tasks-modal-list">
                {selectedDayTasks.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="day-task-row"
                    onClick={() => {
                      setSelectedDayTasks(null);
                      onSelectTask(t);
                    }}
                  >
                    <div>
                      <strong>{t.task_code || 'WO'}: {t.title}</strong>
                      <small>Specialist: {t.employee || 'Unassigned'} • {t.department_name || 'Plant Operations'}</small>
                    </div>
                    <span className={`priority-pill priority-pill--${t.crm_priority || t.urgency || 'medium'}`}>
                      {t.crm_priority || t.urgency || 'medium'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="button button--secondary" onClick={() => setSelectedDayTasks(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
