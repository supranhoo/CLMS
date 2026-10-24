import { sql } from './database.mjs';
import { problem, inScope } from './security.mjs';

const account = row => row && ({ emp_id: row.user_id, Name: row.display_name, email_id: row.email, role: row.role, Is_Active: row.active ? 'Y' : 'N', mustChangePassword: row.must_change_password, passwordHash: row.password_hash, assignments: JSON.parse(row.assignments), version: row.version, lockedUntil: row.locked_until });
const record = row => row && ({ ...JSON.parse(row.payload), version: row.version });

export class SqlRepository {
  constructor(pool) { this.pool = pool; }
  request(owner = this.pool) { return new sql.Request(owner); }
  async transaction(operation) {
    const tx = new sql.Transaction(this.pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try { const result = await operation(tx); await tx.commit(); return result; }
    catch (error) {
      await tx.rollback().catch(() => {});
      if ([2601, 2627].includes(error.number)) throw problem(409, 'A record with this identifier already exists.');
      if (error.number === 547) throw problem(409, 'A referenced record is missing or still in use.');
      throw error;
    }
  }
  async audit(tx, actor, action, target, correlationId) {
    await this.request(tx).input('actor', sql.NVarChar(40), actor).input('action', sql.NVarChar(80), action).input('target', sql.NVarChar(200), target).input('correlation', sql.VarChar(36), correlationId).query('INSERT dbo.clms_audit(actor,action,target,correlation_id) VALUES(@actor,@action,@target,@correlation)');
  }
  async health() { await this.pool.request().query('SELECT TOP (1) name FROM dbo.clms_migrations'); return true; }
  async findUser(id) { return account((await this.request().input('id', sql.NVarChar(40), id).query('SELECT * FROM dbo.clms_users WHERE user_id=@id')).recordset[0]); }
  async bootstrap(user, correlationId) {
    return this.transaction(async tx => {
      const existing = await this.request(tx).query('SELECT COUNT(*) AS total FROM dbo.clms_users WITH(UPDLOCK,HOLDLOCK)');
      if (existing.recordset[0].total) throw problem(409, 'Bootstrap is disabled because an account already exists.');
      await this.insertUser(tx, { ...user, role: 'ADMIN', mustChangePassword: true, assignments: {} });
      await this.audit(tx, user.emp_id, 'BOOTSTRAP_ADMIN', user.emp_id, correlationId);
    });
  }
  async insertUser(tx, user) {
    await this.request(tx).input('id', sql.NVarChar(40), user.emp_id).input('name', sql.NVarChar(200), user.Name).input('email', sql.NVarChar(254), user.email_id || '').input('hash', sql.VarChar(250), user.passwordHash).input('role', sql.VarChar(20), user.role).input('change', sql.Bit, user.mustChangePassword ?? true).input('assignments', sql.NVarChar(sql.MAX), JSON.stringify(user.assignments || {})).query('INSERT dbo.clms_users(user_id,display_name,email,password_hash,role,must_change_password,assignments) VALUES(@id,@name,@email,@hash,@role,@change,@assignments)');
  }
  async createUser(user, actor, correlation) { return this.transaction(async tx => { await this.insertUser(tx, user); await this.audit(tx, actor.emp_id, 'USER_CREATED', user.emp_id, correlation); }); }
  async listUsers() { return (await this.pool.request().query('SELECT * FROM dbo.clms_users ORDER BY user_id')).recordset.map(account); }
  async updateUser(id, changes, actor, correlation) {
    return this.transaction(async tx => {
      const row = account((await this.request(tx).input('id', sql.NVarChar(40), id).query('SELECT * FROM dbo.clms_users WITH(UPDLOCK,HOLDLOCK) WHERE user_id=@id')).recordset[0]);
      if (!row) throw problem(404, 'Account not found.');
      if (row.version !== changes.version) throw problem(409, 'Account changed. Reload before saving.');
      if (row.role === 'ADMIN' && (changes.role !== 'ADMIN' || changes.Is_Active === 'N')) {
        const admins = (await this.request(tx).query("SELECT COUNT(*) AS total FROM dbo.clms_users WITH(UPDLOCK,HOLDLOCK) WHERE role='ADMIN' AND active=1")).recordset[0].total;
        if (admins <= 1) throw problem(409, 'The final active administrator cannot be disabled or demoted.');
      }
      await this.request(tx).input('id', sql.NVarChar(40), id).input('name', sql.NVarChar(200), changes.Name).input('email', sql.NVarChar(254), changes.email_id || '').input('role', sql.VarChar(20), changes.role).input('active', sql.Bit, changes.Is_Active !== 'N').input('assignments', sql.NVarChar(sql.MAX), JSON.stringify(changes.assignments)).query('UPDATE dbo.clms_users SET display_name=@name,email=@email,role=@role,active=@active,assignments=@assignments,version=version+1 WHERE user_id=@id; DELETE dbo.clms_sessions WHERE user_id=@id;');
      await this.audit(tx, actor.emp_id, 'USER_UPDATED', id, correlation);
    });
  }
  async login(id, passwordHash, tokenHash, lifetime, correlation) {
    return this.transaction(async tx => {
      const user = account((await this.request(tx).input('id', sql.NVarChar(40), id).query('SELECT * FROM dbo.clms_users WITH(UPDLOCK,HOLDLOCK) WHERE user_id=@id')).recordset[0]);
      if (!user || user.Is_Active === 'N' || user.passwordHash !== passwordHash || user.lockedUntil > new Date()) return false;
      await this.request(tx).input('id', sql.NVarChar(40), id).input('token', sql.Char(64), tokenHash).input('seconds', sql.Int, lifetime).query('UPDATE dbo.clms_users SET failed_logins=0,locked_until=NULL WHERE user_id=@id; DELETE dbo.clms_sessions WHERE expires_at<=SYSUTCDATETIME(); INSERT dbo.clms_sessions(token_hash,user_id,expires_at) VALUES(@token,@id,DATEADD(second,@seconds,SYSUTCDATETIME()));');
      await this.audit(tx, id, 'LOGIN', id, correlation);
      return true;
    });
  }
  async failedLogin(id) {
    await this.request().input('id', sql.NVarChar(40), id).query('UPDATE dbo.clms_users SET failed_logins=CASE WHEN locked_until<=SYSUTCDATETIME() THEN 1 ELSE failed_logins+1 END, locked_until=CASE WHEN locked_until<=SYSUTCDATETIME() THEN NULL WHEN failed_logins>=4 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE locked_until END WHERE user_id=@id');
  }
  async getSession(hash, idleSeconds) {
    const result = await this.request().input('hash', sql.Char(64), hash).input('idle', sql.Int, idleSeconds).query('UPDATE s SET last_seen=SYSUTCDATETIME() OUTPUT inserted.user_id FROM dbo.clms_sessions s JOIN dbo.clms_users u ON s.user_id=u.user_id WHERE token_hash=@hash AND expires_at>SYSUTCDATETIME() AND last_seen>DATEADD(second,-@idle,SYSUTCDATETIME()) AND u.active=1;');
    return result.recordset[0] ? this.findUser(result.recordset[0].user_id) : null;
  }
  async logout(hash, actor, correlation) { return this.transaction(async tx => { await this.request(tx).input('hash', sql.Char(64), hash).query('DELETE dbo.clms_sessions WHERE token_hash=@hash'); await this.audit(tx, actor.emp_id, 'LOGOUT', actor.emp_id, correlation); }); }
  async changePassword(id, previousHash, hash, correlation) {
    return this.transaction(async tx => {
      const result = await this.request(tx).input('id', sql.NVarChar(40), id).input('old', sql.VarChar(250), previousHash).input('hash', sql.VarChar(250), hash).query('UPDATE dbo.clms_users SET password_hash=@hash,must_change_password=0,version=version+1,failed_logins=0,locked_until=NULL WHERE user_id=@id AND password_hash=@old;');
      if (!result.rowsAffected[0]) throw problem(409, 'Account changed. Sign in again.');
      await this.request(tx).input('id', sql.NVarChar(40), id).query('DELETE dbo.clms_sessions WHERE user_id=@id');
      await this.audit(tx, id, 'PASSWORD_CHANGED', id, correlation);
    });
  }
  async resetPassword(id, hash, expectedVersion, actor, correlation) {
    return this.transaction(async tx => {
      const result = await this.request(tx).input('id', sql.NVarChar(40), id).input('version', sql.Int, expectedVersion).input('hash', sql.VarChar(250), hash).query('UPDATE dbo.clms_users SET password_hash=@hash,must_change_password=1,version=version+1,failed_logins=0,locked_until=NULL WHERE user_id=@id AND version=@version');
      if (!result.rowsAffected[0]) throw problem(409, 'Account changed. Reload before resetting its password.');
      await this.request(tx).input('id', sql.NVarChar(40), id).query('DELETE dbo.clms_sessions WHERE user_id=@id');
      await this.audit(tx, actor.emp_id, 'ADMIN_PASSWORD_RESET', id, correlation);
    });
  }
  async list(kind, actor, options = {}) {
    const limit = Number(options.limit ?? 200); const offset = Number(options.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(offset) || offset < 0 || offset > 10000000) throw problem(400, 'Use a limit of 1–500 and a valid non-negative offset.');
    const search = String(options.search || '').slice(0, 200);
    if (kind === 'contractor') {
      const query = this.request().input('limit', sql.Int, limit).input('offset', sql.Int, offset).input('search', sql.NVarChar(200), search);
      const scoped = actor.role !== 'ADMIN';
      if (scoped) query.input('scope', sql.NVarChar(sql.MAX), JSON.stringify(actor.assignments?.contractors || []));
      return (await query.query(`SELECT payload,version FROM dbo.clms_contractors WHERE (@search='' OR CHARINDEX(@search,contractor_id+' '+contractor_name)>0) ${scoped ? 'AND contractor_id IN (SELECT value FROM OPENJSON(@scope))' : ''} ORDER BY contractor_id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)).recordset.map(record);
    }
    const query = this.request().input('limit', sql.Int, limit).input('offset', sql.Int, offset).input('search', sql.NVarChar(200), search).input('code', sql.NVarChar(80), options.employeeCode || '').input('adhar', sql.NVarChar(80), options.adhar || '').input('pan', sql.NVarChar(80), options.pan || ''); const scoped = actor.role !== 'ADMIN';
    if (scoped) for (const key of ['contractors', 'departments', 'businessUnits', 'locations']) query.input(key, sql.NVarChar(sql.MAX), JSON.stringify(actor.assignments?.[key] || []));
    const where = scoped ? 'AND contractor_id IN (SELECT value FROM OPENJSON(@contractors)) AND department IN (SELECT value FROM OPENJSON(@departments)) AND business_unit IN (SELECT value FROM OPENJSON(@businessUnits)) AND location_code IN (SELECT value FROM OPENJSON(@locations))' : '';
    return (await query.query(`SELECT payload,version FROM dbo.clms_workers WHERE (@search='' OR CHARINDEX(@search,employee_code+' '+display_name)>0) AND (@code='' OR employee_code=@code) AND (@adhar='' OR JSON_VALUE(payload,'$.Adhar_No')=@adhar) AND (@pan='' OR JSON_VALUE(payload,'$.panno')=@pan) ${where} ORDER BY employee_code OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)).recordset.map(record);
  }
  async validateWorkerChange() {}
  async saveRecord(kind, data, expectedVersion, actor, correlation) {
    return this.transaction(async tx => {
      const contractor = kind === 'contractor';
      // Table and key identifiers are fixed choices, never user input.
      const table = contractor ? 'dbo.clms_contractors' : 'dbo.clms_workers';
      const key = contractor ? 'contractor_id' : 'employee_code';
      const id = contractor ? data.Contractor_ID : data.Employee_Code;
      const row = (await this.request(tx).input('id', sql.NVarChar(80), id).query(`SELECT payload,version FROM ${table} WITH(UPDLOCK,HOLDLOCK) WHERE ${key}=@id`)).recordset[0];
      if (row && !inScope(actor, record(row), kind)) throw problem(403, 'Record is outside your assigned scope.');
      if (expectedVersion === null && row) throw problem(409, 'This identifier already exists.');
      if (expectedVersion !== null && (!row || row.version !== expectedVersion)) throw problem(409, 'Record changed. Reload before saving.');
      const saved = { ...(row ? JSON.parse(row.payload) : {}), ...data }; delete saved.version;
      if (!inScope(actor, saved, kind)) throw problem(403, 'Record is outside your assigned scope.');
      if (row && !contractor) await this.validateWorkerChange(tx, JSON.parse(row.payload), saved);
      const query = this.request(tx).input('id', sql.NVarChar(80), id).input('name', sql.NVarChar(200), contractor ? saved.Contractor_Name : saved.display_name).input('payload', sql.NVarChar(sql.MAX), JSON.stringify(saved));
      if (!contractor) query.input('contractor', sql.NVarChar(80), saved.contractor_id).input('dept', sql.NVarChar(80), saved.dept || '').input('bu', sql.NVarChar(80), saved.bu || '').input('loc', sql.NVarChar(80), saved.loc_code || '');
      const updateWorker = contractor ? '' : ',contractor_id=@contractor,department=@dept,business_unit=@bu,location_code=@loc';
      await query.query(row
        ? `UPDATE ${table} SET ${contractor ? 'contractor_name' : 'display_name'}=@name,payload=@payload,version=version+1,modified_at=SYSUTCDATETIME()${updateWorker} WHERE ${key}=@id`
        : contractor ? 'INSERT dbo.clms_contractors(contractor_id,contractor_name,payload) VALUES(@id,@name,@payload)' : 'INSERT dbo.clms_workers(employee_code,display_name,contractor_id,department,business_unit,location_code,payload) VALUES(@id,@name,@contractor,@dept,@bu,@loc,@payload)');
      await this.audit(tx, actor.emp_id, row ? `${kind.toUpperCase()}_UPDATED` : `${kind.toUpperCase()}_CREATED`, id, correlation);
      return { ...saved, version: (row?.version || 0) + 1 };
    });
  }
  async listMasters(kind) { return (await this.request().input('kind', sql.NVarChar(50), kind).query('SELECT payload,version FROM dbo.clms_masters WHERE master_kind=@kind ORDER BY record_key')).recordset.map(record); }
  async saveMaster(kind, keys, method, body, actor, correlation) {
    const values = method === 'POST' ? body : body.keys;
    if (!values || keys.some(key => typeof values[key] !== 'string' || !values[key].trim())) throw problem(400, 'Complete master record keys are required.');
    const recordKey = JSON.stringify(keys.map(key => values[key]));
    if (recordKey.length > 400) throw problem(400, 'Master identifier is too long.');
    return this.transaction(async tx => {
      const query = () => this.request(tx).input('kind', sql.NVarChar(50), kind).input('key', sql.NVarChar(400), recordKey);
      const previous = (await query().query('SELECT payload,version FROM dbo.clms_masters WITH(UPDLOCK,HOLDLOCK) WHERE master_kind=@kind AND record_key=@key')).recordset[0];
      if (method === 'POST' && previous) throw problem(409, 'Master record already exists.');
      if (method !== 'POST' && (!previous || previous.version !== body.version)) throw problem(409, 'Master record changed. Reload before saving.');
      if (method === 'DELETE') await query().query('DELETE dbo.clms_masters WHERE master_kind=@kind AND record_key=@key');
      else {
        const data = method === 'POST' ? body : body.data;
        if (!data || keys.some(key => data[key] !== values[key])) throw problem(400, 'Master identifiers cannot be changed.');
        const saved = { ...data }; delete saved.version;
        await query().input('payload', sql.NVarChar(sql.MAX), JSON.stringify(saved)).query(method === 'POST' ? 'INSERT dbo.clms_masters(master_kind,record_key,payload) VALUES(@kind,@key,@payload)' : 'UPDATE dbo.clms_masters SET payload=@payload,version=version+1 WHERE master_kind=@kind AND record_key=@key');
      }
      await this.audit(tx, actor.emp_id, `MASTER_${method}`, kind, correlation);
      return { success: true, message: 'Master record saved.' };
    });
  }
  async listAudit() { return (await this.pool.request().query('SELECT TOP(500) event_id,actor,action,target,correlation_id,at FROM dbo.clms_audit ORDER BY event_id DESC')).recordset; }
}
