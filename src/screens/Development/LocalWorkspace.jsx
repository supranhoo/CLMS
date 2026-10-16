import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Form, Table } from 'react-bootstrap';
import api from '../../api/axios.js';
import { downloadWorkbook } from '../../utils/exportWorkbook.js';
import { parseImportWorkbook } from '../../utils/importWorkbook.js';

const templates = {
  employees: ['Employee_Code', 'display_name', 'contractor_id', 'dept', 'bu', 'loc_code', 'doj'],
  contractors: ['Contractor_ID', 'Contractor_Name', 'Billing_Name', 'Address1'],
  punches: ['employee_code', 'attendance_date_with_time'],
};
const title = value => String(value || '').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
const text = value => value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
function DataTable({ rows, actions }) {
  if (!rows?.length) return <p className="text-muted">No matching local records.</p>;
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => !['passwordHash', 'passwordSalt'].includes(key));
  return <div className="table-responsive"><Table bordered striped size="sm"><thead><tr>{keys.map(key => <th key={key}>{title(key)}</th>)}{actions && <th>Action</th>}</tr></thead><tbody>{rows.slice(0, 200).map((row, index) => <tr key={row.id || row.request_id || index}>{keys.map(key => <td key={key} style={{ maxWidth: 300, overflowWrap: 'anywhere' }}>{text(row[key])}</td>)}{actions && <td>{actions(row)}</td>}</tr>)}</tbody></Table>{rows.length > 200 && <p>Showing the first 200 of {rows.length} rows.</p>}</div>;
}
export default function LocalWorkspace() {
  const { tool, kind } = useParams();
  const [rows, setRows] = useState([]); const [summary, setSummary] = useState(null);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('CREATE'); const [validated, setValidated] = useState(false);
  const isImport = !!kind; const label = isImport ? `Import ${kind}` : title(tool);
  const load = async () => {
    if (isImport) return;
    setBusy(true); setError('');
    try {
      const path = { audit: '/api/dev/audit', outbox: '/api/dev/outbox', approvals: '/api/attendance/getEmpRequest', jobs: '/api/attendance/jobs', accounting: '/api/accounting/input-summary' }[tool];
      if (!path) throw new Error('Unknown local workspace tool.');
      const response = await api.get(path); const data = response.data;
      if (tool === 'accounting') { setSummary(data); setRows(Object.entries(data.rows || {}).flatMap(([kind, entries]) => entries.map(row => ({ kind, ...row })))); }
      else setRows(Array.isArray(data) ? data : data.data || []);
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { setRows([]); setSummary(null); setMessage(''); setError(''); setValidated(false); load(); }, [tool, kind]);
  const readFile = async event => {
    setRows([]); setValidated(false); setError(''); setMessage('');
    try {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) throw new Error('Use a workbook smaller than 5 MB.');
      if (!/\.(xlsx?|csv)$/i.test(file.name)) throw new Error('Choose XLSX, XLS or CSV.');
      const values = parseImportWorkbook(await file.arrayBuffer());
      if (!values.length || values.length > 2000) throw new Error('Use between 1 and 2000 non-empty rows.');
      const requiredKeys = templates[kind]?.slice(0, 2); if (!requiredKeys) throw new Error('Unknown import type.');
      if (values.some(row => requiredKeys.some(key => !String(row[key] || '').trim()))) throw new Error(`Every row needs ${requiredKeys.join(' and ')}. No incomplete rows are silently skipped.`);
      setRows(values);
    } catch (e) { setError(e.message); }
  };
  const importRows = async commit => {
    setError(''); setMessage(''); setBusy(true);
    try {
      if (!rows.length) throw new Error('Choose a non-empty workbook first.');
      if (kind === 'punches') {
        if (!commit) { setValidated(true); setMessage('Workbook preview ready. The server will validate the complete batch before saving.'); return; }
        const response = await api.post('/api/attendance/uploadManualPunches', { punches: rows });
        if (response.data.notInsertedRecords?.length) throw new Error(JSON.stringify(response.data.notInsertedRecords));
        setMessage(response.data.message || 'Local punch inputs imported. Process them from the local attendance utility.'); setRows([]); setValidated(false); return;
      }
      const response = await api.post(kind === 'employees' ? '/api/employee/import' : '/api/contractor/import', { rows, mode, dryRun: !commit });
      if (!response.data.success) { setValidated(false); throw new Error(response.data.errors.map(row => `Row ${row.row}: ${row.message}`).join(' ')); }
      if (commit) { setMessage(`Saved ${response.data.insertedCount} local rows.`); setRows([]); setValidated(false); }
      else { setValidated(true); setMessage(`Validated ${response.data.count} rows. Ready to save.`); }
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  const review = async (row, action) => {
    setError(''); try { await api.post('/api/attendance/approveOrRejectEmpRequest', { request_id: row.request_id, action }); await load(); setMessage(`Local request ${action}d.`); } catch (e) { setError(e.response?.data?.message || e.message); }
  };
  const exportRows = () => { try { downloadWorkbook({ title: label, rows, columns: [...new Set(rows.flatMap(Object.keys))].map(key => ({ key, label: title(key) })), metadata: { Purpose: tool === 'accounting' ? 'Recorded inputs only; not calculated wages' : 'Local workspace data' } }, `CLMS-${tool || kind}`); } catch (e) { setError(e.message); } };
  return <div className="py-4"><div className="d-flex justify-content-between align-items-center"><h2>{label}</h2><Link to="/dashboard">Dashboard</Link></div>
    <p>Local development workspace · fictional data only</p>{error && <Alert variant="danger">{error}</Alert>}{message && <Alert variant="success">{message}</Alert>}
    {isImport ? <>
      <Alert variant="info">Use the template headers. Preview and validate before saving. No data is sent to the live CLMS server.</Alert>
      <div className="d-flex flex-wrap gap-3 mb-3"><Button variant="outline-secondary" onClick={() => downloadWorkbook({ title: `${kind} import template`, columns: (templates[kind] || []).map(key => ({ key, label: key })), rows: [Object.fromEntries((templates[kind] || []).map(key => [key, '']))], metadata: { Instructions: 'Replace the blank data row with fictional records; keep the headers unchanged.' } }, `CLMS-${kind}-template`)}>Download template</Button>
      <Form.Control type="file" accept=".xlsx,.xls,.csv" aria-label="Local workbook" onChange={readFile} style={{ maxWidth: 400 }} />
      {kind !== 'punches' && <Form.Select aria-label="Import mode" value={mode} onChange={e => { setMode(e.target.value); setValidated(false); }} style={{ maxWidth: 220 }}><option value="CREATE">Create new records</option><option value="UPSERT">Create or update by code</option></Form.Select>}
      <Button disabled={busy || !rows.length} onClick={() => importRows(false)}>Validate workbook</Button><Button variant="success" disabled={busy || !validated} onClick={() => importRows(true)}>Save local rows</Button></div>
    </> : <div className="d-flex gap-2 mb-3"><Button disabled={busy} onClick={load}>Refresh</Button>{tool !== 'outbox' && <Button variant="outline-secondary" disabled={!rows.length} onClick={exportRows}>Export XLSX</Button>}</div>}
    {summary && <Alert variant="info">Recorded earnings: {summary.earnings} · deductions: {summary.deductions} · arrears: {summary.arrears}<br />{summary.note}</Alert>}
    {tool === 'outbox' && <Alert variant="warning">Local recovery tokens for test accounts only. Nothing was delivered externally. Expired or used tokens cannot reset a password.</Alert>}
    <DataTable rows={rows} actions={tool === 'approvals' ? row => <><Button size="sm" disabled={!['PENDING', 'N', undefined].includes(row.status)} onClick={() => review(row, 'approve')}>Approve</Button>{' '}<Button size="sm" variant="outline-danger" disabled={!['PENDING', 'N', undefined].includes(row.status)} onClick={() => review(row, 'reject')}>Reject</Button></> : null} />
    <div className="d-flex gap-3 mt-4"><Link to="/development/import/employees">Import workers</Link><Link to="/development/import/contractors">Import contractors</Link><Link to="/development/import/punches">Import local punches</Link><Link to="/development/jobs">Attendance jobs</Link><Link to="/development/features">State profiles &amp; requirements</Link></div>
  </div>;
}
