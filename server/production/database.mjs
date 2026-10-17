import sql from 'mssql';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export async function connectDatabase(config) {
  // The driver accepts standard SQL Server connection strings, not a URL scheme.
  const parsed = sql.ConnectionPool.parseConnectionString(config.databaseUrl);
  if (!parsed.server || !parsed.database || ['master', 'model', 'msdb', 'tempdb'].includes(parsed.database.toLowerCase())) throw new Error('Configure a dedicated CLMS database. System databases are prohibited.');
  const pool = new sql.ConnectionPool({ ...parsed, options: { ...parsed.options, encrypt: true, trustServerCertificate: Boolean(config.trustServerCertificate), enableArithAbort: true }, pool: { min: 0, max: 10, idleTimeoutMillis: 30000 }, connectionTimeout: 15000, requestTimeout: 30000 });
  pool.on('error', () => console.error('CLMS database connection error.'));
  await pool.connect();
  return pool;
}

export async function migrate(pool) {
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await new sql.Request(tx).query("DECLARE @result int; EXEC @result=sp_getapplock @Resource='clms-schema', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000; IF @result<0 THROW 50001,'Migration lock unavailable',1; IF OBJECT_ID('dbo.clms_migrations','U') IS NULL CREATE TABLE dbo.clms_migrations (name nvarchar(200) PRIMARY KEY, checksum char(64) NOT NULL, applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());");
    const directory = fileURLToPath(new URL('./migrations/', import.meta.url));
    for (const name of readdirSync(directory).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      const content = readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
      const checksum = createHash('sha256').update(content).digest('hex');
      const saved = await new sql.Request(tx).input('name', sql.NVarChar(200), name).query('SELECT checksum FROM dbo.clms_migrations WHERE name=@name');
      if (saved.recordset.length) {
        if (saved.recordset[0].checksum !== checksum) throw new Error(`Previously applied migration changed: ${name}`);
        continue;
      }
      await new sql.Request(tx).batch(content);
      await new sql.Request(tx).input('name', sql.NVarChar(200), name).input('checksum', sql.Char(64), checksum).query('INSERT dbo.clms_migrations(name,checksum) VALUES(@name,@checksum)');
    }
    await tx.commit();
  } catch (error) { await tx.rollback().catch(() => {}); throw error; }
}

export async function verifySchema(pool) {
  const result = await pool.request().query("SELECT name,checksum FROM dbo.clms_migrations WHERE name='001_core.sql'");
  const content = readFileSync(new URL('./migrations/001_core.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const checksum = createHash('sha256').update(content).digest('hex');
  if (result.recordset[0]?.checksum !== checksum) throw new Error('Required CLMS schema is missing or differs. Run the migration command using a migration account.');
}

export { sql };
