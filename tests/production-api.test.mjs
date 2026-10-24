import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createProductionServer } from '../server/production/http.mjs';
import { hashPassword, verifyPassword, digest, csrfFor, inScope, canAccess, validateAssignments } from '../server/production/security.mjs';

// HTTP/service tests use an explicit test repository. SQL behavior is tested
// separately against a provisioned, disposable SQL Server database.
class TestRepository {
  users = new Map(); sessions = new Map(); records = { worker: [], contractor: [] }; audit = [];
  async findUser(id) { return this.users.get(id); }
  async failedLogin() {}
  async login(id, previous, token) { this.sessions.set(token, id); return true; }
  async getSession(token) { const user = this.users.get(this.sessions.get(token)); return user?.Is_Active === 'Y' ? user : null; }
  async logout(token) { this.sessions.delete(token); }
  async health() { return true; }
  async changePassword(id, old, hash) { const user = this.users.get(id); user.passwordHash = hash; user.mustChangePassword = false; for (const [token, userId] of this.sessions) if (userId === id) this.sessions.delete(token); }
  async list(kind, actor) { return this.records[kind].filter(row => inScope(actor, row, kind)); }
  async saveRecord(kind, data) { this.records[kind].push(data); return data; }
  async listMasters() { return []; }
  async listUsers() { return [...this.users.values()]; }
  async createUser(user) { this.users.set(user.emp_id, { ...user, Is_Active: 'Y', version: 1 }); }
}

async function fixture(run) {
  const repository = new TestRepository();
  repository.users.set('admin', { emp_id: 'admin', Name: 'Test administrator', role: 'ADMIN', Is_Active: 'Y', passwordHash: await hashPassword('CorrectPassword123!'), mustChangePassword: false, assignments: {}, version: 1 });
  const logs = [];
  const server = createProductionServer({ repository, config: { mode: 'staging', apiAdapter: 'sql', publicOrigin: 'https://clms.test', sessionSeconds: 43200, idleSeconds: 1800 }, log: event => logs.push(event) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, cookie, csrf, headers = {} } = {}) => {
    return new Promise((resolve, reject) => {
      const req = http.request(base + path, { method, headers: { Host: 'clms.test', Origin: 'https://clms.test', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers } }, response => {
        let text = ''; response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
        response.on('end', () => { const resultHeaders = new Headers(); for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) resultHeaders.set(key, Array.isArray(value) ? value.join(', ') : value); resolve({ status: response.statusCode, body: JSON.parse(text), headers: resultHeaders }); });
      });
      req.on('error', reject);
      if (!['GET', 'HEAD'].includes(method) && body !== undefined) req.write(JSON.stringify(body));
      req.end();
    });
  };
  const login = async (emp_id = 'admin', password = 'CorrectPassword123!') => {
    const response = await call('/api/users/login', { method: 'POST', body: { emp_id, password } });
    return { ...response, cookie: response.headers.get('set-cookie')?.split(';')[0], csrf: response.body.csrfToken };
  };
  try { await run({ repository, call, login, logs }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('server passwords are salted and scopes deny empty and cross-scope assignments', async () => {
  const password = 'CorrectPassword123!'; const first = await hashPassword(password); const second = await hashPassword(password);
  assert.notEqual(first, second); assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true); assert.equal(await verifyPassword('wrong', first), false);
  await assert.rejects(hashPassword('demo123'), /12–128/);
  const user = { role: 'OPERATOR', assignments: validateAssignments({ read: ['workers'], contractors: ['C1'], departments: ['D1'], businessUnits: ['B1'], locations: ['L1'] }) };
  const row = { contractor_id: 'C1', dept: 'D1', bu: 'B1', loc_code: 'L1' };
  assert.equal(inScope(user, row, 'worker'), true);
  assert.equal(inScope(user, { ...row, dept: 'D2' }, 'worker'), false);
  assert.equal(inScope({ role: 'OPERATOR', assignments: {} }, row, 'worker'), false);
  assert.equal(canAccess(user, 'workers', true), false);
  assert.equal(canAccess({ role: 'AUDITOR', assignments: { write: ['workers'] } }, 'workers', true), false);
});

test('cookie sessions protect all records, reject forged hosts/origins/CSRF and revoke on logout', () => fixture(async ({ call, login }) => {
  assert.equal((await call('/api/runtime')).body.demo, false);
  assert.equal((await call('/api/employee/getAllEmployees')).status, 401);
  assert.equal((await call('/api/users/login', { method: 'POST', body: { emp_id: 'demo', password: 'demo123' } })).status, 401);
  const auth = await login(); assert.equal(auth.status, 200);
  const cookie = auth.headers.get('set-cookie');
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag));
  assert.equal(auth.body.token, 'cookie-session'); assert.equal(auth.body.passwordHash, undefined);
  assert.equal((await call('/api/users/session', auth)).status, 200);
  assert.equal((await call('/api/users/session', { ...auth, headers: { Host: 'other.test' } })).status, 403);
  assert.equal((await call('/api/users/logout', { ...auth, method: 'POST', body: {}, csrf: undefined })).status, 403);
  assert.equal((await call('/api/users/logout', { ...auth, method: 'POST', body: {}, headers: { Origin: 'https://other.test' } })).status, 403);
  assert.equal((await call('/api/dev/reset', { ...auth, method: 'POST', body: {} })).status, 501);
  assert.equal((await call('/api/users/logout', { ...auth, method: 'POST', body: {} })).status, 200);
  assert.equal((await call('/api/users/session', auth)).status, 401);
}));

test('initial passwords gate records, password change revokes sessions and old credentials fail', () => fixture(async ({ call, login, repository }) => {
  repository.users.get('admin').mustChangePassword = true;
  const auth = await login();
  assert.equal(auth.body.mustChangePassword, true);
  assert.equal((await call('/api/employee/getAllEmployees', auth)).status, 403);
  assert.equal((await call('/api/users/changePassword', { ...auth, method: 'POST', body: { oldPassword: 'wrong', newPassword: 'NewCorrectPassword123!' } })).status, 400);
  assert.equal((await call('/api/users/changePassword', { ...auth, method: 'POST', body: { oldPassword: 'CorrectPassword123!', newPassword: 'NewCorrectPassword123!' } })).status, 200);
  assert.equal((await call('/api/users/session', auth)).status, 401);
  assert.equal((await login()).status, 401);
  assert.equal((await login('admin', 'NewCorrectPassword123!')).status, 200);
}));

test('permission-filtered menu and user actions cannot be broadened by request body', () => fixture(async ({ call, login, repository }) => {
  repository.users.set('reader', { ...repository.users.get('admin'), emp_id: 'reader', role: 'AUDITOR', assignments: { read: ['workers'], contractors: ['C1'], departments: ['D1'], businessUnits: ['B1'], locations: ['L1'] } });
  repository.records.worker.push({ Employee_Code: 'Allowed', contractor_id: 'C1', dept: 'D1', bu: 'B1', loc_code: 'L1' }, { Employee_Code: 'Denied', contractor_id: 'C2', dept: 'D1', bu: 'B1', loc_code: 'L1' });
  const auth = await login('reader');
  const menu = await call('/api/menu/getMenuUserData', { ...auth, method: 'POST', body: { emp_id: 'admin' } });
  assert.equal(menu.status, 200);
  assert.ok(menu.body.some(row => row.menu_url === '/server/workers'));
  assert.ok(!menu.body.some(row => row.menu_url === '/administration/server' || row.menu_url === '/server/contractors'));
  assert.equal((await call('/api/employee/getAllEmployees', auth)).body.length, 1);
  assert.equal((await call('/api/users/getAllUsers', auth)).status, 403);
  assert.equal((await call('/api/users/register', { ...auth, method: 'POST', body: { emp_id: 'evil', role: 'ADMIN', Name: 'Bad', password: 'Password123456' } })).status, 403);
  assert.equal((await call('/api/employee/addEmployee', { ...auth, method: 'POST', body: { Employee_Code: 'X', display_name: 'No', contractor_id: 'C1' } })).status, 403);
}));

test('service failures return redacted errors and correlation IDs, with no synthetic fallback', () => fixture(async ({ call, login, repository, logs }) => {
  const auth = await login();
  repository.list = async () => { throw new Error('password=SECRET database=PRIVATE'); };
  const response = await call('/api/contractor/getAllContractors', auth);
  assert.equal(response.status, 503); assert.equal(response.body.demo, false);
  assert.ok(response.body.correlationId);
  assert.ok(!JSON.stringify([response.body, logs]).includes('SECRET'));
}));

test('master changes require administrator access even when a module write is assigned', () => fixture(async ({ call, login, repository }) => {
  repository.users.set('operator', { ...repository.users.get('admin'), emp_id: 'operator', role: 'OPERATOR', assignments: { read: ['masters'], write: ['masters'] } });
  const auth = await login('operator');
  assert.equal((await call('/api/master-data/locations', auth)).status, 200);
  assert.equal((await call('/api/master-data/locations', { ...auth, method: 'POST', body: { loc_code: 'L1', loc_name: 'Test' } })).status, 403);
}));

test('write assignments still reject cross-scope worker submissions and preserve case-sensitive identifiers', () => fixture(async ({ call, login, repository }) => {
  repository.users.set('operator', { ...repository.users.get('admin'), emp_id: 'operator', role: 'OPERATOR', assignments: { read: ['workers'], write: ['workers'], contractors: ['C1'], departments: ['D1'], businessUnits: ['B1'], locations: ['L1'] } });
  const auth = await login('operator');
  const body = { Employee_Code: 'MixedCase001', display_name: 'Test', contractor_id: 'C2', dept: 'D1', bu: 'B1', loc_code: 'L1' };
  assert.equal((await call('/api/employee/addEmployee', { ...auth, method: 'POST', body })).status, 403);
  assert.equal(repository.records.worker.length, 0);
  body.contractor_id = 'C1';
  assert.equal((await call('/api/employee/addEmployee', { ...auth, method: 'POST', body })).status, 200);
  assert.equal((await call('/api/employee/updateEmployee/MixedCase001', { ...auth, method: 'PUT', body: { ...body, version: 1 } })).status, 200);
}));

test('attendance and leave routes enforce separate read, write and approval rights', () => fixture(async ({ call, login, repository }) => {
  let reviewedBy;
  repository.reviewLeave = async (id, body, actor) => { reviewedBy = actor.emp_id; return { success: true }; };
  repository.requestLeave = async () => ({ success: true, status: 'PENDING' });
  repository.users.set('operator', { ...repository.users.get('admin'), emp_id: 'operator', role: 'OPERATOR', assignments: { read: ['attendance','leave'], write: ['attendance','leave'], approve: [] } });
  const auth = await login('operator');
  assert.ok(auth.body.assignments.write.includes('leave'));
  const menu = (await call('/api/menu/getMenuUserData', { ...auth, method: 'POST', body: {} })).body;
  assert.ok(menu.some(row => row.menu_url === '/server/attendance'));
  assert.ok(menu.some(row => row.menu_url === '/server/leave'));
  assert.equal((await call('/api/server/leave/requests', { ...auth, method: 'POST', body: {} })).status, 200);
  assert.equal((await call('/api/server/leave/requests/00000000-0000-0000-0000-000000000001/review', { ...auth, method: 'POST', body: { emp_id: 'admin', version: 1, status: 'APPROVED' } })).status, 403);
  assert.equal(reviewedBy, undefined);
  repository.users.get('operator').assignments.approve = ['leave'];
  assert.equal((await call('/api/server/leave/requests/00000000-0000-0000-0000-000000000001/review', { ...auth, method: 'POST', body: { emp_id: 'admin', version: 1, status: 'APPROVED' } })).status, 200);
  assert.equal(reviewedBy, 'operator');
  repository.users.get('operator').role = 'AUDITOR';
  assert.equal((await call('/api/server/leave/requests', { ...auth, method: 'POST', body: {} })).status, 403);
  assert.equal((await call('/api/server/leave/requests/00000000-0000-0000-0000-000000000001/review', { ...auth, method: 'POST', body: {} })).status, 403);
  assert.equal((await call('/api/server/period-locks', auth)).status, 403);
  assert.equal((await call('/api/server/leave/credits', { ...auth, method: 'POST', body: {} })).status, 403);
}));
