import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DEMO_USER, DEMO_PASSWORD, MENUS, MASTER_KEYS, seedState, referenceData } from './seed.mjs';
import { registerAttendanceRoutes, applyAttendanceOverrides } from './modules/attendance.mjs';
import { registerPayrollRoutes } from './modules/payroll.mjs';
import { registerAdministrationRoutes, authorizeLocalRequest, scopeLocalResult } from './modules/administration.mjs';
import { registerWorkspaceRoutes } from './modules/workspace.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 1024 * 1024;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const entities = [{ entity_code: 'E01', entity_name: 'Fictional Demo Manufacturing' }];
const departments = [{ dept_code: 'D01', dept_name: 'Demo Production' }, { dept_code: 'D02', dept_name: 'Demo Maintenance' }];
const leaveTypes = ['CL', 'EL', 'SL'].map((code, i) => ({ leave_type_code: code, leave_type_name: ['Casual Leave', 'Earned Leave', 'Sick Leave'][i] }));
const transTypes = [
  ['OB', 'Opening Balance', '+'], ['CREDIT', 'Credit', '+'], ['AVAILED', 'Availed', '-'], ['ENCASHED', 'Encashed', '-'],
  ['REVERSAL', 'Reversal', '+'], ['ADJ_CR', 'Adjustment Credit', '+'], ['ADJ_DR', 'Adjustment Debit', '-'],
  ['LAPSED', 'Lapsed', '-'], ['CARRY_FORWARD', 'Carry Forward', '+'],
].map(([trans_type, trans_name, balance_effect]) => ({ trans_type, trans_name, balance_effect }));
const punchMarks = [
  ['P', 'Present', '#d1e7dd', '✓'], ['AB', 'Absent', '#f8d7da', '×'], ['WO', 'Weekly Off', '#e2e3e5', '○'],
  ['CL', 'Casual Leave', '#cff4fc', 'L'], ['EL', 'Earned Leave', '#cff4fc', 'L'], ['SL', 'Sick Leave', '#cff4fc', 'L'],
].map(([punch_mark, punch_mark_desc, bg_color, icon]) => ({ punch_mark, punch_mark_desc, bg_color, text_color: '#212529', border_color: '#ddd', icon }));

function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
const present = value => value !== undefined && value !== null && String(value).trim() !== '';
const dateOnly = value => String(value || '').slice(0, 10);
const nextId = (rows, key) => Math.max(0, ...rows.map(row => Number(row[key]) || 0)) + 1;
const sameKeys = (row, keys) => Object.entries(keys).every(([k, v]) => String(row[k] ?? '') === String(v ?? ''));
function required(row, names) { for (const key of names) if (!present(row[key])) fail(400, `${key} is required for this local demo record.`); }
function goodDate(value) { return /^\d{4}-\d{2}-\d{2}/.test(value || '') && Number.isFinite(new Date(value).valueOf()); }
function localOrigin(req) {
  if (!req.headers.origin) return true;
  try { const url = new URL(req.headers.origin); return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname); } catch { return false; }
}

async function readBody(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return {};
  let body = ''; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) fail(413, 'Local demo request body exceeds 1 MB.'); body += chunk; }
  if (!body.trim()) return {};
  if (!String(req.headers['content-type'] || '').includes('application/json')) fail(415, 'Only JSON is supported by the local demo API; file uploads are unavailable.');
  try { const parsed = JSON.parse(body); if (!parsed || typeof parsed !== 'object') fail(400, 'A JSON object is required.'); return parsed; } catch { fail(400, 'Invalid JSON request body.'); }
}

function selectEmployees(state, query = {}) {
  return state.employees.filter(employee => {
    const code = query.employee_code || query.emp_code || query.Employee_Code;
    if (code && code !== 'ALL' && employee.Employee_Code !== code) return false;
    const contractor = query.contractor_id;
    return !contractor || contractor === 'ALL' || employee.contractor_id === contractor;
  });
}
function attendance(state, query) {
  const from = query.from_date || query.fromDate || dateOnly(state.processMonths[1]?.start_date) || '2026-10-01';
  const to = query.to_date || query.toDate || from;
  if (!goodDate(from) || !goodDate(to) || from > to) fail(400, 'A valid local demo date range is required.');
  const days = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1;
  if (days > 93) fail(400, 'Local attendance previews support at most 93 days.');
  const rows = selectEmployees(state, query).flatMap((employee, i) => Array.from({ length: days }, (_, n) => {
    const day = new Date(new Date(from).valueOf() + n * 86400000).toISOString().slice(0, 10);
    const punch = new Date(day).getUTCDay() === 0 ? 'WO' : n % 13 === i + 1 ? 'AB' : 'P';
    const manual = state.manualPunches.find(row => row.employee_code === employee.Employee_Code && dateOnly(row.attendance_date) === day);
    return { ...employee, employee_code: employee.Employee_Code, attendance_date: day + 'T00:00:00', punch_mark: punch, shift: 'GEN', sh_code: 'GEN', sh_group: 'G1', in_punch: punch === 'P' ? `${day}T08:00:00` : null, out_punch: punch === 'P' ? `${day}T17:00:00` : null, total_hours: '08:00', work_hours: '08:00', ot_hours: '00:00', atnd_approved: 'Y', hr_approved: 'Y', ...manual };
  }));
  return applyAttendanceOverrides(state, rows);
}

function enrichLedger(state, row) {
  const employee = state.employees.find(e => e.Employee_Code === row.employee_code) || {};
  const contractor = state.contractors.find(c => c.Contractor_ID === employee.contractor_id) || {};
  return { ...row, employee_name: employee.display_name || row.employee_name || '', display_name: employee.display_name || '', contractor_id: employee.contractor_id || '', contractor_name: contractor.Contractor_Name || '', balance_effect: transTypes.find(t => t.trans_type === row.trans_type)?.balance_effect || row.balance_effect || '+' };
}
function ledgerRows(state, filter) {
  return state.ledger.map(row => enrichLedger(state, row)).filter(row =>
    (!filter.pmonth || dateOnly(row.pmonth) === dateOnly(filter.pmonth)) &&
    (!filter.contractor_id || row.contractor_id === filter.contractor_id) &&
    (!filter.leave_type_code || row.leave_type_code === filter.leave_type_code));
}
function leaveSummary(state, filter) {
  const from = dateOnly(filter.from_month || '0000-00-00'); const to = dateOnly(filter.to_month || '9999-12-31');
  return selectEmployees(state, filter).flatMap(employee => leaveTypes.filter(t => !filter.leave_type_code || t.leave_type_code === filter.leave_type_code).map(type => {
    const rows = state.ledger.filter(row => row.employee_code === employee.Employee_Code && row.leave_type_code === type.leave_type_code && dateOnly(row.pmonth) <= to);
    const effect = row => (transTypes.find(t => t.trans_type === row.trans_type)?.balance_effect === '-' ? -1 : 1) * Number(row.leave_days);
    const sum = trans => rows.filter(row => dateOnly(row.pmonth) >= from && row.trans_type === trans).reduce((sum, row) => sum + Number(row.leave_days), 0);
    return { employee_code: employee.Employee_Code, display_name: employee.display_name, contractor_id: employee.contractor_id, contractor_name: state.contractors.find(c => c.Contractor_ID === employee.contractor_id)?.Contractor_Name || '', leave_type_code: type.leave_type_code, op_balance: rows.filter(row => dateOnly(row.pmonth) < from || row.trans_type === 'OB').reduce((sum, row) => sum + effect(row), 0), credit_days: sum('CREDIT'), availed_days: sum('AVAILED'), encashed_days: sum('ENCASHED'), reversal_days: sum('REVERSAL'), adj_cr_days: sum('ADJ_CR'), adj_dr_days: sum('ADJ_DR'), lapsed_days: sum('LAPSED'), carry_forward_days: sum('CARRY_FORWARD'), closing_balance: rows.reduce((sum, row) => sum + effect(row), 0), last_trans_date: rows.map(row => row.trans_date).sort().at(-1) || null };
  }));
}

/** Isolated, dependency-free demo API. This module imports no network client or database driver. */
export function createServer({ dataDir = resolve(here, '../.local-demo'), persist = true } = {}) {
  const filename = resolve(dataDir, 'state.json');
  let state = seedState();
  if (persist && existsSync(filename)) {
    const saved = JSON.parse(readFileSync(filename, 'utf8'));
    if (saved.environment !== 'LOCAL_SYNTHETIC_DEMO' || saved.schemaVersion !== 1) throw new Error('Unrecognised local demo state; move it aside or use a fresh data directory.');
    state = { ...seedState(), ...saved };
  }
  const sessions = new Map();
  const routes = []; const capabilities = [];
  const save = () => { if (persist) { mkdirSync(dataDir, { recursive: true }); const temporary = filename + '.tmp'; writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', 'utf8'); renameSync(temporary, filename); } };
  function route(method, path, handler, { mutation = false, status = 'implemented', notes = 'Local synthetic demo data only.' } = {}) {
    const normalized = path.toLowerCase().replace(/\/$/, '');
    const previous = routes.findIndex(item => item.method === method && item.path === normalized);
    const value = { method, path: normalized, handler, mutation };
    if (previous >= 0) { routes[previous] = value; capabilities[previous] = { method, path, status, notes }; }
    else { routes.push(value); capabilities.push({ method, path, status, notes }); }
  }
  const both = (path, handler, options) => { route('GET', path, handler, options); route('POST', path, handler, options); };
  const success = message => ({ success: true, demo: true, message: message || 'Saved in the local synthetic demo only.' });

  route('GET', '/api/dev/health', () => ({ ok: true, environment: 'LOCAL_SYNTHETIC_DEMO', productionConnected: false, persistence: persist, version: 1 }));
  route('GET', '/api/dev/capabilities', () => ({ environment: 'LOCAL_SYNTHETIC_DEMO', productionConnected: false, payrollEngine: 'unavailable', statutoryCalculations: 'unavailable', endpoints: capabilities, unknownEndpoints: '501 - explicit unsupported response' }));
  route('POST', '/api/dev/reset', () => { state = seedState(); sessions.clear(); save(); return success('Local demo fixtures restored. Local sessions were revoked. Production was not contacted.'); }, { mutation: true });
  route('GET', '/api/dev/state', () => state, { mutation: true, notes: 'Authenticated local demo fixture export.' });
  route('POST', '/api/users/login', body => {
    if (body.emp_id !== DEMO_USER.emp_id || body.password !== DEMO_PASSWORD) fail(401, 'Use local demo credentials: demo / demo123.');
    const token = 'local-demo-' + randomBytes(24).toString('hex'); sessions.set(token, { ...DEMO_USER, role: 'LOCAL_DEMO_ADMIN' });
    return { ...DEMO_USER, token, demo: true, environment: 'LOCAL_SYNTHETIC_DEMO' };
  });
  both('/api/menu/getMenuUserData', body => body.emp_id ? MENUS : []);
  both('/api/menu/getMenuData', () => MENUS);
  both('/api/menu/getMenuActivityData', () => MENUS.filter(m => m.menu_url).map(m => ({ ...m, activity_id: 1, activity_name: 'Local Demo' })));
  both('/api/menu/getLocationData', () => state.masters.locations);
  both('/api/users/getAllUsers', () => [{ ...DEMO_USER, Is_Active: 'Y' }]);

  both('/api/contractor/getAllContractors', () => state.contractors);
  route('POST', '/api/contractor/addContractor', body => {
    required(body, ['Contractor_ID', 'Contractor_Name']);
    if (state.contractors.some(c => c.Contractor_ID === body.Contractor_ID)) fail(409, 'Contractor ID already exists in the local demo.');
    state.contractors.push({ ...body, Created_By: 'demo', Created_Date: new Date().toISOString() }); save(); return success();
  }, { mutation: true });
  route('PUT', '/api/contractor/updateContractor/:id', (body, params) => {
    const index = state.contractors.findIndex(c => c.Contractor_ID === params.id); if (index < 0) fail(404, 'Local demo contractor not found.');
    state.contractors[index] = { ...state.contractors[index], ...body, Contractor_ID: params.id, Modified_By: 'demo', Modified_Date: new Date().toISOString() }; save(); return success();
  }, { mutation: true });
  both('/api/employee/getAllEmployees', () => state.employees);
  both('/api/employee/getEmpMastDump', () => state.employees);
  both('/api/employee/getEmployeeByCode', body => selectEmployees(state, { employee_code: body.employee_code || body.emp_code || body.Employee_Code || body.code }));
  both('/api/employee/searchEmployees', body => state.employees.filter(e => `${e.Employee_Code} ${e.display_name}`.toLowerCase().includes(String(body.search || body.searchTerm || body.query || '').toLowerCase())));
  both('/api/employee/getByAdhar', body => body.Adhar_No ? state.employees.filter(e => e.Adhar_No === body.Adhar_No) : []);
  both('/api/employee/getByPanno', body => body.panno ? state.employees.filter(e => e.panno === body.panno) : []);
  for (const key of Object.keys(referenceData(state))) both('/api/employee/get' + key, () => referenceData(state)[key]);
  function employeeRecord(body) {
    required(body, ['Employee_Code', 'display_name']);
    const index = state.employees.findIndex(e => e.Employee_Code === body.Employee_Code);
    const row = { ...(index >= 0 ? state.employees[index] : {}), ...body, employee_code: body.Employee_Code };
    return { index, row };
  }
  route('POST', '/api/employee/addEmployee', body => {
    const { index, row } = employeeRecord(body); if (index >= 0) fail(409, 'Employee code already exists in the local demo.');
    state.employees.push(row); save(); return success();
  }, { mutation: true });
  route('POST', '/api/employee/addEmployeePreapprove', body => {
    const { index, row } = employeeRecord(body);
    state.pendingEmployees = state.pendingEmployees.filter(e => e.Employee_Code !== row.Employee_Code);
    state.pendingEmployees.push({ ...row, record_id: nextId(state.pendingEmployees, 'record_id'), source: 'Modified', demo: true });
    save(); return success(index >= 0 ? 'Employee change saved for approval in the local demo.' : 'New employee saved for approval in the local demo.');
  }, { mutation: true });
  both('/api/employee/getUnapprovedEmpRec', () => state.pendingEmployees.flatMap(row => {
    const current = state.employees.find(e => e.Employee_Code === row.Employee_Code);
    return current ? [{ ...current, source: 'Original' }, row] : [row];
  }));
  route('POST', '/api/employee/approveOrRejectEmpRec', body => {
    const row = state.pendingEmployees.find(e => e.record_id === Number(body.record_id)); if (!row) fail(404, 'Pending local demo employee not found.');
    if (!['approve', 'reject'].includes(body.action)) fail(400, 'Action must be approve or reject.');
    if (body.action === 'approve') { const index = state.employees.findIndex(e => e.Employee_Code === row.Employee_Code); const { record_id, source, ...employee } = row; if (index >= 0) state.employees[index] = employee; else state.employees.push(employee); }
    state.pendingEmployees = state.pendingEmployees.filter(e => e !== row); save(); return success();
  }, { mutation: true });

  both('/api/entity', () => entities);
  both('/api/entity/getEntityName', () => entities);
  both('/api/entity/getAssignedEntity', () => entities);
  for (const name of ['getAllBU', 'getAssignedBU']) both('/api/entity/' + name, () => state.masters['business-units']);
  both('/api/entity/getAllDept', () => departments);
  for (const name of ['getAllDivision', 'divcode', 'divgroup']) both('/api/entity/' + name, () => state.masters.divisions.map(r => ({ ...r, div_code: r.Div_code })));
  both('/api/entity/getCostCode', () => state.masters['cost-centres'].map(row => ({ ...row, cost_code: row.cost_code || row.COST_CODE, cost_name: row.cost_name || row.COST_NAME })));
  both('/api/entity/getAssignedLocCode', () => state.masters.locations);

  const roleLists = { BU: () => state.masters['business-units'], Contractor: () => state.contractors.map(c => ({ contractor_code: c.Contractor_ID, contractor_name: c.Contractor_Name })), Dept: () => departments, Location: () => state.masters.locations, Menu: () => MENUS, MenuActivity: () => [] };
  state.roles ||= {};
  for (const [kind, list] of Object.entries(roleLists)) {
    both('/api/assignRoles/getUser' + kind, body => state.roles[body.emp_id]?.[kind] || list());
    route('POST', '/api/assignRoles/assignUser' + kind, body => {
      const code = body.emp_code || body.emp_id; if (!present(code)) fail(400, 'emp_code is required.');
      const payloadKey = { BU: 'bu_codes', Contractor: 'contractor_ids', Dept: 'dept_codes', Location: 'loc_codes', Menu: 'menu_ids', MenuActivity: 'menu_ids' }[kind];
      if (!Array.isArray(body[payloadKey])) fail(400, `${payloadKey} must be an array.`);
      state.roles[code] ||= {}; state.roles[code][kind] = body[payloadKey]; save();
      return success('Demo permission selection recorded locally; all demo screens remain visible.');
    }, { mutation: true, status: 'simulated', notes: 'Persists selected demo roles for the roles screen; production authorisation enforcement is not reproduced.' });
  }
  both('/api/assignRoles/getUserMenuActivityForSpecificMenu', () => []);

  for (const master of Object.keys(MASTER_KEYS)) {
    route('GET', '/api/master-data/' + master, () => state.masters[master]);
    route('POST', '/api/master-data/' + master, body => { const keys = MASTER_KEYS[master]; required(body, keys); const identity = Object.fromEntries(keys.map(k => [k, body[k]])); if (state.masters[master].some(row => sameKeys(row, identity))) fail(409, 'This master record already exists in the local demo.'); state.masters[master].push(body); save(); return success(); }, { mutation: true });
    route('PUT', '/api/master-data/' + master, body => { required(body, ['keys', 'data']); required(body.keys, MASTER_KEYS[master]); required(body.data, MASTER_KEYS[master]); const index = state.masters[master].findIndex(row => sameKeys(row, body.keys)); if (index < 0) fail(404, 'Local demo master record not found.'); state.masters[master][index] = { ...state.masters[master][index], ...body.data }; save(); return success(); }, { mutation: true });
    route('DELETE', '/api/master-data/' + master, body => { required(body.keys || {}, MASTER_KEYS[master]); const before = state.masters[master].length; state.masters[master] = state.masters[master].filter(row => !sameKeys(row, body.keys)); if (before === state.masters[master].length) fail(404, 'Local demo master record not found.'); save(); return success(); }, { mutation: true });
  }
  route('GET', '/api/master-data/lookups', () => ({ entities: entities.map(r => ({ value: r.entity_code, label: r.entity_name })), contractors: state.contractors.map(r => ({ value: r.Contractor_ID, label: r.Contractor_Name })), shiftGroups: state.masters['shift-groups'].map(r => ({ value: r.sh_group, label: `${r.sh_group} - ${r.sh_group_desc}` })) }));

  for (const endpoint of ['getAllProcessMonth', 'getProcessMonth', 'getProcessMonthByBillingCycle', 'getAllProcessMonthByBillingCycle', 'getArrearProcessMonth']) both('/api/wages/' + endpoint, body => state.processMonths.filter(r => !body.billingtype || r.billingType === body.billingtype));
  both('/api/wages/getProcessMonthDates', body => state.processMonths.filter(r => !body.pmonth || dateOnly(r.pmonth) === dateOnly(body.pmonth)));
  both('/api/wages/getAllFinYear', () => [{ finyear: '2026-2027', start_date: '2026-04-01', end_date: '2027-03-31' }]);
  route('POST', '/api/wages/addProcessMonth', body => { const row = body.newProcessMonth || body; required(row, ['pmonth', 'billingType', 'start_date', 'end_date']); if (state.processMonths.some(r => dateOnly(r.pmonth) === dateOnly(row.pmonth) && r.billingType === row.billingType)) fail(409, 'Process month already exists in the local demo.'); state.processMonths.push(row); save(); return success(); }, { mutation: true });
  route('POST', '/api/wages/updateProcessMonth', body => { const row = body.updatedProcessMonth || body; const index = state.processMonths.findIndex(r => dateOnly(r.pmonth) === dateOnly(row.pmonth) && r.billingType === row.billingType); if (index < 0) fail(404, 'Local process month not found.'); state.processMonths[index] = row; save(); return success(); }, { mutation: true });
  route('POST', '/api/wages/deleteProcessMonth', body => { const row = body.updatedProcessMonth || body; required(row, ['pmonth']); const before = state.processMonths.length; state.processMonths = state.processMonths.filter(r => !(dateOnly(r.pmonth) === dateOnly(row.pmonth) && (!row.billingType || r.billingType === row.billingType))); if (before === state.processMonths.length) fail(404, 'Local process month not found.'); save(); return success(); }, { mutation: true });
  both('/api/wages/getFixWagesDump', () => state.fixedWages);
  for (const action of ['addFixWages', 'updateFixWages']) route('POST', '/api/wages/' + action, body => { required(body, ['EmployeeCode']); const index = state.fixedWages.findIndex(r => r.EmployeeCode === body.EmployeeCode && dateOnly(r.eff_date) === dateOnly(body.eff_date)); if (index >= 0) state.fixedWages[index] = { ...state.fixedWages[index], ...body }; else state.fixedWages.push(body); save(); return success(); }, { mutation: true });
  both('/api/wages/getServiceCharges', () => state.serviceCharges);
  route('POST', '/api/wages/addServiceCharges', body => { const row = { ...body, RuleID: nextId(state.serviceCharges, 'RuleID') }; state.serviceCharges.push(row); save(); return row; }, { mutation: true });
  route('DELETE', '/api/wages/deleteServiceCharges/:id', (body, params) => { state.serviceCharges = state.serviceCharges.filter(r => String(r.RuleID) !== params.id); save(); return success(); }, { mutation: true });
  both('/api/wages/getWageProcessLock', () => state.wageLocks);
  route('POST', '/api/wages/addWageProcessLock', body => { state.wageLocks.push(body); save(); return success(); }, { mutation: true });
  route('POST', '/api/wages/deleteWageProcessLock', body => { const row = body.updatedProcessMonth || body; state.wageLocks = state.wageLocks.filter(r => !sameKeys(r, row)); save(); return success(); }, { mutation: true });
  for (const [kind, table, code] of [['Ded', 'deductions', 'ded_code'], ['Ern', 'earnings', 'ern_code'], ['Arrear', 'arrears', 'arrear_code']]) {
    both('/api/wages/get' + kind + 'Codes', () => [{ [code]: 'DEMO', [`${code.split('_')[0]}_desc`]: 'Demo Adjustment' }]);
    const noun = { Ded: 'Deductions', Ern: 'Earnings', Arrear: 'Arrears' }[kind];
    both('/api/wages/getWage' + noun, () => state[table]);
    // Adjustment import/update payloads vary between screens. Deliberately unsupported until an explicit backend contract is defined.
  }

  both('/api/attendance/getPunchMarks', () => punchMarks);
  both('/api/attendance/getAtndMusterAll', body => attendance(state, body), { status: 'simulated', notes: 'Deterministic fictional attendance generated for the requested date range.' });
  both('/api/attendance/getAtndMusterByEmp', body => attendance(state, body), { status: 'simulated', notes: 'Fictional employee attendance; no device or muster processing.' });
  both('/api/attendance/getPunchesDataByEmp', body => attendance(state, body).flatMap(r => r.in_punch ? [{ ...r, punch_time: r.in_punch, punch_date_time: r.in_punch }, { ...r, punch_time: r.out_punch, punch_date_time: r.out_punch }] : []), { status: 'simulated' });
  both('/api/attendance/getShiftGroups', () => state.masters['shift-groups']);
  both('/api/attendance/getShift', () => state.masters['shift-times']);
  both('/api/attendance/getShGrpAlloc', () => state.shiftAllocations);
  for (const [method, action] of [['POST', 'addShGrpAlloc'], ['PUT', 'updShGrpAlloc']]) route(method, '/api/attendance/' + action, body => { required(body, ['employee_code']); const index = state.shiftAllocations.findIndex(r => r.employee_code === body.employee_code); if (index >= 0) state.shiftAllocations[index] = body; else state.shiftAllocations.push(body); save(); return success(); }, { mutation: true });
  both('/api/attendance/listApprovedManpower', body => state.approvedManpower.filter(row => ['contractor_id', 'dept_code', 'bu_code', 'emp_type'].every(k => !body[k] || String(row[k]) === String(body[k]))));
  route('POST', '/api/attendance/addApprovedManpower', body => { const keys = ['contractor_id', 'dept_code', 'bu_code', 'emp_type']; required(body, keys); if (state.approvedManpower.some(row => keys.every(k => row[k] === body[k]))) fail(409, 'Approved manpower record already exists in the local demo.'); if ([body.approved_day, body.approved_night].some(n => !Number.isFinite(Number(n)) || Number(n) < 0)) fail(400, 'Approved manpower must be non-negative numbers.'); state.approvedManpower.push(body); save(); return success(); }, { mutation: true });
  route('POST', '/api/attendance/deleteApprovedManpower', body => { required(body, ['contractor_id', 'dept_code', 'bu_code', 'emp_type']); state.approvedManpower = state.approvedManpower.filter(row => !['contractor_id', 'dept_code', 'bu_code', 'emp_type'].every(k => row[k] === body[k])); save(); return success(); }, { mutation: true });
  both('/api/attendance/getSandwichRules', () => state.sandwichRules);
  for (const action of ['add', 'update', 'delete']) route('POST', '/api/attendance/' + action + 'SandwichRule', body => { const index = state.sandwichRules.findIndex(r => r.rule_id === body.rule_id); if (action !== 'add' && index < 0) fail(404, 'Local demo rule not found.'); if (action === 'delete') state.sandwichRules.splice(index, 1); else if (action === 'update') state.sandwichRules[index] = body; else state.sandwichRules.push({ ...body, rule_id: nextId(state.sandwichRules, 'rule_id') }); save(); return success(); }, { mutation: true });
  both('/api/attendance/getEmpRequest', () => state.employeeRequests);
  route('POST', '/api/attendance/addEmpRequest', body => { const row = { ...body, request_id: nextId(state.employeeRequests, 'request_id') }; state.employeeRequests.push(row); save(); return row; }, { mutation: true });
  both('/api/attendance/getRegularisedPunches', () => state.manualPunches);
  both('/api/attendance/ExpRegPunchDet', () => state.manualPunches);
  both('/api/attendance/getManualMuster', () => state.manualPunches);

  both('/api/leave/getLeaveTypes', () => leaveTypes);
  both('/api/leave/getTransTypes', () => transTypes);
  both('/api/leave/getActiveLeavePeriods', () => [{ leave_period_id: 1, period_name: '2026 Demo Leave Year', start_date: '2026-01-01', end_date: '2026-12-31' }]);
  both('/api/leave/getRecentLeaves', () => state.leaves.map(row => ({ ...row, display_name: state.employees.find(e => e.Employee_Code === row.employee_code)?.display_name || '', leave_type_name: leaveTypes.find(t => t.leave_type_code === row.leave_type_code)?.leave_type_name || row.leave_type_code })));
  route('POST', '/api/leave/addLeave', body => { required(body, ['employee_code', 'leave_type_code', 'from_date', 'to_date']); if (!state.employees.some(e => e.Employee_Code === body.employee_code)) fail(400, 'Select a local demo employee.'); if (!leaveTypes.some(t => t.leave_type_code === body.leave_type_code)) fail(400, 'Select a valid local demo leave type.'); if (!goodDate(body.from_date) || !goodDate(body.to_date) || body.from_date > body.to_date || !(Number(body.total_days) > 0)) fail(400, 'Valid dates and positive leave days are required.'); const id = nextId(state.leaves, 'leave_id'); state.leaves.push({ ...body, leave_id: id, leave_app_id: id, leave_entry_id: id, status: 'APPROVED', demo: true }); state.ledger.push({ trans_id: nextId(state.ledger, 'trans_id'), employee_code: body.employee_code, leave_type_code: body.leave_type_code, trans_type: 'AVAILED', leave_days: Number(body.total_days), pmonth: body.from_date.slice(0, 7) + '-01', trans_date: new Date().toISOString(), ref_type: 'LEAVE', ref_no: String(id), remarks: body.reason || '' }); save(); return success(); }, { mutation: true });
  route('POST', '/api/leave/deleteLeave', body => { const id = Number(body.leave_app_id || body.leave_id || body.leave_entry_id); if (!id) fail(400, 'leave_app_id is required.'); state.leaves = state.leaves.filter(r => r.leave_id !== id); state.ledger = state.ledger.filter(r => !(r.ref_type === 'LEAVE' && r.ref_no === String(id))); save(); return success(); }, { mutation: true });
  route('GET', '/api/leave/query', body => ({ demo: true, data: ledgerRows(state, body) }));
  route('POST', '/api/leave/save-bulk', body => {
    if (!Array.isArray(body.rows) || !body.rows.length) fail(400, 'At least one leave ledger row is required.');
    const timestamp = new Date().toISOString(); const editedIds = new Set(); let newId = nextId(state.ledger, 'trans_id');
    // Validate and prepare the complete batch before changing persisted state.
    const records = body.rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) fail(400, 'Every leave ledger row must be an object.');
      required(row, ['employee_code', 'leave_type_code', 'trans_type', 'pmonth']);
      if (!/^\d{4}-(?:0[1-9]|1[0-2])-01(?:T00:00:00(?:\.000)?Z)?$/.test(String(row.pmonth))) fail(400, 'pmonth must be a valid calendar month starting on the first day (YYYY-MM-01).');
      const hasId = row.trans_id !== null && row.trans_id !== undefined && row.trans_id !== '';
      const id = hasId ? Number(row.trans_id) : null;
      if (hasId && (!Number.isSafeInteger(id) || id <= 0)) fail(400, 'trans_id must identify an existing saved ledger row.');
      const previous = hasId ? state.ledger.find(old => Number(old.trans_id) === id) : null;
      if (hasId && !previous) fail(404, 'The saved local leave ledger row was not found. Query again before saving.');
      if (previous && previous.ref_type !== 'MANUAL') fail(409, 'Only manual ledger entries can be edited here. Payroll and leave-owned entries were preserved.');
      if (hasId && editedIds.has(id)) fail(409, 'The batch contains duplicate ledger transaction IDs. No rows were saved.');
      if (hasId) editedIds.add(id);
      if (!state.employees.some(e => e.Employee_Code === row.employee_code) || !leaveTypes.some(t => t.leave_type_code === row.leave_type_code) || !transTypes.some(t => t.trans_type === row.trans_type) || !Number.isFinite(Number(row.leave_days)) || !(Number(row.leave_days) > 0)) fail(400, 'Select valid local employee, leave type, transaction type, and positive leave days.');
      // Store business fields explicitly: UI flags and derived display fields do not belong to the ledger.
      return { trans_id: id || newId++, employee_code: row.employee_code, leave_type_code: row.leave_type_code, trans_type: row.trans_type, leave_days: Number(row.leave_days), pmonth: dateOnly(row.pmonth), trans_date: timestamp, ref_type: 'MANUAL', ref_no: String(row.ref_no ?? previous?.ref_no ?? ''), remarks: String(row.remarks || ''), created_by: previous?.created_by || 'demo', created_date: previous?.created_date || previous?.trans_date || timestamp, ...(previous ? { modified_by: 'demo', modified_date: timestamp } : {}) };
    });
    const updated = [...state.ledger];
    for (const record of records) { const index = updated.findIndex(old => Number(old.trans_id) === record.trans_id); if (index >= 0) updated[index] = record; else updated.push(record); }
    state.ledger = updated; save(); return success();
  }, { mutation: true });
  route('POST', '/api/leave/delete', body => { if (!Array.isArray(body.trans_ids)) fail(400, 'trans_ids must be an array.'); if (state.ledger.some(row => body.trans_ids.includes(row.trans_id) && row.ref_type !== 'MANUAL')) fail(409, 'Only manual ledger entries can be deleted here. Payroll and leave-owned entries were preserved.'); state.ledger = state.ledger.filter(row => !body.trans_ids.includes(row.trans_id)); save(); return success(); }, { mutation: true });
  route('GET', '/api/leave/report/summary', body => ({ demo: true, data: leaveSummary(state, body) }));
  route('GET', '/api/leave/report/balance', body => {
    const summaries = leaveSummary(state, { ...body, to_month: body.as_on_month });
    return { demo: true, data: selectEmployees(state, body).map(e => { const rows = summaries.filter(r => r.employee_code === e.Employee_Code); const balance = code => rows.find(r => r.leave_type_code === code)?.closing_balance || 0; return { employee_code: e.Employee_Code, display_name: e.display_name, contractor_name: state.contractors.find(c => c.Contractor_ID === e.contractor_id)?.Contractor_Name || '', cl_balance: balance('CL'), el_balance: balance('EL'), sl_balance: balance('SL'), total_balance: balance('CL') + balance('EL') + balance('SL'), last_trans_date: rows.map(r => r.last_trans_date).filter(Boolean).sort().at(-1) || null }; }) };
  });
  route('POST', '/api/leave/payroll-posting', body => {
    if (body.mode !== 'PREVIEW') fail(501, 'Payroll leave posting is unavailable in this development replica. PREVIEW shows local leave entries only; no payroll engine exists.');
    return { demo: true, message: 'DEMO preview from local leave entries only. No wage or payroll calculation.', data: ledgerRows(state, body).filter(r => r.trans_type === 'AVAILED').map(r => ({ ...r, period_name: body.pmonth, ref_type: 'LOCAL_DEMO_PREVIEW' })) };
  }, { status: 'simulated', notes: 'PREVIEW only; POST mode returns 501. No payroll computation or posting.' });

  const featureContext = { route, both, getState: () => state, save, fail, required, dateOnly, nextId, attendance, selectEmployees, success, ledgerRows, leaveSummary, sessions, menus: MENUS, entities, departments, referenceData };
  registerAdministrationRoutes(featureContext);
  registerAttendanceRoutes(featureContext);
  registerPayrollRoutes(featureContext);
  registerWorkspaceRoutes({ ...featureContext, capabilities });

  const unavailable = [
    '/api/users/register', '/api/users/updateUser/:id', '/api/users/changePassword', '/api/users/generateResetToken', '/api/users/resetPassword',
    ...['processWages', 'generateWageSlips', 'getWageRegister', 'wageSlip', 'getBankStatement', 'getPFStatement', 'getESIStatement', 'getCashStatement', 'getPTReport', 'getPTMonthWiseReport', 'getBonusReport', 'getWageComparision', 'uploadWageComponents', 'uploadArrears', 'uploadDeductions', 'uploadEarnings', 'addWageDeductions', 'updateWageDeductions', 'deleteWageDeductions', 'addWageEarnings', 'updateWageEarnings', 'deleteWageEarnings', 'addWageArrears', 'updateWageArrears', 'deleteWageArrears'].map(x => '/api/wages/' + x),
    ...['manualProcessAttendance', 'regenerateMuster', 'runSandwich', 'triggerTask', 'uploadManualMuster', 'uploadManualPunches', 'addManualPunchMark', 'deleteManualPunchMark', 'addRegularisePunch', 'updateRegularisePunch', 'updateMusterDept', 'printAtndReg', 'printAtndReg2', 'printSummary', 'getApprVsPresent', 'getApprVsPresentPeriod', 'getMusterDeptByContractor'].map(x => '/api/attendance/' + x),
    '/api/employee/uploadInActiveEmp', '/api/payslip/progress/:id',
  ];
  for (const path of unavailable) for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    if (routes.some(item => item.method === method && item.path === path.toLowerCase())) continue;
    route(method, path, () => fail(501, 'This API method is not supported. Use the documented local feature workflow; no production request was sent.'), { status: 'unsupported', notes: 'Unsupported method; never proxies to production.' });
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-CLMS-Environment', 'LOCAL_SYNTHETIC_DEMO');
    try {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403, 'The demo API accepts loopback clients only.');
      let hostname;
      try { hostname = new URL('http://' + req.headers.host).hostname; } catch { fail(403, 'A local Host header is required.'); }
      if (!LOCAL_HOSTS.has(hostname)) fail(403, 'Only loopback Host headers are allowed.');
      if (!localOrigin(req)) fail(403, 'Only local browser origins are allowed.');
      if (req.headers.origin) { res.setHeader('Access-Control-Allow-Origin', req.headers.origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); res.writeHead(204); res.end(); return; }
      const url = new URL(req.url, 'http://127.0.0.1'); const pathname = url.pathname.replace(/\/$/, '');
      if (url.protocol !== 'http:' || !LOCAL_HOSTS.has(url.hostname)) fail(403, 'Only local request targets are allowed.');
      const match = routes.map(route => { const keys = []; const pattern = route.path.split('/').map(piece => piece.startsWith(':') ? (keys.push(piece.slice(1)), '([^/]+)') : piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/'); const parts = pathname.match(new RegExp('^' + pattern + '$', 'i')); return route.method === req.method && parts ? { route, params: Object.fromEntries(keys.map((key, i) => [key, decodeURIComponent(parts[i + 1])])) } : null; }).find(Boolean);
      if (!match) fail(501, `Unsupported local demo API: ${req.method} ${url.pathname}. No request was sent to production.`);
      const token = String(req.headers.authorization || '').replace(/^Bearer /i, '');
      const actor = sessions.get(token);
      if (match.route.mutation && !actor) fail(401, 'Sign in with a local account before changing local records.');
      const payload = await readBody(req);
      const body = Array.isArray(payload) ? payload : { ...Object.fromEntries(url.searchParams), ...payload };
      const requestContext = { user: actor, token, method: req.method, path: pathname, isMutation: match.route.mutation, headers: req.headers };
      authorizeLocalRequest(getStateSafe(), requestContext, body, fail);
      const result = await match.route.handler(body, match.params, requestContext);
      res.writeHead(200); res.end(JSON.stringify(scopeLocalResult(getStateSafe(), result, requestContext)));
    } catch (error) {
      res.writeHead(error.status || 500);
      res.end(JSON.stringify({ success: false, demo: true, message: error.status ? error.message : 'The local demo API encountered an error.', error: error.status ? error.message : 'LOCAL_DEMO_ERROR' }));
    }
  });
  function getStateSafe() { return state; }
  server.demo = { capabilities, getState: () => structuredClone(state) };
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createServer();
  server.on('error', error => { console.error('Local demo API could not start:', error.message); process.exitCode = 1; });
  server.listen(5001, '127.0.0.1', () => console.log('CLMS synthetic demo API: http://127.0.0.1:5001 (demo / demo123). No production connection.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
