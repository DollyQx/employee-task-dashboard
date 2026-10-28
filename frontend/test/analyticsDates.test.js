import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrend, getDateRange, getEventDate, getPreviousDateRange, parseDateKey } from '../src/utils/analyticsDates.js';

const today = new Date(2026, 9, 28, 12);

test('preset and custom date ranges are inclusive and validated', () => {
  assert.deepEqual(getDateRange('7d', '', '', today), { start: '2026-10-22', end: '2026-10-28', valid: true, label: 'Last 7 days' });
  assert.deepEqual(getDateRange('30d', '', '', today), { start: '2026-09-29', end: '2026-10-28', valid: true, label: 'Last 30 days' });
  assert.deepEqual(getDateRange('90d', '', '', today), { start: '2026-07-31', end: '2026-10-28', valid: true, label: 'Last 90 days' });
  assert.equal(getDateRange('all', '', '', today).start, null);
  assert.equal(getDateRange('custom', '2026-10-28', '2026-10-27').valid, false);
  assert.equal(getDateRange('custom', '2026-02-30', '2026-03-01').valid, false);
  assert.equal(getDateRange('custom', '2026-10-27', '2026-10-28').valid, true);
  assert.equal(parseDateKey('2026-02-30'), null);
});

test('event timestamps are read only from explicit event fields, never deadlines', () => {
  assert.equal(getEventDate({ createdAt: '2026-10-20' }, ['createdAt']), '2026-10-20');
  assert.notEqual(getEventDate({ createdAt: '2026-10-20T23:00:00Z' }, ['createdAt']), null);
  assert.equal(getEventDate({ deadline: '2026-10-20' }, ['createdAt', 'created_at']), null);
  assert.equal(getEventDate({ createdAt: 'not-a-date' }, ['createdAt']), null);
});

test('previous comparison ranges are equal duration and adjacent', () => {
  const previous = getPreviousDateRange(getDateRange('7d', '', '', today));
  assert.deepEqual(previous, { start: '2026-10-15', end: '2026-10-21' });
  assert.equal(getPreviousDateRange(getDateRange('all')), null);
});

test('trend buckets count only events inside the selected dates', () => {
  const range = { start: '2026-10-26', end: '2026-10-28', valid: true };
  const trend = buildTrend([
    { date: '2026-10-25' },
    { date: '2026-10-26' },
    { date: '2026-10-26' },
    { date: '2026-10-28' },
    { date: '2026-10-29' },
  ], range);
  assert.deepEqual(trend.map(({ count }) => count), [2, 0, 1]);
  assert.deepEqual(buildTrend([], range), []);
});
