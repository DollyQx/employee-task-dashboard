import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysFromToday,
  getTaskMetrics,
  isTaskOverdue,
  matchesTaskFilters,
  UNASSIGNED_EMPLOYEE,
} from '../src/utils/taskMetrics.js';

const today = new Date(2026, 9, 28, 12);

test('deadline calculation is calendar based and rejects missing or invalid dates', () => {
  assert.equal(daysFromToday('2026-10-28', today), 0);
  assert.equal(daysFromToday('2026-10-27', today), -1);
  assert.equal(daysFromToday('2026-10-29', today), 1);
  assert.equal(daysFromToday('2026-10-29', '2026-10-28'), 1);
  assert.equal(daysFromToday('2026-02-30', today), null);
  assert.equal(daysFromToday('2026-02-30T12:00:00Z', today), null);
  assert.ok(Number.isInteger(daysFromToday('2026-10-28T23:30:00-02:00', today)));
  assert.equal(daysFromToday(undefined, today), null);
});

test('completed tasks are never overdue and missing dates are not overdue', () => {
  assert.equal(isTaskOverdue({ status: 'completed', deadline: '2020-01-01' }, today), false);
  assert.equal(isTaskOverdue({ status: 'pending', deadline: '2026-10-27' }, today), true);
  assert.equal(isTaskOverdue({ status: 'pending', deadline: 'invalid' }, today), false);
  assert.equal(isTaskOverdue({ status: 'pending', deadline: null, daysFromToday: -4 }, today), false);
});

test('snapshot metrics use shared overdue rules and handle empty results', () => {
  const metrics = getTaskMetrics([
    { status: 'completed', deadline: '2026-10-20' },
    { status: 'pending', deadline: '2026-10-27' },
    { status: 'in-progress', deadline: 'invalid' },
  ], today);
  assert.deepEqual(metrics, { total: 3, open: 2, completed: 1, overdue: 1, completionRate: 33 });
  assert.deepEqual(getTaskMetrics([]), { total: 0, open: 0, completed: 0, overdue: 0, completionRate: 0 });
});

test('task filters combine employee, status, priority, source, overdue, and search', () => {
  const task = { id: 'crm-007', title: 'Client renewal', employee: 'Avery Jones', status: 'pending', urgency: 'high', source: 'CRM', deadline: '2026-10-27' };
  assert.equal(matchesTaskFilters(task, { employee: 'Avery Jones', status: 'pending', priority: 'high', source: 'crm', page: 'all', overdueOnly: true, search: 'CRM-007' }), true);
  assert.equal(matchesTaskFilters(task, { source: 'helpdesk' }), false);
  assert.equal(matchesTaskFilters({ ...task, employee: ' ' }, { employee: UNASSIGNED_EMPLOYEE }), true);
  assert.equal(matchesTaskFilters({ ...task, status: 'completed' }, { overdueOnly: true }), false);
  assert.equal(matchesTaskFilters({ status: undefined, urgency: undefined, source: undefined }, { status: 'unknown', priority: 'unknown', source: 'unknown' }), true);
  assert.equal(matchesTaskFilters({ ...task, title: undefined, employee: undefined, id: undefined, source: undefined }, { search: 'renewal' }), false);
});
