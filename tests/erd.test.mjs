// Holds docs/erd to the real system. The ERD is only useful to testers if it is true, so this test:
//   1. fails when a state collection exists that the catalogue does not describe (or the reverse),
//   2. checks every documented reference against seeded + scenario data,
//   3. attacks each reference through the API to prove the "Enforcement" column (what is rejected, what is silently accepted),
//   4. fails when the committed docs/erd files no longer match the generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { populate } from '../scripts/lib/populate.mjs';
import { ENTITIES, RELATIONSHIPS } from '../scripts/lib/erd-catalogue.mjs';
import { builtInLists, checkIntegrity, coverage } from '../scripts/lib/erd-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let scenario;
test.before(async () => { scenario = await populate(); });
test.after(async () => { await scenario?.close(); });

test('ERD-01 the sample scenario creates a record in every collection through the API', () => {
  assert.deepEqual(scenario.steps.filter(s => s.status >= 400), []);
  const empty = ENTITIES.filter(e => !e.implicit && !e.reserved && e.stateKey).filter(e => {
    const value = e.stateKey.split('.').reduce((v, k) => v?.[k], scenario.state);
    return Array.isArray(value) ? value.length === 0 : !value || Object.keys(value).length === 0;
  }).map(e => e.id);
  assert.deepEqual(empty, [], 'every documented collection has at least one record, so its columns were observed');
});

test('ERD-02 every state collection is in the catalogue and every catalogued collection exists', () => {
  const { unclaimed, missing } = coverage(scenario.state);
  assert.deepEqual(unclaimed, [], 'a new collection needs an entry in scripts/lib/erd-catalogue.mjs');
  assert.deepEqual(missing, []);
  assert.equal(new Set(ENTITIES.map(e => e.id)).size, ENTITIES.length, 'entity ids are unique');
  for (const rel of RELATIONSHIPS) { assert.ok(ENTITIES.some(e => e.id === rel.from) && ENTITIES.some(e => e.id === rel.to), `${rel.from} -> ${rel.to} names real entities`); assert.equal(rel.fields.length, rel.toFields.length); }
});

test('ERD-03 no reference in the sample data points at a missing record (except those documented as dangling by design)', async () => {
  const ctx = { state: scenario.state, lists: await builtInLists(scenario.call, scenario.state) };
  const hard = checkIntegrity(ctx).filter(r => r.dangling.length && !r.soft).map(r => `${r.from}.${r.fields} -> ${r.to}: ${r.dangling.join('; ')}`);
  assert.deepEqual(hard, []);
});

// ---------------------------------------------------------------- the Enforcement column, attacked through the API
const base = { Employee_Code: 'E-VIOL', display_name: 'Fictional Violation', contractor_id: 'D001', dept: 'D01', bu: 'B01', entity_code: 'E01' };
const muster = { employee_code: 'DEMO001', attendance_date: '2026-10-20', shift: 'GEN', punch_mark: 'P', working_hours: '08:00', ot_hours: '00:00' };
const adjustment = extra => ({ employee_code: 'DEMO001', pmonth: '2026-11-01', billingType: 'M', ernCode: 'DEMO', ernValue: 5, dedCode: 'DEMO', dedValue: 5, arrearCode: 'DEMO', arrearValue: 5, arrearRefPmonth: '2026-10-01', ...extra });
const rule = extra => ({ ContractorID: 'D001', entity_code: 'E01', RuleType: 'EmployeeCode', EmployeeCode: 'DEMO001', Eff_PMonth: '2026-11-01', rate: 3, ...extra });
const leave = extra => ({ employee_code: 'DEMO002', leave_period_id: 1, leave_type_code: 'CL', leave_nature: 'FULL', request_date: '2026-11-02', from_date: '2026-11-02', to_date: '2026-11-02', total_days: 1, reason: 'x', ...extra });
const ledger = extra => ({ rows: [{ employee_code: 'DEMO001', leave_type_code: 'CL', trans_type: 'CREDIT', pmonth: '2026-10-01', leave_days: 1, ...extra }] });
const manpower = extra => ({ contractor_id: 'D002', dept_code: 'D02', bu_code: 'B01', emp_type: 'US', approved_day: 1, approved_night: 0, ...extra });

// [relationship label, API path, body (valid except for the one reference), expectation]
const ATTACKS = [
  ['Employee.contractor_id', '/api/employee/addEmployee', { ...base, contractor_id: 'NOPE' }, 'reject'],
  ['Employee.dept', '/api/employee/addEmployee', { ...base, dept: 'D99' }, 'reject'],
  ['Employee.bu', '/api/employee/addEmployee', { ...base, bu: 'B99' }, 'reject'],
  ['Employee.entity_code', '/api/employee/addEmployee', { ...base, entity_code: 'E99' }, 'reject'],
  ['Employee.design_code', '/api/employee/addEmployee', { ...base, Employee_Code: 'E-D1', design_code: 'ZZZ' }, 'accept'],
  ['Employee.emp_type', '/api/employee/addEmployee', { ...base, Employee_Code: 'E-D2', emp_type: 'ZZ' }, 'accept'],
  ['Employee.loc_code', '/api/employee/addEmployee', { ...base, Employee_Code: 'E-D3', loc_code: 'L99' }, 'accept'],
  ['ShiftAllocation.employee_code', '/api/attendance/addShGrpAlloc', { employee_code: 'NOPE', sh_group: 'G1', sh_group_eff_from: '2026-10-01' }, 'reject'],
  ['ShiftAllocation.sh_group', '/api/attendance/addShGrpAlloc', { employee_code: 'DEMO002', sh_group: 'NOPE', sh_group_eff_from: '2026-10-01' }, 'reject'],
  ['ApprovedManpower.contractor_id', '/api/attendance/addApprovedManpower', manpower({ contractor_id: 'NOPE' }), 'reject'],
  ['ApprovedManpower.dept_code', '/api/attendance/addApprovedManpower', manpower({ dept_code: 'NOPE' }), 'reject'],
  ['ApprovedManpower.bu_code', '/api/attendance/addApprovedManpower', manpower({ bu_code: 'NOPE' }), 'reject'],
  ['ApprovedManpower.emp_type', '/api/attendance/addApprovedManpower', manpower({ emp_type: 'XX' }), 'reject'],
  ['ManualMusterEntry.employee_code', '/api/attendance/addManualPunchMark', { ...muster, employee_code: 'NOPE' }, 'reject'],
  ['ManualMusterEntry.shift', '/api/attendance/addManualPunchMark', { ...muster, shift: 'NOT-A-SHIFT' }, 'reject'],
  ['RegularisedPunch.employee_code', '/api/attendance/addRegularisePunch', { employee_code: 'NOPE', contractor_id: 'D001', attendance_date: '2026-10-20', in_punch: '2026-10-20T09:00', out_punch: '2026-10-20T17:00' }, 'reject'],
  ['RegularisedPunch.contractor_id', '/api/attendance/addRegularisePunch', { employee_code: 'DEMO003', contractor_id: 'D001', attendance_date: '2026-10-20', in_punch: '2026-10-20T09:00', out_punch: '2026-10-20T17:00' }, 'reject'],
  ['MusterDepartment.employee_code', '/api/attendance/updateMusterDept', [{ employee_code: 'NOPE', attendance_date: '2026-10-20', dept_code: 'D01', bu_code: 'B01' }], 'reject'],
  ['MusterDepartment.dept_code', '/api/attendance/updateMusterDept', [{ employee_code: 'DEMO001', attendance_date: '2026-10-20', dept_code: 'NOPE', bu_code: 'B01', entity_code: 'E01' }], 'reject'],
  ['MusterDepartment.bu_code', '/api/attendance/updateMusterDept', [{ employee_code: 'DEMO001', attendance_date: '2026-10-20', dept_code: 'D01', bu_code: 'NOPE' }], 'reject'],
  ['MusterDepartment.entity_code', '/api/attendance/updateMusterDept', [{ employee_code: 'DEMO001', attendance_date: '2026-10-20', dept_code: 'D01', bu_code: 'B01', entity_code: 'E99' }], 'reject'],
  ['MusterDepartment.div_code', '/api/attendance/updateMusterDept', [{ employee_code: 'DEMO001', attendance_date: '2026-10-20', dept_code: 'D01', bu_code: 'B01', entity_code: 'E01', div_code: 'NOPE' }], 'reject'],
  ['ImportedPunch.employee_code', '/api/attendance/uploadManualPunches', { punches: [{ employee_code: 'NOPE', attendance_date_with_time: '2026-10-20T08:00:00' }] }, 'reject'],
  ['EmployeeRequest.employee_code', '/api/attendance/addEmpRequest', { employee_code: 'NOPE', request_type: 'OD', request_date: '2026-10-20', start_date: '2026-10-21', end_date: '2026-10-21', reason: 'x' }, 'reject'],
  ['LeaveApplication.employee_code', '/api/leave/addLeave', leave({ employee_code: 'NOPE' }), 'reject'],
  ['LeaveApplication.leave_type_code', '/api/leave/addLeave', leave({ leave_type_code: 'XX' }), 'reject'],
  ['LeaveLedgerEntry.employee_code', '/api/leave/save-bulk', ledger({ employee_code: 'NOPE' }), 'reject'],
  ['LeaveLedgerEntry.leave_type_code', '/api/leave/save-bulk', ledger({ leave_type_code: 'XX' }), 'reject'],
  ['LeaveLedgerEntry.trans_type', '/api/leave/save-bulk', ledger({ trans_type: 'XX' }), 'reject'],
  ['FixedWage.EmployeeCode', '/api/wages/addFixWages', { EmployeeCode: 'NOPE', BillingType: 'M', eff_date: '2026-11-01', BasicRate: 1 }, 'reject'],
  ['WageEarning.employee_code', '/api/wages/addWageEarnings', adjustment({ employee_code: 'NOPE' }), 'reject'],
  ['WageEarning.pmonth', '/api/wages/addWageEarnings', adjustment({ pmonth: '2031-01-01' }), 'reject'],
  ['WageDeduction.employee_code', '/api/wages/addWageDeductions', adjustment({ employee_code: 'NOPE' }), 'reject'],
  ['WageDeduction.pmonth', '/api/wages/addWageDeductions', adjustment({ pmonth: '2031-01-01' }), 'reject'],
  ['WageArrear.employee_code', '/api/wages/addWageArrears', adjustment({ employee_code: 'NOPE' }), 'reject'],
  ['WageArrear.pmonth', '/api/wages/addWageArrears', adjustment({ pmonth: '2031-01-01' }), 'reject'],
  ['WageArrear.arrearRefPmonth', '/api/wages/addWageArrears', adjustment({ arrearRefPmonth: '2031-01-01' }), 'reject'],
  ['ServiceChargeRule.ContractorID', '/api/wages/addServiceCharges', rule({ ContractorID: 'NOPE' }), 'reject'],
  ['ServiceChargeRule.EmployeeCode', '/api/wages/addServiceCharges', rule({ EmployeeCode: 'NOPE' }), 'reject'],
  ['ServiceChargeRule.DesignCode', '/api/wages/addServiceCharges', rule({ RuleType: 'Designation', EmployeeCode: undefined, DesignCode: 'NOPE' }), 'reject'],
  ['ServiceChargeRule.BuCode', '/api/wages/addServiceCharges', rule({ RuleType: 'BuCode', EmployeeCode: undefined, BuCode: 'NOPE' }), 'reject'],
  ['ServiceChargeRule.entity_code', '/api/wages/addServiceCharges', rule({ entity_code: 'E99', EmployeeCode: 'DEMO002' }), 'reject'],
  ['WageProcessLock.pmonth', '/api/wages/addWageProcessLock', { pmonth: '2031-01-01', billingType: 'M', entityCode: 'E01', ContractorId: 'D001' }, 'reject'],
  ['WageProcessLock.ContractorId', '/api/wages/addWageProcessLock', { pmonth: '2026-11-01', billingType: 'M', entityCode: 'E01', ContractorId: 'D99' }, 'reject'],
  ['WageProcessLock.entityCode', '/api/wages/addWageProcessLock', { pmonth: '2026-11-01', billingType: 'M', entityCode: 'E99', ContractorId: 'D001' }, 'reject'],
  ['BusinessUnit.entity_code', '/api/master-data/business-units', { bu_code: 'B-VIOL', bu_name: 'x', entity_code: 'E99' }, 'accept'],
  ['Holiday.contractor_id', '/api/master-data/holidays', { hol_date: '2026-12-25', hol_name: 'x', contractor_id: 'D99' }, 'accept'],
  ['RoleAssignment.emp_id', '/api/assignRoles/saveAll', { emp_code: 'ghost-user', roles: { BU: [], Contractor: [], Dept: [], Menu: [], Location: [], MenuActivity: [] } }, 'reject'],
];

// Each rejected payload above is valid except for its one bad reference. These controls prove that: the same call with
// good references succeeds, so a rejection can only be about the reference (otherwise "reject" would pass vacuously).
const CONTROLS = [
  ['/api/employee/addEmployee', base],
  ['/api/attendance/addShGrpAlloc', { employee_code: 'DEMO002', sh_group: 'G1', sh_group_eff_from: '2026-10-01' }],
  ['/api/attendance/addApprovedManpower', manpower()],
  ['/api/attendance/addManualPunchMark', muster],
  ['/api/attendance/addRegularisePunch', { employee_code: 'DEMO001', contractor_id: 'D001', attendance_date: '2026-10-20', in_punch: '2026-10-20T09:00', out_punch: '2026-10-20T17:00' }],
  ['/api/attendance/updateMusterDept', [{ employee_code: 'DEMO001', attendance_date: '2026-10-20', dept_code: 'D01', bu_code: 'B01', entity_code: 'E01', div_code: 'DV' }]],
  ['/api/attendance/uploadManualPunches', { punches: [{ employee_code: 'DEMO001', attendance_date_with_time: '2026-10-20T08:00:00' }] }],
  ['/api/attendance/addEmpRequest', { employee_code: 'DEMO001', request_type: 'OD', request_date: '2026-10-20', start_date: '2026-10-21', end_date: '2026-10-21', reason: 'x' }],
  ['/api/leave/addLeave', leave()],
  ['/api/leave/save-bulk', ledger()],
  ['/api/wages/addFixWages', { EmployeeCode: 'DEMO002', BillingType: 'M', eff_date: '2026-11-01', BasicRate: 1 }],
  ['/api/wages/addWageEarnings', adjustment()], ['/api/wages/addWageDeductions', adjustment()], ['/api/wages/addWageArrears', adjustment()],
  ['/api/wages/addServiceCharges', rule()],
  ['/api/wages/addServiceCharges', rule({ RuleType: 'Designation', EmployeeCode: undefined, DesignCode: 'OP' })],
  ['/api/wages/addServiceCharges', rule({ RuleType: 'BuCode', EmployeeCode: undefined, BuCode: 'B01' })],
  ['/api/wages/addWageProcessLock', { pmonth: '2026-11-01', billingType: 'M', entityCode: 'E01', ContractorId: 'D001' }],
  ['/api/assignRoles/saveAll', { emp_code: 'clerk1', roles: { BU: [], Contractor: [], Dept: [], Menu: [], Location: [], MenuActivity: [] } }],
];
for (const [apiPath, body] of CONTROLS) {
  test(`ERD-04c control ${apiPath} ${JSON.stringify(body).slice(0, 60)}: the same call with good references succeeds`, async () => {
    const fresh = await populate();
    try { const response = await fresh.call(apiPath, body); assert.equal(response.status, 200, `${response.status} ${response.data?.message}`); } finally { await fresh.close(); }
  });
}

for (const [label, apiPath, body, expectation] of ATTACKS) {
  test(`ERD-04 ${label}: a bad value is ${expectation === 'reject' ? 'rejected' : 'accepted and stored (not enforced)'}`, async () => {
    const fresh = await populate();
    try {
      const response = await fresh.call(apiPath, body);
      if (expectation === 'reject') assert.ok(response.status >= 400 && response.status < 500, `${label}: expected a 4xx, got ${response.status} ${response.data?.message}`);
      else assert.equal(response.status, 200, `${label}: documented as not enforced, but got ${response.status} ${response.data?.message}`);
    } finally { await fresh.close(); }
  });
}

test('ERD-05 every reference documented as checked has an attack above (or says it is unverified)', () => {
  const attacked = new Set(ATTACKS.map(([label]) => label.toLowerCase()));
  const untested = RELATIONSHIPS.filter(r => ['create', 'both'].includes(r.enforced) && !r.unverified && !attacked.has(`${r.from}.${r.fields[0]}`.toLowerCase())).map(r => `${r.from}.${r.fields.join('+')}`);
  assert.deepEqual(untested, [], 'add an attack row for these references, or mark them unverified in the catalogue');
});

// ---------------------------------------------------------------- delete protection of masters
const IN_USE = [
  ['business-units', { bu_code: 'B01' }], ['locations', { loc_code: 'L01' }], ['cost-centres', { COST_CODE: 'C01' }],
  ['divisions', { Div_code: 'DV', entity_code: 'E01' }], ['shift-groups', { sh_group: 'G1' }], ['cities', { city_code: 'DC', state_code: 'DM' }],
];
for (const [master, keys] of IN_USE) {
  test(`ERD-06 master ${master}: a record that is still referenced cannot be deleted`, async () => {
    const fresh = await populate();
    try {
      const seeded = fresh.state.masters[master].some(row => Object.entries(keys).every(([k, v]) => row[k] === v));
      assert.ok(seeded, `${master} ${JSON.stringify(keys)} exists in the seed`);
      const response = await fresh.call('/api/master-data/' + master, { keys }, 'DELETE');
      assert.equal(response.status, 409, `${master}: ${response.status} ${response.data?.message}`);
    } finally { await fresh.close(); }
  });
}

// ---------------------------------------------------------------- the committed documents match the generator
test('ERD-07 docs/erd is current (run `node scripts/erd.mjs` after changing the model or the data shapes)', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/erd.mjs'), '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const name of ['ERD.md', 'DATA-DICTIONARY.md']) assert.ok(fs.statSync(path.join(root, 'docs/erd', name)).size > 1000, name + ' is not empty');
});
