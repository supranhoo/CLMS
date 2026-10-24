import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../api/axios';
import { useRuntime } from '../../components/RuntimeEnvironment';
import { parseImportWorkbook } from '../../utils/importWorkbook';
import '../Administration/ServerWorkspace.css';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const display = value => value === null || value === undefined || value === '' ? '—' : String(value);

export default function ServerOperations({ kind }) {
  const runtime = useRuntime(); const user = useSelector(state => state.user); const attendance = kind === 'attendance';
  const admin = user?.role === 'ADMIN';
  const write = admin || user?.role === 'OPERATOR' && user.assignments?.write?.includes(kind);
  const approve = admin || user?.role === 'OPERATOR' && user.assignments?.approve?.includes(kind);
  const [filter, setFilter] = useState({ from_date: today().slice(0, 7) + '-01', to_date: today(), employee_code: '' });
  const [offset, setOffset] = useState(0); const [rows, setRows] = useState([]); const [requests, setRequests] = useState([]); const [jobs, setJobs] = useState([]);
  const [types, setTypes] = useState([]); const [balances, setBalances] = useState(null); const [locks, setLocks] = useState([]); const [reportContext, setReportContext] = useState(null);
  const [form, setForm] = useState(null); const [upload, setUpload] = useState([]); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const queryGeneration = useRef(0); const uploadGeneration = useRef(0);
  const prefix = `/api/server/${kind}`;
  const reload = async () => {
    const generation = ++queryGeneration.current;
    const query = new URLSearchParams({ ...filter, limit: '100', offset: String(offset) });
    const results = await Promise.all([api.get(`${prefix}/${attendance ? 'report' : 'ledger'}?${query}`), api.get(`${prefix}/requests?limit=100&offset=${offset}`), attendance ? api.get(`${prefix}/jobs`) : api.get(`${prefix}/types`), admin ? api.get('/api/server/period-locks') : Promise.resolve({ data: [] })]);
    if (generation !== queryGeneration.current) return;
    setRows(results[0].data); setReportContext({ ...filter, offset }); setRequests(results[1].data); if (attendance) setJobs(results[2].data); else setTypes(results[2].data); setLocks(results[3].data);
  };
  useEffect(() => { queryGeneration.current++; uploadGeneration.current++; setForm(null); setRows([]); setRequests([]); setJobs([]); setBalances(null); setReportContext(null); setOffset(0); setNotice(''); setError(''); }, [kind]);
  useEffect(() => { if (!runtime.demo) reload().catch(error => setError(error.response?.data?.message || 'Records could not be loaded.')); }, [kind, runtime.demo, offset]);
  useEffect(() => {
    if (!attendance || !jobs.some(job => ['QUEUED', 'RUNNING'].includes(job.status))) return;
    const timer = setInterval(() => api.get(`${prefix}/jobs`).then(response => setJobs(response.data)).catch(() => {}), 2000);
    return () => clearInterval(timer);
  }, [attendance, prefix, jobs]);
  const open = (mode, extra = {}) => { uploadGeneration.current++; setUpload([]); setForm({ mode, employee_code: filter.employee_code, business_date: filter.to_date, leave_code: types.find(type => type.active)?.leave_code || '', units: 1, mark: 'P', reason: '', reference: crypto.randomUUID(), batch_id: crypto.randomUUID(), contractor_id: '', period: filter.to_date.slice(0, 7), locked: true, leave_name: '', active: true, allow_negative: false, unit_step: 0.5, ...extra }); setNotice(''); setError(''); };
  const field = (label, name, type = 'text', required = true, placeholder = '') => <label>{label}<input type={type} value={form[name] ?? ''} required={required} maxLength={name === 'reason' ? 500 : 200} placeholder={placeholder} onChange={event => setForm({ ...form, [name]: event.target.value })} /></label>;
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (form.mode === 'punches') await api.post(`${prefix}/punches`, { batch_id: form.batch_id, rows: upload });
      else if (form.mode === 'job') await api.post(`${prefix}/jobs`, { ...filter, employee_codes: form.employee_code.split(',').map(code => code.trim()).filter(Boolean) });
      else if (form.mode === 'review') await api.post(`${prefix}/requests/${form.request_id}/review`, { status: form.status, version: form.version, reason: form.reason });
      else if (form.mode === 'credit') await api.post(`${prefix}/credits`, { ...form, units: Number(form.units) });
      else if (form.mode === 'type') await api.put(`${prefix}/types`, { ...form, unit_step: Number(form.unit_step) });
      else if (form.mode === 'lock') {
        const period = form.period + '-01'; const saved = locks.find(row => row.module === kind && row.contractor_id === form.contractor_id && row.period === period);
        await api.put('/api/server/period-locks', { module: kind, contractor_id: form.contractor_id, period, locked: form.locked, reason: form.reason, ...(saved ? { version: saved.version } : {}) });
      } else if (attendance) await api.post(`${prefix}/requests`, { ...form, first_punch: form.first_punch || null, last_punch: form.last_punch || null });
      else await api.post(`${prefix}/requests`, { employee_code: form.employee_code, leave_code: form.leave_code, days: [{ date: form.business_date, units: Number(form.units) }], reason: form.reason });
      setForm(null); setUpload([]); setNotice(form.mode === 'job' ? 'Processing queued. Job status updates automatically; refresh the report after completion.' : form.mode === 'punches' ? 'Punches saved. Queue processing to update elapsed-time summaries.' : 'Saved successfully.');
      try { await reload(); } catch { setError('The operation was saved, but the view could not be refreshed. Use Load / refresh.'); }
    } catch (error) { setError(error.response?.data?.message || 'Operation failed. No success was confirmed.'); }
    finally { setBusy(false); }
  };
  const readFile = async event => {
    const generation = ++uploadGeneration.current;
    const file = event.target.files[0]; setUpload([]); setError(''); if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Maximum file size is 10 MB.');
      const rows = parseImportWorkbook(new Uint8Array(await file.arrayBuffer()));
      if (generation !== uploadGeneration.current) return;
      if (!rows.length || rows.length > 1000) throw new Error('Import 1–1000 rows per batch.');
      if (rows.some(row => !row.employee_code || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.business_date)) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(row.punched_at)))) throw new Error('Use employee_code, business_date (YYYY-MM-DD) and punched_at (ISO text with timezone).');
      setUpload(rows.map(row => ({ employee_code: String(row.employee_code), business_date: String(row.business_date), punched_at: String(row.punched_at) })));
    } catch (error) { if (generation === uploadGeneration.current) setError(error.message); }
  };
  if (runtime.demo) return <p>These SQL attendance/leave screens require a configured staging or production server. Use the existing demo modules for fictional data.</p>;
  return <section className="server-records">
    <h1>{attendance ? 'Recorded attendance & approvals' : 'Leave requests & ledger'}</h1>
    <p className="alert alert-info">{attendance ? 'Punches and approved marks are recorded inputs. Elapsed time does not establish paid hours, paid days or overtime. Overnight business dates must be assigned explicitly in the import.' : 'Balances come from recorded credits, approved requests and reversals. No automatic entitlement, accrual, holiday exclusion, paid-attendance credit or encashment is calculated. Charged dates and units are explicit inputs.'}</p>
    {error && <p role="alert" className="alert alert-danger">{error}</p>}{notice && <p role="status" className="alert alert-success">{notice}</p>}
    <form className="server-records-toolbar" onSubmit={event => { event.preventDefault(); if (offset) setOffset(0); else reload().catch(error => setError(error.response?.data?.message || 'Query failed.')); }}>
      <label>From date<input type="date" required value={filter.from_date} onChange={event => setFilter({ ...filter, from_date: event.target.value })} /></label><label>To date<input type="date" required value={filter.to_date} onChange={event => setFilter({ ...filter, to_date: event.target.value })} /></label><label>Worker code (optional for report)<input value={filter.employee_code} onChange={event => setFilter({ ...filter, employee_code: event.target.value })} /></label><button type="submit">Load / refresh</button>
      {!attendance && <button type="button" onClick={() => api.get(`${prefix}/balances?${new URLSearchParams({ employee_code: filter.employee_code, as_of: filter.to_date })}`).then(response => { setBalances({ rows: response.data, employee_code: filter.employee_code, as_of: filter.to_date }); setError(''); }).catch(error => setError(error.response?.data?.message || 'Balance query failed.'))}>Worker balances as of To date</button>}
    </form>
    <div className="server-records-toolbar">{write && <button onClick={() => open('request')}>{attendance ? 'Request attendance entry' : 'Request single-day leave'}</button>}{attendance && write && <><button onClick={() => open('punches')}>Import punches</button><button onClick={() => open('job')}>Queue punch processing</button></>}{!attendance && admin && <><button onClick={() => open('credit')}>Record approved opening / credit</button><button onClick={() => open('type', { leave_code: '' })}>Add leave type</button></>}{admin && <button onClick={() => open('lock')}>Lock / unlock period</button>}</div>
    {form && <form className="server-records-form" onSubmit={submit}><h2>{({ punches: 'Import punch file', job: 'Process recorded punches', review: 'Review request', credit: 'Record an externally approved credit', type: 'Leave input settings', lock: 'Contractor period lock', request: attendance ? 'Submit attendance entry for review' : 'Submit explicitly charged single-day leave' })[form.mode]}</h2><div className="server-records-fields">
      {form.mode === 'review' && <p>Decision: <strong>{form.status}</strong> · request {form.request_id}. The request remains unchanged until you submit this review reason.</p>}
      {['request', 'credit', 'job'].includes(form.mode) && field(form.mode === 'job' ? 'Worker codes (comma-separated)' : 'Worker code', 'employee_code')}
      {['request', 'credit'].includes(form.mode) && field('Business / charged date', 'business_date', 'date')}
      {form.mode === 'punches' && <>{field('Batch reference (reuse unchanged when retrying)', 'batch_id')}<label>CSV / XLSX punch file<input type="file" accept=".csv,.xlsx" onChange={readFile} required /></label><p>Columns: employee_code, business_date, punched_at. Example timestamp: 2026-10-05T08:00:00+05:30. Keep timestamp cells as text. Preview below; the server validates the full batch atomically.</p></>}
      {form.mode === 'job' && <p>Uses the From/To range above. Processing only calculates first/last punches, count and elapsed seconds.</p>}
      {form.mode === 'request' && attendance && <><label>Manually declared mark<select aria-label="Manually declared mark" value={form.mark} onChange={event => setForm({ ...form, mark: event.target.value })}>{['P','AB','WO','HLD','OD'].map(mark => <option key={mark}>{mark}</option>)}</select></label>{field('Optional first punch (ISO with timezone)', 'first_punch', 'text', false, '2026-10-05T08:00:00+05:30')}{field('Optional last punch (ISO with timezone)', 'last_punch', 'text', false, '2026-10-05T17:00:00+05:30')}</>}
      {(!attendance && ['request', 'credit'].includes(form.mode)) && <><label>Leave type<select aria-label="Leave type" required value={form.leave_code} onChange={event => setForm({ ...form, leave_code: event.target.value })}><option value="">Choose leave type</option>{types.filter(type => type.active).map(type => <option key={type.leave_code} value={type.leave_code}>{type.leave_name} ({type.leave_code})</option>)}</select></label>{field('Days / units (must match configured step)', 'units', 'text')}{form.mode === 'credit' && field('Unique source reference', 'reference')}</>}
      {form.mode === 'type' && <>{field('Leave code', 'leave_code')}{field('Leave name', 'leave_name')}<label>Minimum unit step<select value={form.unit_step} onChange={event => setForm({ ...form, unit_step: Number(event.target.value) })}>{[0.25,0.5,1].map(value => <option key={value}>{value}</option>)}</select></label><label className="server-records-checkbox"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />Active</label><label className="server-records-checkbox"><input type="checkbox" checked={form.allow_negative} onChange={event => setForm({ ...form, allow_negative: event.target.checked })} />Allow negative recorded balance (company setting)</label></>}
      {form.mode === 'lock' && <>{field('Contractor ID', 'contractor_id')}{field('Month', 'period', 'month')}<label>State<select value={String(form.locked)} onChange={event => setForm({ ...form, locked: event.target.value === 'true' })}><option value="true">Locked</option><option value="false">Unlocked</option></select></label></>}
      {!['punches','job','type'].includes(form.mode) && field('Reason / source details', 'reason')}
    </div>
      {form.mode === 'punches' && upload.length > 0 && <div className="server-records-table"><p>{upload.length} rows selected. Showing first five.</p><table><thead><tr><th>Worker</th><th>Business date</th><th>Punch timestamp</th></tr></thead><tbody>{upload.slice(0,5).map((row,index) => <tr key={index}><td>{row.employee_code}</td><td>{row.business_date}</td><td>{row.punched_at}</td></tr>)}</tbody></table></div>}
      <button disabled={busy || form.mode === 'punches' && !upload.length} type="submit">{busy ? 'Saving…' : 'Save / submit'}</button> <button disabled={busy} type="button" onClick={() => { setForm(null); setUpload([]); }}>Cancel</button>
    </form>}
    {!attendance && balances?.rows?.length > 0 && <><h2>Recorded balances</h2><p>Worker {balances.employee_code} · as of {balances.as_of}</p><div className="server-records-table"><table><thead><tr><th>Type</th><th>Balance (days)</th></tr></thead><tbody>{balances.rows.map(row => <tr key={row.leave_code}><td>{row.leave_name}</td><td>{row.balance}</td></tr>)}</tbody></table></div></>}
    {reportContext && <p>Loaded report: {reportContext.from_date} to {reportContext.to_date} · {reportContext.employee_code || 'all permitted workers'} · page {Math.floor(reportContext.offset / 100) + 1}</p>}
    <h2>{attendance ? 'Attendance inputs' : 'Append-only leave ledger'}</h2><div className="server-records-table"><table><thead><tr><th>Worker</th><th>Date</th>{attendance ? <><th>Recorded first / last</th><th>Punches / elapsed seconds</th><th>Approved mark / pair</th></> : <><th>Type</th><th>Units</th><th>Source / reason</th></>}</tr></thead><tbody>{rows.map((row,index) => <tr key={row.entry_id || `${row.employee_code}-${row.business_date}-${index}`}><td>{row.employee_code}<br/>{row.display_name}</td><td>{row.business_date}</td>{attendance ? <><td>{display(row.raw_first_punch)}<br/>{display(row.raw_last_punch)}</td><td>{display(row.punch_count)} / {display(row.elapsed_seconds)}</td><td>{display(row.mark)}<br/>{display(row.approved_first_punch)}<br/>{display(row.approved_last_punch)}</td></> : <><td>{row.leave_code}</td><td>{row.units}</td><td>{row.source_type} / {row.source_id}<br/>{row.reason}</td></>}</tr>)}</tbody></table>{!rows.length && <p>No recorded rows for this query. Missing dates are not interpreted as absence or presence.</p>}</div>
    <h2>Requests & approvals</h2><p>Another authorised reviewer must approve or reject. The latest 100 requests on this page are shown independently of the report's date filter.</p><div className="server-records-table"><table><thead><tr><th>Worker / maker</th><th>Requested input</th><th>Status</th><th>Review</th></tr></thead><tbody>{requests.map(row => <tr key={row.adjustment_id || row.request_id}><td>{row.employee_code}<br/>{row.submitted_by}</td><td>{attendance ? `${row.business_date} · ${row.mark}` : `${row.leave_code} · ${row.charged_days.map(entry => `${entry.date}: ${entry.units}`).join(', ')}`}<br/>{row.reason}</td><td>{row.status}<br/>{row.review_reason}</td><td>{approve && row.submitted_by.toLowerCase() !== user.emp_id.toLowerCase() && (row.status === 'PENDING' ? ['APPROVED','REJECTED'] : !attendance && row.status === 'APPROVED' ? ['CANCELLED'] : []).map(status => <button type="button" key={status} onClick={() => open('review', { request_id: row.adjustment_id || row.request_id, version: row.version, status })}>{status}</button>)}</td></tr>)}</tbody></table></div>
    <div className="server-records-toolbar"><button disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 100))}>Previous page</button><span>Page {Math.floor(offset / 100) + 1}</span><button disabled={rows.length < 100 && requests.length < 100} onClick={() => setOffset(value => value + 100)}>Next page</button></div>
    {attendance ? <><h2>Processing jobs</h2><div className="server-records-table"><table><thead><tr><th>Job</th><th>Range</th><th>Status / attempts</th><th>Failure</th></tr></thead><tbody>{jobs.map(job => <tr key={job.job_id}><td>{job.job_id}</td><td>{String(job.from_date).slice(0,10)} to {String(job.to_date).slice(0,10)}</td><td>{job.status} / {job.attempts}</td><td>{job.error_code}</td></tr>)}</tbody></table></div></> : <><h2>Leave input categories</h2><p>Editable categories and balance constraints only. No quota or statutory entitlement is seeded.</p><div className="server-records-table"><table><thead><tr><th>Code</th><th>Name</th><th>Step / negative balance / active</th><th>Action</th></tr></thead><tbody>{types.map(type => <tr key={type.leave_code}><td>{type.leave_code}</td><td>{type.leave_name}</td><td>{type.unit_step} / {type.allow_negative ? 'Allowed' : 'Blocked'} / {type.active ? 'Yes' : 'No'}</td><td>{admin && <button onClick={() => open('type', { ...type, active: Boolean(type.active), allow_negative: Boolean(type.allow_negative) })}>Edit settings</button>}</td></tr>)}</tbody></table></div></>}
    {admin && <details><summary>Contractor period locks</summary><div className="server-records-table"><table><thead><tr><th>Module</th><th>Contractor</th><th>Month</th><th>Locked / reason</th></tr></thead><tbody>{locks.map(lock => <tr key={`${lock.module}:${lock.contractor_id}:${lock.period}`}><td>{lock.module}</td><td>{lock.contractor_id}</td><td>{lock.period}</td><td>{lock.locked ? 'Yes' : 'No'} / {lock.reason}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
