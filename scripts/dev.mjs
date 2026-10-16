import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ports = [5001, 5173];

async function requireAvailable(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Local port ${port} is already in use. Stop the existing replica before starting another.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

let api;
let vite;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (vite) await vite.close();
  if (api && api.exitCode === null) {
    api.kill();
    await Promise.race([
      new Promise(resolve => api.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2500)),
    ]);
  }
  process.exit(code);
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());

try {
  for (const port of ports) await requireAvailable(port);
  console.log('\nCLMS DEVELOPMENT REPLICA — synthetic data only');
  console.log('No production database or live CLMS API is used.\n');
  api = spawn(process.execPath, [path.join(root, 'server', 'index.mjs')], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
    windowsHide: true,
  });
  api.once('error', error => { console.error(error.message); void stop(1); });
  api.once('exit', code => {
    if (!stopping) { console.error(`Local API stopped (${code ?? 'signal'}).`); void stop(1); }
  });
  let ready = false;
  for (let attempt = 0; attempt < 80 && !stopping; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:5001/api/dev/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* The local server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 125));
  }
  if (!ready) throw new Error('The local demo API did not become ready.');
  const { createServer } = await import('vite');
  vite = await createServer({ root, configFile: path.join(root, 'vite.config.js') });
  await vite.listen();
  vite.printUrls();
  console.log('\nUse the demo sign-in button, or demo / demo123.');
  console.log('Press Ctrl+C to stop both local servers.\n');
} catch (error) {
  console.error(`Replica could not start: ${error.message}`);
  await stop(1);
}
