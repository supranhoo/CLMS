// Puts the replica back to its seeded fixtures so a test run starts from a known state.
//
//   npm run reset
//
// If the local API is running, it is asked to reset itself (POST /api/dev/reset as the demo administrator): that restores
// the fixtures, deletes every added user, role and record, and revokes every session, without a restart.
// If it is not running, the saved state file (.local-demo/state.json) is deleted, so the next start begins from the seed.
//
// Loopback only; nothing outside the local data folder is touched. CLMS_API and CLMS_DATA_DIR override the defaults.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = process.env.CLMS_API || 'http://127.0.0.1:5001';
const dataDir = path.resolve(process.env.CLMS_DATA_DIR || path.join(root, '.local-demo'));
if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(api)) throw new Error('The reset script only talks to a loopback API: ' + api);
if (path.basename(dataDir) !== '.local-demo' && !process.env.CLMS_DATA_DIR) throw new Error('Unexpected data folder: ' + dataDir);

const json = { 'content-type': 'application/json' };
async function viaApi() {
  const health = await fetch(api + '/api/dev/health', { signal: AbortSignal.timeout(1500) });
  if (!health.ok) throw new Error('health check failed');
  const login = await fetch(api + '/api/users/login', { method: 'POST', headers: json, body: JSON.stringify({ emp_id: 'demo', password: 'demo123' }) });
  if (!login.ok) throw new Error(`The demo administrator could not sign in (${login.status}); restart the API with \`npm run reset\` after stopping it.`);
  const { token } = await login.json();
  const reset = await fetch(api + '/api/dev/reset', { method: 'POST', headers: { ...json, authorization: `Bearer ${token}` }, body: '{}' });
  if (!reset.ok) throw new Error(`The API refused the reset (${reset.status}).`);
}

let running = true;
try { await viaApi(); console.log(`Reset the running API at ${api}: seed fixtures restored, all sessions revoked.`); }
catch (error) {
  if (!/fetch failed|timeout|aborted|health check failed|ECONNREFUSED/i.test(String(error?.message) + String(error?.cause?.code))) throw error;
  running = false;
}
if (!running) {
  const files = ['state.json', 'state.json.tmp'].map(name => path.join(dataDir, name)).filter(file => fs.existsSync(file));
  for (const file of files) fs.rmSync(file);
  console.log(files.length ? `The API is not running. Deleted ${files.map(f => path.relative(root, f)).join(', ')}; the next start uses the seed fixtures.` : 'The API is not running and there is no saved state. Nothing to reset.');
}
