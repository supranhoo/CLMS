import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { connectDatabase } from '../server/production/database.mjs';
import { OperationsRepository } from '../server/production/operations-repository.mjs';
import { createProductionServer } from '../server/production/http.mjs';
import { startAttendanceWorker } from '../server/production/attendance-worker.mjs';

// Browser-only QA fixture. The loopback HTTP proxy rewrites the canonical host,
// Origin and cookie name so UI flows can be exercised without trusting a local
// TLS certificate. It is never packaged as deployment configuration and does
// not test real HTTPS/cookie transport. Only generated test databases are allowed.
export async function operationsUiPreview(connection) {
  if (!/Database=clms_test_[a-f0-9]+;/i.test(connection)) throw new Error('UI preview requires the disposable SQL test database.');
  const pool = await connectDatabase({ databaseUrl: connection, trustServerCertificate: true });
  const repository = new OperationsRepository(pool);
  const api = createProductionServer({ repository, config: { mode: 'staging', apiAdapter: 'sql', publicOrigin: 'https://clms.test', sessionSeconds: 3600, idleSeconds: 1800 } });
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  const stopWorker = startAttendanceWorker(repository);
  const root = resolve('dist'); const token = randomUUID();
  let finish; const finished = new Promise(resolve => { finish = resolve; });
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html' };
  const web = http.createServer(async (req, res) => {
    const localOrigin = `http://127.0.0.1:${web.address().port}`;
    if (!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || req.headers.host !== new URL(localOrigin).host || !req.url.startsWith('/') || req.url.startsWith('//')) { res.writeHead(403); res.end(); return; }
    if (req.url === `/__qa/stop/${token}` && req.method === 'POST') { res.end('Stopping disposable UI preview.'); finish(); return; }
    if (req.url.startsWith('/api/')) {
      if (req.headers.origin && req.headers.origin !== localOrigin) { res.writeHead(403); res.end(); return; }
      const headers = { ...req.headers, host: 'clms.test', ...(req.headers.origin ? { origin: 'https://clms.test' } : {}), cookie: String(req.headers.cookie || '').replaceAll('clms-ui-test-session=', '__Host-clms-session=') };
      const upstream = http.request({ hostname: '127.0.0.1', port: api.address().port, path: req.url, method: req.method, headers }, reply => {
        const responseHeaders = { ...reply.headers };
        if (responseHeaders['set-cookie']) responseHeaders['set-cookie'] = responseHeaders['set-cookie'].map(value => value.replace('__Host-clms-session=', 'clms-ui-test-session=').replace('; Secure', ''));
        res.writeHead(reply.statusCode, responseHeaders); reply.pipe(res);
      });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); }); req.pipe(upstream); return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, localOrigin).pathname);
      let path = resolve(root, '.' + pathname);
      if (!path.startsWith(root + sep) && path !== root || extname(path) === '.map') { res.writeHead(404); res.end(); return; }
      try { if (!(await stat(path)).isFile()) path = resolve(root, 'index.html'); } catch { path = resolve(root, 'index.html'); }
      let body = await readFile(path);
      if (extname(path) === '.html') body = Buffer.from(body.toString().replace('<body>', '<body><aside style="padding:12px;background:#fff1b8;color:#352600;font-weight:bold">DISPOSABLE UI TEST FIXTURE · fictional SQL records · HTTP test proxy · not a deployment</aside>'));
      res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-store'); res.end(body);
    } catch { res.writeHead(500); res.end('Build the frontend before opening this test preview.'); }
  });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${web.address().port}`;
  console.log(`UI_TEST_URL=${origin}/login`);
  console.log(`UI_TEST_STOP=${origin}/__qa/stop/${token}`);
  console.log('Fictional fixture sign-in: ops_maker or ops_reviewer; password Fictional-Operator-12345. No live accounts or records are used.');
  await finished;
  await new Promise(resolve => web.close(resolve)); await new Promise(resolve => api.close(resolve)); await stopWorker(); await pool.close();
}
