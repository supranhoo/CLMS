import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../server/index.mjs';

async function fixture(options = {}) {
  const server = createServer({ persist: false, ...options }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  let token; const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body) => { const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, data: await response.json() }; };
  const login = await call('/api/users/login', { emp_id: 'demo', password: 'demo123' }); token = login.data.token;
  return { call, server, close: () => new Promise(resolve => server.close(resolve)) };
}
const row = (extra = {}) => ({ employee_code: 'DEMO001', leave_type_code: 'CL', trans_type: 'ADJ_CR', leave_days: '1.5', pmonth: '2026-10-01', remarks: 'Fictional test adjustment', ...extra });

test('saved ledger strips UI state and derived fields, then remains exportable after query and API restart', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'clms-ledger-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const f = await fixture({ persist: true, dataDir: dir });
  try {
    assert.equal((await f.call('/api/leave/save-bulk', { rows: [row({ is_new: true, is_dirty: true, selected: true, employee_name: 'Client-controlled display', balance_effect: '-', created_by: 'spoofed' })] })).status, 200);
    const saved = (await f.call('/api/leave/query?pmonth=2026-10-01&leave_type_code=CL')).data.data[0];
    assert.equal(saved.is_new, undefined); assert.equal(saved.is_dirty, undefined); assert.equal(saved.selected, undefined);
    assert.equal(saved.employee_name, 'Asha Demo'); assert.equal(saved.balance_effect, '+'); assert.equal(saved.leave_days, 1.5); assert.equal(saved.created_by, 'demo'); assert.ok(saved.created_date);
    assert.equal((await f.call('/api/leave/save-bulk', { rows: [{ ...saved, remarks: 'Edited saved adjustment', is_dirty: true }] })).status, 200);
  } finally { await f.close(); }
  const restarted = await fixture({ persist: true, dataDir: dir }); t.after(restarted.close);
  const saved = (await restarted.call('/api/leave/query?pmonth=2026-10-01&leave_type_code=CL')).data.data;
  assert.equal(saved.length, 1); assert.equal(saved[0].remarks, 'Edited saved adjustment');
  assert.ok(saved.every(r => !r.is_new && !r.is_dirty), 'queried saved rows do not trigger the frontend unsaved-export guard');
  assert.equal(saved[0].selected, undefined); assert.equal(saved[0].modified_by, 'demo');
});

test('manual ledger updates preserve leave-owned source entries even when IDs are submitted as strings', async t => {
  const f = await fixture(); t.after(f.close);
  assert.equal((await f.call('/api/leave/addLeave', { employee_code: 'DEMO001', leave_type_code: 'CL', from_date: '2026-10-16', to_date: '2026-10-16', total_days: 1, reason: 'Fictional leave test' })).status, 200);
  const source = f.server.demo.getState().ledger.find(r => r.ref_type === 'LEAVE'); assert.ok(source);
  assert.equal((await f.call('/api/leave/save-bulk', { rows: [row()] })).status, 200);
  const manual = f.server.demo.getState().ledger.find(r => r.ref_type === 'MANUAL' && r.trans_type === 'ADJ_CR');
  assert.equal((await f.call('/api/leave/save-bulk', { rows: [{ ...manual, leave_days: 2, is_dirty: true }] })).status, 200);
  assert.deepEqual(f.server.demo.getState().ledger.find(r => r.trans_id === source.trans_id), source);
  const before = f.server.demo.getState().ledger;
  const result = await f.call('/api/leave/save-bulk', { rows: [{ ...manual, remarks: 'Must remain unapplied' }, { ...source, trans_id: String(source.trans_id), leave_days: 99, ref_type: 'MANUAL' }] });
  assert.equal(result.status, 409); assert.match(result.data.message, /source|owned|manual/i); assert.deepEqual(f.server.demo.getState().ledger, before);
});

test('invalid calendar months and invalid late batch rows leave every ledger entry unchanged', async t => {
  const f = await fixture(); t.after(f.close); const before = f.server.demo.getState().ledger;
  for (const month of ['2026-13-01', '2026-00-01', '2026-02-30', '2026-10-02', '2026-10-01junk', 'not-a-date']) {
    const result = await f.call('/api/leave/save-bulk', { rows: [row(), row({ employee_code: 'DEMO002', pmonth: month })] }); assert.equal(result.status, 400, month); assert.deepEqual(f.server.demo.getState().ledger, before);
  }
  assert.equal((await f.call('/api/leave/save-bulk', { rows: [row(), row({ employee_code: 'UNKNOWN' })] })).status, 400);
  assert.equal((await f.call('/api/leave/save-bulk', { rows: [row(), row({ trans_id: 99999 })] })).status, 404);
  assert.equal((await f.call('/api/leave/save-bulk', { rows: [row(), row({ leave_days: 'Infinity' })] })).status, 400);
  assert.deepEqual(f.server.demo.getState().ledger, before);
  const saved = before[0];
  assert.equal((await f.call('/api/leave/save-bulk', { rows: [{ ...saved }, { ...saved, trans_id: String(saved.trans_id), leave_days: 50 }] })).status, 409);
  assert.deepEqual(f.server.demo.getState().ledger, before);
});
