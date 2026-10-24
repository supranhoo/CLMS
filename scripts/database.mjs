import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { readServerConfig } from '../server/config.mjs';
import { connectDatabase, migrate, verifySchema } from '../server/production/database.mjs';
import { SqlRepository } from '../server/production/repository.mjs';
import { hashPassword } from '../server/production/security.mjs';

let pool;
let phase = 'configuration';
try {
  const command = process.argv[2];
  if (!['migrate', 'bootstrap', 'verify'].includes(command)) throw new Error('Use migrate, bootstrap or verify.');
  const config = readServerConfig();
  if (config.isDemo || config.apiAdapter !== 'sql') throw new Error('Database tools require an explicitly configured staging/production SQL environment.');
  let bootstrapUser;
  if (command === 'bootstrap') {
    const expires = Date.parse(process.env.CLMS_BOOTSTRAP_EXPIRES_AT || '');
    if (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 3600000) throw new Error('Set CLMS_BOOTSTRAP_EXPIRES_AT to a future UTC time within one hour.');
    const emp_id = process.env.CLMS_BOOTSTRAP_USER || '';
    const Name = process.env.CLMS_BOOTSTRAP_NAME || '';
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(emp_id) || !Name.trim() || Name.length > 200) throw new Error('Set a valid bootstrap user and display name.');
    if (!process.env.CLMS_BOOTSTRAP_PASSWORD_FILE) throw new Error('CLMS_BOOTSTRAP_PASSWORD_FILE is required.');
    const password = readFileSync(process.env.CLMS_BOOTSTRAP_PASSWORD_FILE, 'utf8').replace(/\r?\n$/, '');
    bootstrapUser = { emp_id, Name, passwordHash: await hashPassword(password) };
  }
  phase = 'database';
  pool = await connectDatabase(config);
  if (command === 'migrate') await migrate(pool);
  else {
    await verifySchema(pool);
    if (command === 'bootstrap') await new SqlRepository(pool).bootstrap(bootstrapUser, randomUUID());
  }
  console.log(`CLMS database ${command} completed.`);
} catch (error) {
  // Driver errors may contain host/user details. Never echo connection strings.
  console.error(error.status || phase === 'configuration' ? error.message : 'Database command failed. Verify database access and schema. No credentials are logged.');
  process.exitCode = 1;
} finally { if (pool) await pool.close(); }
