import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const cleanUser = ({ passwordHash, passwordSalt, password, ...row }) => ({ ...row, password: '' });
const admin = user => user?.role === 'LOCAL_DEMO_ADMIN' || user?.emp_id === 'demo';
const hashPassword = password => { const salt = randomBytes(16).toString('hex'); return { passwordSalt: salt, passwordHash: scryptSync(password, salt, 32).toString('hex') }; };
function passwordMatches(user, password) { if (!user?.passwordHash || typeof password !== 'string') return false; const hash = scryptSync(password, user.passwordSalt, 32); const saved = Buffer.from(user.passwordHash, 'hex'); return saved.length === hash.length && timingSafeEqual(saved, hash); }
const keyFor = { BU: 'bu_code', Contractor: 'contractor_code', Dept: 'dept_code', Menu: 'menu_id', MenuActivity: 'menu_id', Location: 'loc_code' };
function selectionValues(rows, key) { return (rows || []).map(row => String(typeof row === 'object' ? row[key] ?? row.value ?? '' : row)); }
function isScopedEmployee(state, user, employee) {
  if (admin(user)) return true;
  const roles = state.roles?.[user?.emp_id] || {};
  return [['Contractor', 'contractor_id', 'contractor_code'], ['Dept', 'dept', 'dept_code'], ['BU', 'bu', 'bu_code'], ['Location', 'loc_code', 'loc_code']].every(([kind, field, key]) => {
    const selected = selectionValues(roles[kind], key);
    return selected.length > 0 && selected.includes(String(employee[field] ?? ''));
  });
}
export function authorizeLocalRequest(state, request, body, fail) {
  const path = request.path.toLowerCase();
  const publicPath = ['/api/users/login', '/api/users/logout', '/api/users/generateresettoken', '/api/users/resetpassword', '/api/dev/health', '/api/dev/capabilities', '/api/dev/features'];
  if (publicPath.includes(path)) return;
  if (!request.user) {
    if (request.token) fail(401, 'The local session has expired. Sign in to the demo workspace again.');
    if (path === '/api/menu/getmenuuserdata') return;
    // Every other read needs a session too: worker records hold identity numbers and the account list holds contact details.
    fail(401, 'A local login is required.');
  }
  if (admin(request.user)) return;
  // Changing your own password is self-service; the handler itself refuses any other account.
  if (path === '/api/users/changepassword') return;
  if (/^\/api\/(?:dev|assignroles|users|compliance\/profiles|payroll\/rules)/.test(path)) fail(403, 'Local administrator access is required.');
  const code = body.employee_code || body.Employee_Code || body.EmployeeCode;
  if (code) { const employee = state.employees.find(row => row.Employee_Code === code); if (employee && !isScopedEmployee(state, request.user, employee)) fail(403, 'This worker is outside the assigned local scope.'); }
  if (request.isMutation) {
    const checkRow = row => {
      const code = row.employee_code || row.Employee_Code || row.EmployeeCode;
      const employee = state.employees.find(item => item.Employee_Code === code);
      if (employee && !isScopedEmployee(state, request.user, employee)) fail(403, 'A row is outside the assigned local worker scope.');
      const contractorId = row.contractor_id || row.Contractor_ID || row.ContractorID;
      if (contractorId && !selectionValues(state.roles?.[request.user.emp_id]?.Contractor, 'contractor_code').includes(String(contractorId))) fail(403, 'A row is outside the assigned local contractor scope.');
    };
    if (Array.isArray(body)) body.forEach(checkRow);
    else { checkRow(body); for (const value of Object.values(body)) if (Array.isArray(value)) value.filter(item => item && typeof item === 'object').forEach(checkRow); }
  }
  if (request.isMutation) {
    // The original activity model is retained. A non-admin must have an explicit
    // write activity as well as an allowed menu; empty assignments never mean all.
    const activities = state.roles?.[request.user.emp_id]?.MenuActivity || [];
    if (!activities.some(row => ['WRITE', 'ALL', 'LOCAL_DEMO'].includes(String(row.activity_name || row.activity_id || row)))) fail(403, 'A write activity must be assigned before changing local data.');
  }
}
export function canSeeEmployee(state, user, employeeCode) {
  if (!user || admin(user)) return true;
  const employee = state.employees.find(row => row.Employee_Code === employeeCode);
  return Boolean(employee) && isScopedEmployee(state, user, employee);
}
export function scopeLocalResult(state, result, request) {
  if (!request.user || admin(request.user)) return result;
  const workers = new Set(state.employees.filter(row => isScopedEmployee(state, request.user, row)).map(row => row.Employee_Code));
  const contractors = new Set(selectionValues(state.roles?.[request.user.emp_id]?.Contractor, 'contractor_code'));
  const keep = row => {
    if (!row || typeof row !== 'object') return true;
    const code = row.Employee_Code || row.employee_code || row.EmployeeCode || row.emp_code;
    if (code) return workers.has(code);
    if (row.Contractor_ID || row.contractor_id || row.contractor_code) return contractors.has(String(row.Contractor_ID || row.contractor_id || row.contractor_code));
    return true;
  };
  // Lists are filtered at every depth, so a report that nests its rows (accounting inputs, compliance data) is scoped too.
  const scope = (value, depth) => {
    if (depth > 4) return value;
    if (Array.isArray(value)) return value.filter(keep).map(item => (item && typeof item === 'object' ? scope(item, depth + 1) : item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, scope(inner, depth + 1)]));
    return value;
  };
  return scope(result, 0);
}

export function registerAdministrationRoutes(ctx) {
  const { route, both, getState, save, fail, required, success, sessions, menus, departments } = ctx;
  function state() {
    const s = getState(); s.authUsers ||= []; s.recoveryOutbox ||= []; s.recoveryRequests ||= {}; s.auditLog ||= [];
    if (!s.authUsers.some(row => row.emp_id === 'demo')) s.authUsers.push({ emp_id: 'demo', Name: 'Demo Developer', email_id: 'demo@example.invalid', role: 'LOCAL_DEMO_ADMIN', Is_Active: 'Y', Created_Date: new Date().toISOString(), ...hashPassword('demo123') });
    return s;
  }
  const audit = (action, target, actor) => { state().auditLog.push({ id: randomBytes(8).toString('hex'), action, target, actor: actor?.emp_id || 'local-recovery', at: new Date().toISOString() }); save(); };
  function validatePassword(value) { if (typeof value !== 'string' || value.length < 8 || value.length > 128 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) fail(400, 'Use 8–128 characters with letters and numbers for the local account.'); }
  function publicAccount(row) { return { ...cleanUser(row), environment: 'LOCAL_SYNTHETIC_DEMO', demo: true }; }
  function invalidate(code) { for (const [token, user] of sessions) if (user.emp_id === code) sessions.delete(token); }
  // Failed sign-ins are counted per user ID (known or not): ten in a row lock that ID for a minute.
  const failedLogins = new Map(); const MAX_FAILED_LOGINS = 10; const LOGIN_LOCK_MS = 60_000;
  const DUMMY_ACCOUNT = { passwordSalt: '00'.repeat(16), passwordHash: '00'.repeat(32) };
  route('POST', '/api/users/login', body => {
    const id = typeof body.emp_id === 'string' ? body.emp_id.slice(0, 64) : '';
    const attempts = failedLogins.get(id);
    if (attempts?.lockedUntil > Date.now()) fail(429, `Too many failed sign-ins for this user ID. Try again in ${Math.ceil((attempts.lockedUntil - Date.now()) / 1000)} seconds.`);
    const row = state().authUsers.find(user => user.emp_id === body.emp_id && user.Is_Active !== 'N');
    // An unknown ID still pays for one password hash, so response time does not reveal which IDs exist.
    if (!passwordMatches(row || DUMMY_ACCOUNT, body.password) || !row) {
      if (failedLogins.size > 5000) failedLogins.clear();
      const count = (attempts?.lockedUntil > 0 ? 0 : attempts?.count || 0) + 1;
      failedLogins.set(id, { count, lockedUntil: count >= MAX_FAILED_LOGINS ? Date.now() + LOGIN_LOCK_MS : 0 });
      fail(401, 'Invalid local user ID or password. Demo access: demo / demo123.');
    }
    failedLogins.delete(id);
    const token = 'local-demo-' + randomBytes(24).toString('hex'); sessions.set(token, cleanUser(row));
    return { ...publicAccount(row), token };
  });
  route('POST', '/api/users/logout', (body, params, request) => { if (request?.token) sessions.delete(request.token); return success('Signed out of the local session.'); });
  both('/api/users/getAllUsers', () => state().authUsers.map(publicAccount));
  route('POST', '/api/users/register', (body, params, request) => {
    required(body, ['emp_id', 'Name', 'password']); validatePassword(body.password);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(body.emp_id)) fail(400, 'User ID must use up to 40 letters, numbers, underscores or hyphens.');
    if (state().authUsers.some(row => row.emp_id === body.emp_id)) fail(409, 'This local user already exists.');
    const row = { emp_id: body.emp_id, Name: String(body.Name).trim(), email_id: body.email_id || '', mobile_no: body.mobile_no || '', role: body.role === 'LOCAL_DEMO_ADMIN' ? body.role : 'LOCAL_OPERATOR', Is_Active: 'Y', Created_Date: new Date().toISOString(), ...hashPassword(body.password) };
    state().authUsers.push(row); audit('USER_CREATED', row.emp_id, request?.user); return publicAccount(row);
  }, { mutation: true });
  route('PUT', '/api/users/updateUser/:id', (body, params, request) => {
    const row = state().authUsers.find(user => user.emp_id === params.id); if (!row) fail(404, 'Local account not found.');
    if (row.emp_id === 'demo' && (body.role && body.role !== 'LOCAL_DEMO_ADMIN' || body.Is_Active === 'N' || body.password)) fail(409, 'The public demo administrator is retained for sandbox recovery. Create another local account to test password or role changes.');
    if (body.role && !['LOCAL_DEMO_ADMIN', 'LOCAL_OPERATOR'].includes(body.role)) fail(400, 'Unknown local role.');
    if (body.password) { validatePassword(body.password); Object.assign(row, hashPassword(body.password)); invalidate(row.emp_id); }
    for (const key of ['Name', 'email_id', 'mobile_no', 'Is_Active']) if (body[key] !== undefined) row[key] = body[key];
    if (body.role) { row.role = body.role; invalidate(row.emp_id); }
    if (body.Is_Active === 'N') invalidate(row.emp_id);
    audit('USER_UPDATED', row.emp_id, request?.user); return publicAccount(row);
  }, { mutation: true });
  route('POST', '/api/users/changePassword', (body, params, request) => {
    if (!request?.user || request.user.emp_id !== body.emp_id) fail(403, 'Only the signed-in local account can change its password.');
    if (body.emp_id === 'demo') fail(409, 'The public demo password remains demo123. Use a separate local account to test password changes.');
    const row = state().authUsers.find(user => user.emp_id === body.emp_id);
    if (!passwordMatches(row, body.oldPassword)) fail(400, 'The current local password is incorrect.');
    validatePassword(body.newPassword); Object.assign(row, hashPassword(body.newPassword)); invalidate(row.emp_id); audit('PASSWORD_CHANGED', row.emp_id, request.user); return success('Local password changed. Sign in again.');
  }, { mutation: true });
  route('POST', '/api/users/generateResetToken', body => {
    required(body, ['emp_id']); const s = state(); const user = s.authUsers.find(row => row.emp_id === body.emp_id);
    if (body.emp_id === 'demo') fail(409, 'The public demo password remains demo123.');
    const day = new Date().toISOString().slice(0, 10); const limitKey = `${body.emp_id}:${day}`;
    if ((s.recoveryRequests[limitKey] || 0) >= 3) fail(429, 'The local recovery limit is three requests per day.');
    s.recoveryRequests[limitKey] = (s.recoveryRequests[limitKey] || 0) + 1;
    if (user) { const token = randomBytes(16).toString('hex'); s.recoveryOutbox = s.recoveryOutbox.filter(row => row.emp_id !== body.emp_id); s.recoveryOutbox.push({ id: randomBytes(8).toString('hex'), emp_id: body.emp_id, token, expiresAt: new Date(Date.now() + 600000).toISOString(), used: false, delivery: 'LOCAL_ADMIN_OUTBOX_ONLY' }); }
    save(); return success('For an existing local account, recovery instructions are available in the local administrator outbox. No email or WhatsApp message was sent.');
  });
  route('GET', '/api/dev/outbox', () => ({ data: state().recoveryOutbox.filter(row => !row.used) }), { mutation: true });
  route('POST', '/api/users/resetPassword', body => {
    validatePassword(body.newPassword); const record = state().recoveryOutbox.find(row => row.emp_id === body.emp_id && row.token === body.token && !row.used && new Date(row.expiresAt) > new Date());
    if (!record) fail(400, 'The local recovery token is invalid, used or expired.');
    const user = state().authUsers.find(row => row.emp_id === body.emp_id); if (!user || user.emp_id === 'demo') fail(400, 'Local account not found.');
    Object.assign(user, hashPassword(body.newPassword)); record.used = true; invalidate(user.emp_id); audit('PASSWORD_RESET', user.emp_id); return success('Local password reset.');
  });
  route('GET', '/api/dev/audit', () => ({ data: state().auditLog.slice().reverse() }), { mutation: true });

  const lists = {
    BU: () => getState().masters['business-units'], Contractor: () => getState().contractors.map(row => ({ contractor_code: row.Contractor_ID, contractor_name: row.Contractor_Name })),
    Dept: () => departments, Menu: () => menus, Location: () => getState().masters.locations,
    MenuActivity: () => [{ menu_id: 'WRITE', activity_id: 'WRITE', activity_name: 'WRITE' }, { menu_id: 'READ', activity_id: 'READ', activity_name: 'READ' }],
  };
  both('/api/menu/getMenuActivityData', () => lists.MenuActivity());
  route('POST', '/api/assignRoles/saveAll', (body, params, request) => {
    const code = body.emp_code;
    if (!state().authUsers.some(row => row.emp_id === code)) fail(404, 'Choose an existing local user.');
    if (code === 'demo') fail(409, 'The demo administrator retains full local access. Assign a separate account.');
    const next = {};
    for (const [kind, list] of Object.entries(lists)) {
      const selected = body.roles?.[kind]; if (!Array.isArray(selected)) fail(400, `Provide a ${kind} array, including an empty array to clear it.`);
      const values = selectionValues(selected, keyFor[kind]); const available = list();
      if (values.some(value => !available.some(row => String(row[keyFor[kind]]) === value))) fail(400, `Unknown ${kind} selection. No assignments were changed.`);
      next[kind] = available.filter(row => values.includes(String(row[keyFor[kind]])));
    }
    state().roles ||= {}; state().roles[code] = next; audit('ASSIGN_ALL', code, request?.user); return success('Local assignments saved atomically.');
  }, { mutation: true });
  for (const [kind, list] of Object.entries(lists)) {
    both('/api/assignRoles/getUser' + kind, body => { const code = body.emp_id || body.emp_code; if (code === 'demo') return list(); const selected = selectionValues(getState().roles?.[code]?.[kind], keyFor[kind]); return list().filter(row => selected.includes(String(row[keyFor[kind]]))); });
    route('POST', '/api/assignRoles/assignUser' + kind, (body, params, request) => {
      const code = body.emp_code || body.emp_id; if (!state().authUsers.some(row => row.emp_id === code)) fail(404, 'Choose an existing local user.');
      if (code === 'demo') fail(409, 'The demo administrator retains full local access. Assign a separate local account.');
      const payloadKey = { BU: 'bu_codes', Contractor: 'contractor_ids', Dept: 'dept_codes', Location: 'loc_codes', Menu: 'menu_ids', MenuActivity: 'menu_ids' }[kind];
      if (!Array.isArray(body[payloadKey])) fail(400, `${payloadKey} must be an array.`);
      const values = selectionValues(body[payloadKey], keyFor[kind]); const available = list();
      if (values.some(value => !available.some(row => String(row[keyFor[kind]]) === value))) fail(400, 'One or more selected assignments do not exist.');
      state().roles ||= {}; state().roles[code] ||= {}; state().roles[code][kind] = available.filter(row => values.includes(String(row[keyFor[kind]])));
      audit('ASSIGN_' + kind.toUpperCase(), code, request?.user); return success('Local assignments saved, including empty selections.');
    }, { mutation: true });
  }
  both('/api/assignRoles/getUserMenuActivityForSpecificMenu', (body, params, request) => admin(request?.user) ? [{ activity_id: 'WRITE', activity_name: 'WRITE' }, { activity_id: 'READ', activity_name: 'READ' }, { activity_id: 'UPLOAD', activity_name: 'UPLOAD' }] : getState().roles?.[request?.user?.emp_id]?.MenuActivity || []);
  both('/api/menu/getMenuUserData', (body, params, request) => {
    if (!request?.user) return [];
    if (admin(request.user)) return menus;
    const selected = new Set(selectionValues(getState().roles?.[request.user.emp_id]?.Menu, 'menu_id'));
    const childRows = menus.filter(row => selected.has(String(row.menu_id)) && row.menu_url);
    const parents = new Set(childRows.map(row => row.parent_menu_id)); return menus.filter(row => parents.has(row.menu_id) || childRows.includes(row));
  });
}
