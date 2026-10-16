import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from '../server/index.mjs';

async function fixture(options = {}) {
  const server = createServer({ persist: false, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let token = '';
  const call = async (path, body, method = body === undefined ? 'GET' : 'POST', authenticated = true) => {
    const response = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token && authenticated ? { authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  const login = async () => { const result = await call('/api/users/login', { emp_id: 'demo', password: 'demo123' }); token = result.data.token; return result; };
  return { server, call, login, close: () => new Promise(resolve => server.close(resolve)) };
}

test('demo login, original dashboard groups, fixtures and masters agree with frontend contracts', async t => {
  const f = await fixture(); t.after(f.close);
  assert.equal((await f.call('/api/users/login', { emp_id: 'demo', password: 'wrong' })).status, 401);
  const login = await f.login(); assert.equal(login.data.emp_id, 'demo'); assert.equal(login.data.Name, 'Demo Developer'); assert.ok(login.data.token);
  const menus = (await f.call('/api/menu/getMenuUserData', { emp_id: 'demo' })).data;
  assert.deepEqual(menus.filter(m => m.parent_menu_id === 0).map(m => m.menu_name), ['Configuration Module', 'Masters Module', 'Attendance Module', 'Wages Module', 'Accounting Module', 'Approvals', 'Compliance Reports', 'Leave Module']);
  const menuIds = new Set(menus.map(m => m.menu_id)); assert.ok(menus.every(m => m.parent_menu_id === 0 || menuIds.has(m.parent_menu_id)));
  assert.equal(menus.filter(m => m.menu_url.startsWith('/compliance/form-')).length, 6);
  const employees = (await f.call('/api/employee/getAllEmployees')).data;
  const contractors = (await f.call('/api/contractor/getAllContractors')).data;
  assert.equal(employees.length, 4); assert.ok(employees.every(e => e.Employee_Code.startsWith('DEMO') && contractors.some(c => c.Contractor_ID === e.contractor_id)));
  const lookups = (await f.call('/api/master-data/lookups')).data;
  assert.ok(lookups.shiftGroups[0].value); assert.ok(lookups.entities[0].label);
  const shifts = (await f.call('/api/master-data/shift-times')).data;
  assert.equal(shifts[0].sh_start_time, '08:00:00');
  const costs = (await f.call('/api/entity/getCostCode')).data;
  assert.equal(costs[0].cost_code, 'C01'); assert.equal(costs[0].cost_name, 'Demo Cost Centre');
});

test('contractor edit preserves case and master CRUD persists across server restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'clms-demo-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const f = await fixture({ persist: true, dataDir: dir });
  try {
    assert.equal((await f.call('/api/contractor/addContractor', { Contractor_ID: 'LOCAL9', Contractor_Name: 'Fictional API Test Contractor' })).status, 401);
    await f.login();
    assert.equal((await f.call('/api/contractor/addContractor', { Contractor_ID: 'LOCAL9', Contractor_Name: 'Fictional API Test Contractor' })).status, 200);
    assert.equal((await f.call('/api/contractor/updateContractor/LOCAL9', { Contractor_Name: 'Fictional Edited Contractor' }, 'PUT')).status, 200);
    assert.equal((await f.call('/api/master-data/locations', { loc_code: 'TEST', loc_name: 'Fictional Test Location' })).status, 200);
    assert.equal((await f.call('/api/master-data/locations', { keys: { loc_code: 'TEST' }, data: { loc_code: 'TEST', loc_name: 'Edited Local Location' } }, 'PUT')).status, 200);
  } finally { await f.close(); }
  const restarted = await fixture({ persist: true, dataDir: dir }); t.after(restarted.close); await restarted.login();
  assert.equal((await restarted.call('/api/contractor/getAllContractors')).data.find(r => r.Contractor_ID === 'LOCAL9').Contractor_Name, 'Fictional Edited Contractor');
  assert.equal((await restarted.call('/api/master-data/locations')).data.find(r => r.loc_code === 'TEST').loc_name, 'Edited Local Location');
  assert.equal((await restarted.call('/api/master-data/locations', { keys: { loc_code: 'TEST' } }, 'DELETE')).status, 200);
  assert.equal((await restarted.call('/api/dev/reset', {})).status, 200);
  await restarted.login();
  assert.equal((await restarted.call('/api/contractor/getAllContractors')).data.length, 2);
});

test('employee preapproval affects local master only after approval', async t => {
  const f = await fixture(); t.after(f.close); await f.login();
  const employee = (await f.call('/api/employee/getAllEmployees')).data[0];
  assert.equal((await f.call('/api/employee/addEmployeePreapprove', { ...employee, display_name: 'Fictional Revised Person' })).status, 200);
  assert.equal((await f.call('/api/employee/getAllEmployees')).data[0].display_name, employee.display_name);
  const pendingRows = (await f.call('/api/employee/getUnapprovedEmpRec', {})).data;
  assert.ok(pendingRows.some(r => r.source === 'Original'));
  const pending = pendingRows.find(r => r.source === 'Modified');
  assert.ok(pending.record_id);
  assert.equal((await f.call('/api/employee/approveOrRejectEmpRec', { record_id: pending.record_id, action: 'approve' })).status, 200);
  assert.equal((await f.call('/api/employee/getAllEmployees')).data[0].display_name, 'Fictional Revised Person');
});

test('synthetic attendance, leave save, balance, deletion, and payroll boundaries', async t => {
  const f = await fixture(); t.after(f.close); await f.login();
  const attendance = (await f.call('/api/attendance/getAtndMusterAll', { from_date: '2026-10-01', to_date: '2026-10-03' })).data;
  assert.equal(attendance.length, 12); assert.ok(attendance.every(r => r.employee_code.startsWith('DEMO') && r.attendance_date && r.punch_mark));
  const leave = { employee_code: 'DEMO001', leave_period_id: 1, leave_type_code: 'CL', leave_nature: 'FULL', request_date: '2026-10-16', from_date: '2026-10-16', to_date: '2026-10-16', total_days: 1, reason: 'Fictional test leave' };
  assert.equal((await f.call('/api/leave/addLeave', leave)).status, 200);
  let balance = (await f.call('/api/leave/report/balance?as_on_month=2026-10-01')).data.data;
  assert.equal(balance.find(r => r.employee_code === 'DEMO001').cl_balance, 5);
  const entries = (await f.call('/api/leave/getRecentLeaves')).data;
  assert.equal(entries[0].leave_type_name, 'Casual Leave'); assert.ok(entries[0].leave_app_id);
  const preview = await f.call('/api/leave/payroll-posting', { mode: 'PREVIEW', pmonth: '2026-10-01', contractor_id: 'D001' });
  assert.equal(preview.status, 422); assert.match(preview.data.message, /BFCL_RULES_REQUIRED/);
  assert.equal((await f.call('/api/leave/payroll-posting', { mode: 'POST', pmonth: '2026-10-01', contractor_id: 'D001' })).status, 422);
  assert.equal((await f.call('/api/wages/processWages', {})).status, 422);
  assert.equal((await f.call('/api/leave/deleteLeave', { leave_app_id: entries[0].leave_app_id })).status, 200);
  balance = (await f.call('/api/leave/report/balance?as_on_month=2026-10-01')).data.data;
  assert.equal(balance.find(r => r.employee_code === 'DEMO001').cl_balance, 6);
});
