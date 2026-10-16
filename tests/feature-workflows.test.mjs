import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server/index.mjs';

async function fixture(t) {
  const server = createServer({ persist: false }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`; let token;
  const call = async (path, body, method = body === undefined ? 'GET' : 'POST', suppliedToken = token) => {
    const response = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(suppliedToken ? { authorization: `Bearer ${suppliedToken}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  token = (await call('/api/users/login', { emp_id: 'demo', password: 'demo123' })).data.token;
  return { call, server };
}

test('state profiles preserve separate source-backed drafts, history and version conflicts without enabling calculations', async t => {
  const f = await fixture(t);
  const initial = (await f.call('/api/payroll/rules')).data;
  assert.equal(initial.stateCode, 'JH'); assert.equal(initial.rules.central.pf.employeeRate, null);
  assert.equal((await f.call('/api/compliance/profiles', { stateCode: 'BR', name: 'Bihar' })).status, 200);
  assert.equal((await f.call('/api/compliance/profiles/active', { profileId: 'BR' }, 'PUT')).status, 200);
  const changed = await f.call('/api/payroll/rules', { expectedVersion: 1, sourceRef: 'Local test source, unverified', effectiveFrom: '2026-10-01', rules: { company: { wageBasis: { monthlyDivisor: 'Pending BFCL policy' } } } }, 'PUT');
  assert.equal(changed.status, 200); assert.equal(changed.data.version, 2); assert.equal(changed.data.history.length, 1);
  assert.equal((await f.call('/api/payroll/rules', { expectedVersion: 1, sourceRef: 'stale' }, 'PUT')).status, 409);
  assert.equal((await f.call('/api/payroll/rules', { verificationStatus: 'VERIFIED' }, 'PUT')).status, 400);
  assert.equal((await f.call('/api/payroll/rules', { effectiveFrom: '2026-02-30' }, 'PUT')).status, 400);
  const readiness = (await f.call('/api/payroll/readiness')).data;
  assert.equal(readiness.calculationEnabled, false); assert.ok(readiness.missingCount > 0);
  assert.equal((await f.call('/api/wages/processWages', {})).status, 422);
  assert.equal(f.server.demo.getState().payrollRuns?.length || 0, 0);
});

test('adjustment imports are atomic, contractor locks stop edits, and accounting reports recorded inputs only', async t => {
  const f = await fixture(t);
  const entry = { employee_code: 'DEMO001', pmonth: '2026-10-01', billingType: 'M', ernCode: 'DEMO', ernValue: 125 };
  assert.equal((await f.call('/api/wages/addWageEarnings', entry)).status, 200);
  assert.equal((await f.call('/api/wages/addWageEarnings', entry)).status, 409);
  const invalid = await f.call('/api/wages/uploadEarnings', { earnings: [{ ...entry, employee_code: 'DEMO002' }, { ...entry, employee_code: 'UNKNOWN' }] });
  assert.equal(invalid.status, 400); assert.equal(f.server.demo.getState().earnings.length, 1);
  assert.equal((await f.call('/api/wages/addWageProcessLock', { pmonth: '2026-10-01', billingType: 'M', entityCode: 'E01', ContractorId: 'D001' })).status, 200);
  assert.equal((await f.call('/api/wages/updateWageEarnings', { ...entry, ernValue: 999 })).status, 423);
  const summary = (await f.call('/api/accounting/input-summary')).data;
  assert.equal(summary.earnings, 125); assert.match(summary.note, /not gross wages/);
  assert.equal(f.server.demo.getState().earnings[0].ernValue, 125);
});

test('workbook import previews do not write and validation failures cannot partially import', async t => {
  const f = await fixture(t); const before = f.server.demo.getState().employees.length;
  const row = { Employee_Code: 'QA001', display_name: 'Fictional QA Worker', contractor_id: 'D001' };
  assert.equal((await f.call('/api/employee/import', { rows: [row], dryRun: true })).data.valid, true);
  assert.equal(f.server.demo.getState().employees.length, before);
  const rejected = await f.call('/api/employee/import', { rows: [row, { Employee_Code: 'QA002', display_name: '' }], dryRun: false });
  assert.equal(rejected.data.valid, false); assert.equal(f.server.demo.getState().employees.length, before);
  assert.equal((await f.call('/api/employee/import', { rows: [row], dryRun: false })).data.insertedCount, 1);
  assert.equal((await f.call('/api/employee/import', { rows: [row], dryRun: false })).data.valid, false);
});

test('local user passwords are hashed and menu/scope assignments include explicit clearing', async t => {
  const f = await fixture(t);
  const user = await f.call('/api/users/register', { emp_id: 'qa_operator', Name: 'Fictional QA Operator', password: 'LocalOnly123!' });
  assert.equal(user.status, 200); assert.equal(user.data.password, ''); assert.equal(user.data.passwordHash, undefined);
  const state = f.server.demo.getState(); assert.notEqual(state.authUsers.find(r => r.emp_id === 'qa_operator').passwordHash, 'LocalOnly123!');
  const menus = (await f.call('/api/menu/getMenuData')).data;
  const workerMenu = menus.find(r => r.menu_url === '/manageEmployees');
  const roles = { BU: [{ bu_code: 'B01' }], Contractor: [{ contractor_code: 'D001' }], Dept: [{ dept_code: 'D01' }], Location: [{ loc_code: 'L01' }], Menu: [{ menu_id: workerMenu.menu_id }], MenuActivity: [] };
  assert.equal((await f.call('/api/assignRoles/saveAll', { emp_code: 'qa_operator', roles })).status, 200);
  const login = await f.call('/api/users/login', { emp_id: 'qa_operator', password: 'LocalOnly123!' });
  const token = login.data.token;
  assert.equal((await f.call('/api/employee/getAllEmployees', undefined, 'GET', token)).data.length, 2);
  assert.equal((await f.call('/api/users/getAllUsers', undefined, 'GET', token)).status, 403);
  assert.equal((await f.call('/api/employee/addEmployeePreapprove', { Employee_Code: 'DEMO001', display_name: 'changed' }, 'POST', token)).status, 403);
  assert.equal((await f.call('/api/assignRoles/saveAll', { emp_code: 'qa_operator', roles: Object.fromEntries(Object.keys(roles).map(key => [key, []])) })).status, 200);
  assert.deepEqual((await f.call('/api/menu/getMenuUserData', { emp_id: 'qa_operator' }, 'POST', token)).data, []);
  assert.equal((await f.call('/api/employee/getAllEmployees', undefined, 'GET', token)).data.length, 0);
});

test('local password recovery is single-use and no external message is claimed', async t => {
  const f = await fixture(t);
  await f.call('/api/users/register', { emp_id: 'recovery_test', Name: 'Fictional Recovery', password: 'InitialLocal123!' });
  const generated = await f.call('/api/users/generateResetToken', { emp_id: 'recovery_test' });
  assert.match(generated.data.message, /No email or WhatsApp/); assert.equal(generated.data.token, undefined);
  const outbox = (await f.call('/api/dev/outbox')).data.data;
  const token = outbox.find(row => row.emp_id === 'recovery_test').token;
  const body = { emp_id: 'recovery_test', token, newPassword: 'ChangedLocal456!' };
  assert.equal((await f.call('/api/users/resetPassword', body)).status, 200);
  assert.equal((await f.call('/api/users/resetPassword', body)).status, 400);
  assert.equal((await f.call('/api/users/login', { emp_id: 'recovery_test', password: 'InitialLocal123!' })).status, 401);
  assert.equal((await f.call('/api/users/login', { emp_id: 'recovery_test', password: 'ChangedLocal456!' })).status, 200);
});

test('a stale local session prompts sign-in instead of returning an empty dashboard', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/menu/getMenuUserData', { emp_id: 'demo' }, 'POST', 'expired-local-session')).status, 401);
  assert.equal((await f.call('/api/employee/getAllEmployees', undefined, 'GET', 'expired-local-session')).status, 401);
  assert.deepEqual((await f.call('/api/menu/getMenuUserData', {}, 'POST', '')).data, []);
});

test('compliance previews distinguish working data from verified statutory formats and calculated wages', async t => {
  const f = await fixture(t);
  const report = (await f.call('/api/compliance/report?form=form-xii-register-of-contractors')).data;
  assert.equal(report.data.length, 2); assert.match(report.formatStatus, /BFCL_FORMAT_REQUIRED/); assert.ok(report.missingRules.length);
  const slips = (await f.call('/api/compliance/report?form=form-xix-wage-slip')).data;
  assert.deepEqual(slips.data, []); assert.ok(slips.missingRules.some(row => /Calculated payroll/.test(row)));
  assert.equal((await f.call('/api/compliance/report?form=unknown')).status, 404);
  assert.equal((await f.call('/api/compliance/report?form=form-xvi-muster-roll')).status, 400);
  const muster = (await f.call('/api/compliance/report?form=form-xvi-muster-roll&pmonth=2026-10-01')).data;
  assert.equal(muster.scope.pmonth, '2026-10-01');
  assert.ok(muster.data.length > 0);
  assert.ok(muster.data.every(row => row.attendance_date.startsWith('2026-10')));
});
