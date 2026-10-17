import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import sql from 'mssql';
import http from 'node:http';

// Disposable local verification only: no production environment or credentials.
const suffix = randomBytes(6).toString('hex');
const container = `clms-test-${suffix}`;
const database = `clms_test_${suffix}`;
const password = `Test!${randomBytes(24).toString('hex')}a1`;
const verifyImages = process.argv.includes('--verify-images');
const network = `clms-net-test-${suffix}`;
const containers = [];
let networkCreated = false;
const docker = (args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn('docker', args, { env: { ...process.env, ...env }, windowsHide: true });
  let output = ''; let error = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { error += chunk; });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(`Docker command failed (${code}). ${error.slice(-600)}`)));
});
let pool;
try {
  console.log('Starting isolated SQL Server Developer container; image download may take several minutes.');
  if (verifyImages) { await docker(['network', 'create', '--label', `clms.test=${suffix}`, network]); networkCreated = true; }
  await docker(['run', '--rm', '-d', '--name', container, '--label', `clms.test=${suffix}`, ...(verifyImages ? ['--network', network, '--network-alias', 'sql'] : []), '-p', '127.0.0.1::1433', '-e', 'ACCEPT_EULA=Y', '-e', 'MSSQL_PID=Developer', '-e', 'MSSQL_SA_PASSWORD', 'mcr.microsoft.com/mssql/server:2022-latest'], { MSSQL_SA_PASSWORD: password });
  containers.push(container);
  const portText = await docker(['port', container, '1433/tcp']);
  const port = Number(portText.split(':').at(-1));
  const admin = { server: '127.0.0.1', port, user: 'sa', password, database: 'master', connectionTimeout: 2000, options: { encrypt: true, trustServerCertificate: true } };
  for (let attempt = 0; attempt < 90; attempt++) {
    const candidate = new sql.ConnectionPool(admin);
    try { await candidate.connect(); pool = candidate; break; }
    catch { await candidate.close().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  if (!pool) throw new Error('Disposable SQL Server did not become ready.');
  await pool.request().query(`CREATE DATABASE [${database}]`);
  await pool.close(); pool = null;
  const connection = `Server=127.0.0.1,${port};Database=${database};User Id=sa;Password=${password};Encrypt=true;`;
  console.log('Disposable database ready. Running real SQL integration tests.');
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', 'tests/sql-integration.test.mjs'], { env: { ...process.env, CLMS_TEST_DATABASE_CONNECTION: connection }, stdio: 'inherit', windowsHide: true });
    child.once('error', reject); child.once('exit', resolve);
  });
  if (code !== 0) process.exitCode = 1;
  if (code === 0 && verifyImages) {
    const apiName = `clms-api-test-${suffix}`; const webName = `clms-web-test-${suffix}`;
    await docker(['run', '--rm', '-d', '--name', apiName, '--label', `clms.test=${suffix}`, '--network', network, '--network-alias', 'api', '-e', 'CLMS_DATABASE_URL', '-e', 'CLMS_MODE=staging', '-e', 'CLMS_API_ADAPTER=sql', '-e', 'CLMS_BIND_HOST=0.0.0.0', '-e', 'CLMS_SQL_TRUST_CERTIFICATE=true', '-e', 'PUBLIC_ORIGIN=https://clms.test', 'clms-api:verification'], { CLMS_DATABASE_URL: `Server=sql,1433;Database=${database};User Id=sa;Password=${password};Encrypt=true;` });
    containers.push(apiName);
    await docker(['run', '--rm', '-d', '--name', webName, '--label', `clms.test=${suffix}`, '--network', network, '-p', '127.0.0.1::80', 'clms-web:verification']);
    containers.push(webName);
    const webPort = Number((await docker(['port', webName, '80/tcp'])).split(':').at(-1));
    const request = path => new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port: webPort, path, headers: { Host: 'clms.test' } }, res => {
        let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      }); req.setTimeout(3000, () => req.destroy(new Error('Preview request timed out.'))); req.on('error', reject);
    });
    let ready = false;
    for (let n = 0; n < 45; n++) {
      try { if ((await request('/api/health/ready')).status === 200) { ready = true; break; } } catch { /* startup in progress */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Container stack did not become ready.');
    const runtime = await request('/api/runtime');
    if (runtime.status !== 200 || JSON.parse(runtime.body).mode !== 'staging' || JSON.parse(runtime.body).demo !== false) throw new Error('Server runtime/proxy check failed.');
    if ((await request('/api/employee/getAllEmployees')).status !== 401) throw new Error('Container authorization check failed.');
    const page = await request('/server/workers');
    if (page.status !== 200 || !page.body.includes('id="root"')) throw new Error('Frontend deep-link check failed.');
    if (!(page.headers['content-security-policy'] || '').includes("connect-src 'self'")) throw new Error('Web CSP missing.');
    if ((await request('/assets/blocked.map')).status !== 404) throw new Error('Source map exposure check failed.');
    console.log('API + Nginx + SQL container smoke checks passed: readiness, origin routing, authenticated API, SPA deep links and CSP. HTTPS browser/UAT is separate.');
  }
} catch (error) { console.error(error.message.replaceAll(password, '[redacted]')); process.exitCode = 1; }
finally {
  if (pool) await pool.close().catch(() => {});
  for (const name of containers.reverse()) {
    const label = await docker(['inspect', '--format', '{{index .Config.Labels "clms.test"}}', name]);
    if (label !== suffix || !/^clms-(?:api-test|web-test|test)-[a-f0-9]{12}$/.test(name)) throw new Error('Container identity verification failed; automatic cleanup stopped.');
    await docker(['rm', '-f', name]);
  }
  if (containers.length) {
    console.log('Removed the disposable SQL container and its test database.');
  }
  if (networkCreated) {
    const label = await docker(['network', 'inspect', '--format', '{{index .Labels "clms.test"}}', network]);
    if (label !== suffix) throw new Error('Test network identity verification failed.');
    await docker(['network', 'rm', network]);
  }
}
