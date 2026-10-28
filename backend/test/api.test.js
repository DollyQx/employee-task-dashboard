const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { once } = require('node:events');

const app = require('../server');

const productionOrigin = 'https://employee-task-dashboard-chi.vercel.app';
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
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
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
    assert.doesNotMatch(response.headers.get('access-control-allow-methods'), /POST|PUT|PATCH|DELETE/);
  }
});

test('task sources are read-only and reject unsupported write methods', async () => {
  for (const path of ['/api/crm/tasks', '/api/helpdesk/tasks']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { Origin: productionOrigin, 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify({ title: 'unsupported mutation' }),
      });
      assert.equal(response.status, 404, `${method} ${path} should remain unsupported`);
      assert.equal(response.headers.get('access-control-allow-origin'), productionOrigin);
      assert.deepEqual(await response.json(), { error: 'Route not found' });
    }
  }
});

test('CORS does not allow unknown origins', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://untrusted.example' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
