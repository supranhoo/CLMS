// The documented way to start a test run from a known state: `npm run reset`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = env => spawnSync(process.execPath, [path.join(root, 'scripts/reset-local-state.mjs')], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });

test('RESET-01 with the API running, it restores the fixtures and revokes sessions', async t => {
  const server = createServer({ persist: false }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`; const post = (p, token, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const admin = (await (await post('/api/users/login', null, { emp_id: 'demo', password: 'demo123' })).json()).token;
  await post('/api/contractor/addContractor', admin, { Contractor_ID: 'D777', Contractor_Name: 'Added During A Test' });
  assert.equal(server.demo.getState().contractors.length, 3);
  // The API lives in this process, so the script must run asynchronously (a blocking spawn would starve the server).
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/reset-local-state.mjs')], { cwd: root, env: { ...process.env, CLMS_API: base } });
    let stdout = ''; let stderr = ''; child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Reset the running API/);
  assert.equal(server.demo.getState().contractors.length, 2, 'the added contractor is gone');
  assert.equal((await fetch(base + '/api/employee/getAllEmployees', { headers: { authorization: `Bearer ${admin}` } })).status, 401, 'the old session was revoked');
});

test('RESET-02 with the API stopped, it deletes only the saved state file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clms-reset-')); const keep = path.join(dir, 'notes.txt');
  fs.writeFileSync(path.join(dir, 'state.json'), '{}'); fs.writeFileSync(keep, 'keep me');
  const result = run({ CLMS_API: 'http://127.0.0.1:9', CLMS_DATA_DIR: dir });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Deleted/);
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), false); assert.equal(fs.existsSync(keep), true);
  assert.match(run({ CLMS_API: 'http://127.0.0.1:9', CLMS_DATA_DIR: dir }).stdout, /Nothing to reset/);
});

test('RESET-03 it refuses a non-loopback API address', () => {
  const result = run({ CLMS_API: 'http://example.test:5001' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /loopback/);
});
