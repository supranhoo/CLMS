// Builds a fully populated replica state by driving the real API (so every record passes the server's own validation).
// Used by the ERD generator and by the data-integrity test: a collection that is empty in the seed (leaves, earnings,
// punches ...) still gets real rows, which is the only way to observe its shape and check its references.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createServer } from '../../server/index.mjs';

export async function populate() {
  const server = createServer({ dataDir: mkdtempSync(path.join(tmpdir(), 'clms-populate-')), persist: false });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  let token;
  const call = async (p, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`http://127.0.0.1:${port}${p}`, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  token = (await call('/api/users/login', { emp_id: 'demo', password: 'demo123' })).data.token;
  const steps = [];
  const step = async (name, p, body, method) => { const r = await call(p, body, method); steps.push({ name, status: r.status, message: r.status >= 400 ? r.data?.message : '' }); return r; };

  await step('register user', '/api/users/register', { emp_id: 'clerk1', Name: 'Clerk One', password: 'Passw0rd1' });
  await step('assign roles', '/api/assignRoles/saveAll', { emp_code: 'clerk1', roles: { BU: ['B01'], Contractor: ['D001'], Dept: ['D01'], Menu: [], Location: ['L01'], MenuActivity: ['WRITE'] } });
  await step('password reset token', '/api/users/generateResetToken', { emp_id: 'clerk1' });
  await step('contractor', '/api/contractor/addContractor', { Contractor_ID: 'D003', Contractor_Name: 'Fictional Packers' });
  await step('master: business unit', '/api/master-data/business-units', { bu_code: 'B09', bu_name: 'Fictional BU', entity_code: 'E01' });
  await step('employee', '/api/employee/addEmployee', { Employee_Code: 'DEMO005', display_name: 'Fictional Five', contractor_id: 'D001', dept: 'D01', bu: 'B01', entity_code: 'E01', loc_code: 'L01', emp_type: 'SL', BillingType: 'M' });
  await step('pending employee change', '/api/employee/addEmployeePreapprove', { Employee_Code: 'DEMO006', display_name: 'Pending Six', contractor_id: 'D001' });
  await step('process month', '/api/wages/addProcessMonth', { pmonth: '2026-12-01', start_date: '2026-12-01', end_date: '2026-12-31', billingType: 'M', period_name: 'Dec 2026', is_active: 'Y' });
  await step('fixed wages', '/api/wages/addFixWages', { EmployeeCode: 'DEMO001', BillingType: 'M', eff_date: '2026-10-01', BasicRate: 550, DARate: 100, GrossRate: 700, OTFactor: 2 });
  await step('earning', '/api/wages/addWageEarnings', { employee_code: 'DEMO001', pmonth: '2026-10-01', billingType: 'M', ernCode: 'DEMO', ernValue: 125 });
  await step('deduction', '/api/wages/addWageDeductions', { employee_code: 'DEMO001', pmonth: '2026-10-01', billingType: 'M', dedCode: 'DEMO', dedValue: 30 });
  await step('arrear', '/api/wages/addWageArrears', { employee_code: 'DEMO001', pmonth: '2026-10-01', billingType: 'M', arrearCode: 'DEMO', arrearValue: 40, arrearRefPmonth: '2026-09-01', arrearDays: 2 });
  await step('service charge', '/api/wages/addServiceCharges', { ContractorID: 'D001', entity_code: 'E01', RuleType: 'EmployeeCode', EmployeeCode: 'DEMO001', Eff_PMonth: '2026-10-01', rate: 5 });
  await step('shift allocation', '/api/attendance/addShGrpAlloc', { employee_code: 'DEMO001', sh_group: 'G1', sh_group_eff_from: '2026-10-01', weekly_off: 'Sunday' });
  await step('approved manpower', '/api/attendance/addApprovedManpower', { contractor_id: 'D002', dept_code: 'D01', bu_code: 'B01', emp_type: 'SL', approved_day: 3, approved_night: 1, eff_date: '2026-10-01' });
  await step('sandwich rule', '/api/attendance/addSandwichRule', { present_pattern: 'P-WO-P', converted_pattern: 'P-P-P' });
  await step('employee request', '/api/attendance/addEmpRequest', { employee_code: 'DEMO001', request_type: 'OD', request_date: '2026-10-05', start_date: '2026-10-06', end_date: '2026-10-06', reason: 'Site visit' });
  await step('manual muster', '/api/attendance/addManualPunchMark', { employee_code: 'DEMO001', attendance_date: '2026-10-01', shift: 'GEN', punch_mark: 'P', working_hours: '08:00', ot_hours: '01:00' });
  await step('regularisation', '/api/attendance/addRegularisePunch', { employee_code: 'DEMO001', contractor_id: 'D001', attendance_date: '2026-10-02', in_punch: '2026-10-02T09:00', out_punch: '2026-10-02T16:00', approved: 'N' });
  await step('muster department override', '/api/attendance/updateMusterDept', [{ employee_code: 'DEMO001', attendance_date: '2026-10-03', dept_code: 'D01', bu_code: 'B01', entity_code: 'E01' }]);
  await step('imported punches', '/api/attendance/uploadManualPunches', { punches: [{ employee_code: 'DEMO001', attendance_date_with_time: '2026-10-04T08:00:00' }, { employee_code: 'DEMO001', attendance_date_with_time: '2026-10-04T17:00:00' }] });
  await step('process attendance', '/api/attendance/manualProcessAttendance', { from_date: '2026-10-04', to_date: '2026-10-04' });
  await step('leave', '/api/leave/addLeave', { employee_code: 'DEMO001', leave_period_id: 1, leave_type_code: 'CL', leave_nature: 'FULL', request_date: '2026-10-16', from_date: '2026-10-16', to_date: '2026-10-16', total_days: 1, reason: 'Fictional leave' });
  await step('compliance profile', '/api/compliance/profiles', { stateCode: 'BR', name: 'Bihar' });
  await step('wage lock', '/api/wages/addWageProcessLock', { pmonth: '2026-10-01', billingType: 'M', entityCode: 'E01', ContractorId: 'D002' });

  return { state: server.demo.getState(), steps, call, server, close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }) };
}
