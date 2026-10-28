import React, { useMemo, useState } from 'react';
import DateRangeControls from './DateRangeControls';

const UNASSIGNED_KEY = '__unassigned__';
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function eventDateKey(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateKey(value) ? value : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}

function getEventDate(task, fieldNames) {
  for (const field of fieldNames) {
    const key = eventDateKey(task[field]);
    if (key) return key;
  }
  return null;
}

function getLocalToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateOrdinal(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function isOverdue(task) {
  if (task.status === 'completed') return false;

  if (Number.isFinite(task.daysFromToday)) {
    return task.daysFromToday < 0;
  }

  if (!task.deadline || Number.isNaN(Date.parse(`${task.deadline}T00:00:00`))) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${task.deadline}T00:00:00`);
  return deadline < today;
}

function rate(completed, total) {
  return total ? Math.round((completed / total) * 100) : 0;
}

function employeeLabel(employee) {
  return employee?.trim() || 'Unassigned';
}

function statusLabel(status) {
  if (status === 'in-progress') return 'In progress';
  if (status === 'pending') return 'To do';
  if (status === 'completed') return 'Completed';
  return status;
}

function buildTrend(events, dateRange) {
  if (!dateRange.valid || events.length === 0) return [];

  const start = dateRange.start
    ? parseDateKey(dateRange.start)
    : parseDateKey(events.reduce((earliest, event) => event.date < earliest ? event.date : earliest, events[0].date));
  const end = dateRange.end
    ? parseDateKey(dateRange.end)
    : parseDateKey(events.reduce((latest, event) => event.date > latest ? event.date : latest, events[0].date));
  if (!start || !end || end < start) return [];

  const dayCount = dateOrdinal(dateKey(end)) - dateOrdinal(dateKey(start)) + 1;
  const step = dayCount <= 31 ? 1 : dayCount <= 180 ? 7 : 30;
  const buckets = [];
  for (let offset = 0; offset < dayCount; offset += step) {
    const bucketStart = new Date(start.getTime());
    bucketStart.setDate(bucketStart.getDate() + offset);
    const bucketEnd = new Date(start.getTime());
    bucketEnd.setDate(bucketEnd.getDate() + Math.min(offset + step - 1, dayCount - 1));
    buckets.push({
      start: dateKey(bucketStart),
      end: dateKey(bucketEnd),
      label: step === 1
        ? bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${bucketEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      count: 0,
    });
  }

  events.forEach((event) => {
    if (event.date < dateKey(start) || event.date > dateKey(end)) return;
    const index = Math.floor((dateOrdinal(event.date) - dateOrdinal(dateKey(start))) / step);
    if (buckets[index]) buckets[index].count += 1;
  });
  return buckets;
}

function periodComparison(current, previous) {
  if (!previous) return null;
  const change = current.length - previous.length;
  if (change === 0) return 'No change from the prior period';
  return `${change > 0 ? '+' : ''}${change} vs prior period`;
}

function TrendPanel({ title, description, buckets, maxCount, unavailableMessage, comparison }) {
  return (
    <article className="analytics-panel trend-panel">
      <header className="analytics-panel__header"><div><h2>{title}</h2><p>{description}</p></div></header>
      {unavailableMessage ? (
        <div className="trend-unavailable" role="status"><span aria-hidden="true">∅</span><p>{unavailableMessage}</p></div>
      ) : buckets.length === 0 ? (
        <div className="trend-unavailable" role="status"><span aria-hidden="true">—</span><p>No dated events in this range.</p></div>
      ) : (
        <>
          {comparison && <p className="trend-comparison">{comparison}</p>}
          <div className="trend-chart" role="list" aria-label={title}>
            {buckets.map((bucket) => (
              <div className="trend-row" role="listitem" key={bucket.start}>
                <span className="trend-date">{bucket.label}</span>
                <div className="analytics-bar-track" role="img" aria-label={`${bucket.label}: ${bucket.count} ${bucket.count === 1 ? 'task' : 'tasks'}`}>
                  <span className="analytics-bar-fill analytics-bar-fill--employee" style={{ width: `${(bucket.count / maxCount) * 100}%` }} />
                </div>
                <strong>{bucket.count}</strong>
              </div>
            ))}
          </div>
          <p className="trend-footnote">Counts are based on dated task records returned by the API.</p>
        </>
      )}
    </article>
  );
}

export default function TeamAnalytics({ tasks, onSelectEmployee }) {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [rangePreset, setRangePreset] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => {
    const today = getLocalToday();
    if (rangePreset === 'all') return { start: null, end: null, valid: true, label: 'All time' };
    if (rangePreset === 'custom') {
      const start = parseDateKey(customStart);
      const end = parseDateKey(customEnd);
      if (!start || !end) return { start: null, end: null, valid: false, label: 'Choose both dates' };
      if (end < start) return { start: null, end: null, valid: false, label: 'Invalid date range' };
      return { start: dateKey(start), end: dateKey(end), valid: true, label: `${customStart} to ${customEnd}` };
    }
    const days = Number.parseInt(rangePreset, 10);
    if (![7, 30, 90].includes(days)) return { start: null, end: null, valid: false, label: 'Invalid date range' };
    const start = new Date(today.getTime());
    start.setDate(start.getDate() - days + 1);
    return { start: dateKey(start), end: dateKey(today), valid: true, label: `Last ${days} days` };
  }, [rangePreset, customStart, customEnd]);

  const scopedTasks = useMemo(() => tasks.filter((task) => {
    const matchesSource = sourceFilter === 'all'
      || task.source?.toLowerCase() === sourceFilter;
    const matchesPriority = priorityFilter === 'all'
      || task.urgency?.toLowerCase() === priorityFilter;
    return matchesSource && matchesPriority;
  }), [tasks, sourceFilter, priorityFilter]);

  const eventData = useMemo(() => {
    const created = scopedTasks
      .map((task) => ({ task, date: getEventDate(task, ['createdAt', 'created_at']) }))
      .filter(({ date }) => date);
    const completed = scopedTasks
      .filter((task) => task.status === 'completed')
      .map((task) => ({ task, date: getEventDate(task, ['completedAt', 'completed_at']) }))
      .filter(({ date }) => date);
    return { created, completed };
  }, [scopedTasks]);

  const periodData = useMemo(() => {
    if (!dateRange.valid) return { created: [], completed: [], previousCreated: null, previousCompleted: null };
    const inRange = (event) => (!dateRange.start || event.date >= dateRange.start)
      && (!dateRange.end || event.date <= dateRange.end);
    const created = eventData.created.filter(inRange);
    const completed = eventData.completed.filter(inRange);
    if (!dateRange.start || !dateRange.end) {
      return { created, completed, previousCreated: null, previousCompleted: null };
    }

    const start = parseDateKey(dateRange.start);
    const end = parseDateKey(dateRange.end);
    const duration = dateOrdinal(dateRange.end) - dateOrdinal(dateRange.start) + 1;
    const previousEnd = new Date(start.getTime());
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd.getTime());
    previousStart.setDate(previousStart.getDate() - duration + 1);
    const previousStartKey = dateKey(previousStart);
    const previousEndKey = dateKey(previousEnd);
    const inPreviousRange = (event) => event.date >= previousStartKey && event.date <= previousEndKey;
    return {
      created,
      completed,
      previousCreated: eventData.created.filter(inPreviousRange),
      previousCompleted: eventData.completed.filter(inPreviousRange),
    };
  }, [eventData, dateRange]);

  const metrics = useMemo(() => {
    const completed = scopedTasks.filter((task) => task.status === 'completed').length;
    const overdue = scopedTasks.filter(isOverdue).length;
    return {
      total: scopedTasks.length,
      completed,
      open: scopedTasks.length - completed,
      overdue,
      completionRate: rate(completed, scopedTasks.length),
    };
  }, [scopedTasks]);

  const employeeStats = useMemo(() => {
    const groups = new Map();
    scopedTasks.forEach((task) => {
      const key = task.employee?.trim() || UNASSIGNED_KEY;
      const label = employeeLabel(task.employee);
      if (!groups.has(key)) {
        groups.set(key, { label, key, total: 0, open: 0, overdue: 0, completed: 0 });
      }
      const group = groups.get(key);
      group.total += 1;
      if (task.status === 'completed') group.completed += 1;
      else group.open += 1;
      if (isOverdue(task)) group.overdue += 1;
    });
    return [...groups.values()]
      .map((group) => ({ ...group, completionRate: rate(group.completed, group.total) }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [scopedTasks]);

  const statusStats = useMemo(() => {
    const counts = new Map();
    scopedTasks.forEach((task) => {
      const status = task.status || 'Unknown';
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [scopedTasks]);

  const maximumEmployeeTasks = Math.max(1, ...employeeStats.map((employee) => employee.total));
  const maximumStatusTasks = Math.max(1, ...statusStats.map(([, count]) => count));
  const hasUnassigned = scopedTasks.some((task) => !task.employee?.trim());
  const hasCreatedDates = eventData.created.length > 0;
  const hasCompletedDates = eventData.completed.length > 0;
  const allTasksHaveCreatedDate = scopedTasks.length > 0
    && scopedTasks.every((task) => getEventDate(task, ['createdAt', 'created_at']));
  const completedTasks = scopedTasks.filter((task) => task.status === 'completed');
  const allCompletedHaveDate = completedTasks.length > 0
    && completedTasks.every((task) => getEventDate(task, ['completedAt', 'completed_at']));

  const createdTrend = useMemo(() => buildTrend(periodData.created, dateRange), [periodData.created, dateRange]);
  const completedTrend = useMemo(() => buildTrend(periodData.completed, dateRange), [periodData.completed, dateRange]);

  const customRangeError = rangePreset === 'custom'
    ? !customStart || !customEnd
      ? 'Enter a start and end date to apply the custom range.'
      : !parseDateKey(customStart) || !parseDateKey(customEnd)
        ? 'Enter valid calendar dates.'
        : customEnd < customStart ? 'End date must be on or after the start date.' : ''
    : '';

  const maxCreatedTrend = Math.max(1, ...createdTrend.map((bucket) => bucket.count));
  const maxCompletedTrend = Math.max(1, ...completedTrend.map((bucket) => bucket.count));
  const createdComparison = periodComparison(
    periodData.created,
    rangePreset !== 'all' && allTasksHaveCreatedDate ? periodData.previousCreated : null
  );
  const completedComparison = periodComparison(
    periodData.completed,
    rangePreset !== 'all' && allCompletedHaveDate ? periodData.previousCompleted : null
  );
  const createdUnavailable = !hasCreatedDates
    ? 'Creation timestamps are not present in the task data returned by the API.'
    : !dateRange.valid ? 'Choose a valid date range to view this trend.' : '';
  const completedUnavailable = !hasCompletedDates
    ? 'Completion timestamps are not present for completed tasks in the API data.'
    : !dateRange.valid ? 'Choose a valid date range to view this trend.' : '';

  return (
    <section className="analytics-page" aria-labelledby="analytics-title">
      <div className="welcome-row analytics-welcome">
        <div>
          <p className="eyebrow">TEAM PERFORMANCE</p>
          <h1 id="analytics-title">Team Analytics<span className="heading-period">.</span></h1>
          <p>Workload and completion, calculated from the tasks currently available.</p>
        </div>
        <div className="analytics-filters" aria-label="Analytics filters">
          <label className="analytics-filter">
            <span>Source</span>
            <select className="filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter analytics by source">
              <option value="all">All sources</option>
              <option value="crm">CRM</option>
              <option value="helpdesk">Helpdesk</option>
            </select>
          </label>
          <label className="analytics-filter">
            <span>Priority</span>
            <select className="filter-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter analytics by priority">
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
      </div>

      <DateRangeControls
        preset={rangePreset}
        onPresetChange={setRangePreset}
        customStart={customStart}
        customEnd={customEnd}
        onStartChange={setCustomStart}
        onEndChange={setCustomEnd}
        error={customRangeError}
        rangeLabel={dateRange.label}
      />

      {scopedTasks.length === 0 ? (
        <div className="analytics-empty" role="status">
          <span className="analytics-empty__mark" aria-hidden="true">∅</span>
          <h2>No task data for these filters</h2>
          <p>Choose another source or priority to view available workload.</p>
        </div>
      ) : (
        <>
          <section className="analytics-summary" aria-label="Task performance metrics">
            <article className="analytics-metric"><span>Current total tasks</span><strong>{metrics.total}</strong><small>Filtered task snapshot</small></article>
            <article className="analytics-metric"><span>Tasks created in range</span><strong>{dateRange.valid ? hasCreatedDates ? periodData.created.length : 'Unavailable' : '—'}</strong><small>{hasCreatedDates ? 'Based on creation timestamp' : 'No creation timestamp in API data'}</small></article>
            <article className="analytics-metric analytics-metric--complete"><span>Tasks completed in range</span><strong>{dateRange.valid ? hasCompletedDates ? periodData.completed.length : 'Unavailable' : '—'}</strong><small>{hasCompletedDates ? 'Based on completion timestamp' : 'No completion timestamp in API data'}</small></article>
            <article className="analytics-metric analytics-metric--overdue"><span>Currently overdue</span><strong>{metrics.overdue}</strong><small>Outstanding snapshot; completed excluded</small></article>
            <article className="analytics-metric"><span>Current open tasks</span><strong>{metrics.open}</strong><small>Not completed in current snapshot</small></article>
            <article className="analytics-metric analytics-metric--complete"><span>Current completed tasks</span><strong>{metrics.completed}</strong><small>Filtered task snapshot</small></article>
            <article className="analytics-metric analytics-metric--rate"><span>Current completion rate</span><strong>{metrics.completionRate}%</strong><small>Completed ÷ total in current snapshot</small></article>
          </section>

          <p className="analytics-snapshot-note">Date range: <strong>{dateRange.label}</strong>. Current workload, overdue, and completion-rate cards show the latest task snapshot; only timestamp-backed activity metrics use the selected period.</p>

          <section className="analytics-trends" aria-label="Performance trends">
            <TrendPanel
              title="Tasks completed over time"
              description={`Completed events · ${dateRange.label}`}
              buckets={completedTrend}
              maxCount={maxCompletedTrend}
              unavailableMessage={completedUnavailable}
              comparison={completedComparison}
            />
            <TrendPanel
              title="Tasks created over time"
              description={`Created events · ${dateRange.label}`}
              buckets={createdTrend}
              maxCount={maxCreatedTrend}
              unavailableMessage={createdUnavailable}
              comparison={createdComparison}
            />
            <article className="analytics-panel trend-panel">
              <header className="analytics-panel__header"><div><h2>Overdue history</h2><p>Outstanding tasks by date</p></div></header>
              <div className="trend-unavailable" role="status"><span aria-hidden="true">∅</span><p>Historical snapshots are not provided by the API. The overdue count above is the current outstanding snapshot only.</p></div>
            </article>
          </section>

          <section className="analytics-charts" aria-label="Current workload distribution">
            <article className="analytics-panel">
              <header className="analytics-panel__header"><div><h2>Current workload by assignee</h2><p>Tasks assigned in the filtered snapshot</p></div><span className="chart-total">{metrics.total} tasks</span></header>
              <div className="analytics-bars" role="list" aria-label="Tasks by assignee">
                {employeeStats.map((employee) => (
                  <div className="analytics-bar-row" role="listitem" key={employee.label}>
                    <span className="analytics-bar-label" title={employee.label}>{employee.label}</span>
                    <div className="analytics-bar-track" role="img" aria-label={`${employee.label}: ${employee.total} ${employee.total === 1 ? 'task' : 'tasks'}`}><span className="analytics-bar-fill analytics-bar-fill--employee" style={{ width: `${(employee.total / maximumEmployeeTasks) * 100}%` }} /></div>
                    <strong className="analytics-bar-value">{employee.total}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="analytics-panel">
              <header className="analytics-panel__header"><div><h2>Current tasks by status</h2><p>Filtered snapshot distribution</p></div><span className="chart-total">{metrics.total} tasks</span></header>
              <div className="analytics-bars" role="list" aria-label="Tasks by status">
                {statusStats.map(([status, count]) => (
                  <div className="analytics-bar-row analytics-bar-row--status" role="listitem" key={status}>
                    <span className="analytics-bar-label">{statusLabel(status)}</span>
                    <div className="analytics-bar-track" role="img" aria-label={`${statusLabel(status)}: ${count} ${count === 1 ? 'task' : 'tasks'}`}><span className={`analytics-bar-fill analytics-bar-fill--${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{ width: `${(count / maximumStatusTasks) * 100}%` }} /></div>
                    <strong className="analytics-bar-value">{count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="analytics-panel analytics-workload">
            <header className="analytics-panel__header"><div><h2>Employee workload</h2><p>Select an assignee to open their tasks.</p></div><span className="chart-total">{employeeStats.length} {employeeStats.length === 1 ? 'assignee' : 'assignees'}</span></header>
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead><tr><th scope="col">Employee</th><th scope="col">Total assigned</th><th scope="col">Open</th><th scope="col">Overdue</th><th scope="col">Completed</th><th scope="col">Completion rate</th></tr></thead>
                <tbody>{employeeStats.map((employee) => (
                  <tr key={employee.key}>
                    <th scope="row"><button className="analytics-employee-link" type="button" onClick={() => onSelectEmployee(employee.key)} aria-label={`View tasks for ${employee.label}`}><span className="analytics-avatar" aria-hidden="true">{employee.key === UNASSIGNED_KEY ? '?' : employee.label.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span>{employee.label}</span><span className="analytics-row-arrow" aria-hidden="true">↗</span></button></th>
                    <td>{employee.total}</td><td>{employee.open}</td><td className={employee.overdue > 0 ? 'analytics-overdue-value' : ''}>{employee.overdue}</td><td>{employee.completed}</td>
                    <td><span className="analytics-rate"><span className="analytics-rate__track"><i style={{ width: `${employee.completionRate}%` }} /></span><span>{employee.completionRate}%</span></span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {hasUnassigned && <p className="analytics-table-note">Unassigned tasks are grouped separately and included in the totals.</p>}
          </section>
        </>
      )}
    </section>
  );
}
