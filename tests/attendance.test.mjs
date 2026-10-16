import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../server/seed.mjs';
import { registerAttendanceRoutes, applyAttendanceOverrides } from '../server/modules/attendance.mjs';

// Exercise the module's public contracts with a replaceable state context.
function fixture() {
  let data = seedState(); let saves = 0; const routes = new Map();
  const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
  const route = (method, path, handler) => routes.set(method + ' ' + path.toLowerCase(), handler);
  const attendance = (state, q) => state.employees.flatMap(e => {
    const rows = []; for (let day = Date.parse(q.from_date); day <= Date.parse(q.to_date); day += 86400000) { const date = new Date(day).toISOString().slice(0, 10); rows.push({ ...e, employee_code: e.Employee_Code, attendance_date: date, shift: 'GEN', sh_group: 'G1', punch_mark: 'P', in_punch: date + 'T08:00:00', out_punch: date + 'T17:00:00', work_hours: '08:00', ot_hours: '00:00' }); } return rows;
  });
  registerAttendanceRoutes({ route, both: (path, handler, opts) => { route('GET', path, handler, opts); route('POST', path, handler, opts); }, getState: () => data, save: () => saves++, fail, required: (row, fields) => { for (const field of fields) if (row[field] === undefined || row[field] === null || row[field] === '') fail(400, field + ' is required.'); }, nextId: (rows, field) => Math.max(0, ...rows.map(r => Number(r[field]) || 0)) + 1, attendance, success: message => ({ success: true, demo: true, message }) });
  return { call: (path, body = {}, method = 'POST') => { const handler = routes.get(method + ' /api/attendance/' + path.toLowerCase()); assert.ok(handler, 'registered route ' + path); return handler(body, {}); }, state: () => data, saves: () => saves, reset: () => { data = seedState(); }, report: (body = {}) => routes.get('POST /api/attendance/printatndreg2')({ from_date: '2026-10-01', to_date: '2026-10-02', ...body }) };
}
const rejects = (fn, status, pattern) => assert.throws(fn, error => error.status === status && (!pattern || pattern.test(error.message)));
const manual = (extra = {}) => ({ employee_code: 'DEMO001', attendance_date: '2026-10-01', shift: 'GEN', punch_mark: 'AB', working_hours: '00:00', ot_hours: '00:00', ...extra });

test('manual muster edits and deletes affect reports without changing employee masters', () => {
  const f = fixture(); const original = structuredClone(f.state().employees[0]);
  f.call('addManualPunchMark', { updatedArrear: manual() });
  assert.equal(f.report({ employee_code: 'DEMO001' })[0].punch_mark, 'AB');
  assert.equal(f.report({ employee_code: 'DEMO001' })[0].in_punch, null);
  rejects(() => f.call('addManualPunchMark', manual()), 409);
  f.call('updateManualPunchMark', manual({ punch_mark: 'P', working_hours: '07:30' }));
  assert.equal(f.report({ employee_code: 'DEMO001' })[0].working_hours, '07:30');
  f.call('deleteManualPunchMark', manual());
  assert.equal(f.report({ employee_code: 'DEMO001' })[0].attendance_source, 'LOCAL_SYNTHETIC_FIXTURE');
  rejects(() => f.call('deleteManualPunchMark', manual()), 404);
  assert.deepEqual(f.state().employees[0], original);
});

test('attendance imports validate all rows atomically, including calendar dates and unknown workers', () => {
  const f = fixture();
  rejects(() => f.call('uploadManualMuster', { muster: [manual(), manual({ employee_code: 'UNKNOWN' })] }), 404);
  assert.equal(f.state().manualPunches.length, 0); assert.equal(f.saves(), 0);
  rejects(() => f.call('addManualPunchMark', manual({ attendance_date: '2026-02-30' })), 400);
  rejects(() => f.call('addManualPunchMark', manual({ working_hours: '08:99' })), 400);
  rejects(() => f.call('uploadManualMuster', { muster: [manual(), manual()] }), 409);
  assert.equal(f.state().manualPunches.length, 0);
  const imported = f.call('uploadManualMuster', { muster: [manual(), manual({ employee_code: 'DEMO002' })] });
  assert.equal(imported.insertedCount, 2);
  assert.equal(f.call('getManualMuster', { pmonth: '2026-10-01', billingType: 'M' }).length, 2);
  assert.equal(f.call('getManualMuster', { pmonth: '2026-09-01' }).length, 0);
});

test('regularisation stays pending until approval and failed updates preserve the prior record', () => {
  const f = fixture(); const body = { employee_code: 'DEMO001', contractor_id: 'D001', attendance_date: '2026-10-01', in_punch: '2026-10-01T09:00', out_punch: '2026-10-01T16:00', approved: 'N' };
  f.call('addRegularisePunch', body);
  assert.equal(f.call('getRegularisedPunches', { attendance_date: body.attendance_date, contractor_id: 'D001' }).recordset.length, 1);
  assert.match(f.report({ employee_code: 'DEMO001' })[0].in_punch, /08:00/);
  const saved = structuredClone(f.state().regularisedPunches);
  rejects(() => f.call('updateRegularisePunch', { ...body, out_punch: '2026-10-01T08:00' }), 400);
  assert.deepEqual(f.state().regularisedPunches, saved);
  f.call('approveRegularisePunch', { ...body, approved: 'Y' });
  const row = f.report({ employee_code: 'DEMO001' })[0];
  assert.match(row.in_punch, /09:00/); assert.equal(row.elapsed_hours, '07:00');
  assert.equal(row.work_hours, '08:00', 'elapsed time does not invent paid/net-hour rules');
  const exported = f.call('ExpRegPunchDet', { from_date: '2026-10-01', to_date: '2026-10-01', contractor: ['D001'] });
  assert.match(exported[0].in_punch, /08:00/); assert.match(exported[0].reg_in_punch, /09:00/);
  f.call('approveRegularisePunch', { ...body, approved: 'N' });
  assert.match(f.report({ employee_code: 'DEMO001' })[0].in_punch, /08:00/);
  rejects(() => f.call('addRegularisePunch', { ...body, employee_code: 'DEMO003' }), 400, /contractor/);
});

test('muster department batches validate completely and remain date-specific', () => {
  const f = fixture(); const first = { employee_code: 'DEMO001', attendance_date: '2026-10-01', entity_code: 'E01', bu_code: 'B01', dept_code: 'D02', div_code: 'DV' };
  rejects(() => f.call('updateMusterDept', [first, { ...first, employee_code: 'DEMO002', dept_code: 'BAD' }]), 400);
  assert.equal(f.state().musterDepartments.length, 0);
  assert.equal(f.call('updateMusterDept', { 0: first }).updatedCount, 1);
  const rows = f.report({ employee_code: 'DEMO001' });
  assert.equal(rows[0].dept_code, 'D02'); assert.equal(rows[1].dept_code, 'D01'); assert.equal(f.state().employees[0].dept, 'D01');
});

test('report selections, dates, daily comparisons and dynamic summaries use the same saved attendance', () => {
  const f = fixture(); f.call('addManualPunchMark', manual());
  assert.equal(f.report({ contractor: ['D001'], department: ['D01'], entity: ['E01'], bu: ['B01'], locCode: ['L01'], emp_type: ['SL'] }).length, 4);
  assert.equal(f.report({ contractor: ['D002'], department: ['D01'] }).length, 0);
  rejects(() => f.report({ employee_code: 'BAD' }), 404);
  rejects(() => f.report({ from_date: '2026-10-03', to_date: '2026-10-01' }), 400);
  rejects(() => f.report({ from_date: '2026-01-01', to_date: '2026-12-31' }), 400);
  const rows = f.call('getApprVsPresentPeriod', { from_date: '2026-10-01', to_date: '2026-10-02', emp_type: ['SL'] });
  assert.equal(rows.length, 4);
  const d1 = rows.find(r => r.contractor_id === 'D001' && r.attendance_date === '2026-10-01'); assert.equal(d1.total_cnt, 1); assert.equal(d1.approved_total, 8); assert.equal(d1.allocation_date, '01/10/2026');
  const summary = f.call('printSummary', { from_date: '2026-10-01', to_date: '2026-10-02', contractor: ['D001'] });
  assert.equal(summary.length, 1); assert.equal(summary[0]['01-10'], 1); assert.equal(summary[0]['02-10'], 2); assert.equal(summary[0].Total, 3);
});

test('manpower effective dates, whole-number counts and delete failures are enforced', () => {
  const f = fixture(); const row = { contractor_id: 'D002', dept_code: 'D02', bu_code: 'B01', emp_type: 'SL', approved_day: 3, approved_night: 1, eff_date: '2026-10-02' };
  rejects(() => f.call('addApprovedManpower', { ...row, approved_day: 1.5 }), 400);
  f.call('addApprovedManpower', row); rejects(() => f.call('addApprovedManpower', row), 409);
  const compared = f.call('getApprVsPresentPeriod', { from_date: '2026-10-01', to_date: '2026-10-02', contractor_id: 'D002' });
  assert.equal(compared[0].approved_total, 0); assert.equal(compared[1].approved_total, 4);
  assert.equal(f.call('listApprovedManpower', { eff_date_from: '2026-10-01' }).length, 1);
  f.call('deleteApprovedManpower', row); rejects(() => f.call('deleteApprovedManpower', row), 404);
});

test('local punch import and reprocessing are idempotent and cannot claim biometric or paid-hour success', () => {
  const f = fixture(); const punches = [{ employee_code: 'DEMO001', attendance_date_with_time: '2026-10-01 08:00' }, { employee_code: 'DEMO001', attendance_date_with_time: '2026-10-01 17:00' }];
  rejects(() => f.call('triggerTask', { taskName: 'process_biometric' }), 422, /Biometric/);
  rejects(() => f.call('manualProcessAttendance', {}), 422, /No locally imported/);
  rejects(() => f.call('uploadManualPunches', { punches: [...punches, { employee_code: 'BAD', attendance_date_with_time: '2026-10-01 09:00' }] }), 404);
  assert.equal(f.state().importedPunches.length, 0);
  assert.equal(f.call('uploadManualPunches', { punches }).insertedCount, 2);
  assert.equal(f.call('uploadManualPunches', { punches }).duplicateCount, 2);
  assert.equal(f.call('manualProcessAttendance', {}).changedCount, 1);
  const processed = f.report({ employee_code: 'DEMO001' })[0];
  assert.equal(processed.elapsed_hours, '09:00'); assert.equal(processed.punch_mark, null); assert.equal(processed.ot_hours, null); assert.equal(processed.rule_status, 'AWAITING_BFCL_ATTENDANCE_RULES');
  assert.equal(f.call('regenerateMuster', { pmonth: '2026-10-01', employeeCode: 'DEMO001' }).changedCount, 0);
  assert.equal(f.state().processedAttendance.length, 1); assert.equal(f.state().attendanceJobs.length, 2);
  assert.equal(f.call('getPunchesDataByEmp', { emp_code: 'DEMO001', from_date: '2026-10-01', to_date: '2026-10-01' })[0].EMPLOYEE_CODE, 'DEMO001');
});

test('request reviews and sandwich drafts require explicit valid transitions and BFCL rules', () => {
  const f = fixture(); const row = f.call('addEmpRequest', { employee_code: 'DEMO001', request_date: '2026-10-01', request_type: 'OD', start_date: '2026-10-02', end_date: '2026-10-03', reason: 'Fictional workshop visit' });
  assert.equal(row.status, 'PENDING');
  rejects(() => f.call('addEmpRequest', { ...row }), 409);
  f.call('approveOrRejectEmpRequest', { request_id: row.request_id, action: 'approve' });
  assert.equal(f.state().employeeRequests[0].status, 'APPROVED');
  rejects(() => f.call('approveOrRejectEmpRequest', { request_id: row.request_id, action: 'reject' }), 409);
  assert.equal(f.state().manualPunches.length, 0, 'request approval does not assume BFCL attendance credit');
  rejects(() => f.call('addSandwichRule', { present_pattern: 'AB-WO-AB', converted_pattern: 'AB-AB' }), 400);
  f.call('addSandwichRule', { present_pattern: 'AB-WO-AB', converted_pattern: 'AB-AB-AB' });
  const before = structuredClone(f.state()); rejects(() => f.call('runSandwich', {}), 422, /BFCL sandwich rules/); assert.deepEqual(f.state(), before);
});

test('module reads replacement state after reset and applies effective allocations', () => {
  const f = fixture(); f.call('addManualPunchMark', manual());
  f.call('addShGrpAlloc', { employee_code: 'DEMO001', sh_group: 'G1', sh_group_eff_from: '2026-10-02', weekly_off: 'Tuesday' });
  assert.equal(f.report({ employee_code: 'DEMO001' })[1].weekly_off, 'Tuesday');
  rejects(() => f.call('updShGrpAlloc', { employee_code: 'DEMO002', sh_group: 'G1', sh_group_eff_from: '2026-10-01' }, 'PUT'), 404);
  f.reset(); assert.equal(f.call('getManualMuster').length, 0); assert.equal(f.call('getShGrpAlloc').length, 0);
  assert.equal(applyAttendanceOverrides(f.state(), [f.state().employees[0]]).length, 1);
});
