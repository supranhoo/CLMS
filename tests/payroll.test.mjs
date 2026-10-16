import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../server/index.mjs';

async function fixture(t) {
  const server = createServer({ persist: false }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`; let token;
  const call = async (path, body) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  token = (await call('/api/users/login', { emp_id: 'demo', password: 'demo123' })).data.token;
  return { call, state: () => server.demo.getState() };
}

test('arrear days preserve user input including zero, never derive pay, and invalid imports are atomic', async t => {
  const f = await fixture(t);
  const entry = { employee_code: 'DEMO001', pmonth: '2026-10-01', billingType: 'M', arrearCode: 'DEMO', arrearValue: 123, arrearRefPmonth: '2026-09-01', arrearDays: 1.5 };
  assert.equal((await f.call('/api/wages/addWageArrears', entry)).status, 200);
  let rows = (await f.call('/api/wages/getWageArrears', { pmonth: entry.pmonth, billingType: 'M' })).data;
  assert.equal(rows[0].arrearDays, 1.5); assert.equal(rows[0].arrearValue, 123);
  assert.equal((await f.call('/api/wages/updateWageArrears', { ...entry, arrearDays: 0 })).status, 200);
  rows = (await f.call('/api/wages/getWageArrears', { pmonth: entry.pmonth })).data;
  assert.equal(rows[0].arrearDays, 0); assert.equal(rows[0].arrearValue, 123);
  const before = f.state().arrears;
  const result = await f.call('/api/wages/uploadArrears', { arrears: [{ ...entry, employee_code: 'DEMO002' }, { ...entry, employee_code: 'DEMO003', arrearDays: -1 }] });
  assert.equal(result.status, 400); assert.deepEqual(f.state().arrears, before);
  assert.equal((await f.call('/api/wages/updateWageArrears', { ...entry, arrearDays: 'Infinity' })).status, 400);
  assert.deepEqual(f.state().arrears, before); assert.equal(f.state().payrollRuns?.length || 0, 0);
});

test('service charge responses enrich the current contractor name without storing client-controlled display values', async t => {
  const f = await fixture(t);
  const entry = { ContractorID: 'D001', entity_code: 'E01', RuleType: 'EmployeeCode', EmployeeCode: 'DEMO001', Eff_PMonth: '2026-10-01', rate: 5, ContractorName: 'Client-controlled name' };
  const added = await f.call('/api/wages/addServiceCharges', entry);
  assert.equal(added.status, 200); assert.equal(added.data.ContractorName, 'Demo Fabrication Services');
  assert.equal(f.state().serviceCharges[0].ContractorName, undefined);
  const fetched = (await f.call('/api/wages/getServiceCharges')).data;
  assert.equal(fetched[0].ContractorName, 'Demo Fabrication Services');
  const updated = await f.call('/api/wages/updateServiceCharges', { ...entry, RuleID: added.data.RuleID, rate: 7 });
  assert.equal(updated.status, 200); assert.equal(updated.data.ContractorName, 'Demo Fabrication Services'); assert.equal(updated.data.rate, 7);
});
