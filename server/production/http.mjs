import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { MENUS, MASTER_KEYS } from '../seed.mjs';
import { problem, publicUser, hashPassword, verifyPassword, validatePassword, validateAssignments, ROLES, digest, newToken, csrfFor, sessionCookie, readSessionCookie, canAccess } from './security.mjs';

const dummyHash = hashPassword('Dummy-not-an-account-8675309');
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value);
const text = (value, length) => typeof value === 'string' && value.trim().length > 0 && value.length <= length;
const canonical = value => String(value || '').toLowerCase().replace(/\/$/, '');
const masterKinds = { ...MASTER_KEYS, entities: ['entity_code'], departments: ['dept_code'] };

async function jsonBody(req) {
  if (['GET', 'HEAD'].includes(req.method)) return {};
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw problem(415, 'Use application/json.');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) throw problem(413, 'Request exceeds 1 MB.'); chunks.push(chunk); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw problem(400, 'Provide a valid JSON object.'); }
}

export function createProductionServer({ repository, config, log = event => console.error(JSON.stringify(event)) }) {
  if (!['staging', 'production'].includes(config.mode) || config.apiAdapter !== 'sql') throw new Error('This server requires staging/production with the SQL adapter.');
  const origin = new URL(config.publicOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== config.publicOrigin) throw new Error('PUBLIC_ORIGIN must be a canonical HTTPS origin without a trailing slash or path.');
  const routes = [];
  const register = (methods, path, handler, access = {}) => {
    for (const method of methods) routes.push({ method, path: canonical(path), handler, ...access });
  };
  const both = (path, handler, access) => register(['GET', 'POST'], path, handler, access);
  const attempts = new Map();
  function throttle(key, limit) {
    const now = Date.now();
    for (const [entry, value] of attempts) if (value.until <= now) attempts.delete(entry);
    const current = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (attempts.size >= 10000 && !attempts.has(key)) throw problem(429, 'Sign-in capacity reached. Retry later.');
    current.count++; attempts.set(key, current);
    if (current.count > limit) throw problem(429, 'Too many sign-in requests. Retry after 15 minutes.');
  }
  const accountResponse = (user, token) => ({ ...publicUser(user), token: 'cookie-session', sessionAuth: 'cookie', csrfToken: csrfFor(token), demo: false, environment: config.mode.toUpperCase() });
  register(['GET'], '/api/runtime', () => ({ mode: config.mode, demo: false }), { public: true });
  register(['POST'], '/api/users/login', async ({ body, req, res, correlation }) => {
    // Trust the socket address, never a caller-supplied forwarding header.
    throttle(`socket:${req.socket.remoteAddress || 'unknown'}`, 1000);
    if (!id(body.emp_id) || typeof body.password !== 'string' || body.password.length > 128) throw problem(401, 'Invalid user ID or password.');
    throttle(`account:${body.emp_id.toLowerCase()}`, 20);
    const user = await repository.findUser(body.emp_id);
    const valid = await verifyPassword(body.password, user?.passwordHash || await dummyHash);
    if (!valid || !user || user.Is_Active === 'N' || user.lockedUntil > new Date()) {
      await repository.failedLogin(body.emp_id);
      throw problem(401, 'Invalid user ID or password.');
    }
    const token = newToken();
    if (!await repository.login(user.emp_id, user.passwordHash, digest(token), config.sessionSeconds, correlation)) throw problem(401, 'Invalid user ID or password.');
    res.setHeader('Set-Cookie', sessionCookie(token, config.sessionSeconds));
    return accountResponse(user, token);
  }, { public: true });
  register(['GET'], '/api/users/session', async ({ user, token }) => accountResponse(user, token), { allowPasswordChange: true });
  register(['POST'], '/api/users/logout', async ({ user, token, res, correlation }) => {
    await repository.logout(digest(token), user, correlation);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return { success: true };
  }, { allowPasswordChange: true });
  register(['POST'], '/api/users/changePassword', async ({ user, body, res, correlation }) => {
    if (body.emp_id && body.emp_id !== user.emp_id) throw problem(403, 'Only your own password can be changed.');
    validatePassword(body.newPassword);
    if (!await verifyPassword(body.oldPassword, user.passwordHash)) throw problem(400, 'The current password is incorrect.');
    if (await verifyPassword(body.newPassword, user.passwordHash)) throw problem(400, 'Choose a different password.');
    await repository.changePassword(user.emp_id, user.passwordHash, await hashPassword(body.newPassword), correlation);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return { success: true, message: 'Password changed. Sign in again.' };
  }, { allowPasswordChange: true });
  both('/api/users/getAllUsers', async () => (await repository.listUsers()).map(user => ({ ...publicUser(user), assignments: user.assignments, version: user.version })), { admin: true });
  register(['POST'], '/api/users/register', async ({ body, user, correlation }) => {
    if (!id(body.emp_id) || !text(body.Name, 200) || !ROLES.includes(body.role)) throw problem(400, 'Provide a valid ID, name and ADMIN, OPERATOR or AUDITOR role.');
    if (body.email_id !== undefined && (typeof body.email_id !== 'string' || body.email_id.length > 254)) throw problem(400, 'Invalid email.');
    const created = { emp_id: body.emp_id, Name: body.Name.trim(), email_id: body.email_id || '', role: body.role, passwordHash: await hashPassword(body.password), assignments: validateAssignments(body.assignments), mustChangePassword: true };
    await repository.createUser(created, user, correlation);
    return { success: true, message: 'Account created. Initial password must be changed at sign-in.' };
  }, { admin: true });
  register(['PUT'], '/api/users/updateUser/:id', async ({ body, params, user, correlation }) => {
    if (!id(params.id) || !text(body.Name, 200) || !ROLES.includes(body.role) || !Number.isInteger(body.version) || !['Y', 'N'].includes(body.Is_Active)) throw problem(400, 'Provide account version, name, role and active status.');
    if (typeof body.email_id !== 'string' || body.email_id.length > 254) throw problem(400, 'Invalid email.');
    await repository.updateUser(params.id, { ...body, Name: body.Name.trim(), assignments: validateAssignments(body.assignments) }, user, correlation);
    return { success: true, message: 'Account updated and its sessions revoked.' };
  }, { admin: true });
  register(['POST'], '/api/admin/users/:id/reset-password', async ({ body, params, user, correlation }) => {
    if (!id(params.id) || !Number.isInteger(body.version)) throw problem(400, 'Provide the current account version.');
    if (params.id.toLowerCase() === user.emp_id.toLowerCase()) throw problem(400, 'Use Change password for your own account.');
    await repository.resetPassword(params.id, await hashPassword(body.password), body.version, user, correlation);
    return { success: true, message: 'Temporary password set. Existing sessions were revoked; password change is required.' };
  }, { admin: true });
  both('/api/menu/getMenuUserData', async ({ user }) => {
    const allowed = new Set();
    if (canAccess(user, 'masters')) Object.keys(MASTER_KEYS).forEach(kind => allowed.add('/masters/' + kind));
    if (user.role === 'ADMIN') allowed.add('/administration/server');
    const children = MENUS.filter(row => allowed.has(canonical(row.menu_url)));
    const parent = MENUS.find(row => row.menu_name === 'Masters Module').menu_id;
    const extra = [
      ...(user.role === 'ADMIN' ? [{ menu_id: 9000, parent_menu_id: MENUS[0].menu_id, menu_name: 'Server accounts & access', menu_url: '/administration/server' }] : []),
      ...(canAccess(user, 'workers') ? [{ menu_id: 9001, parent_menu_id: parent, menu_name: 'Worker records', menu_url: '/server/workers' }] : []),
      ...(canAccess(user, 'contractors') ? [{ menu_id: 9002, parent_menu_id: parent, menu_name: 'Contractor records', menu_url: '/server/contractors' }] : []),
      ...(canAccess(user, 'masters') ? [{ menu_id: 9003, parent_menu_id: parent, menu_name: 'Entities', menu_url: '/masters/entities' }, { menu_id: 9004, parent_menu_id: parent, menu_name: 'Departments', menu_url: '/masters/departments' }, { menu_id: 9005, parent_menu_id: parent, menu_name: 'Shifts', menu_url: '/masters/shifts' }] : []),
    ];
    const parents = new Set([...children, ...extra].map(row => row.parent_menu_id));
    return [...MENUS.filter(row => parents.has(row.menu_id) && !row.menu_url), ...children, ...extra];
  });
  both('/api/menu/getMenuActivityData', () => ['READ', 'WRITE'].map(activity => ({ activity_id: activity, activity_name: activity })), { admin: true });
  both('/api/assignRoles/getUserMenuActivityForSpecificMenu', ({ user }) => [{ activity_id: 'READ', activity_name: 'READ' }, ...(user.role === 'ADMIN' || user.role === 'OPERATOR' && user.assignments?.write?.length ? [{ activity_id: 'WRITE', activity_name: 'WRITE' }, { activity_id: 'UPLOAD', activity_name: 'UPLOAD' }] : [])]);

  for (const kind of ['worker', 'contractor']) {
    const module = kind === 'worker' ? 'workers' : 'contractors';
    const prefix = kind === 'worker' ? '/api/employee' : '/api/contractor';
    const plural = kind === 'worker' ? 'Employees' : 'Contractors';
    both(`${prefix}/getAll${plural}`, ({ user, body }) => repository.list(kind, user, body), { module });
    if (kind === 'worker') {
      both('/api/employee/getEmpMastDump', () => { throw problem(501, 'Full worker export is pending a paged export implementation. Use the core records screen.'); }, { module });
      for (const path of ['getEmployeeByCode', 'searchEmployees', 'getByAdhar', 'getByPanno']) both(`${prefix}/${path}`, async ({ user, body }) => {
        if (path === 'getByAdhar') return body.Adhar_No ? repository.list(kind, user, { ...body, adhar: body.Adhar_No }) : [];
        if (path === 'getByPanno') return body.panno ? repository.list(kind, user, { ...body, pan: body.panno }) : [];
        if (path === 'getEmployeeByCode') { const code = body.employee_code || body.emp_code || body.Employee_Code || body.code; return code ? repository.list(kind, user, { ...body, employeeCode: code }) : []; }
        return repository.list(kind, user, { ...body, search: body.search || body.searchTerm || body.query || '' });
      }, { module });
    }
    const save = async ({ user, body, params, correlation }, update) => {
      const key = kind === 'worker' ? 'Employee_Code' : 'Contractor_ID';
      const name = kind === 'worker' ? 'display_name' : 'Contractor_Name';
      if (!text(body[key], 80) || !text(body[name], 200) || /[\u0000-\u001f]/.test(body[key])) throw problem(400, 'Identifier and display name are required.');
      if (params.id && params.id !== body[key]) throw problem(400, 'The record identifier cannot be changed.');
      if (kind === 'worker' && !text(body.contractor_id, 80)) throw problem(400, 'Contractor is required.');
      for (const field of ['dept', 'bu', 'loc_code']) if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > 80)) throw problem(400, `Invalid ${field}.`);
      if (update && (!Number.isInteger(body.version) || body.version < 1)) throw problem(409, 'Reload the record to obtain its current version.');
      const allowed = Object.fromEntries(Object.entries(body).filter(([key]) => !/password|token|created_by|modified_by/i.test(key)));
      const data = await repository.saveRecord(kind, allowed, update ? body.version : null, user, correlation);
      return { success: true, message: 'Record saved.', data };
    };
    register(['POST'], `${prefix}/add${kind === 'worker' ? 'Employee' : 'Contractor'}`, ctx => save(ctx, false), { module, write: true });
    register(['PUT'], `${prefix}/update${kind === 'worker' ? 'Employee' : 'Contractor'}/:id`, ctx => save(ctx, true), { module, write: true });
  }
  register(['GET'], '/api/master-data/lookups', async ({ user }) => ({ entities: canAccess(user, 'masters') ? (await repository.listMasters('entities')).map(row => ({ value: row.entity_code, label: row.entity_name })) : [], contractors: canAccess(user, 'contractors') ? (await repository.list('contractor', user)).map(row => ({ value: row.Contractor_ID, label: row.Contractor_Name })) : [], shiftGroups: canAccess(user, 'masters') ? (await repository.listMasters('shift-groups')).map(row => ({ value: row.sh_group, label: row.sh_group_desc })) : [] }));
  for (const kind of Object.keys(masterKinds)) {
    register(['GET'], '/api/master-data/' + kind, () => repository.listMasters(kind), { module: 'masters' });
    for (const method of ['POST', 'PUT', 'DELETE']) register([method], '/api/master-data/' + kind, ({ body, user, correlation }) => repository.saveMaster(kind, masterKinds[kind], method, body, user, correlation), { admin: true });
  }
  register(['GET'], '/api/admin/audit', async () => ({ data: await repository.listAudit() }), { admin: true });
  register(['GET'], '/api/dev/capabilities', () => ({ demo: false, environment: config.mode.toUpperCase(), productionConnected: true, payrollEngine: 'unavailable', statutoryCalculations: 'unavailable', endpoints: [], unknownEndpoints: '501 - explicitly unavailable' }));
  register(['GET'], '/api/dev/features', () => ({ demo: false, environment: config.mode.toUpperCase(), features: [], message: 'Server core: accounts, scoped workers, contractors and masters. Attendance, leave and payroll migration pending.' }));

  const server = http.createServer(async (req, res) => {
    const correlation = randomUUID();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Correlation-ID', correlation);
    res.setHeader('X-CLMS-Environment', config.mode.toUpperCase());
    try {
      // Reject absolute-form targets, malformed escapes, and remote host overrides.
      if (!req.url?.startsWith('/') || req.url.startsWith('//')) throw problem(400, 'Invalid request target.');
      const url = new URL(req.url, config.publicOrigin); const path = canonical(url.pathname);
      if (req.method === 'GET' && ['/api/health/live', '/api/health/ready'].includes(path)) {
        if (path.endsWith('/ready')) await repository.health();
        res.end(JSON.stringify({ ok: true })); return;
      }
      if (req.headers.host !== origin.host) throw problem(403, 'Unexpected Host header.');
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== config.publicOrigin) throw problem(403, 'Request origin does not match this application.');
      let matched;
      for (const entry of routes) {
        if (entry.method !== req.method) continue;
        const keys = [];
        const pattern = entry.path.split('/').map(segment => segment.startsWith(':') ? (keys.push(segment.slice(1)), '([^/]+)') : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/');
        const match = url.pathname.replace(/\/$/, '').match(new RegExp(`^${pattern}$`, 'i'));
        if (match) { matched = { ...entry, params: Object.fromEntries(keys.map((key, n) => [key, decodeURIComponent(match[n + 1])])) }; break; }
      }
      const token = readSessionCookie(req.headers.cookie);
      let user;
      if (!matched?.public) {
        user = token ? await repository.getSession(digest(token), config.idleSeconds) : null;
        if (!user) throw problem(401, 'Sign in to continue.');
        if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== csrfFor(token)) throw problem(403, 'Session verification failed. Reload and retry.');
        if (user.mustChangePassword && !matched?.allowPasswordChange) throw problem(403, 'Change your initial password before accessing records.');
      }
      if (!matched) throw problem(501, 'This operation is not yet available in the SQL server release.');
      if (matched.admin && user.role !== 'ADMIN') throw problem(403, 'Administrator access required.');
      if (matched.module && !canAccess(user, matched.module, matched.write)) throw problem(403, 'This operation is not assigned to your account.');
      const payload = await jsonBody(req);
      const body = { ...Object.fromEntries(url.searchParams), ...payload };
      if (matched.write && matched.module === 'workers' && user.role !== 'ADMIN') {
        // Reject out-of-scope new records before reaching the repository as well.
        const scope = user.assignments || {};
        if (![['contractors', 'contractor_id'], ['departments', 'dept'], ['businessUnits', 'bu'], ['locations', 'loc_code']].every(([assignment, field]) => (scope[assignment] || []).includes(String(body[field] || '')))) throw problem(403, 'Record is outside your assigned scope.');
      }
      const result = await matched.handler({ body, params: matched.params, req, res, user, token, correlation });
      res.end(JSON.stringify(result));
    } catch (error) {
      const status = error.status || 503;
      if (!error.status) log({ level: 'error', event: 'API_FAILURE', correlation });
      res.statusCode = status;
      if (status === 429) res.setHeader('Retry-After', '900');
      res.end(JSON.stringify({ success: false, demo: false, message: error.status ? error.message : 'The service is temporarily unavailable.', correlationId: correlation }));
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return server;
}
