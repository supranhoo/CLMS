// Regression tests for defects found in the full-application audit (docs/testing/AUDIT-REPORT.md).
// Each test name starts with the finding ID it pins, so a failure points straight at the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createServer } from '../server/index.mjs';

const SCOPE = { BU: ['B01'], Contractor: ['D001'], Dept: ['D01'], Menu: [], Location: ['L01'], MenuActivity: ['WRITE'] };

async function fixture(t, options = {}) {
  const server = createServer({ persist: false, ...options }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }));
  const port = server.address().port;
  const call = async (path, { token, body, method } = {}) => {
    const verb = method || (body === undefined ? 'GET' : 'POST');
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: verb, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  const login = async (id, password) => call('/api/users/login', { body: { emp_id: id, password } });
  const admin = (await login('demo', 'demo123')).data.token;
  const operator = async (id, roles = SCOPE) => {
    assert.equal((await call('/api/users/register', { token: admin, body: { emp_id: id, Name: id, password: 'Passw0rd1' } })).status, 200);
    if (roles) assert.equal((await call('/api/assignRoles/saveAll', { token: admin, body: { emp_code: id, roles } })).status, 200);
    return (await login(id, 'Passw0rd1')).data.token;
  };
  return { call, login, admin, operator, port, server };
}

// ---------------------------------------------------------------- authentication and sessions

test('AUD-A01 reads need a session; only the health, capability and menu bootstrap stay public', async t => {
  const f = await fixture(t);
  for (const path of ['/api/employee/getAllEmployees', '/api/users/getAllUsers', '/api/wages/getFixWagesDump', '/api/contractor/getAllContractors', '/api/accounting/input-summary']) {
    assert.equal((await f.call(path)).status, 401, path);
  }
  assert.equal((await f.call('/api/dev/health')).status, 200);
  assert.equal((await f.call('/api/menu/getMenuUserData')).status, 200);
  assert.equal((await f.call('/api/employee/getAllEmployees', { token: f.admin })).status, 200);
});

test('AUD-A06 an ordinary user can change their own password and nobody else\'s', async t => {
  const f = await fixture(t); const token = await f.operator('opwd');
  const other = await f.call('/api/users/changePassword', { token, body: { emp_id: 'demo', oldPassword: 'demo123', newPassword: 'Another123' } });
  assert.equal(other.status, 403);
  const own = await f.call('/api/users/changePassword', { token, body: { emp_id: 'opwd', oldPassword: 'Passw0rd1', newPassword: 'Newpass123' } });
  assert.equal(own.status, 200);
  assert.equal((await f.call('/api/employee/getAllEmployees', { token })).status, 401, 'the old session is revoked');
  assert.equal((await f.login('opwd', 'Passw0rd1')).status, 401);
  assert.equal((await f.login('opwd', 'Newpass123')).status, 200);
  assert.equal((await f.call('/api/users/changePassword', { token: f.admin, body: { emp_id: 'opwd', oldPassword: 'Newpass123', newPassword: 'Third12345' } })).status, 403, 'even an administrator cannot change another account here');
});

test('AUD-A07 deactivating an account ends its open session at once', async t => {
  const f = await fixture(t); const token = await f.operator('ogone');
  assert.equal((await f.call('/api/employee/getAllEmployees', { token })).status, 200);
  assert.equal((await f.call('/api/users/updateUser/ogone', { token: f.admin, method: 'PUT', body: { Is_Active: 'N' } })).status, 200);
  assert.equal((await f.call('/api/employee/getAllEmployees', { token })).status, 401);
  assert.equal((await f.login('ogone', 'Passw0rd1')).status, 401);
});

test('AUD-A08 logout revokes the token, and sessions expire on their own', async t => {
  const f = await fixture(t); const token = (await f.login('demo', 'demo123')).data.token;
  assert.equal((await f.call('/api/employee/getAllEmployees', { token })).status, 200);
  assert.equal((await f.call('/api/users/logout', { token, body: {} })).status, 200);
  assert.equal((await f.call('/api/employee/getAllEmployees', { token })).status, 401, 'a replayed token is refused');
  assert.equal((await f.call('/api/users/logout', { body: {} })).status, 200, 'logging out twice is harmless');

  const short = await fixture(t, { sessionTtlMs: 25 }); const brief = (await short.login('demo', 'demo123')).data.token;
  assert.equal((await short.call('/api/dev/health', { token: brief })).status, 200);
  await new Promise(resolve => setTimeout(resolve, 60));
  const expired = await short.call('/api/employee/getAllEmployees', { token: brief });
  assert.equal(expired.status, 401); assert.match(expired.data.message, /expired/i);
});

test('AUD-A09 ten wrong passwords lock that user ID for a while; other IDs and a good password later are unaffected', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await f.login('demo', 'wrong' + i)).status, 401);
  const locked = await f.login('demo', 'demo123');
  assert.equal(locked.status, 429); assert.match(locked.data.message, /Try again in/);
  await f.operator('someone');
  assert.equal((await f.login('someone', 'Passw0rd1')).status, 200, 'the lock is per user ID');
  assert.equal((await f.login('nobody-here', 'x')).status, 401);
});

// ---------------------------------------------------------------- authorisation and scope

test('AUD-A11 a scoped user sees only their own workers in nested accounting rows and in the totals', async t => {
  const f = await fixture(t); const token = await f.operator('oscope');
  const entry = (code, value) => ({ employee_code: code, pmonth: '2026-10-01', billingType: 'M', ernCode: 'DEMO', ernValue: value });
  assert.equal((await f.call('/api/wages/addWageEarnings', { token: f.admin, body: entry('DEMO001', 100) })).status, 200);
  assert.equal((await f.call('/api/wages/addWageEarnings', { token: f.admin, body: entry('DEMO003', 500) })).status, 200);
  const all = (await f.call('/api/accounting/input-summary', { token: f.admin })).data;
  assert.equal(all.earnings, 600);
  const mine = (await f.call('/api/accounting/input-summary', { token })).data;
  assert.equal(mine.earnings, 100, 'the total counts only workers in scope');
  assert.deepEqual(mine.rows.earnings.map(row => row.employee_code), ['DEMO001'], 'the nested rows are scoped as well');
});

test('AUD-D12 approving a pending worker change needs that worker in scope, and never undoes later changes', async t => {
  const f = await fixture(t); const outsider = await f.operator('ounscoped', { BU: [], Contractor: [], Dept: [], Menu: [], Location: [], MenuActivity: ['WRITE'] });
  const worker = (await f.call('/api/employee/getAllEmployees', { token: f.admin })).data[0];
  const submit = async change => f.call('/api/employee/addEmployeePreapprove', { token: f.admin, body: { ...worker, ...change } });
  assert.equal((await submit({ display_name: 'Renamed By Request' })).status, 200);
  const pending = async () => (await f.call('/api/employee/getUnapprovedEmpRec', { token: f.admin, body: {} })).data.find(row => row.source === 'Modified');
  const first = await pending();
  assert.equal('base_snapshot' in first, false, 'internal bookkeeping is not exposed');
  assert.equal((await f.call('/api/employee/approveOrRejectEmpRec', { token: outsider, body: { record_id: first.record_id, action: 'approve' } })).status, 403);
  // The worker is inactivated while the change waits; approving must apply the rename only.
  assert.equal((await f.call('/api/employee/uploadInActiveEmp', { token: f.admin, body: { muster: [{ employee_code: worker.Employee_Code, attendance_date: '2026-10-05' }] } })).status, 200);
  assert.equal((await f.call('/api/employee/approveOrRejectEmpRec', { token: f.admin, body: { record_id: first.record_id, action: 'approve' } })).status, 200);
  const after = (await f.call('/api/employee/getAllEmployees', { token: f.admin })).data.find(row => row.Employee_Code === worker.Employee_Code);
  assert.equal(after.display_name, 'Renamed By Request');
  assert.equal(after.Is_Active, 'N', 'the inactivation survives the approval');
});

// ---------------------------------------------------------------- audit trail

test('AUD-A12 audit columns record the signed-in user, and a contractor update cannot forge them', async t => {
  const f = await fixture(t); const token = await f.operator('oaudit');
  const muster = { employee_code: 'DEMO001', attendance_date: '2026-10-01', shift: 'GEN', punch_mark: 'P', working_hours: '08:00', ot_hours: '00:00' };
  assert.equal((await f.call('/api/attendance/addManualPunchMark', { token, body: muster })).status, 200);
  assert.equal(f.server.demo.getState().manualPunches[0].created_by, 'oaudit');
  assert.equal((await f.call('/api/attendance/addManualPunchMark', { token: f.admin, body: { ...muster, attendance_date: '2026-10-02' } })).status, 200);
  assert.equal(f.server.demo.getState().manualPunches[1].created_by, 'demo');

  const update = await f.call('/api/contractor/updateContractor/D001', { token: f.admin, method: 'PUT', body: { Contractor_Name: 'Renamed', Created_By: 'forged', Created_Date: '1999-01-01T00:00', Modified_By: 'forged' } });
  assert.equal(update.status, 200);
  const row = f.server.demo.getState().contractors.find(c => c.Contractor_ID === 'D001');
  assert.equal(row.Contractor_Name, 'Renamed');
  assert.equal(row.Created_By, 'demo'); assert.equal(row.Created_Date, '2026-09-01T00:00:00Z'); assert.equal(row.Modified_By, 'demo');
});

// ---------------------------------------------------------------- data integrity

test('AUD-D01 a worker must reference an existing contractor, department, business unit and entity; codes are stored as text', async t => {
  const f = await fixture(t);
  const add = body => f.call('/api/employee/addEmployee', { token: f.admin, body });
  const base = { display_name: 'Fictional Person', contractor_id: 'D001', dept: 'D01', bu: 'B01', entity_code: 'E01' };
  for (const [field, value] of [['contractor_id', 'NOPE'], ['dept', 'D99'], ['bu', 'B99'], ['entity_code', 'E99']]) {
    const rejected = await add({ Employee_Code: 'FK' + field, ...base, [field]: value });
    assert.equal(rejected.status, 400, field); assert.match(rejected.data.message, new RegExp(field));
  }
  assert.equal((await add({ Employee_Code: 12345, ...base })).status, 200);
  const found = await f.call('/api/employee/getEmployeeByCode', { token: f.admin, body: { employee_code: '12345' } });
  assert.equal(found.data.length, 1, 'a numeric code is found by its text');
  assert.equal(f.server.demo.getState().employees.at(-1).Employee_Code, '12345');
});

test('AUD-D02/D03 master data keys stay unique and a record that is still in use cannot be removed or re-keyed', async t => {
  const f = await fixture(t); const unit = '/api/master-data/business-units'; const send = (method, body) => f.call(unit, { token: f.admin, method, body });
  assert.equal((await send('POST', { bu_code: 'B02', bu_name: 'Second', entity_code: 'E01' })).status, 200);
  const collide = await send('PUT', { keys: { bu_code: 'B02' }, data: { bu_code: 'B01', bu_name: 'Second', entity_code: 'E01' } });
  assert.equal(collide.status, 409);
  assert.equal(f.server.demo.getState().masters['business-units'].filter(row => row.bu_code === 'B01').length, 1);
  const rekey = await send('PUT', { keys: { bu_code: 'B01' }, data: { bu_code: 'B77', bu_name: 'Demo Works', entity_code: 'E01' } });
  assert.equal(rekey.status, 409); assert.match(rekey.data.message, /employees/);
  const inUse = await send('DELETE', { keys: { bu_code: 'B01' } });
  assert.equal(inUse.status, 409); assert.match(inUse.data.message, /still use/);
  assert.equal((await send('PUT', { keys: { bu_code: 'B01' }, data: { bu_code: 'B01', bu_name: 'Renamed Name', entity_code: 'E01' } })).status, 200, 'editing a non-key field is fine');
  assert.equal((await send('DELETE', { keys: { bu_code: 'B02' } })).status, 200, 'an unused record can be deleted');
  assert.equal((await f.call('/api/master-data/locations', { token: f.admin, method: 'DELETE', body: { keys: { loc_code: 'L01' } } })).status, 409);
});

test('AUD-D04 leave days must fit the dates, and a worker cannot take overlapping leave', async t => {
  const f = await fixture(t);
  const leave = extra => ({ employee_code: 'DEMO002', leave_period_id: 1, leave_type_code: 'CL', leave_nature: 'FULL', request_date: '2026-10-16', from_date: '2026-10-16', to_date: '2026-10-16', total_days: 1, reason: 'Fictional', ...extra });
  const add = body => f.call('/api/leave/addLeave', { token: f.admin, body });
  const tooMany = await add(leave({ total_days: 400 }));
  assert.equal(tooMany.status, 400); assert.match(tooMany.data.message, /cannot exceed the 1 day/);
  assert.equal((await add(leave({ total_days: 0.3 }))).status, 400, 'only whole and half days');
  assert.equal((await add(leave({ total_days: 0.5 }))).status, 200, 'a half day is allowed');
  assert.equal((await add(leave({ from_date: '2026-10-16', to_date: '2026-10-18', total_days: 3 }))).status, 409, 'overlaps the half day already taken');
  assert.equal((await add(leave({ from_date: '2026-10-20', to_date: '2026-10-22', total_days: 3 }))).status, 200);
  const balance = (await f.call('/api/leave/report/balance?as_on_month=2026-10-01', { token: f.admin })).data.data.find(row => row.employee_code === 'DEMO002');
  assert.equal(balance.cl_balance, 6 - 0.5 - 3);
});

test('AUD-D13 an approved regularisation is read-only until the approval is withdrawn', async t => {
  const f = await fixture(t); const post = (action, body) => f.call('/api/attendance/' + action, { token: f.admin, body });
  const row = { employee_code: 'DEMO001', contractor_id: 'D001', attendance_date: '2026-10-01', in_punch: '2026-10-01T09:00', out_punch: '2026-10-01T16:00', approved: 'N' };
  assert.equal((await post('addRegularisePunch', row)).status, 200);
  assert.equal((await post('approveRegularisePunch', { ...row, approved: 'Y' })).status, 200);
  const edit = await post('updateRegularisePunch', { ...row, in_punch: '2026-10-01T03:00', approved: 'Y' });
  assert.equal(edit.status, 409); assert.match(edit.data.message, /Withdraw the approval/);
  assert.equal((await post('approveRegularisePunch', { ...row, approved: 'N' })).status, 200);
  assert.equal((await post('updateRegularisePunch', { ...row, in_punch: '2026-10-01T08:30' })).status, 200);
});

test('AUD-D14 the sandwich-rule Active flag is saved, and the punch marks the API lists are exactly the ones it accepts', async t => {
  const f = await fixture(t); const post = (action, body) => f.call('/api/attendance/' + action, { token: f.admin, body });
  assert.equal((await post('addSandwichRule', { present_pattern: 'P-WO-P', converted_pattern: 'P-P-P' })).status, 200);
  const [rule] = (await f.call('/api/attendance/getSandwichRules', { token: f.admin })).data;
  assert.equal(rule.is_active, 'Y'); assert.equal(rule.token_count, 3);
  assert.equal((await post('updateSandwichRule', { ...rule, is_active: 'N' })).status, 200);
  assert.equal((await f.call('/api/attendance/getSandwichRules', { token: f.admin })).data[0].is_active, 'N');

  const listed = (await post('getPunchMarks', {})).data.map(row => row.punch_mark).sort();
  const accepted = [];
  for (const [i, mark] of ['A', 'HDP', 'P', 'AB', 'WO', 'CL', 'EL', 'SL', 'HLD', 'OD', 'WFH', 'HD', 'LOP'].entries()) {
    const day = String(i + 1).padStart(2, '0');
    const r = await post('addManualPunchMark', { employee_code: 'DEMO001', attendance_date: `2026-10-${day}`, shift: 'GEN', punch_mark: mark, working_hours: '00:00', ot_hours: '00:00' });
    if (r.status === 200) accepted.push(mark);
  }
  assert.deepEqual(listed, accepted.sort(), 'every listed mark is accepted and nothing else is');
  assert.ok(!listed.includes('A') && !listed.includes('HDP'));
});

// ---------------------------------------------------------------- HTTP handling

test('AUD-R02 a multi-byte character split across network chunks survives the request body', async t => {
  const f = await fixture(t);
  const name = 'नमस्ते '.repeat(2000); // 3-byte characters: any chunk size that is not a multiple of 3 splits one
  const body = Buffer.from(JSON.stringify({ Employee_Code: 'UTF8', display_name: name, contractor_id: 'D001' }), 'utf8');
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: f.port, method: 'POST', path: '/api/employee/addEmployee', headers: { 'content-type': 'application/json', authorization: `Bearer ${f.admin}`, 'content-length': body.length } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    (async () => { for (let i = 0; i < body.length; i += 7) { req.write(body.subarray(i, i + 7)); if (i % 700 === 0) await new Promise(r => setImmediate(r)); } req.end(); })();
  });
  assert.equal(status, 200);
  assert.equal(f.server.demo.getState().employees.find(e => e.Employee_Code === 'UTF8').display_name, name);
});

test('AUD-A05 malformed percent-encoding in a path is a client error, not a server error', async t => {
  const f = await fixture(t);
  const response = await f.call('/api/wages/deleteServiceCharges/%E0%A4%A', { token: f.admin, method: 'DELETE' });
  assert.equal(response.status, 400); assert.match(response.data.message, /percent-encoded/);
});

test('AUD-A13 the fixture export withholds password hashes and reset tokens', async t => {
  const f = await fixture(t); await f.operator('oexport');
  assert.equal((await f.call('/api/users/generateResetToken', { body: { emp_id: 'oexport' } })).status, 200);
  const exported = await f.call('/api/dev/state', { token: f.admin });
  assert.equal(exported.status, 200);
  const text = JSON.stringify(exported.data);
  assert.doesNotMatch(text, /passwordHash|passwordSalt/); assert.ok(exported.data.recoveryOutbox.every(row => row.token === '[withheld]'));
  assert.ok(exported.data.authUsers.length >= 2, 'accounts are still listed');
  assert.ok(f.server.demo.getState().authUsers.every(row => row.passwordHash), 'the real state is untouched');
});
