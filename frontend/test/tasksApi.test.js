import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllTasks } from '../src/api/tasks.js';

const baseUrl = 'https://tasks.example.test/api';

function response(tasks, status = 200) {
  return new Response(JSON.stringify({ tasks }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('fetches both exact API routes, merges records, and applies task priority', async () => {
  const requests = [];
  const tasks = await fetchAllTasks({
    baseUrl,
    fetchImpl: async (url) => {
      requests.push(url);
      return response([{ id: url.includes('/crm/') ? 'crm-1' : 'hd-1', title: 'Task', status: 'pending', urgency: 'low', deadline: '2026-11-20', source: url.includes('/crm/') ? 'CRM' : 'Helpdesk' }]);
    },
  });

  assert.deepEqual(requests.sort(), [
    'https://tasks.example.test/api/crm/tasks',
    'https://tasks.example.test/api/helpdesk/tasks',
  ]);
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((task) => typeof task.score === 'number'));
});

test('rejects HTTP errors, malformed JSON, invalid shapes, and wrong field types', async () => {
  await assert.rejects(fetchAllTasks({ baseUrl, fetchImpl: async () => response([], 503) }), /API returned 503/);
  await assert.rejects(fetchAllTasks({ baseUrl, fetchImpl: async () => new Response('{bad json') }), /invalid JSON/);
  await assert.rejects(fetchAllTasks({ baseUrl, fetchImpl: async () => new Response(JSON.stringify({ tasks: {} })) }), /tasks array/);
  await assert.rejects(fetchAllTasks({ baseUrl, fetchImpl: async () => response([{ title: 42 }]) }), /task fields with invalid types/);
});

test('converts network and timeout failures to recoverable messages', async () => {
  await assert.rejects(fetchAllTasks({ baseUrl, fetchImpl: async () => { throw new TypeError('network down'); } }), /could not be reached/);
  await assert.rejects(fetchAllTasks({
    baseUrl,
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  }), /timed out after 0\.005 seconds/);
});
