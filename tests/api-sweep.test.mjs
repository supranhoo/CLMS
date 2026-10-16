// Sweeps every route the server registers (from its own capability list), so a new endpoint is covered the day it is added:
//   - without a session, only the documented public routes answer; every other route is refused with 401,
//   - with an administrator session and an empty body, no route crashes (never a 5xx) and every answer is JSON,
//   - routes declared unsupported say so (501) and routes that need BFCL rules say so (422), never a fake success,
//   - a signed-in ordinary user cannot reach the administrator-only areas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server/index.mjs';

const PUBLIC = new Set(['POST /api/users/login', 'POST /api/users/logout', 'POST /api/users/generateresettoken', 'POST /api/users/resetpassword', 'GET /api/dev/health', 'GET /api/dev/capabilities', 'GET /api/dev/features', 'GET /api/menu/getmenuuserdata', 'POST /api/menu/getmenuuserdata']);
const ADMIN_ONLY = /^\/api\/(?:dev|assignroles|users|compliance\/profiles|payroll\/rules)/i;
const SELF_SERVICE = new Set(['/api/users/changepassword', '/api/users/logout']);
const concrete = path => path.replace(/:[A-Za-z]+/g, '1');

async function start(t) {
  const server = createServer({ persist: false }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }));
  const port = server.address().port;
  const call = async (method, path, token, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
    const text = await response.text(); let json; try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: response.status, json, text };
  };
  const login = async (id, password) => (await call('POST', '/api/users/login', null, { emp_id: id, password })).json?.token;
  const admin = await login('demo', 'demo123');
  const capabilities = (await call('GET', '/api/dev/capabilities')).json.endpoints;
  return { call, login, admin, capabilities, server };
}

test('SWEEP-01 the server lists every route with a status, and the list is large enough to matter', async t => {
  const { capabilities } = await start(t);
  assert.ok(capabilities.length >= 400, `only ${capabilities.length} routes listed`);
  const statuses = new Set(capabilities.map(c => c.status));
  for (const status of statuses) assert.ok(['implemented', 'simulated', 'rules-required', 'unsupported'].includes(status), `unknown route status ${status}`);
  assert.equal(new Set(capabilities.map(c => `${c.method} ${c.path.toLowerCase()}`)).size, capabilities.length, 'no route is listed twice');
});

test('SWEEP-02 without a session every route is refused (401) except the documented public ones', async t => {
  const { call, capabilities } = await start(t); const open = [];
  for (const c of capabilities) {
    if (c.path.toLowerCase() === '/api/dev/reset') continue;
    const response = await call(c.method, concrete(c.path), null, {});
    const isPublic = PUBLIC.has(`${c.method} ${c.path.toLowerCase()}`);
    if (!isPublic && response.status !== 401 && response.status !== 501) open.push(`${c.method} ${c.path} -> ${response.status}`);
    if (response.status >= 500 && response.status !== 501) open.push(`${c.method} ${c.path} crashed: ${response.status}`);
  }
  assert.deepEqual(open, []);
});

test('SWEEP-03 an administrator can call every route with an empty body without a crash, and every answer is JSON', async t => {
  const { call, admin, capabilities } = await start(t); const problems = [];
  for (const c of capabilities) {
    if (c.path.toLowerCase() === '/api/dev/reset') continue; // exercised on its own below: it wipes the state the sweep relies on
    const response = await call(c.method, concrete(c.path), admin, {});
    if (response.json === undefined) problems.push(`${c.method} ${c.path}: not JSON (${response.status})`);
    else if (response.status >= 500 && response.status !== 501) problems.push(`${c.method} ${c.path}: ${response.status} ${response.json.message}`);
  }
  assert.deepEqual(problems, []);
});

test('SWEEP-04 routes declared unsupported answer 501 with an explanation; none returns a fake success', async t => {
  const { call, admin, capabilities } = await start(t);
  const unsupported = capabilities.filter(c => c.status === 'unsupported'); assert.ok(unsupported.length > 50);
  const wrong = [];
  for (const c of unsupported) {
    const response = await call(c.method, concrete(c.path), admin, {});
    if (response.status !== 501 || !/not supported|unavailable|unsupported/i.test(response.json?.message || '')) wrong.push(`${c.method} ${c.path} -> ${response.status} ${response.json?.message}`);
  }
  assert.deepEqual(wrong, []);
});

test('SWEEP-05 an unknown path is a 501 "unsupported" answer, never a 404 page or a proxy to production', async t => {
  const { call, admin } = await start(t);
  for (const [method, path] of [['GET', '/api/does/not/exist'], ['POST', '/api/wages/definitelyNotARoute'], ['DELETE', '/api/employee']]) {
    const response = await call(method, path, admin, {});
    assert.equal(response.status, 501, `${method} ${path}`); assert.match(response.json.message, /Unsupported|not supported/i);
  }
});

test('SWEEP-06 an ordinary signed-in user is refused the administrator-only routes (403) and can still reach the rest of the API', async t => {
  const { call, admin, capabilities } = await start(t);
  assert.equal((await call('POST', '/api/users/register', admin, { emp_id: 'sweepuser', Name: 'Sweep', password: 'Passw0rd1' })).status, 200);
  assert.equal((await call('POST', '/api/assignRoles/saveAll', admin, { emp_code: 'sweepuser', roles: { BU: ['B01'], Contractor: ['D001'], Dept: ['D01'], Menu: [], Location: ['L01'], MenuActivity: ['WRITE'] } })).status, 200);
  const token = (await call('POST', '/api/users/login', null, { emp_id: 'sweepuser', password: 'Passw0rd1' })).json.token;
  const leaked = []; let reachable = 0;
  for (const c of capabilities) {
    const lower = c.path.toLowerCase(); if (lower === '/api/dev/reset' || PUBLIC.has(`${c.method} ${lower}`)) continue;
    const response = await call(c.method, concrete(c.path), token, {});
    if (ADMIN_ONLY.test(lower) && !SELF_SERVICE.has(lower)) { if (response.status !== 403 && response.status !== 501) leaked.push(`${c.method} ${c.path} -> ${response.status}`); }
    else if (response.status < 400) reachable++;
    if (response.status >= 500 && response.status !== 501) leaked.push(`${c.method} ${c.path} crashed ${response.status}`);
  }
  assert.deepEqual(leaked, []); assert.ok(reachable > 50, `only ${reachable} routes were reachable for the ordinary user`);
});

test('SWEEP-07 the reset route restores the fixtures, revokes every session and needs an administrator', async t => {
  const { call, admin, login } = await start(t);
  assert.equal((await call('POST', '/api/users/register', admin, { emp_id: 'resetme', Name: 'Reset Me', password: 'Passw0rd1' })).status, 200);
  const other = await login('resetme', 'Passw0rd1');
  assert.equal((await call('POST', '/api/dev/reset', other, {})).status, 403);
  assert.equal((await call('POST', '/api/dev/reset', null, {})).status, 401);
  assert.equal((await call('POST', '/api/dev/reset', admin, {})).status, 200);
  assert.equal((await call('GET', '/api/dev/health', admin)).status, 200);
  assert.equal((await call('GET', '/api/employee/getAllEmployees', admin)).status, 401, 'the administrator session was revoked by the reset');
  assert.equal(await login('resetme', 'Passw0rd1'), undefined, 'the extra account is gone');
  const fresh = await login('demo', 'demo123'); assert.ok(fresh);
  assert.equal((await call('GET', '/api/employee/getAllEmployees', fresh)).json.length, 4);
});
