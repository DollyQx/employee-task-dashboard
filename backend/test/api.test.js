const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { once } = require('node:events');

const app = require('../server');

const productionOrigin = 'https://employee-task-dashboard-chivel.vercel.app';
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
  }
});

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Origin: productionOrigin },
  });
  return { response, body: await response.json() };
}

test('GET /api/health returns a healthy status and permits the Vercel origin', async () => {
  const { response, body } = await getJson('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), productionOrigin);
  assert.equal(body.status, 'ok');
  assert.ok(Number.isNaN(Date.parse(body.timestamp)) === false);
});

test('GET /api/crm/tasks returns the CRM task response shape', async () => {
  const { response, body } = await getJson('/api/crm/tasks');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), productionOrigin);
  assert.equal(body.source, 'CRM (Mock)');
  assert.equal(body.count, 8);
  assert.equal(body.tasks.length, body.count);
  assert.ok(body.tasks.every((task) => task.source === 'CRM'));
  assert.deepEqual(
    Object.keys(body.tasks[0]).sort(),
    ['deadline', 'employee', 'id', 'source', 'sourceUrl', 'status', 'title', 'urgency'].sort()
  );
});

test('GET /api/helpdesk/tasks returns the Helpdesk task response shape', async () => {
  const { response, body } = await getJson('/api/helpdesk/tasks');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), productionOrigin);
  assert.equal(body.source, 'Helpdesk (Mock)');
  assert.equal(body.count, 8);
  assert.equal(body.tasks.length, body.count);
  assert.ok(body.tasks.every((task) => task.source === 'Helpdesk'));
  assert.deepEqual(
    Object.keys(body.tasks[0]).sort(),
    ['deadline', 'employee', 'id', 'source', 'sourceUrl', 'status', 'title', 'urgency'].sort()
  );
});

test('OPTIONS preflight permits GET from the Vercel origin on both task routes', async () => {
  for (const path of ['/api/crm/tasks', '/api/helpdesk/tasks']) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'OPTIONS',
      headers: {
        Origin: productionOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), productionOrigin);
    assert.match(response.headers.get('access-control-allow-methods'), /GET/);
  }
});
