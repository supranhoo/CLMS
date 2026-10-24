import { randomUUID } from 'node:crypto';
import { SqlRepository } from './repository.mjs';
import { sql } from './database.mjs';
import { problem, inScope, canAccess, canApprove, digest } from './security.mjs';
import { day, range, identifier, reason, stamp, chargedDays, page, expectedVersion } from './operations-validation.mjs';

const date = value => new Date(day(value) + 'T00:00:00Z');
const isoDay = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const serialize = rows => rows.map(row => ({ ...row, ...(row.business_date ? { business_date: isoDay(row.business_date) } : {}), ...(row.period ? { period: isoDay(row.period) } : {}) }));
const months = (from, to) => [...new Set(Array.from({ length: Math.floor((Date.parse(to) - Date.parse(from)) / 86400000) + 1 }, (_, n) => new Date(Date.parse(from) + n * 86400000).toISOString().slice(0, 7) + '-01'))];

export class OperationsRepository extends SqlRepository {
  scope(query, actor, alias = 'w') {
    if (actor.role === 'ADMIN') return '1=1';
    for (const key of ['contractors', 'departments', 'businessUnits', 'locations']) query.input(key, sql.NVarChar(sql.MAX), JSON.stringify(actor.assignments?.[key] || []));
    return `${alias}.contractor_id IN (SELECT value FROM OPENJSON(@contractors)) AND ${alias}.department IN (SELECT value FROM OPENJSON(@departments)) AND ${alias}.business_unit IN (SELECT value FROM OPENJSON(@businessUnits)) AND ${alias}.location_code IN (SELECT value FROM OPENJSON(@locations))`;
  }
  async worker(tx, code, actor) {
    if (typeof code !== 'string' || !code || code.length > 80) throw problem(400, 'Worker code is required.');
    const result = (await this.request(tx).input('code', sql.NVarChar(80), code).query('SELECT employee_code,contractor_id,payload FROM dbo.clms_workers WITH(UPDLOCK,HOLDLOCK) WHERE employee_code=@code')).recordset[0];
    if (!result || !inScope(actor, JSON.parse(result.payload), 'worker')) throw problem(403, 'Worker is missing or outside your assigned scope.');
    return result;
  }
  async unlocked(tx, module, contractor, value) {
    const period = value.slice(0, 7) + '-01';
    const row = (await this.request(tx).input('module', sql.VarChar(20), module).input('contractor', sql.NVarChar(80), contractor).input('period', sql.Date, date(period)).query(`SELECT TOP(1) locked FROM dbo.clms_period_locks WITH(UPDLOCK,HOLDLOCK) WHERE module=@module AND contractor_id=@contractor AND period${module === 'leave' ? '>=' : '='}@period AND locked=1`)).recordset[0];
    if (row?.locked) throw problem(409, 'This contractor period or an affected later leave period is locked. No changes were made.');
  }
  async validateWorkerChange(tx, previous, next) {
    if (!['contractor_id', 'dept', 'bu', 'loc_code'].some(key => (previous[key] || '') !== (next[key] || ''))) return;
    const result = await this.request(tx).input('code', sql.NVarChar(80), next.Employee_Code).query('SELECT (SELECT COUNT(*) FROM dbo.clms_punches WHERE employee_code=@code)+(SELECT COUNT(*) FROM dbo.clms_attendance_adjustments WHERE employee_code=@code)+(SELECT COUNT(*) FROM dbo.clms_leave_requests WHERE employee_code=@code)+(SELECT COUNT(*) FROM dbo.clms_leave_ledger WHERE employee_code=@code) AS total');
    if (result.recordset[0].total) throw problem(409, 'Scope transfers for workers with operational history require an effective-dated transfer workflow. Historical assignments were preserved.');
  }
  async importPunches(body, actor, correlation) {
    const batchId = identifier(body.batch_id);
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 1000) throw problem(400, 'Import 1–1000 punch rows per batch.');
    const rows = body.rows.map(row => ({ employee_code: String(row?.employee_code || ''), business_date: day(row?.business_date), punched_at: stamp(row?.punched_at).toISOString() })).sort((a, b) => `${a.employee_code}|${a.business_date}|${a.punched_at}`.localeCompare(`${b.employee_code}|${b.business_date}|${b.punched_at}`));
    if (new Set(rows.map(row => `${row.employee_code.toLowerCase()}|${row.punched_at}`)).size !== rows.length) throw problem(409, 'Duplicate worker/timestamp in batch.');
    // Business date is explicitly supplied for overnight shifts; restrict gross
    // misclassification without inferring a shift or a paid attendance day.
    if (rows.some(row => Math.abs(Date.parse(row.punched_at) - Date.parse(row.business_date)) > 48 * 3600000)) throw problem(400, 'Punch timestamp must be within 48 hours of its explicit business date.');
    const hash = digest(JSON.stringify(rows));
    return this.transaction(async tx => {
      const prior = (await this.request(tx).input('id', sql.VarChar(80), batchId).query('SELECT * FROM dbo.clms_punch_batches WITH(UPDLOCK,HOLDLOCK) WHERE batch_id=@id')).recordset[0];
      if (prior) {
        if (prior.payload_hash !== hash || prior.submitted_by.toLowerCase() !== actor.emp_id.toLowerCase()) throw problem(409, 'Batch ID already belongs to a different submission.');
        return { success: true, replay: true, rows: prior.row_count };
      }
      const workers = new Map();
      for (const code of [...new Set(rows.map(row => row.employee_code))].sort()) workers.set(code, await this.worker(tx, code, actor));
      for (const key of [...new Set(rows.map(row => JSON.stringify([workers.get(row.employee_code).contractor_id, row.business_date.slice(0, 7) + '-01'])))].sort()) { const [contractor, when] = JSON.parse(key); await this.unlocked(tx, 'attendance', contractor, when); }
      await this.request(tx).input('id', sql.VarChar(80), batchId).input('hash', sql.Char(64), hash).input('actor', sql.NVarChar(40), actor.emp_id).input('count', sql.Int, rows.length).query('INSERT dbo.clms_punch_batches(batch_id,payload_hash,submitted_by,row_count) VALUES(@id,@hash,@actor,@count)');
      const payload = JSON.stringify(rows);
      const conflicting = (await this.request(tx).input('rows', sql.NVarChar(sql.MAX), payload).query("SELECT TOP(1) 1 AS conflict FROM OPENJSON(@rows) WITH(employee_code nvarchar(80),business_date date,punched_at datetimeoffset(0)) r JOIN dbo.clms_punches p ON r.employee_code=p.employee_code AND r.punched_at=p.punched_at WHERE r.business_date<>p.business_date")).recordset.length;
      if (conflicting) throw problem(409, 'A punch was already assigned to another business date.');
      await this.request(tx).input('rows', sql.NVarChar(sql.MAX), payload).input('batch', sql.VarChar(80), batchId).query('INSERT dbo.clms_punches(employee_code,business_date,punched_at,batch_id) SELECT r.employee_code,r.business_date,r.punched_at,@batch FROM OPENJSON(@rows) WITH(employee_code nvarchar(80),business_date date,punched_at datetimeoffset(0)) r WHERE NOT EXISTS(SELECT 1 FROM dbo.clms_punches p WHERE p.employee_code=r.employee_code AND p.punched_at=r.punched_at)');
      const invalidSpan = (await this.request(tx).input('rows', sql.NVarChar(sql.MAX), payload).query('SELECT TOP(1) p.employee_code FROM dbo.clms_punches p WHERE EXISTS(SELECT 1 FROM OPENJSON(@rows) WITH(employee_code nvarchar(80),business_date date) r WHERE p.employee_code=r.employee_code AND p.business_date=r.business_date) GROUP BY p.employee_code,p.business_date HAVING DATEDIFF(second,MIN(p.punched_at),MAX(p.punched_at))>172800')).recordset.length;
      if (invalidSpan) throw problem(400, 'A business date cannot contain a punch span longer than 48 hours. No rows were imported.');
      await this.audit(tx, actor.emp_id, 'PUNCH_BATCH_IMPORTED', batchId, correlation);
      return { success: true, replay: false, rows: rows.length, message: 'Recorded punches saved. Queue processing to update elapsed-time summaries.' };
    });
  }
  async queueAttendance(body, actor, correlation) {
    const selected = range(body);
    if (!Array.isArray(body.employee_codes) || !body.employee_codes.length || body.employee_codes.length > 200 || body.employee_codes.some(code => typeof code !== 'string' || code.length > 80)) throw problem(400, 'Select 1–200 worker codes.');
    const codes = [...new Set(body.employee_codes)].sort(); const jobId = randomUUID();
    return this.transaction(async tx => {
      for (const code of codes) {
        const worker = await this.worker(tx, code, actor);
        for (const month of months(selected.from, selected.to)) await this.unlocked(tx, 'attendance', worker.contractor_id, month);
      }
      await this.request(tx).input('id', sql.VarChar(36), jobId).input('actor', sql.NVarChar(40), actor.emp_id).input('from', sql.Date, date(selected.from)).input('to', sql.Date, date(selected.to)).input('codes', sql.NVarChar(sql.MAX), JSON.stringify(codes)).query('INSERT dbo.clms_attendance_jobs(job_id,submitted_by,from_date,to_date,employee_codes) VALUES(@id,@actor,@from,@to,@codes)');
      await this.audit(tx, actor.emp_id, 'ATTENDANCE_QUEUED', jobId, correlation);
      return { success: true, job_id: jobId, status: 'QUEUED' };
    });
  }
  async claimAttendanceJob() {
    const lease = randomUUID();
    // A pooled connection can retain an earlier SERIALIZABLE isolation level.
    // READPAST needs an explicit locking-compatible transaction here, including
    // on databases that enable READ_COMMITTED_SNAPSHOT.
    const tx = new sql.Transaction(this.pool); await tx.begin(sql.ISOLATION_LEVEL.REPEATABLE_READ);
    try {
      const result = await this.request(tx).input('lease', sql.VarChar(36), lease).query(";WITH candidate AS (SELECT TOP(1) * FROM dbo.clms_attendance_jobs WITH(UPDLOCK,READPAST,ROWLOCK) WHERE status='QUEUED' OR (status='RUNNING' AND lease_until<SYSUTCDATETIME()) ORDER BY created_at) UPDATE candidate SET status='RUNNING',lease_token=@lease,lease_until=DATEADD(minute,5,SYSUTCDATETIME()),attempts=attempts+1 OUTPUT inserted.*;");
      await tx.commit(); return result.recordset[0];
    } catch (error) { await tx.rollback().catch(() => {}); throw error; }
  }
  async processAttendanceJob(job) {
    try {
      await this.transaction(async tx => {
        const current = (await this.request(tx).input('id', sql.VarChar(36), job.job_id).input('lease', sql.VarChar(36), job.lease_token).query("SELECT * FROM dbo.clms_attendance_jobs WITH(UPDLOCK,HOLDLOCK) WHERE job_id=@id AND status='RUNNING' AND lease_token=@lease AND lease_until>SYSUTCDATETIME()")).recordset[0];
        if (!current) return;
        const actor = await this.findUser(current.submitted_by);
        if (!actor || actor.Is_Active === 'N' || !canAccess(actor, 'attendance', true)) throw problem(403, 'Job owner no longer has attendance write access.');
        const from = isoDay(current.from_date); const to = isoDay(current.to_date);
        for (const code of JSON.parse(current.employee_codes).sort()) {
          const worker = await this.worker(tx, code, actor);
          for (const month of months(from, to)) await this.unlocked(tx, 'attendance', worker.contractor_id, month);
          const query = () => this.request(tx).input('code', sql.NVarChar(80), code).input('from', sql.Date, date(from)).input('to', sql.Date, date(to));
          await query().query('DELETE dbo.clms_attendance_daily WHERE employee_code=@code AND business_date BETWEEN @from AND @to');
          await query().input('job', sql.VarChar(36), job.job_id).query('INSERT dbo.clms_attendance_daily(employee_code,business_date,first_punch,last_punch,punch_count,elapsed_seconds,job_id) SELECT employee_code,business_date,MIN(punched_at),MAX(punched_at),COUNT(*),CASE WHEN COUNT(*)>1 THEN DATEDIFF(second,MIN(punched_at),MAX(punched_at)) ELSE NULL END,@job FROM dbo.clms_punches WHERE employee_code=@code AND business_date BETWEEN @from AND @to GROUP BY employee_code,business_date');
        }
        await this.request(tx).input('id', sql.VarChar(36), job.job_id).query("UPDATE dbo.clms_attendance_jobs SET status='COMPLETE',completed_at=SYSUTCDATETIME(),lease_until=NULL WHERE job_id=@id");
        await this.audit(tx, actor.emp_id, 'ATTENDANCE_PROCESSED', job.job_id, randomUUID());
      });
    } catch (error) {
      await this.request().input('id', sql.VarChar(36), job.job_id).input('lease', sql.VarChar(36), job.lease_token).input('error', sql.VarChar(40), error.status === 403 ? 'ACCESS_CHANGED' : error.status === 409 ? 'PERIOD_LOCKED' : 'PROCESSING_FAILED').query("UPDATE dbo.clms_attendance_jobs SET status='FAILED',error_code=@error,completed_at=SYSUTCDATETIME(),lease_until=NULL WHERE job_id=@id AND lease_token=@lease AND status='RUNNING'");
    }
  }
  async listJobs(actor) {
    return (await this.request().input('actor', sql.NVarChar(40), actor.emp_id).input('admin', sql.Bit, actor.role === 'ADMIN').query('SELECT TOP(100) job_id,submitted_by,from_date,to_date,status,attempts,error_code,created_at,completed_at FROM dbo.clms_attendance_jobs WHERE submitted_by=@actor OR @admin=1 ORDER BY created_at DESC')).recordset;
  }
  async requestAttendance(body, actor, correlation) {
    const businessDate = day(body.business_date); const memo = reason(body.reason);
    if (!['P', 'AB', 'WO', 'HLD', 'OD'].includes(body.mark)) throw problem(400, 'Choose P, AB, WO, HLD or OD as a manually declared mark.');
    const first = body.first_punch ? stamp(body.first_punch) : null; const last = body.last_punch ? stamp(body.last_punch) : null;
    if (Boolean(first) !== Boolean(last) || first && (last < first || last - first > 48 * 3600000 || Math.abs(first - date(businessDate)) > 48 * 3600000 || Math.abs(last - date(businessDate)) > 48 * 3600000)) throw problem(400, 'Provide an ordered punch pair within 48 hours of the business date, or leave both blank.');
    return this.transaction(async tx => {
      const worker = await this.worker(tx, body.employee_code, actor); await this.unlocked(tx, 'attendance', worker.contractor_id, businessDate);
      const requestId = randomUUID();
      await this.request(tx).input('id', sql.VarChar(36), requestId).input('code', sql.NVarChar(80), worker.employee_code).input('day', sql.Date, date(businessDate)).input('mark', sql.VarChar(10), body.mark).input('first', sql.DateTimeOffset(0), first).input('last', sql.DateTimeOffset(0), last).input('reason', sql.NVarChar(500), memo).input('actor', sql.NVarChar(40), actor.emp_id).query('INSERT dbo.clms_attendance_adjustments(adjustment_id,employee_code,business_date,mark,first_punch,last_punch,reason,submitted_by) VALUES(@id,@code,@day,@mark,@first,@last,@reason,@actor)');
      await this.audit(tx, actor.emp_id, 'ATTENDANCE_SUBMITTED', requestId, correlation);
      return { success: true, adjustment_id: requestId, status: 'PENDING' };
    });
  }
  async reviewAttendance(id, body, actor, correlation) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw problem(400, 'Invalid request identifier.');
    if (!canApprove(actor, 'attendance')) throw problem(403, 'Attendance approval permission required.');
    const memo = reason(body.reason); expectedVersion(body.version);
    if (!['APPROVED', 'REJECTED'].includes(body.status)) throw problem(400, 'Choose APPROVED or REJECTED.');
    const candidate = (await this.request().input('id', sql.VarChar(36), id).query('SELECT employee_code FROM dbo.clms_attendance_adjustments WHERE adjustment_id=@id')).recordset[0];
    if (!candidate) throw problem(404, 'Adjustment not found.');
    return this.transaction(async tx => {
      const worker = await this.worker(tx, candidate.employee_code, actor);
      const row = (await this.request(tx).input('id', sql.VarChar(36), id).query('SELECT * FROM dbo.clms_attendance_adjustments WITH(UPDLOCK,HOLDLOCK) WHERE adjustment_id=@id')).recordset[0];
      if (row.status !== 'PENDING' || row.version !== body.version) throw problem(409, 'Adjustment changed or was already reviewed.');
      if (row.submitted_by.toLowerCase() === actor.emp_id.toLowerCase()) throw problem(403, 'A different authorised person must review this request.');
      await this.unlocked(tx, 'attendance', worker.contractor_id, isoDay(row.business_date));
      await this.request(tx).input('id', sql.VarChar(36), id).input('status', sql.VarChar(20), body.status).input('actor', sql.NVarChar(40), actor.emp_id).input('reason', sql.NVarChar(500), memo).query('UPDATE dbo.clms_attendance_adjustments SET status=@status,reviewed_by=@actor,review_reason=@reason,version=version+1 WHERE adjustment_id=@id');
      if (body.status === 'APPROVED') {
        const query = this.request(tx).input('id', sql.VarChar(36), id).input('code', sql.NVarChar(80), worker.employee_code).input('day', sql.Date, row.business_date);
        await query.query('DELETE dbo.clms_attendance_marks WHERE employee_code=@code AND business_date=@day; INSERT dbo.clms_attendance_marks(employee_code,business_date,adjustment_id) VALUES(@code,@day,@id)');
      }
      await this.audit(tx, actor.emp_id, `ATTENDANCE_${body.status}`, id, correlation);
      return { success: true };
    });
  }
  async operationalList(kind, body, actor) {
    const { limit, offset } = page(body); const query = this.request().input('limit', sql.Int, limit).input('offset', sql.Int, offset);
    const scope = this.scope(query, actor);
    if (kind === 'attendanceRequests') return serialize((await query.query(`SELECT a.*,w.display_name FROM dbo.clms_attendance_adjustments a JOIN dbo.clms_workers w ON a.employee_code=w.employee_code WHERE ${scope} ORDER BY a.created_at DESC,a.adjustment_id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)).recordset);
    if (kind === 'leaveRequests') return (await query.query(`SELECT r.*,w.display_name FROM dbo.clms_leave_requests r JOIN dbo.clms_workers w ON r.employee_code=w.employee_code WHERE ${scope} ORDER BY r.created_at DESC,r.request_id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)).recordset.map(row => ({ ...row, charged_days: JSON.parse(row.charged_days) }));
    if (kind === 'ledger') {
      const selected = range(body); query.input('from', sql.Date, date(selected.from)).input('to', sql.Date, date(selected.to)).input('code', sql.NVarChar(80), body.employee_code || '');
      return serialize((await query.query(`SELECT l.*,w.display_name FROM dbo.clms_leave_ledger l JOIN dbo.clms_workers w ON l.employee_code=w.employee_code WHERE ${scope} AND (@code='' OR w.employee_code=@code) AND l.business_date BETWEEN @from AND @to ORDER BY l.business_date,l.entry_id OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)).recordset);
    }
    const selected = range(body); query.input('from', sql.Date, date(selected.from)).input('to', sql.Date, date(selected.to)).input('code', sql.NVarChar(80), body.employee_code || '');
    return serialize((await query.query(`WITH days AS (SELECT employee_code,business_date FROM dbo.clms_attendance_daily UNION SELECT employee_code,business_date FROM dbo.clms_attendance_marks) SELECT d.employee_code,w.display_name,d.business_date,p.first_punch AS raw_first_punch,p.last_punch AS raw_last_punch,p.punch_count,p.elapsed_seconds,a.mark,a.first_punch AS approved_first_punch,a.last_punch AS approved_last_punch FROM days d JOIN dbo.clms_workers w ON d.employee_code=w.employee_code LEFT JOIN dbo.clms_attendance_daily p ON d.employee_code=p.employee_code AND d.business_date=p.business_date LEFT JOIN dbo.clms_attendance_marks m ON d.employee_code=m.employee_code AND d.business_date=m.business_date LEFT JOIN dbo.clms_attendance_adjustments a ON m.adjustment_id=a.adjustment_id WHERE ${scope} AND (@code='' OR w.employee_code=@code) AND d.business_date BETWEEN @from AND @to ORDER BY d.business_date,d.employee_code OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`)).recordset);
  }
  async leaveTypes() { return (await this.request().query('SELECT * FROM dbo.clms_leave_types ORDER BY leave_code')).recordset; }
  async saveLeaveType(body, actor, correlation) {
    const code = identifier(body.leave_code);
    if (code.length > 20 || typeof body.leave_name !== 'string' || !body.leave_name.trim() || body.leave_name.length > 100 || typeof body.active !== 'boolean' || typeof body.allow_negative !== 'boolean' || ![0.25, 0.5, 1].includes(body.unit_step)) throw problem(400, 'Provide a leave name, active/negative flags and a step of 0.25, 0.5 or 1 day.');
    return this.transaction(async tx => {
      const old = (await this.request(tx).input('code', sql.VarChar(20), code).query('SELECT version FROM dbo.clms_leave_types WITH(UPDLOCK,HOLDLOCK) WHERE leave_code=@code')).recordset[0];
      if (old && old.version !== body.version || !old && body.version !== undefined) throw problem(409, 'Leave type changed. Reload before saving.');
      await this.request(tx).input('code', sql.VarChar(20), code).input('name', sql.NVarChar(100), body.leave_name.trim()).input('active', sql.Bit, body.active).input('negative', sql.Bit, body.allow_negative).input('step', sql.Decimal(3, 2), body.unit_step).query(old ? 'UPDATE dbo.clms_leave_types SET leave_name=@name,active=@active,allow_negative=@negative,unit_step=@step,version=version+1 WHERE leave_code=@code' : 'INSERT dbo.clms_leave_types(leave_code,leave_name,active,allow_negative,unit_step) VALUES(@code,@name,@active,@negative,@step)');
      await this.audit(tx, actor.emp_id, 'LEAVE_TYPE_SAVED', code, correlation);
      return { success: true };
    });
  }
  async type(tx, code) {
    if (typeof code !== 'string' || code.length > 20) throw problem(400, 'Choose a leave type.');
    const row = (await this.request(tx).input('code', sql.VarChar(20), code).query('SELECT * FROM dbo.clms_leave_types WITH(UPDLOCK,HOLDLOCK) WHERE leave_code=@code')).recordset[0];
    if (!row?.active) throw problem(400, 'Choose an active leave type.');
    return row;
  }
  async balanceAt(tx, employee, type, when) {
    return Number((await this.request(tx).input('code', sql.NVarChar(80), employee).input('type', sql.VarChar(20), type).input('day', sql.Date, date(when)).query('SELECT COALESCE(SUM(units),0) AS balance FROM dbo.clms_leave_ledger WHERE employee_code=@code AND leave_code=@type AND business_date<=@day')).recordset[0].balance);
  }
  async balances(body, actor) {
    const asOf = day(body.as_of);
    return this.transaction(async tx => {
      const worker = await this.worker(tx, body.employee_code, actor);
      return (await this.request(tx).input('code', sql.NVarChar(80), worker.employee_code).input('day', sql.Date, date(asOf)).query('SELECT t.leave_code,t.leave_name,t.unit_step,t.active,COALESCE(SUM(l.units),0) AS balance FROM dbo.clms_leave_types t LEFT JOIN dbo.clms_leave_ledger l ON t.leave_code=l.leave_code AND l.employee_code=@code AND l.business_date<=@day GROUP BY t.leave_code,t.leave_name,t.unit_step,t.active ORDER BY t.leave_code')).recordset;
    });
  }
  async creditLeave(body, actor, correlation) {
    if (actor.role !== 'ADMIN') throw problem(403, 'Only administrators can record externally approved opening/credit balances.');
    const ref = identifier(body.reference); const when = day(body.business_date); const memo = reason(body.reason); const units = Number(body.units);
    if (typeof body.units !== 'number' || !Number.isFinite(units) || units <= 0 || units > 10000) throw problem(400, 'Credit must be a positive number of days, at most 10000.');
    return this.transaction(async tx => {
      const worker = await this.worker(tx, body.employee_code, actor); const type = await this.type(tx, body.leave_code);
      if (!Number.isInteger(units / Number(type.unit_step))) throw problem(400, 'Credit must match the leave type unit step.');
      await this.unlocked(tx, 'leave', worker.contractor_id, when);
      const old = (await this.request(tx).input('id', sql.VarChar(80), ref).query("SELECT * FROM dbo.clms_leave_ledger WITH(UPDLOCK,HOLDLOCK) WHERE source_type='CREDIT' AND source_id=@id")).recordset[0];
      if (old) {
        if (old.employee_code !== worker.employee_code || old.leave_code !== body.leave_code || isoDay(old.business_date) !== when || Number(old.units) !== units || old.reason !== memo) throw problem(409, 'Credit reference already belongs to another entry.');
        return { success: true, replay: true };
      }
      await this.ledger(tx, worker.employee_code, body.leave_code, when, units, 'CREDIT', ref, memo, actor.emp_id);
      await this.audit(tx, actor.emp_id, 'LEAVE_CREDIT_RECORDED', ref, correlation);
      return { success: true, replay: false };
    });
  }
  async ledger(tx, code, type, when, units, source, sourceId, memo, actor) {
    await this.request(tx).input('code', sql.NVarChar(80), code).input('type', sql.VarChar(20), type).input('day', sql.Date, date(when)).input('units', sql.Decimal(9, 2), units).input('source', sql.VarChar(20), source).input('id', sql.VarChar(80), sourceId).input('reason', sql.NVarChar(500), memo).input('actor', sql.NVarChar(40), actor).query('INSERT dbo.clms_leave_ledger(employee_code,leave_code,business_date,units,source_type,source_id,reason,created_by) VALUES(@code,@type,@day,@units,@source,@id,@reason,@actor)');
  }
  async requestLeave(body, actor, correlation) {
    const days = chargedDays(body.days); const memo = reason(body.reason); const requestId = randomUUID();
    return this.transaction(async tx => {
      const worker = await this.worker(tx, body.employee_code, actor); const type = await this.type(tx, body.leave_code);
      for (const entry of days) {
        if (!Number.isInteger(entry.units / Number(type.unit_step))) throw problem(400, 'Requested units do not match the leave type step.');
        await this.unlocked(tx, 'leave', worker.contractor_id, entry.date);
      }
      await this.request(tx).input('id', sql.VarChar(36), requestId).input('code', sql.NVarChar(80), worker.employee_code).input('type', sql.VarChar(20), body.leave_code).input('days', sql.NVarChar(sql.MAX), JSON.stringify(days)).input('reason', sql.NVarChar(500), memo).input('actor', sql.NVarChar(40), actor.emp_id).query('INSERT dbo.clms_leave_requests(request_id,employee_code,leave_code,charged_days,reason,submitted_by) VALUES(@id,@code,@type,@days,@reason,@actor)');
      await this.audit(tx, actor.emp_id, 'LEAVE_SUBMITTED', requestId, correlation);
      return { success: true, request_id: requestId, status: 'PENDING' };
    });
  }
  async reviewLeave(id, body, actor, correlation) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw problem(400, 'Invalid request identifier.');
    if (!canApprove(actor, 'leave')) throw problem(403, 'Leave approval permission required.');
    const memo = reason(body.reason); expectedVersion(body.version);
    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(body.status)) throw problem(400, 'Choose APPROVED, REJECTED or CANCELLED.');
    const candidate = (await this.request().input('id', sql.VarChar(36), id).query('SELECT employee_code FROM dbo.clms_leave_requests WHERE request_id=@id')).recordset[0];
    if (!candidate) throw problem(404, 'Leave request not found.');
    return this.transaction(async tx => {
      const worker = await this.worker(tx, candidate.employee_code, actor);
      const row = (await this.request(tx).input('id', sql.VarChar(36), id).query('SELECT * FROM dbo.clms_leave_requests WITH(UPDLOCK,HOLDLOCK) WHERE request_id=@id')).recordset[0];
      if (row.version !== body.version || (body.status === 'CANCELLED' ? row.status !== 'APPROVED' : row.status !== 'PENDING')) throw problem(409, 'Request changed or transition is invalid.');
      if (row.submitted_by.toLowerCase() === actor.emp_id.toLowerCase()) throw problem(403, 'A different authorised person must review this request.');
      const days = JSON.parse(row.charged_days);
      for (const entry of days) await this.unlocked(tx, 'leave', worker.contractor_id, entry.date);
      if (body.status === 'APPROVED') {
        const type = await this.type(tx, row.leave_code);
        for (const entry of days) {
          if (!Number.isInteger(entry.units / Number(type.unit_step))) throw problem(409, 'Leave step changed. Review the request again.');
          const used = Number((await this.request(tx).input('code', sql.NVarChar(80), worker.employee_code).input('day', sql.Date, date(entry.date)).query("SELECT -COALESCE(SUM(units),0) AS used FROM dbo.clms_leave_ledger WHERE employee_code=@code AND business_date=@day AND source_type IN ('LEAVE','REVERSAL')")).recordset[0].used);
          if (used + entry.units > 1) throw problem(409, 'Approved leave would exceed one day on a charged date.');
          if (!type.allow_negative && await this.balanceAt(tx, worker.employee_code, row.leave_code, entry.date) < entry.units) throw problem(409, 'Insufficient recorded balance on a charged date. No days were posted.');
          await this.ledger(tx, worker.employee_code, row.leave_code, entry.date, -entry.units, 'LEAVE', id, memo, actor.emp_id);
        }
        if (!type.allow_negative) {
          const minimum = (await this.request(tx).input('code', sql.NVarChar(80), worker.employee_code).input('type', sql.VarChar(20), row.leave_code).input('from', sql.Date, date(days[0].date)).query('WITH balances AS (SELECT business_date,SUM(SUM(units)) OVER(ORDER BY business_date ROWS UNBOUNDED PRECEDING) AS balance FROM dbo.clms_leave_ledger WHERE employee_code=@code AND leave_code=@type GROUP BY business_date) SELECT MIN(balance) AS minimum FROM balances WHERE business_date>=@from')).recordset[0].minimum;
          if (Number(minimum) < 0) throw problem(409, 'Backdated leave would overdraw a later recorded balance. No days were posted.');
        }
      } else if (body.status === 'CANCELLED') {
        for (const entry of days) await this.ledger(tx, worker.employee_code, row.leave_code, entry.date, entry.units, 'REVERSAL', id, memo, actor.emp_id);
      }
      await this.request(tx).input('id', sql.VarChar(36), id).input('status', sql.VarChar(20), body.status).input('actor', sql.NVarChar(40), actor.emp_id).input('reason', sql.NVarChar(500), memo).query('UPDATE dbo.clms_leave_requests SET status=@status,reviewed_by=@actor,review_reason=@reason,version=version+1 WHERE request_id=@id');
      await this.audit(tx, actor.emp_id, `LEAVE_${body.status}`, id, correlation);
      return { success: true };
    });
  }
  async listLocks() { return serialize((await this.request().query('SELECT TOP(500) * FROM dbo.clms_period_locks ORDER BY period DESC,module,contractor_id')).recordset); }
  async setPeriodLock(body, actor, correlation) {
    if (actor.role !== 'ADMIN') throw problem(403, 'Administrator access required.');
    if (!['attendance', 'leave'].includes(body.module) || typeof body.locked !== 'boolean') throw problem(400, 'Choose attendance/leave and a lock flag.');
    const period = day(body.period); const memo = reason(body.reason);
    if (!period.endsWith('-01') || typeof body.contractor_id !== 'string' || body.contractor_id.length > 80) throw problem(400, 'Choose a contractor and the first date of a month.');
    return this.transaction(async tx => {
      const query = () => this.request(tx).input('module', sql.VarChar(20), body.module).input('contractor', sql.NVarChar(80), body.contractor_id).input('period', sql.Date, date(period));
      const old = (await query().query('SELECT version FROM dbo.clms_period_locks WITH(UPDLOCK,HOLDLOCK) WHERE module=@module AND contractor_id=@contractor AND period=@period')).recordset[0];
      if (old && old.version !== body.version || !old && body.version !== undefined) throw problem(409, 'Period lock changed. Reload before saving.');
      await query().input('locked', sql.Bit, body.locked).input('reason', sql.NVarChar(500), memo).query(old ? 'UPDATE dbo.clms_period_locks SET locked=@locked,reason=@reason,version=version+1 WHERE module=@module AND contractor_id=@contractor AND period=@period' : 'INSERT dbo.clms_period_locks(module,contractor_id,period,locked,reason) VALUES(@module,@contractor,@period,@locked,@reason)');
      await this.audit(tx, actor.emp_id, body.locked ? 'PERIOD_LOCKED' : 'PERIOD_UNLOCKED', `${body.module}:${body.contractor_id}:${period}`, correlation);
      return { success: true };
    });
  }
}
