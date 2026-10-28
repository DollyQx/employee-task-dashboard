import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAllTasks } from './api/tasks';

import Header from './components/Header';
import FilterBar from './components/FilterBar';
import TaskList from './components/TaskList';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

/**
 * App — root component
 *
 * Responsibilities:
 *  1. Fetch tasks from both mock API endpoints on mount
 *  2. Manage loading / error / data state
 *  3. Apply employee and status filters in memory (no extra API call)
 *  4. Render the correct UI state (loading → error → dashboard)
 */
export default function App() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState('all');

  // ── Fetch tasks ───────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllTasks();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── Derived: filtered task list ───────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesEmployee = employeeFilter === 'all' || task.employee === employeeFilter;
      const matchesStatus   = statusFilter   === 'all' || task.status   === statusFilter;
      return matchesEmployee && matchesStatus;
    });
  }, [tasks, employeeFilter, statusFilter]);

  // ── Derived: summary stats ────────────────────────────────────────────────
  const overdueCount = useMemo(
    () => tasks.filter((t) => t.daysFromToday < 0 && t.status !== 'completed').length,
    [tasks]
  );

  const resetFilters = useCallback(() => {
    setEmployeeFilter('all');
    setStatusFilter('all');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Header taskCount={tasks.length} overdueCount={overdueCount} />

      <main className="main" id="main-content">
        <div className="container">

          {/* Loading state */}
          {loading && <LoadingSpinner />}

          {/* Error state */}
          {!loading && error && (
            <ErrorMessage error={error} onRetry={loadTasks} />
          )}

          {/* Dashboard state */}
          {!loading && !error && (
            <>
              {/* Summary chips */}
              <div className="stats-bar" aria-label="Task summary">
                <div className="stat-chip">
                  <span>Total</span>
                  <span className="stat-chip__value">{tasks.length}</span>
                </div>
                <div className="stat-chip">
                  <span>Showing</span>
                  <span className="stat-chip__value">{filteredTasks.length}</span>
                </div>
                {overdueCount > 0 && (
                  <div className="stat-chip stat-chip--overdue">
                    <span>⚠️ Overdue</span>
                    <span className="stat-chip__value">{overdueCount}</span>
                  </div>
                )}
                <div className="stat-chip">
                  <span>Sources</span>
                  <span className="stat-chip__value">CRM + Helpdesk</span>
                </div>
              </div>

              {/* Filters */}
              <FilterBar
                tasks={tasks}
                employeeFilter={employeeFilter}
                statusFilter={statusFilter}
                onEmployeeChange={setEmployeeFilter}
                onStatusChange={setStatusFilter}
                onReset={resetFilters}
              />

              {/* Task list */}
              <TaskList
                tasks={filteredTasks}
                employeeFilter={employeeFilter}
                statusFilter={statusFilter}
                onResetFilters={resetFilters}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}
