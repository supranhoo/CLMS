import { actorId } from '../actor.mjs';
import { canSeeEmployee } from './administration.mjs';
const FORMS = {
  'form-xii-register-of-contractors': ['Form XII — Register of contractors', 'contractors'],
  'form-xiii-register-of-workmen': ['Form XIII — Register of workmen', 'workers'],
  'form-xix-wage-slip': ['Form XIX — Wage slip', 'wages'],
  'form-xvi-muster-roll': ['Form XVI — Muster roll', 'muster'],
  'form-xviii-wages-cum-muster-roll': ['Form XVIII — Wages-cum-Muster Roll', 'combined'],
  'form-xxiii-register-of-overtime': ['Form XXIII — Register of Overtime', 'overtime'],
};
const columns = entries => entries.map(([key, label]) => ({ key, label }));
export function registerWorkspaceRoutes(ctx) {
  const { route, both, getState, save, fail, required, dateOnly, attendance, success, capabilities } = ctx;
  const mutation = { mutation: true };
  const features = [
    ['leave-exports', 'Leave ledger and posting preview spreadsheet exports', 'complete', '/leave-ledger-entry', 'Exports current filtered records with scope and source metadata.'],
    ['records', 'Workers, contractors and change approvals', 'complete', '/manageEmployees', 'Local record creation, edits, imports and approval workflow.'],
    ['masters', 'Master data, shifts and effective allocations', 'complete', '/masters/shifts', 'Local CRUD and effective-date allocations.'],
    ['attendance', 'Manual attendance, regularisation and report data', 'complete', '/manageAttendance', 'Validated local edits and recorded attendance reports.'],
    ['local-processing', 'Imported punch processing and job history', 'complete', '/manualProcessAttendance', 'Summarizes locally supplied first/last punches; no presence or paid-hour rule is assumed.'],
    ['adjustments', 'Earnings, deductions, arrears and wage-input imports', 'complete', '/wageEarnings', 'Validated and persistent wage input management with month locks.'],
    ['accounts', 'Local users, assignments, recovery and audit', 'complete', '/manageUsers', 'Hashed local accounts, scoped worker reads, explicit write activities and local recovery outbox.'],
    ['profiles', 'State-wise compliance profiles and rule history', 'complete', '/development/features', 'Jharkhand draft plus configurable state profiles, effective dates, sources and versions.'],
    ['compliance-data', 'Six compliance working-data previews and exports', 'complete', '/compliance/form-xii-register-of-contractors', 'Preview, filter, choose fields, export XLSX and print working data. Approved statutory formats are separate.'],
    ['payroll', 'BFCL payroll calculations and payment statements', 'needs_rules', '/processWages', 'Requires verified state and central applicability plus BFCL pay formulas and expected-result examples.'],
    ['leave-posting', 'Calculated payroll leave posting', 'needs_rules', '/leave-payroll-posting', 'Posting is implemented against explicit calculated payroll outputs; such outputs cannot be generated before rules are supplied and implemented.'],
    ['sandwich', 'Sandwich rules and paid attendance interpretation', 'needs_rules', '/SandwichRuleMaster', 'Draft patterns can be stored; processing waits for verified BFCL policy and applicability.'],
    ['statutory-format', 'Verified state-specific statutory layouts', 'needs_rules', '/compliance/form-xii-register-of-contractors', 'Supply applicable approved layouts, rule sources and signatory requirements. Working-data exports are not filings.'],
    ['biometric', 'Biometric device and operating-system jobs', 'external_integration', '/manualProcessAttendance', 'Isolated replica accepts local imports only. Device integration requires a specified test interface.'],
    ['delivery', 'External password-token delivery', 'external_integration', '/development/outbox', 'The local administrator outbox works; no email or WhatsApp delivery service is connected.'],
  ];
  route('GET', '/api/dev/features', () => ({ data: features.map(([id, title, status, path, description]) => ({ id, title, status, path, description, requirements: status === 'complete' ? [] : [description] })), environment: 'LOCAL_SYNTHETIC_DEMO' }));
  route('GET', '/api/dev/capabilities', () => ({ environment: 'LOCAL_SYNTHETIC_DEMO', productionConnected: false, payrollEngine: 'BFCL_RULES_AND_IMPLEMENTATION_REQUIRED', statutoryCalculations: 'VERIFIED_PROFILE_REQUIRED', endpoints: capabilities, unknownEndpoints: '501 - explicit unsupported method' }));

  function importRecords(body, kind) {
    const s = getState(); const rows = body.rows;
    if (!Array.isArray(rows) || !rows.length || rows.length > 2000) fail(400, 'Import requires between 1 and 2000 rows.');
    const key = kind === 'employees' ? 'Employee_Code' : 'Contractor_ID';
    const name = kind === 'employees' ? 'display_name' : 'Contractor_Name';
    const seen = new Set(); const errors = [];
    const accepted = rows.map((raw, index) => {
      const row = { ...raw, [key]: String(raw[key] || '').trim(), [name]: String(raw[name] || '').trim() };
      // Workbook number cells arrive as numbers; codes are text everywhere else and compared strictly.
      for (const field of ['contractor_id', 'dept', 'bu', 'entity_code', 'loc_code', 'division', 'design_code', 'section', 'cost_code', 'Adhar_No', 'contact_no']) if (typeof row[field] === 'number') row[field] = String(row[field]);
      if (!row[key] || !row[name]) errors.push({ row: index + 2, message: `${key} and ${name} are required.` });
      if (seen.has(row[key])) errors.push({ row: index + 2, message: 'Duplicate code in workbook.' }); seen.add(row[key]);
      if (kind === 'employees' && row.contractor_id && !s.contractors.some(c => c.Contractor_ID === String(row.contractor_id))) errors.push({ row: index + 2, message: 'Unknown contractor_id.' });
      if (body.mode !== 'UPSERT' && s[kind].some(old => old[key] === row[key])) errors.push({ row: index + 2, message: 'Code already exists. Choose UPSERT to update explicitly.' });
      return row;
    });
    if (errors.length) return { success: false, valid: false, errors, insertedCount: 0, notInsertedRecords: errors };
    if (body.dryRun !== false) return { success: true, valid: true, preview: accepted, count: accepted.length, message: 'Validation only. No records were changed.' };
    for (const row of accepted) { const index = s[kind].findIndex(old => old[key] === row[key]); if (index >= 0) s[kind][index] = { ...s[kind][index], ...row, Modified_By: actorId(), Modified_Date: new Date().toISOString() }; else s[kind].push({ ...row, Created_By: actorId(), Created_Date: new Date().toISOString() }); }
    save(); return { ...success('Local workbook rows saved.'), insertedCount: accepted.length, notInsertedRecords: [] };
  }
  route('POST', '/api/employee/import', body => importRecords(body, 'employees'), mutation);
  route('POST', '/api/contractor/import', body => importRecords(body, 'contractors'), mutation);
  route('POST', '/api/employee/uploadInActiveEmp', body => {
    const s = getState(); if (!Array.isArray(body.muster) || !body.muster.length) fail(400, 'Choose non-empty employee inactivation rows.');
    const errors = body.muster.flatMap((row, index) => !s.employees.some(e => e.Employee_Code === row.employee_code) || !/^\d{4}-\d{2}-\d{2}/.test(String(row.attendance_date)) || !Number.isFinite(Date.parse(row.attendance_date)) ? [{ row: index + 1, message: 'Valid employee_code and attendance_date are required.' }] : []);
    if (errors.length) return { success: false, insertedCount: 0, notInsertedRecords: errors };
    for (const row of body.muster) Object.assign(s.employees.find(e => e.Employee_Code === row.employee_code), { Is_Active: 'N', inactive_date: dateOnly(row.attendance_date) });
    save(); return { ...success('Selected local workers marked inactive.'), insertedCount: body.muster.length, notInsertedRecords: [] };
  }, mutation);

  route('GET', '/api/accounting/input-summary', (body, params, request) => {
    const s = getState(); const scoped = rows => rows.filter(row => canSeeEmployee(s, request?.user, row.employee_code || row.EmployeeCode) && (!body.pmonth || dateOnly(row.pmonth) === dateOnly(body.pmonth)) && (!body.contractor_id || s.employees.find(e => e.Employee_Code === (row.employee_code || row.EmployeeCode))?.contractor_id === body.contractor_id));
    const sums = Object.fromEntries(['earnings', 'deductions', 'arrears'].map(key => [key, scoped(s[key] || []).reduce((total, row) => total + Number(row.amount ?? row.ernValue ?? row.dedValue ?? row.arrearValue ?? row.ern_amount ?? row.ded_amount ?? row.arrear_amount ?? 0), 0)]));
    return { demo: true, ...sums, note: 'Recorded input amounts only. These are not gross wages, net pay or statutory dues.', rows: Object.fromEntries(['earnings', 'deductions', 'arrears'].map(key => [key, scoped(s[key] || [])])) };
  });

  route('GET', '/api/compliance/report', body => {
    const s = getState(); const definition = FORMS[body.form]; if (!definition) fail(404, 'Select one of the six local compliance working-data reports.');
    const [title, kind] = definition; const contractFilter = row => !body.contractor_id || String(row.Contractor_ID || row.contractor_id) === String(body.contractor_id);
    const workers = s.employees.filter(contractFilter); let data = []; let schema = [];
    const missingRules = ['Applicable state and establishment classification', 'Verified effective statutory format, rule reference and required signatories'];
    if (kind === 'contractors') {
      data = s.contractors.filter(contractFilter); schema = columns([['Contractor_ID', 'Contractor code'], ['Contractor_Name', 'Contractor name'], ['Address1', 'Address'], ['labour_license_number', 'Recorded licence number'], ['labour_license_valid_from', 'Recorded licence valid from'], ['labour_license_valid_to', 'Recorded licence valid to']]);
    } else if (kind === 'workers') {
      data = workers.map(row => ({ ...row, contractor_name: s.contractors.find(c => c.Contractor_ID === row.contractor_id)?.Contractor_Name || '', doj: dateOnly(row.doj) }));
      schema = columns([['Employee_Code', 'Worker code'], ['display_name', 'Worker name'], ['contractor_name', 'Contractor'], ['Father_Husband_Name', 'Recorded father / spouse'], ['Gender', 'Recorded gender'], ['doj', 'Date of joining'], ['design_code', 'Designation code']]);
    } else if (kind === 'wages') {
      data = (s.payrollRuns || []).filter(run => run.status === 'CALCULATED' && (!body.pmonth || dateOnly(run.pmonth) === dateOnly(body.pmonth))).flatMap(run => (run.rows || []).filter(contractFilter));
      schema = columns([['employee_code', 'Worker code'], ['display_name', 'Worker name'], ['gross', 'Calculated gross'], ['deductions', 'Calculated deductions'], ['net', 'Calculated net pay']]);
      missingRules.push('Calculated payroll outputs using the supplied BFCL and state rules');
    } else {
      const month = String(body.pmonth || ''); if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(month)) fail(400, 'Select an explicit process month for attendance working data.');
      const start = dateOnly(month); const end = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10);
      data = attendance(s, { from_date: start, to_date: end }).filter(contractFilter);
      if (kind === 'overtime') data = data.filter(row => row.ot_hours && row.ot_hours !== '00:00');
      schema = columns([['employee_code', 'Worker code'], ['display_name', 'Worker name'], ['attendance_date', 'Attendance date'], ['punch_mark', 'Recorded attendance mark'], ['in_punch', 'Recorded in time'], ['out_punch', 'Recorded out time'], ['work_hours', 'Recorded work hours'], ['ot_hours', 'Recorded overtime hours']]);
      if (kind === 'combined' || kind === 'overtime') missingRules.push('BFCL paid hours, overtime eligibility and wage calculation rules');
    }
    const profile = (s.complianceProfiles || []).find(p => p.id === s.activeComplianceProfileId);
    return { title, data, columns: schema, scope: { pmonth: body.pmonth || null, contractor_id: body.contractor_id || null }, formatStatus: 'WORKING_DATA_BFCL_FORMAT_REQUIRED', missingRules, stateCode: profile?.stateCode || 'JH', profileVersion: profile?.version || 1, demo: true };
  });
}
