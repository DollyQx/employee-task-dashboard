import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, prioritize } from '../src/utils/prioritize.js';

const now = new Date(2026, 9, 28, 12);

test('priority scoring gives no due-date bonus to missing or malformed deadlines', () => {
  assert.equal(computeScore({ urgency: 'low', deadline: 'not-a-date' }, now), 5);
  assert.equal(computeScore({ urgency: 'low', deadline: null }, now), 5);
  assert.equal(computeScore({ urgency: 'low', deadline: '2026-10-28' }, now), 35);
});

test('priority sorting is stable for ties and malformed deadlines remain safe', () => {
  const sorted = prioritize([
    { id: 'first', urgency: 'low', deadline: 'invalid' },
    { id: 'second', urgency: 'low', deadline: null },
    { id: 'today', urgency: 'high', deadline: '2026-10-28' },
  ], now);
  assert.deepEqual(sorted.map((task) => task.id), ['today', 'first', 'second']);
  assert.equal(sorted[1].daysFromToday, null);
});
