import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createServer as createDemoServer } from '../server/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('the shared frontend API client keeps requests in the local sandbox', () => {
  const origin = 'http://127.0.0.1:5173';
  let vite;
  let api;
  let previousWindow;
  let previousStorage;

  before(async () => {
    previousWindow = globalThis.window;
    previousStorage = globalThis.localStorage;
    const storage = new Map();
    globalThis.window = { location: { origin } };
    globalThis.localStorage = {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    };
    // Load the actual browser module, including Vite's extension resolution.
    // The injected adapter below prevents these tests from making network calls.
    vite = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, watch: null },
    });
    api = (await vite.ssrLoadModule('/src/api/axios.js')).default;
  });

  after(async () => {
    await vite?.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  });

  test('a relative API request cannot override its base URL to a remote host', async () => {
    let dispatched;
    const response = await api.get('/api/dev/health?source=isolation-test', {
      baseURL: 'https://example.invalid',
      adapter: async config => {
        dispatched = config;
        return { data: { local: true }, status: 200, statusText: 'OK', headers: {}, config };
      },
    });
    assert.equal(response.data.local, true);
    assert.equal(new URL(dispatched.url, dispatched.baseURL).origin, origin);
    assert.equal(new URL(dispatched.url, dispatched.baseURL).pathname, '/api/dev/health');
    assert.equal(new URL(dispatched.url, dispatched.baseURL).search, '?source=isolation-test');
  });

  for (const url of [
    'https://example.invalid/api/employee/getAllEmployees',
    '//example.invalid/api/employee/getAllEmployees',
    'http://127.0.0.1:5001/api/dev/health',
    '/dashboard',
    '/api/../outside-api',
  ]) {
    test(`rejects ${url} before invoking the transport`, async () => {
      let dispatched = false;
      await assert.rejects(api.get(url, {
        adapter: async () => {
          dispatched = true;
          throw new Error('The transport must not be reached.');
        },
      }), /only permits local \/api requests/);
      assert.equal(dispatched, false);
    });
  }
});

describe('the demo API rejects access outside the localhost boundary', () => {
  let server;
  let base;
  let port;

  before(async () => {
    server = createDemoServer({ persist: false });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    port = server.address().port;
    base = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server?.listening) {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
  });

  // Always connect to loopback. An absolute-form path is merely test input;
  // this helper never resolves or contacts the hostname inside that path.
  function rawRequest(requestPath, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, headers }, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }));
      });
      req.once('error', reject);
      req.end();
    });
  }

  test('local browser requests receive the synthetic environment explicitly', async () => {
    const response = await fetch(`${base}/api/dev/health`, { headers: { Origin: 'http://127.0.0.1:5173' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    assert.equal((await response.json()).productionConnected, false);
  });

  test('an external browser origin is rejected without a CORS grant', async () => {
    const response = await fetch(`${base}/api/dev/health`, { headers: { Origin: 'https://example.invalid' } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await response.json()).success, false);
  });

  test('a cross-origin preflight is rejected instead of authorising mutations', async () => {
    const response = await fetch(`${base}/api/contractor/addContractor`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.invalid',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  for (const host of ['example.invalid', '127.0.0.1.example.invalid']) {
    test(`rejects the nonlocal Host ${host}`, async () => {
      const response = await rawRequest('/api/dev/health', { Host: host });
      assert.equal(response.status, 403);
      assert.equal(response.body.success, false);
    });
  }

  test('an absolute remote request target is rejected rather than proxied', async () => {
    const response = await rawRequest('http://example.invalid/api/dev/health');
    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
  });

  test('an unknown endpoint returns an explicit unsupported failure', async () => {
    const response = await fetch(`${base}/api/future-feature-that-has-no-local-handler`);
    assert.equal(response.status, 501);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Unsupported local demo API/);
  });

  test('a mutation without a local session cannot change sample records', async () => {
    const before = await (await fetch(`${base}/api/contractor/getAllContractors`)).json();
    const response = await fetch(`${base}/api/contractor/addContractor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Contractor_ID: 'BOUNDARY_TEST', Contractor_Name: 'Blocked boundary fixture' }),
    });
    assert.equal(response.status, 401);
    const after = await (await fetch(`${base}/api/contractor/getAllContractors`)).json();
    assert.deepEqual(after, before);
  });
});
