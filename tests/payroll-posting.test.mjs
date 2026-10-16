import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server/index.mjs';

const period = '2026-10-01';
const posting = { pmonth: period, contractor_id: 'D001', mode: 'POST' };
const movement = (extra = {}) => ({ employee_code: 'DEMO001', leave_type_code: 'CL', trans_type: 'CREDIT', leave_days: 1.5, ...extra });
const run = (extra = {}) => ({ run_id: 'SYNTHETIC-EXPLICIT-OUTPUT-1', status: 'CALCULATED', pmonth: period, billingType: 'M', profileId: 'JH', ruleVersion: 1,
  rows: [{ employee_code: 'DEMO001' }, { employee_code: 'DEMO002' }], leaveRows: [movement(), movement({ employee_code: 'DEMO002', leave_type_code: 'EL', trans_type: 'AVAILED', leave_days: 2 })], ...extra });

// These explicit outputs are fixtures for the posting contract. This test does not calculate wages or verify BFCL rules.
async function fixture(t, modify = () => {}) {
  const initial = createServer({ persist: false }); const snapshot = initial.demo.getState();
  snapshot.ledger.push(
    { trans_id: 13, employee_code: 'DEMO001', leave_type_code: 'CL', trans_type: 'ADJ_CR', leave_days: 2, pmonth: period, ref_type: 'MANUAL', remarks: 'Preserve manual input' },
    { trans_id: 14, employee_code: 'DEMO001', leave_type_code: 'SL', trans_type: 'AVAILED', leave_days: 1, pmonth: period, ref_type: 'LEAVE', ref_no: 'SOURCE-LEAVE-TEST', remarks: 'Preserve source-owned input' },
    { trans_id: 15, employee_code: 'DEMO003', contractor_id: 'D002', leave_type_code: 'CL', trans_type: 'CREDIT', leave_days: 3, pmonth: period, billingType: 'M', ref_type: 'PAYROLL', ref_no: 'OTHER-CONTRACTOR', source_key: 'DEMO003|CL|CREDIT|M', remarks: 'Preserve other contractor posting' },
  );
  snapshot.payrollRuns = [run()]; modify(snapshot);
  const dataDir = await mkdtemp(join(tmpdir(), 'clms-payroll-posting-'));
  await writeFile(join(dataDir, 'state.json'), JSON.stringify(snapshot), 'utf8');
  const server = createServer({ persist: true, dataDir }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`; let token;
  const call = async (path, body) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  token = (await call('/api/users/login', { emp_id: 'demo', password: 'demo123' })).data.token;
  return { call, state: () => server.demo.getState() };
}

test('payroll leave preview reads explicit scoped outputs and never writes ledger or run fixtures', async t => {
  const f = await fixture(t, state => state.payrollRuns.push(run({ run_id: 'OTHER', rows: [{ employee_code: 'DEMO003' }], leaveRows: [movement({ employee_code: 'DEMO003' })] })));
  const before = f.state();
  const result = await f.call('/api/leave/payroll-posting', { ...posting, mode: 'PREVIEW' });
  assert.equal(result.status, 200); assert.equal(result.data.data.length, 2);
  assert.ok(result.data.data.every(row => row.contractor_id === 'D001' && row.ref_type === 'PAYROLL'));
  assert.deepEqual(f.state().ledger, before.ledger); assert.deepEqual(f.state().payrollRuns, before.payrollRuns);
});

test('payroll leave posting is idempotent and preserves manual, source-owned and other contractor ledger rows', async t => {
  const f = await fixture(t); const before = f.state().ledger;
  const posted = await f.call('/api/leave/payroll-posting', posting);
  assert.equal(posted.status, 200); assert.equal(posted.data.postedRows, 2);
  const once = f.state().ledger;
  assert.deepEqual(once.filter(row => before.some(old => old.trans_id === row.trans_id)), before);
  assert.equal(once.filter(row => row.ref_type === 'PAYROLL' && row.contractor_id === 'D001').length, 2);
  assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 200);
  assert.deepEqual(f.state().ledger, once, 'reposting preserves transaction IDs, timestamps and values');
});

test('contractor-scoped wage locks prevent a whole posting atomically while another contractor lock does not interfere', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/wages/addWageProcessLock', { pmonth: period, billingType: 'M', entityCode: 'E01', ContractorId: 'D002' })).status, 200);
  assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 200);
  assert.equal((await f.call('/api/wages/addWageProcessLock', { pmonth: period, billingType: 'M', entityCode: 'E01', ContractorId: 'D001' })).status, 200);
  const before = f.state().ledger;
  assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 423);
  assert.deepEqual(f.state().ledger, before);
  assert.equal((await f.call('/api/leave/payroll-posting', { ...posting, mode: 'PREVIEW' })).status, 200);
  assert.deepEqual(f.state().ledger, before);
});

test('missing calculated payroll leaves preview and posting gated without partial writes', async t => {
  const f = await fixture(t, state => state.payrollRuns = []); const before = f.state().ledger;
  for (const mode of ['PREVIEW', 'POST']) {
    const result = await f.call('/api/leave/payroll-posting', { ...posting, mode });
    assert.equal(result.status, 422); assert.match(result.data.message, /BFCL_RULES_REQUIRED/);
    assert.deepEqual(f.state().ledger, before);
  }
});

test('a malformed late output and overlapping calculated runs cannot partially replace payroll ledger rows', async t => {
  await t.test('invalid leave type', async t => {
    const f = await fixture(t, state => state.payrollRuns[0].leaveRows.push(movement({ employee_code: 'DEMO002', leave_type_code: 'UNKNOWN' })));
    const before = f.state().ledger;
    assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 422);
    assert.deepEqual(f.state().ledger, before);
  });
  await t.test('invalid leave days', async t => {
    const f = await fixture(t, state => state.payrollRuns[0].leaveRows[1].leave_days = 'Infinity'); const before = f.state().ledger;
    assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 400);
    assert.deepEqual(f.state().ledger, before);
  });
  await t.test('overlapping runs', async t => {
    const f = await fixture(t, state => state.payrollRuns.push(run({ run_id: 'OVERLAPPING-OUTPUT' }))); const before = f.state().ledger;
    assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 409);
    assert.deepEqual(f.state().ledger, before);
  });
  await t.test('existing source-owned movement', async t => {
    const f = await fixture(t, state => state.ledger.push({ trans_id: 16, ...movement(), pmonth: period, ref_type: 'MANUAL' })); const before = f.state().ledger;
    assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 409);
    assert.deepEqual(f.state().ledger, before);
  });
});

test('a calculated run for another contractor cannot authorize clearing this contractor payroll postings', async t => {
  const f = await fixture(t, state => {
    state.payrollRuns = [run({ rows: [{ employee_code: 'DEMO003' }], leaveRows: [movement({ employee_code: 'DEMO003' })] })];
    state.ledger.push({ trans_id: 16, ...movement(), contractor_id: 'D001', pmonth: period, billingType: 'M', ref_type: 'PAYROLL', source_key: 'DEMO001|CL|CREDIT|M' });
  });
  const before = f.state().ledger;
  const result = await f.call('/api/leave/payroll-posting', posting);
  assert.equal(result.status, 422); assert.deepEqual(f.state().ledger, before);
});

test('calculated outputs without billing metadata are rejected atomically before posting', async t => {
  const f = await fixture(t, state => delete state.payrollRuns[0].billingType);
  const before = f.state().ledger;
  assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 422);
  assert.deepEqual(f.state().ledger, before);
});

test('a leave output cannot post an employee absent from the calculated payroll rows', async t => {
  const f = await fixture(t, state => state.payrollRuns[0].rows = [{ employee_code: 'DEMO001' }]);
  const before = f.state().ledger;
  const result = await f.call('/api/leave/payroll-posting', posting);
  assert.equal(result.status, 422); assert.match(result.data.message, /does not belong/);
  assert.deepEqual(f.state().ledger, before);
});

test('no matching calculated leave movements cannot clear earlier payroll-owned ledger rows', async t => {
  const f = await fixture(t, state => {
    state.payrollRuns[0].leaveRows = [];
    state.ledger.push({ trans_id: 16, ...movement(), contractor_id: 'D001', pmonth: period, billingType: 'M', ref_type: 'PAYROLL', source_key: 'DEMO001|CL|CREDIT|M' });
  });
  const before = f.state().ledger;
  assert.equal((await f.call('/api/leave/payroll-posting', posting)).status, 422);
  assert.deepEqual(f.state().ledger, before);
});
