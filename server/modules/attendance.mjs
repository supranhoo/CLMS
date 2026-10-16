// Local attendance inputs and reports. No biometric/device/OS services are called.
const DAY = 86400000;
const key = row => `${row.employee_code || row.Employee_Code || row.EMPLOYEE_CODE}|${String(row.attendance_date || '').slice(0, 10)}`;
const ymd = value => String(value || '').slice(0, 10);
const minutesText = minutes => `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(ymd(value)) && !Number.isNaN(Date.parse(ymd(value))) && new Date(ymd(value)).toISOString().slice(0, 10) === ymd(value);
const selected = (filter, value) => !filter || (Array.isArray(filter) && (!filter.length || filter.includes('ALL'))) || filter === 'ALL' || (Array.isArray(filter) ? filter.map(String).includes(String(value)) : String(filter) === String(value));
const arr = body => Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows : Object.keys(body).length && Object.keys(body).every(k => /^\d+$/.test(k)) ? Object.values(body) : null;
const now = () => new Date().toISOString();

/** Called by the shared synthetic fixture generator; explicit inputs take precedence. */
export function applyAttendanceOverrides(state, rows) {
  const maps = ['processedAttendance', 'manualPunches', 'regularisedPunches', 'musterDepartments'].map(name => new Map((state[name] || []).map(row => [key(row), row])));
  return rows.map(base => {
    const id = key(base); const [processed, manual, regularised, department] = maps.map(map => map.get(id));
    const allocation = (state.shiftAllocations || []).filter(row => row.employee_code === base.employee_code && ymd(row.sh_group_eff_from) <= ymd(base.attendance_date)).sort((a, b) => ymd(b.sh_group_eff_from).localeCompare(ymd(a.sh_group_eff_from)))[0];
    const shift = (state.masters?.['shift-times'] || []).find(row => row.sh_group === allocation?.sh_group);
    let row = { ...base, ...(allocation ? { sh_group: allocation.sh_group, weekly_off: allocation.weekly_off, ...(shift ? { shift: shift.sh_code, sh_code: shift.sh_code, shift_day_night: shift.shift_day_night } : {}) } : {}), ...processed, ...manual };
    if (regularised?.approved === 'Y') {
      row = { ...row, in_punch: regularised.in_punch, out_punch: regularised.out_punch, reg_in_punch: regularised.in_punch, reg_out_punch: regularised.out_punch, atnd_approved: 'Y', elapsed_hours: regularised.elapsed_hours, attendance_source: 'LOCAL_APPROVED_REGULARISATION' };
    }
    if (department) row = { ...row, ...department };
    const employee = state.employees.find(e => e.Employee_Code === row.employee_code) || {};
    const dept = row.dept_code || row.dept || employee.dept || '';
    const bu = row.bu_code || row.bu || employee.bu || '';
    const departmentMaster = (state.masters?.departments || []).find(d => d.dept_code === dept);
    row = { ...row, employee_code: base.employee_code, Employee_Code: base.employee_code, EMPLOYEE_CODE: base.employee_code, attendance_date: ymd(base.attendance_date) + 'T00:00:00', dept_code: dept, bu_code: bu, div_code: row.div_code || row.division || '', design_name: row.design_name || 'Demo Operator', emp_category: row.emp_category || row.emp_category_code || '', entity_name: row.entity_name || 'Fictional Demo Manufacturing', contractor_name: state.contractors.find(c => c.Contractor_ID === row.contractor_id)?.Contractor_Name || '', bu_name: state.masters?.['business-units']?.find(b => b.bu_code === bu)?.bu_name || bu, dept_name: departmentMaster?.dept_name || ({ D01: 'Demo Production', D02: 'Demo Maintenance' }[dept]) || dept, working_hours: row.working_hours ?? row.work_hours ?? '00:00', total_hours: row.working_hours ?? row.work_hours ?? '00:00', demo: true, attendance_source: row.attendance_source || 'LOCAL_SYNTHETIC_FIXTURE' };
    return row;
  });
}

export function registerAttendanceRoutes(ctx) {
  const { route, both, getState, save, fail, required, nextId, attendance, success } = ctx;
  const state = () => { const s = getState(); for (const name of ['manualPunches', 'regularisedPunches', 'musterDepartments', 'importedPunches', 'processedAttendance', 'attendanceJobs', 'shiftAllocations', 'approvedManpower', 'employeeRequests', 'sandwichRules']) s[name] ||= []; return s; };
  const mutation = { mutation: true, notes: 'Validated local synthetic records only; no device, payroll or statutory processing.' };
  const emp = code => { const e = state().employees.find(e => e.Employee_Code === code); if (!e) fail(404, 'Local demo employee not found.'); return e; };
  const checkDay = (value, name = 'attendance_date') => { if (!validDay(value)) fail(400, `${name} must be a valid calendar date (YYYY-MM-DD).`); return ymd(value); };
  const checkRange = body => {
    const s = state(); const month = body.pmonth ? s.processMonths.find(p => ymd(p.pmonth) === ymd(body.pmonth) && selected(body.billingType || body.billingtype, p.billingType)) : null;
    if (body.pmonth && !month) fail(404, 'The selected local process month does not exist.');
    const from = checkDay(body.from_date || body.fromDate || body.attendance_date || body.must_date || month?.start_date, 'from_date');
    const to = checkDay(body.to_date || body.toDate || body.attendance_date || body.must_date || month?.end_date || from, 'to_date');
    if (from > to || (Date.parse(to) - Date.parse(from)) / DAY > 92) fail(400, 'Select an ordered attendance range of at most 93 days.');
    return { from_date: from, to_date: to };
  };
  const codeFilter = body => body.employee_code || body.emp_code || body.Employee_Code || body.employeeCode;
  const filtered = (rows, body = {}) => rows.filter(row => selected(codeFilter(body), row.employee_code || row.Employee_Code) && selected(body.contractor_id || body.contractor || body.contractorFilter, row.contractor_id) && selected(body.department || body.dept_code, row.dept_code || row.dept) && selected(body.bu || body.bu_code, row.bu_code || row.bu) && selected(body.entity || body.entity_code || body.entityFilter, row.entity_code) && selected(body.locCode || body.loc_code, row.loc_code) && selected(body.emp_type, row.emp_type) && selected(body.billingType || body.billingtype, row.BillingType));
  const validateCodeFilter = body => { const code = codeFilter(body); if (code && code !== 'ALL') { if (Array.isArray(code)) code.filter(c => c !== 'ALL').forEach(emp); else emp(code); } };
  const report = body => { const range = checkRange(body); validateCodeFilter(body); return filtered(applyAttendanceOverrides(state(), attendance(state(), { ...range })), body); };
  const enrich = row => applyAttendanceOverrides(state(), [{ ...emp(row.employee_code), ...row }])[0];
  const inputRows = (rows, label) => { if (!Array.isArray(rows) || !rows.length || rows.length > 10000) fail(400, `${label} must contain between 1 and 10000 rows.`); return rows; };
  const duration = (value, field, fallback = '00:00') => {
    if (value === null || value === undefined || value === '') return fallback;
    const m = String(value).match(/^(\d{1,3}):([0-5]\d)(?::[0-5]\d)?$/);
    if (!m || Number(m[1]) > 48) fail(400, `${field} must be HH:MM between 00:00 and 48:00.`);
    if (Number(m[1]) === 48 && Number(m[2])) fail(400, `${field} cannot exceed 48:00.`);
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  };
  const stamp = (value, field, day) => {
    if (!value) return null;
    let text = String(value).trim().replace(' ', 'T');
    if (/^\d{2}:\d{2}(?::\d{2})?$/.test(text)) text = day + 'T' + text;
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?$/.test(text) || !validDay(text) || !Number.isFinite(Date.parse(text))) fail(400, `${field} must be a valid date and time.`);
    return text.length === 16 ? text + ':00' : text;
  };
  const punchMarks = new Set(['P', 'AB', 'WO', 'CL', 'EL', 'SL', 'HLD', 'OD', 'WFH', 'HD', 'LOP']);
  const manualRecord = raw => {
    const employee = emp(raw.employee_code || raw.Employee_Code); const day = checkDay(raw.attendance_date);
    const shift = raw.shift || raw.sh_code;
    if (!state().masters['shift-times'].some(s => s.sh_code === shift)) fail(400, 'Select a valid local shift.');
    if (!punchMarks.has(raw.punch_mark)) fail(400, 'Select a valid local punch mark.');
    return { employee_code: employee.Employee_Code, attendance_date: day, display_name: employee.display_name, shift, sh_code: shift, punch_mark: raw.punch_mark, working_hours: duration(raw.working_hours || raw.work_hours, 'working_hours'), work_hours: duration(raw.working_hours || raw.work_hours, 'working_hours'), ot_hours: duration(raw.ot_hours, 'ot_hours'), in_punch: null, out_punch: null, remarks: String(raw.remarks || ''), created_by: 'demo', created_date: now(), attendance_source: 'LOCAL_MANUAL_MUSTER' };
  };
  const uniqueBatch = rows => { const keys = new Set(); for (const row of rows) { if (keys.has(key(row))) fail(409, 'The batch contains duplicate employee/date records.'); keys.add(key(row)); } };

  both('/api/attendance/getAtndMusterAll', report);
  both('/api/attendance/getAtndMusterByEmp', report);
  both('/api/attendance/printAtndReg', report);
  both('/api/attendance/printAtndReg2', report);
  both('/api/attendance/getManualMuster', body => {
    const range = body.pmonth || body.from_date || body.attendance_date ? checkRange(body) : null;
    return filtered(state().manualPunches.map(enrich), body).filter(row => !range || (ymd(row.attendance_date) >= range.from_date && ymd(row.attendance_date) <= range.to_date));
  });
  route('POST', '/api/attendance/addManualPunchMark', body => {
    const row = manualRecord(body.updatedArrear || body); if (state().manualPunches.some(old => key(old) === key(row))) fail(409, 'A manual muster entry already exists for this employee and date.');
    state().manualPunches.push(row); save(); return { ...success('Manual muster saved locally.'), record: enrich(row) };
  }, mutation);
  route('POST', '/api/attendance/updateManualPunchMark', body => {
    const row = manualRecord(body.updatedArrear || body); const index = state().manualPunches.findIndex(old => key(old) === key(row)); if (index < 0) fail(404, 'Local manual muster entry not found.');
    state().manualPunches[index] = { ...state().manualPunches[index], ...row, modified_date: now(), modified_by: 'demo' }; save(); return success('Manual muster updated locally.');
  }, mutation);
  route('POST', '/api/attendance/deleteManualPunchMark', body => {
    emp(body.employee_code); checkDay(body.attendance_date); const index = state().manualPunches.findIndex(old => key(old) === key(body)); if (index < 0) fail(404, 'Local manual muster entry not found.');
    state().manualPunches.splice(index, 1); save(); return success('Manual muster deleted locally.');
  }, mutation);
  route('POST', '/api/attendance/uploadManualMuster', body => {
    const rows = inputRows(body.muster, 'muster').map(manualRecord); uniqueBatch(rows);
    if (rows.some(row => state().manualPunches.some(old => key(old) === key(row)))) fail(409, 'An imported employee/date already has a manual muster entry. No rows were saved.');
    state().manualPunches.push(...rows); save(); return { ...success('Manual muster rows imported locally.'), insertedCount: rows.length, notInsertedRecords: [] };
  }, mutation);

  const regularisedRecord = (raw, previous) => {
    const employee = emp(raw.employee_code); const day = checkDay(raw.attendance_date || previous?.attendance_date);
    if (raw.contractor_id && raw.contractor_id !== employee.contractor_id) fail(400, 'Employee does not belong to the selected contractor.');
    const actual = report({ employee_code: employee.Employee_Code, from_date: day, to_date: day })[0];
    const input = raw.in_punch === undefined ? previous?.in_punch : raw.in_punch;
    const output = raw.out_punch === undefined ? previous?.out_punch : raw.out_punch;
    const inPunch = stamp(input, 'in_punch', day); const outPunch = stamp(output, 'out_punch', day);
    if (!inPunch && !outPunch) fail(400, 'At least one revised punch is required.');
    if (inPunch && ymd(inPunch) !== day) fail(400, 'The IN punch must be on the attendance date.');
    if (outPunch && (ymd(outPunch) < day || Date.parse(ymd(outPunch)) - Date.parse(day) > DAY)) fail(400, 'The OUT punch must be on the attendance date or following day.');
    if (inPunch && outPunch && Date.parse(outPunch) <= Date.parse(inPunch)) fail(400, 'The OUT punch must be after the IN punch.');
    const approved = raw.approved ?? previous?.approved ?? 'N'; if (!['Y', 'N'].includes(approved)) fail(400, 'approved must be Y or N.');
    return { ...previous, employee_code: employee.Employee_Code, attendance_date: day, contractor_id: employee.contractor_id, display_name: employee.display_name, in_punch_actual: previous?.in_punch_actual ?? actual?.in_punch ?? null, out_punch_actual: previous?.out_punch_actual ?? actual?.out_punch ?? null, in_punch: inPunch, out_punch: outPunch, elapsed_hours: inPunch && outPunch ? minutesText(Math.floor((Date.parse(outPunch) - Date.parse(inPunch)) / 60000)) : null, approved, approved_by: approved === 'Y' ? 'demo' : '', remarks: String(raw.remarks ?? previous?.remarks ?? ''), created_by: previous?.created_by || 'demo', created_date: previous?.created_date || now(), modified_by: previous ? 'demo' : '', modified_date: previous ? now() : null, demo: true };
  };
  both('/api/attendance/getRegularisedPunches', body => {
    const day = body.attendance_date ? checkDay(body.attendance_date) : null;
    return { recordset: filtered(state().regularisedPunches.map(row => ({ ...emp(row.employee_code), ...row })), body).filter(row => !day || ymd(row.attendance_date) === day), demo: true };
  });
  route('POST', '/api/attendance/addRegularisePunch', body => {
    const row = regularisedRecord(body); if (state().regularisedPunches.some(old => key(old) === key(row))) fail(409, 'A regularisation entry already exists for this employee and date.');
    state().regularisedPunches.push(row); save(); return { ...success('Punch regularisation saved locally.'), record: row };
  }, mutation);
  route('POST', '/api/attendance/updateRegularisePunch', body => {
    const day = checkDay(body.attendance_date); const index = state().regularisedPunches.findIndex(old => key(old) === key({ ...body, attendance_date: day })); if (index < 0) fail(404, 'Local regularisation entry not found.');
    const row = regularisedRecord(body, state().regularisedPunches[index]); state().regularisedPunches[index] = row; save(); return { ...success('Punch regularisation updated locally.'), record: row };
  }, mutation);
  route('POST', '/api/attendance/approveRegularisePunch', body => {
    checkDay(body.attendance_date); if (!['Y', 'N'].includes(body.approved)) fail(400, 'approved must be Y or N.');
    const row = state().regularisedPunches.find(old => key(old) === key(body)); if (!row) fail(404, 'Local regularisation entry not found.');
    row.approved = body.approved; row.approved_by = row.approved === 'Y' ? 'demo' : ''; row.modified_by = 'demo'; row.modified_date = now(); save(); return success('Local regularisation approval recorded.');
  }, mutation);
  route('POST', '/api/attendance/deleteRegularisePunch', body => {
    checkDay(body.attendance_date); const index = state().regularisedPunches.findIndex(old => key(old) === key(body)); if (index < 0) fail(404, 'Local regularisation entry not found.'); state().regularisedPunches.splice(index, 1); save(); return success();
  }, mutation);
  both('/api/attendance/ExpRegPunchDet', body => {
    const range = checkRange(body);
    return filtered(state().regularisedPunches.map(r => ({ ...enrich(r), ...r, in_punch: r.in_punch_actual, out_punch: r.out_punch_actual, reg_in_punch: r.in_punch, reg_out_punch: r.out_punch })), body).filter(row => ymd(row.attendance_date) >= range.from_date && ymd(row.attendance_date) <= range.to_date);
  });

  both('/api/attendance/getMusterDeptByContractor', body => report({ ...body, from_date: body.must_date, to_date: body.must_date }));
  route('POST', '/api/attendance/updateMusterDept', body => {
    const rows = inputRows(arr(body), 'Department update').map(raw => {
      const employee = emp(raw.employee_code || raw.EMPLOYEE_CODE); const day = checkDay(raw.attendance_date);
      const dept = raw.dept_code || raw.dept; const bu = raw.bu_code || raw.bu; const division = raw.div_code || raw.division;
      if (!state().employees.some(e => e.dept === dept) && !state().masters.departments?.some(d => d.dept_code === dept)) fail(400, 'Select a valid local department.');
      if (!state().masters['business-units'].some(b => b.bu_code === bu && (!raw.entity_code || b.entity_code === raw.entity_code))) fail(400, 'Select a valid local business unit and entity combination.');
      if (division && !state().masters.divisions.some(d => d.Div_code === division && (!raw.entity_code || d.entity_code === raw.entity_code))) fail(400, 'Select a valid local division and entity combination.');
      return { employee_code: employee.Employee_Code, attendance_date: day, dept_code: dept, dept, bu_code: bu, bu, entity_code: raw.entity_code || employee.entity_code, div_code: division || employee.division, modified_by: 'demo', modified_date: now() };
    }); uniqueBatch(rows);
    const updated = [...state().musterDepartments]; for (const row of rows) { const index = updated.findIndex(old => key(old) === key(row)); if (index < 0) updated.push(row); else updated[index] = row; }
    state().musterDepartments = updated; save(); return { ...success('Daily muster departments updated locally.'), updatedCount: rows.length, notInsertedRecords: [] };
  }, mutation);

  both('/api/attendance/getShGrpAlloc', () => state().shiftAllocations.map(r => ({ ...r, display_name: emp(r.employee_code).display_name })));
  const allocation = (body, update) => {
    emp(body.employee_code); const date = checkDay(body.sh_group_eff_from, 'sh_group_eff_from');
    if (!state().masters['shift-groups'].some(s => s.sh_group === body.sh_group)) fail(400, 'Select a valid local shift group.');
    if (body.weekly_off && !['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(body.weekly_off)) fail(400, 'weekly_off must be a weekday name.');
    const index = state().shiftAllocations.findIndex(r => r.employee_code === body.employee_code);
    if (update && index < 0) fail(404, 'Local employee shift allocation not found.'); if (!update && index >= 0) fail(409, 'Employee already has a local shift allocation; edit it instead.');
    const row = { ...(index >= 0 ? state().shiftAllocations[index] : {}), employee_code: body.employee_code, sh_group: body.sh_group, sh_group_eff_from: date, weekly_off: body.weekly_off || '', ...(update ? { modified_by: 'demo', modified_date: now() } : { created_by: 'demo', created_date: now() }) };
    if (index >= 0) state().shiftAllocations[index] = row; else state().shiftAllocations.push(row); save(); return success('Shift allocation saved locally.');
  };
  route('POST', '/api/attendance/addShGrpAlloc', body => allocation(body, false), mutation);
  route('PUT', '/api/attendance/updShGrpAlloc', body => allocation(body, true), mutation);

  const manpowerKeys = ['contractor_id', 'dept_code', 'bu_code', 'emp_type'];
  const manpowerMatch = (a, b) => manpowerKeys.every(k => a[k] === b[k]);
  both('/api/attendance/listApprovedManpower', body => {
    if (body.eff_date_from) checkDay(body.eff_date_from, 'eff_date_from'); if (body.eff_date_to) checkDay(body.eff_date_to, 'eff_date_to');
    if (body.eff_date_from && body.eff_date_to && body.eff_date_from > body.eff_date_to) fail(400, 'Effective date range is reversed.');
    return filtered(state().approvedManpower, body).filter(r => (!body.eff_date_from || ymd(r.eff_date) >= body.eff_date_from) && (!body.eff_date_to || ymd(r.eff_date) <= body.eff_date_to));
  });
  route('POST', '/api/attendance/addApprovedManpower', body => {
    required(body, manpowerKeys); if (!state().contractors.some(c => c.Contractor_ID === body.contractor_id)) fail(400, 'Select a valid local contractor.');
    if (!state().masters['business-units'].some(b => b.bu_code === body.bu_code)) fail(400, 'Select a valid local business unit.');
    if (!state().employees.some(e => e.dept === body.dept_code) && !state().masters.departments?.some(d => d.dept_code === body.dept_code)) fail(400, 'Select a valid local department.');
    if (!['SL', 'US', 'PR'].includes(body.emp_type)) fail(400, 'Select a valid local employee type.');
    const values = [body.approved_day, body.approved_night].map(Number); if (values.some(n => !Number.isSafeInteger(n) || n < 0)) fail(400, 'Approved manpower must be non-negative whole numbers.');
    if (state().approvedManpower.some(r => manpowerMatch(r, body))) fail(409, 'Approved manpower already exists for this contractor, department, business unit and type.');
    const row = Object.fromEntries(manpowerKeys.map(k => [k, body[k]])); Object.assign(row, { approved_day: values[0], approved_night: values[1], eff_date: body.eff_date ? checkDay(body.eff_date, 'eff_date') : null }); state().approvedManpower.push(row); save(); return success();
  }, mutation);
  route('POST', '/api/attendance/deleteApprovedManpower', body => { required(body, manpowerKeys); const index = state().approvedManpower.findIndex(r => manpowerMatch(r, body)); if (index < 0) fail(404, 'Local approved manpower record not found.'); state().approvedManpower.splice(index, 1); save(); return success(); }, mutation);
  const comparison = body => {
    const range = checkRange(body); const rows = report(body); const groups = new Map();
    for (let stamp = Date.parse(range.from_date); stamp <= Date.parse(range.to_date); stamp += DAY) {
      const day = new Date(stamp).toISOString().slice(0, 10); const dayRows = rows.filter(r => ymd(r.attendance_date) === day);
      const approved = filtered(state().approvedManpower, body).filter(r => !r.eff_date || ymd(r.eff_date) <= day);
      for (const entry of [...dayRows, ...approved]) {
        const identity = `${day}|${entry.contractor_id}|${entry.bu_code || entry.bu}|${entry.dept_code || entry.dept}|${entry.emp_type}`;
        if (groups.has(identity)) continue;
        const e = state().employees.find(e => e.contractor_id === entry.contractor_id && e.bu === (entry.bu_code || entry.bu) && e.dept === (entry.dept_code || entry.dept)) || {};
        const enriched = applyAttendanceOverrides(state(), [{ ...e, ...entry, employee_code: e.Employee_Code || '', attendance_date: day }])[0];
        const countRows = dayRows.filter(r => manpowerMatch({ ...r, dept_code: r.dept_code || r.dept, bu_code: r.bu_code || r.bu }, { ...entry, dept_code: entry.dept_code || entry.dept, bu_code: entry.bu_code || entry.bu }) && ['P', 'HD', 'OD', 'WFH'].includes(r.punch_mark));
        const approval = approved.find(r => manpowerMatch(r, { ...entry, dept_code: entry.dept_code || entry.dept, bu_code: entry.bu_code || entry.bu }));
        const dayCount = countRows.filter(r => (state().masters['shift-times'].find(s => s.sh_code === (r.shift || r.sh_code))?.shift_day_night || 'D') !== 'N').length;
        const nightCount = countRows.length - dayCount;
        groups.set(identity, { allocation_date: day.split('-').reverse().join('/'), attendance_date: day, contractor_id: entry.contractor_id, contractor_name: enriched.contractor_name, bu_code: entry.bu_code || entry.bu, bu_name: enriched.bu_name, dept_code: entry.dept_code || entry.dept, dept_name: enriched.dept_name, emp_type: entry.emp_type, entity_code: enriched.entity_code, entity_name: enriched.entity_name, approved_day: Number(approval?.approved_day || 0), approved_night: Number(approval?.approved_night || 0), approved_total: Number(approval?.approved_day || 0) + Number(approval?.approved_night || 0), day_cnt: dayCount, night_cnt: nightCount, total_cnt: countRows.length, demo: true });
      }
    }
    return [...groups.values()].sort((a, b) => `${a.contractor_name}|${a.bu_name}|${a.dept_name}|${a.attendance_date}`.localeCompare(`${b.contractor_name}|${b.bu_name}|${b.dept_name}|${b.attendance_date}`));
  };
  both('/api/attendance/getApprVsPresent', body => comparison({ ...body, to_date: body.from_date }));
  both('/api/attendance/getApprVsPresentPeriod', comparison);
  both('/api/attendance/printSummary', body => {
    const range = checkRange(body); const groups = new Map();
    for (const row of report(body)) {
      const id = `${row.contractor_id}|${row.bu_code}|${row.dept_code}`;
      if (!groups.has(id)) {
        const group = { contractor_id: row.contractor_id, contractor_name: row.contractor_name, bu_code: row.bu_code, bu_name: row.bu_name, dept_code: row.dept_code, dept_name: row.dept_name, Total: 0, demo: true };
        for (let day = Date.parse(range.from_date); day <= Date.parse(range.to_date); day += DAY) { const d = new Date(day).toISOString().slice(0, 10).split('-'); group[`${d[2]}-${d[1]}`] = 0; } groups.set(id, group);
      }
      if (['P', 'HD', 'OD', 'WFH'].includes(row.punch_mark)) { const d = ymd(row.attendance_date).split('-'); groups.get(id)[`${d[2]}-${d[1]}`]++; groups.get(id).Total++; }
    }
    return [...groups.values()].sort((a, b) => `${a.contractor_name}|${a.bu_name}|${a.dept_name}`.localeCompare(`${b.contractor_name}|${b.bu_name}|${b.dept_name}`));
  });

  both('/api/attendance/getEmpRequest', body => filtered(state().employeeRequests.map(row => ({ ...emp(row.employee_code), ...row })), body).filter(row => !body.status || row.status === body.status));
  route('POST', '/api/attendance/addEmpRequest', body => {
    const employee = emp(body.employee_code); required(body, ['request_type', 'reason']); const requestDate = checkDay(body.request_date, 'request_date'); const range = checkRange({ from_date: body.start_date, to_date: body.end_date });
    if (!['OD', 'WFH'].includes(body.request_type)) fail(400, 'request_type must be OD or WFH.');
    if (state().employeeRequests.some(r => r.employee_code === employee.Employee_Code && r.status !== 'REJECTED' && r.start_date <= range.to_date && r.end_date >= range.from_date)) fail(409, 'An overlapping local employee request already exists.');
    const row = { employee_code: employee.Employee_Code, request_id: nextId(state().employeeRequests, 'request_id'), request_date: requestDate, request_type: body.request_type, start_date: range.from_date, end_date: range.to_date, reason: String(body.reason).trim(), approver_id: body.approver_id || 'demo', status: 'PENDING', created_by: 'demo', created_date: now(), demo: true }; state().employeeRequests.push(row); save(); return row;
  }, mutation);
  route('POST', '/api/attendance/approveOrRejectEmpRequest', body => {
    if (!['approve', 'reject'].includes(body.action)) fail(400, 'action must be approve or reject.'); const row = state().employeeRequests.find(r => r.request_id === Number(body.request_id)); if (!row) fail(404, 'Local employee request not found.'); if (row.status !== 'PENDING') fail(409, 'This employee request has already been reviewed.');
    row.status = body.action === 'approve' ? 'APPROVED' : 'REJECTED'; row.reviewed_by = 'demo'; row.reviewed_date = now(); row.review_remarks = String(body.remarks || ''); save(); return { ...success('Employee request reviewed locally. Attendance credit awaits BFCL rules.'), record: row };
  }, mutation);

  route('POST', '/api/attendance/uploadManualPunches', body => {
    const rows = inputRows(body.punches, 'punches').map(raw => {
      const employee = emp(raw.employee_code || raw.EMPLOYEE_CODE); const text = stamp(raw.attendance_date_with_time || raw.ATTENDANCE_DATE_WITH_TIME, 'attendance_date_with_time'); if (!text) fail(400, 'attendance_date_with_time is required.');
      return { employee_code: employee.Employee_Code, attendance_date_with_time: text, attendance_date: ymd(text), biometricmachine_id: String(raw.biometricmachine_id || raw.BIOMETRICMACHINE_ID || 'LOCAL_IMPORT'), created_date: now(), source: 'LOCAL_MANUAL_IMPORT', status: 0 };
    });
    let insertedCount = 0; const existing = new Set(state().importedPunches.map(r => `${r.employee_code}|${r.attendance_date_with_time}`));
    for (const row of rows) { const id = `${row.employee_code}|${row.attendance_date_with_time}`; if (!existing.has(id)) { existing.add(id); state().importedPunches.push(row); insertedCount++; } }
    if (insertedCount) save(); return { ...success('Punch inputs imported into the local sandbox.'), insertedCount, duplicateCount: rows.length - insertedCount, notInsertedRecords: [] };
  }, mutation);
  both('/api/attendance/getPunchesDataByEmp', body => {
    const range = checkRange(body); validateCodeFilter(body);
    return filtered(state().importedPunches.map(row => ({ ...emp(row.employee_code), ...row })), body).filter(r => r.attendance_date >= range.from_date && r.attendance_date <= range.to_date).sort((a, b) => a.attendance_date_with_time.localeCompare(b.attendance_date_with_time)).map(r => ({ ...r, EMPLOYEE_CODE: r.employee_code, BIOMETRICMACHINE_ID: r.biometricmachine_id, ATTENDANCE_DATE_WITH_TIME: r.attendance_date_with_time, CREATED_DATE: r.created_date }));
  });
  const processInputs = body => {
    validateCodeFilter(body); const range = body.pmonth || body.from_date || body.attendance_date ? checkRange(body) : null;
    const inputs = filtered(state().importedPunches.map(r => ({ ...emp(r.employee_code), ...r })), body).filter(r => !range || (r.attendance_date >= range.from_date && r.attendance_date <= range.to_date));
    if (!inputs.length) fail(422, 'No locally imported punch inputs match the selection. Import sample punches first; no biometric or OS task was submitted.');
    const groups = new Map(); for (const input of inputs) { const id = key(input); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(input); }
    const processed = [...state().processedAttendance]; let changedCount = 0;
    for (const group of groups.values()) {
      group.sort((a, b) => Date.parse(a.attendance_date_with_time) - Date.parse(b.attendance_date_with_time)); const first = group[0]; const last = group.length > 1 ? group.at(-1) : null;
      const row = { employee_code: first.employee_code, attendance_date: first.attendance_date, in_punch: first.attendance_date_with_time, out_punch: last?.attendance_date_with_time || null, punch_mark: null, working_hours: null, work_hours: null, total_hours: null, elapsed_hours: last ? minutesText(Math.floor((Date.parse(last.attendance_date_with_time) - Date.parse(first.attendance_date_with_time)) / 60000)) : null, ot_hours: null, atnd_approved: 'N', hr_approved: 'N', attendance_source: 'LOCAL_IMPORTED_PUNCHES', rule_status: 'AWAITING_BFCL_ATTENDANCE_RULES' };
      const index = processed.findIndex(old => key(old) === key(row)); if (index < 0) { processed.push(row); changedCount++; } else if (JSON.stringify(processed[index]) !== JSON.stringify(row)) { processed[index] = row; changedCount++; }
    }
    state().processedAttendance = processed; for (const input of inputs) { const original = state().importedPunches.find(r => r.employee_code === input.employee_code && r.attendance_date_with_time === input.attendance_date_with_time); original.status = 1; }
    const job = { job_id: nextId(state().attendanceJobs, 'job_id'), task_name: 'LOCAL_IMPORTED_PUNCHES', status: 'COMPLETED_LOCAL_INPUT_SUMMARY', input_count: inputs.length, employee_days: groups.size, changed_count: changedCount, created_date: now(), completed_date: now(), rule_status: 'AWAITING_BFCL_ATTENDANCE_RULES', demo: true }; state().attendanceJobs.push(job); save();
    return { ...success('Local punch inputs summarized. Presence, paid hours, overtime and payroll credit await BFCL rules.'), jobId: job.job_id, job, processedCount: groups.size, changedCount, ruleStatus: job.rule_status };
  };
  route('POST', '/api/attendance/manualProcessAttendance', processInputs, mutation);
  route('POST', '/api/attendance/regenerateMuster', processInputs, mutation);
  route('POST', '/api/attendance/triggerTask', body => {
    if (!['LOCAL_IMPORTED_PUNCHES', 'ProcessPunchMark'].includes(body.taskName)) fail(422, 'Biometric and operating-system tasks are unavailable in this isolated replica. Use LOCAL_IMPORTED_PUNCHES to summarize local imported sample punches.');
    return processInputs(body);
  }, mutation);
  both('/api/attendance/jobs', () => state().attendanceJobs.slice().reverse());
  route('GET', '/api/attendance/jobs/:id', (body, params) => { const row = state().attendanceJobs.find(r => r.job_id === Number(params.id)); if (!row) fail(404, 'Local attendance job not found.'); return row; });

  both('/api/attendance/getSandwichRules', () => state().sandwichRules);
  const sandwichRecord = (body, previous = {}) => {
    const a = String(body.present_pattern || '').split('-'); const b = String(body.converted_pattern || '').split('-');
    if (a.length < 2 || a.length !== b.length || [...a, ...b].some(m => !punchMarks.has(m))) fail(400, 'Sandwich patterns require the same number of valid punch marks, at least two each.');
    if (state().sandwichRules.some(r => r.rule_id !== previous.rule_id && r.present_pattern === body.present_pattern)) fail(409, 'A local draft rule for this present pattern already exists.');
    return { ...previous, rule_id: previous.rule_id || nextId(state().sandwichRules, 'rule_id'), present_pattern: body.present_pattern, converted_pattern: body.converted_pattern, created_by: previous.created_by || 'demo', created_date: previous.created_date || now(), status: 'DRAFT_AWAITING_BFCL_RULES', demo: true };
  };
  route('POST', '/api/attendance/addSandwichRule', body => { const row = sandwichRecord(body); state().sandwichRules.push(row); save(); return success('Draft sandwich rule saved locally; processing awaits BFCL policy.'); }, mutation);
  route('POST', '/api/attendance/updateSandwichRule', body => { const index = state().sandwichRules.findIndex(r => r.rule_id === Number(body.rule_id)); if (index < 0) fail(404, 'Local sandwich rule not found.'); const row = sandwichRecord(body, state().sandwichRules[index]); state().sandwichRules[index] = row; save(); return success(); }, mutation);
  route('POST', '/api/attendance/deleteSandwichRule', body => { const index = state().sandwichRules.findIndex(r => r.rule_id === Number(body.rule_id)); if (index < 0) fail(404, 'Local sandwich rule not found.'); state().sandwichRules.splice(index, 1); save(); return success(); }, mutation);
  route('POST', '/api/attendance/runSandwich', () => fail(422, 'BFCL sandwich rules are required before processing: applicable worker groups, effective dates, holiday/weekly-off treatment, qualifying absence/leave patterns, exceptions, approval authority and payroll effects. Draft local patterns do not authorize attendance changes.'), mutation);
}
