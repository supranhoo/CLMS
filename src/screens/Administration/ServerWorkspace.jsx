import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../../api/axios';
import { useRuntime } from '../../components/RuntimeEnvironment';
import './ServerWorkspace.css';

const split = value => String(value || '').split(',').map(item => item.trim());
const emptyAssignments = { contractors: [], departments: [], businessUnits: [], locations: [], read: [], write: [] };

export default function ServerWorkspace({ kind = 'accounts' }) {
  const runtime = useRuntime();
  const user = useSelector(state => state.user);
  const accounts = kind === 'accounts'; const workers = kind === 'workers';
  const key = accounts ? 'emp_id' : workers ? 'Employee_Code' : 'Contractor_ID';
  const name = accounts ? 'Name' : workers ? 'display_name' : 'Contractor_Name';
  const url = accounts ? '/api/users/getAllUsers' : workers ? '/api/employee/getAllEmployees' : '/api/contractor/getAllContractors';
  const [rows, setRows] = useState([]); const [form, setForm] = useState(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''); const [audit, setAudit] = useState(null);
  const [page, setPage] = useState(0);
  const [reset, setReset] = useState(null);
  const query = accounts ? url : `${url}?limit=100&offset=${page * 100}&search=${encodeURIComponent(search)}`;
  useEffect(() => { setPage(0); }, [kind, search]);
  const load = async () => { setRows((await api.get(query)).data); };
  useEffect(() => {
    setForm(null); setError(''); setNotice(''); setRows([]); setAudit(null);
  }, [kind, runtime.demo]);
  useEffect(() => {
    if (runtime.demo) return;
    const controller = new AbortController();
    const timer = setTimeout(() => api.get(query, { signal: controller.signal }).then(response => setRows(response.data)).catch(error => { if (error.code !== 'ERR_CANCELED') setError(error.response?.data?.message || 'Records could not be loaded.'); }), 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, runtime.demo]);
  const edit = row => { setForm(row ? structuredClone(row) : { [key]: '', [name]: '', role: 'OPERATOR', Is_Active: 'Y', assignments: structuredClone(emptyAssignments) }); setError(''); setNotice(''); };
  const field = (label, property, { required = false, type = 'text', maxLength = 200 } = {}) => <label key={property}>{label}<input required={required} type={type} maxLength={maxLength} value={form[property] || ''} disabled={property === key && Boolean(form.version)} onChange={event => setForm({ ...form, [property]: event.target.value })} autoComplete={type === 'password' ? 'new-password' : 'off'} /></label>;
  const save = async event => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...form };
      if (accounts) payload.email_id ||= '';
      if (accounts) payload.assignments = Object.fromEntries(Object.entries(payload.assignments || {}).map(([key, values]) => [key, values.filter(Boolean)]));
      const base = accounts ? '/api/users' : workers ? '/api/employee' : '/api/contractor';
      const noun = workers ? 'Employee' : 'Contractor';
      if (form.version) await api.put(`${base}/${accounts ? 'updateUser' : `update${noun}`}/${encodeURIComponent(form[key])}`, payload);
      else await api.post(`${base}/${accounts ? 'register' : `add${noun}`}`, payload);
      setForm(null); setNotice('Saved successfully.'); await load();
    } catch (error) { setError(error.response?.data?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };
  const resetPassword = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post(`/api/admin/users/${encodeURIComponent(reset.emp_id)}/reset-password`, { version: reset.version, password: reset.password }); setReset(null); setNotice('Temporary password set. The user must change it at sign-in.'); await load(); }
    catch (error) { setError(error.response?.data?.message || 'Password reset failed.'); }
    finally { setBusy(false); }
  };
  if (runtime.demo) return <p>Server administration is available only in a configured SQL server environment.</p>;
  const filtered = accounts ? rows.filter(row => `${row[key]} ${row[name]}`.toLowerCase().includes(search.toLowerCase())) : rows;
  return <section className="server-records">
    <h1>{accounts ? 'Server accounts & access' : workers ? 'Worker records' : 'Contractor records'}</h1>
    <p>{accounts ? 'Provision accounts and assign access to this server. New accounts must change their initial password.' : 'Maintain core records in the server database. Attendance, leave and payroll are not enabled in this release.'}</p>
    {error && <p className="alert alert-danger" role="alert">{error}</p>}
    {notice && <p className="alert alert-success" role="status">{notice}</p>}
    {reset && <form className="server-records-form" onSubmit={resetPassword}><h2>Reset password: {reset.emp_id}</h2><label>Temporary password (12–128 characters with letters and numbers)<input type="password" minLength={12} maxLength={128} autoComplete="new-password" required value={reset.password} onChange={event => setReset({ ...reset, password: event.target.value })} /></label><p>Share through your approved secure channel. Reset revokes existing sessions and requires password replacement.</p><button disabled={busy} type="submit">Reset password</button> <button type="button" disabled={busy} onClick={() => setReset(null)}>Cancel</button></form>}
    <div className="server-records-toolbar"><label>Search records<input value={search} onChange={event => setSearch(event.target.value)} /></label><button type="button" onClick={() => edit(null)}>Add {accounts ? 'account' : workers ? 'worker' : 'contractor'}</button><button type="button" onClick={() => load().catch(error => setError(error.response?.data?.message || 'Refresh failed.'))}>Refresh</button>{accounts && <button type="button" onClick={() => api.get('/api/admin/audit').then(response => setAudit(response.data.data)).catch(error => setError(error.response?.data?.message || 'Audit could not be loaded.'))}>View recent audit</button>}</div>
    {!accounts && <div className="server-records-toolbar"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page + 1} · up to 100 records</span><button type="button" disabled={rows.length < 100} onClick={() => setPage(value => value + 1)}>Next page</button></div>}
    {form && <form onSubmit={save} className="server-records-form">
      <h2>{form.version ? 'Edit record' : 'New record'}</h2>
      <div className="server-records-fields">{field(accounts ? 'User ID' : workers ? 'Worker code' : 'Contractor ID', key, { required: true, maxLength: accounts ? 40 : 80 })}{field('Name', name, { required: true })}
      {accounts ? <>
        {field('Email', 'email_id', { type: 'email', maxLength: 254 })}
        {!form.version && field('Initial password (12–128 characters with letters and numbers)', 'password', { type: 'password', required: true, maxLength: 128 })}
        <label>Role<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{['ADMIN', 'OPERATOR', 'AUDITOR'].map(role => <option key={role}>{role}</option>)}</select></label>
        <label>Status<select value={form.Is_Active} onChange={event => setForm({ ...form, Is_Active: event.target.value })}><option value="Y">Active</option><option value="N">Disabled</option></select></label>
        {['contractors', 'departments', 'businessUnits', 'locations'].map(scope => <label key={scope}>{({ contractors: 'Contractor IDs', departments: 'Department codes', businessUnits: 'Business unit codes', locations: 'Location codes' })[scope]} (comma-separated)<input value={form.assignments?.[scope]?.join(', ') || ''} onChange={event => setForm({ ...form, assignments: { ...form.assignments, [scope]: split(event.target.value) } })} /></label>)}
      </> : workers ? <>{field('Contractor ID', 'contractor_id', { required: true, maxLength: 80 })}{field('Department code', 'dept', { maxLength: 80 })}{field('Business unit code', 'bu', { maxLength: 80 })}{field('Location code', 'loc_code', { maxLength: 80 })}</> : field('Contact email', 'Email', { type: 'email' })}
      </div>
      {accounts && <><p>Administrators have full core access. Other roles need module permissions and matching scopes. All four worker scopes must match; empty scopes grant no worker access.</p>{['read', 'write'].map(activity => <fieldset key={activity}><legend>{activity === 'read' ? 'Read access' : 'Write access (operators only)'}</legend>{['workers', 'contractors', 'masters'].map(module => <label className="server-records-checkbox" key={module}><input type="checkbox" checked={form.assignments?.[activity]?.includes(module) || false} onChange={event => { const values = form.assignments?.[activity] || []; setForm({ ...form, assignments: { ...form.assignments, [activity]: event.target.checked ? [...values, module] : values.filter(value => value !== module) } }); }} />{module}</label>)}</fieldset>)}<p>Master changes require an administrator. Editing an account revokes its existing sessions.</p></>}
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button> <button type="button" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
    </form>}
    <div className="server-records-table"><table><thead><tr><th>Identifier</th><th>Name</th><th>{accounts ? 'Role / status' : workers ? 'Contractor' : 'Version'}</th><th>Actions</th></tr></thead><tbody>{filtered.map(row => <tr key={row[key]}><td>{row[key]}</td><td>{row[name]}</td><td>{accounts ? `${row.role} / ${row.Is_Active === 'N' ? 'Disabled' : 'Active'}` : workers ? row.contractor_id : row.version}</td><td><button type="button" onClick={() => edit(row)}>Edit</button>{accounts && row.emp_id !== user?.emp_id && <button type="button" onClick={() => { setForm(null); setReset({ emp_id: row.emp_id, version: row.version, password: '' }); }}>Reset password</button>}</td></tr>)}</tbody></table>{!filtered.length && <p>No matching records.</p>}</div>
    {audit && <details open><summary>Recent audit events (up to 500)</summary><div className="server-records-table"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{audit.map(row => <tr key={row.event_id}><td>{row.at}</td><td>{row.actor}</td><td>{row.action}</td><td>{row.target}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
