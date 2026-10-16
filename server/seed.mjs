// All people, organisations, balances and rates in this file are fictional demo fixtures.
// They are deliberately unrelated to the installed application's live records.
export const DEMO_USER = Object.freeze({ emp_id: 'demo', Name: 'Demo Developer', email_id: 'demo@example.invalid', role: 'LOCAL_DEMO_ADMIN' });
export const DEMO_PASSWORD = 'demo123';

const routeGroups = {
  'Employee': [
    ['Manage Employees', '/manageEmployees'], ['Shift Group Allocation', '/manageShGrpAlloc'],
    ['Employee Master Dump', '/exportEmpMastDump'], ['Inactive Employees', '/InActiveEmp'],
    ['Approve Employee Changes', '/ApproveEmployeeChanges'],
  ],
  'Contractor': [['Manage Contractors', '/manageContractors'], ['Register Contractor', '/registerContractor']],
  'Attendance': [
    ['Manage Attendance', '/manageAttendance'], ['Daily Attendance', '/printDailyAttendance'],
    ['Attendance Format 2', '/PrintAttendanceFormat2'], ['Attendance Summary', '/printAtndSummary'],
    ['Monthly Attendance Sheet', '/monthlyAtndSheet'], ['Update Muster Department', '/updDeptInMust'],
    ['Regularize Punches', '/regularizePunches'], ['Regenerate Muster', '/regenerateMuster'],
    ['Manual Process Attendance', '/manualProcessAttendance'], ['Monthly Attendance Times', '/monthlyAtndRegTimes'],
    ['Manual Muster', '/ManualMuster'], ['Employee Request', '/EmpRequest'],
    ['Approved vs Present', '/printApprovedVsPresent'], ['Approved vs Present Period', '/printApprVsPresentPeriod'],
    ['Regularized Punch Details', '/ExpRegPunchDetToXLS'], ['Approved Manpower', '/ManageApprovedManpower'],
    ['Process Sandwich', '/ProcessSandwich'], ['Sandwich Rule Master', '/SandwichRuleMaster'],
  ],
  'Wages': [
    ['Fixed Wages', '/ManageFixWages'], ['Fixed Wages Dump', '/ExportFixWagesDump'],
    ['Process Wages (unavailable in demo)', '/processWages'], ['Print Wages (unavailable in demo)', '/printWages'],
    ['Wage Deductions', '/wageDeductions'], ['Wage Earnings', '/wageEarnings'], ['Wage Arrears', '/wageArrears'],
    ['Wage Slip (unavailable in demo)', '/wageSlip'], ['Print Wage Slips (unavailable in demo)', '/PrintWageSlips'],
    ['Bank Statement (unavailable in demo)', '/getBankStatement'], ['PF Statement (unavailable in demo)', '/getPFStatement'],
    ['ESI Statement (unavailable in demo)', '/getESIStatement'], ['Cash Statement (unavailable in demo)', '/getCashStatement'],
    ['Professional Tax (unavailable in demo)', '/PTReport'], ['Monthly Professional Tax (unavailable in demo)', '/PTMonthReport'],
    ['Process Months', '/manageProcessMonth'], ['Wage Process Lock', '/manageWageProcessLock'],
    ['Service Charges', '/ServiceCharges'], ['Wage Comparison (unavailable in demo)', '/ExportWageComparission'],
    ['Upload Wage Components (unavailable in demo)', '/UploadEmpWageComp'], ['Bonus Report (unavailable in demo)', '/BonusReport'],
  ],
  'Leave': [
    ['Leave Entry', '/LeaveEntryTimeKeeper'], ['Leave Ledger', '/leave-ledger-entry'],
    ['Payroll Leave Posting (preview only)', '/leave-payroll-posting'], ['Leave Ledger Summary', '/leave-ledger-summary'],
    ['Leave Balance Report', '/leave-balance-report'],
  ],
  'Master Data': [
    ['Shifts', '/masters/shifts'], ['Business Units', '/masters/business-units'], ['Cities', '/masters/cities'],
    ['Divisions', '/masters/divisions'], ['Holiday Calendar', '/masters/holidays'], ['Locations', '/masters/locations'],
    ['Cost Centres', '/masters/cost-centres'],
  ],
  'Administration': [['Manage Users (view only)', '/manageUsers'], ['Assign Roles', '/AssignRoles']],
};

// The group structure and core labels match the observed installed dashboard.
// Source routes absent from that dashboard remain reachable within the matching module.
const groups = {
  'Configuration Module': [...routeGroups.Administration.map(([label, url]) => [url === '/manageUsers' ? 'User Management' : label, url]), ['State Compliance Profiles', '/development/features'], ['Local Recovery Outbox', '/development/outbox'], ['Audit Trail', '/development/audit']],
  'Masters Module': [
    ['Worker Management', '/manageEmployees'], ['Contractor Management', '/manageContractors'],
    ['Shift Group Allocation', '/manageShGrpAlloc'], ['Shift Setup', '/masters/shifts'],
    ...routeGroups['Master Data'].filter(([, url]) => url !== '/masters/shifts'),
    ['Employee Master Dump', '/exportEmpMastDump'], ['Inactive Employees', '/InActiveEmp'],
    ['Approve Employee Changes', '/ApproveEmployeeChanges'],
  ],
  'Attendance Module': routeGroups.Attendance.map(([label, url]) => [url === '/manageAttendance' ? 'Att Calendar' : label, url]),
  'Wages Module': routeGroups.Wages.map(([label, url]) => [url === '/printWages' ? 'Wage Register (BFCL rules required)' : label.replace(' (unavailable in demo)', /processWages|wageSlip|PrintWageSlips|getBank|getPF|getESI|getCash|PTReport|PTMonthReport|BonusReport|WageComparission/.test(url) ? ' (BFCL rules required)' : ''), url]),
  'Accounting Module': [['Payroll Input Summary', '/development/accounting']],
  'Approvals': [['Employee Change Approvals', '/ApproveEmployeeChanges'], ['Employee Requests', '/development/approvals'], ['Attendance Regularisation', '/regularizePunches']],
  'Compliance Reports': [
    ['Form XII Register of contractors', '/compliance/form-xii-register-of-contractors'],
    ['Form XIII Register of workmen', '/compliance/form-xiii-register-of-workmen'],
    ['Form XIX Wage slip', '/compliance/form-xix-wage-slip'],
    ['Form XVI Muster roll', '/compliance/form-xvi-muster-roll'],
    ['Form XVIII Wages-cum-Muster Roll', '/compliance/form-xviii-wages-cum-muster-roll'],
    ['Form XXIII Register of Overtime', '/compliance/form-xxiii-register-of-overtime'],
  ],
  'Leave Module': routeGroups.Leave.map(([label, url]) => [label.replace(' (preview only)', ' (calculated outputs required)'), url]),
};

export const MENUS = (() => {
  const rows = []; let id = 0;
  for (const [name, children] of Object.entries(groups)) {
    const parent = ++id;
    rows.push({ menu_id: parent, parent_menu_id: 0, menu_name: name, menu_url: '' });
    for (const [label, url] of children) rows.push({ menu_id: ++id, parent_menu_id: parent, menu_name: label, menu_url: url });
  }
  return rows;
})();

export const MASTER_KEYS = {
  'shift-groups': ['sh_group'], 'shift-times': ['sh_code'], 'business-units': ['bu_code'],
  cities: ['city_code', 'state_code'], divisions: ['Div_code', 'entity_code'], holidays: ['hol_date'],
  locations: ['loc_code'], 'cost-centres': ['COST_CODE'],
};

export function seedState() {
  const contractors = [
    { Contractor_ID: 'D001', Contractor_Name: 'Demo Fabrication Services', Billing_Name: 'Demo Fabrication Services', Address1: 'Fictional Demo Industrial Area', Address2: 'Local development fixture', Father_Name: 'Demo Contact', PAN_No: '', TAN_No: '', GIR_No: '', REG_No: 'DEMO-ONLY', PF_No: '', ESIC_No: '', Created_By: 'demo', Created_Date: '2026-09-01T00:00:00Z', Modified_By: 'demo', Modified_Date: '2026-09-01T00:00:00Z', Is_Administrative_Applicable: 'N', Administrative_Charge_Percent: 0, Is_FoodAccoChargs_Applicable: 'N', FoodAcco_Charge_Percent: 0 },
    { Contractor_ID: 'D002', Contractor_Name: 'Sample Maintenance Partners', Billing_Name: 'Sample Maintenance Partners', Address1: 'Fictional Demo Workshop', Address2: 'Local development fixture', Father_Name: 'Sample Contact', PAN_No: '', TAN_No: '', GIR_No: '', REG_No: 'DEMO-ONLY', PF_No: '', ESIC_No: '', Created_By: 'demo', Created_Date: '2026-09-01T00:00:00Z', Modified_By: 'demo', Modified_Date: '2026-09-01T00:00:00Z', Is_Administrative_Applicable: 'N', Administrative_Charge_Percent: 0, Is_FoodAccoChargs_Applicable: 'N', FoodAcco_Charge_Percent: 0 },
  ];
  const employees = ['Asha Demo', 'Ravi Sample', 'Mira Example', 'Dev Test'].map((name, i) => ({
    Employee_Code: `DEMO00${i + 1}`, employee_code: `DEMO00${i + 1}`, display_name: name,
    First_Name: name.split(' ')[0], Middle_Name: '', Last_Name: name.split(' ')[1], Nick_Name: '',
    Father_Husband_Name: 'Fictional Person', Salutation: i % 2 ? 'MR' : 'MS', Gender: i % 2 ? 'M' : 'F',
    Dateof_Birth: '1995-01-15T00:00:00Z', Dateof_Birth_Actual: '1995-01-15T00:00:00Z', Placeof_Birth: 'Demo City',
    Nationality: 'IN', Religion: 'NA', Caste: 'NA', Language: '', Blood_Group: 'O+', Marital_Status: 'Single',
    Handicap: 'N', Smoker: 'N', Is_Active: 'Y', blacklisted: 'N', blacklisted_reason: '', Adhar_No: '', Adhar_Name: '',
    panno: '', Hobbies: '', Modified_By: 'demo', Modified_Date: '2026-09-01T00:00:00Z', Created_By: 'demo', Created_Date: '2026-09-01T00:00:00Z',
    EmpTag: '', BillingType: 'M', dept: i < 2 ? 'D01' : 'D02', bu: 'B01', division: 'DV', contractor_id: i < 2 ? 'D001' : 'D002',
    pfno: '', uanno: '', esino: '', skill_category: 'Skilled', contact_no: '', doj: '2026-09-01T00:00:00Z', doj_group: '2026-09-01T00:00:00Z',
    payment_mode: 'C', bank_code: '', bank_account_no: '', ifsc_code: '', design_code: 'OP', section: 'S01', entity_code: 'E01',
    local_address: 'Fictional Demo Address', local_city: 'DC', local_state: 'DM', local_pin: '', pmt_address: 'Fictional Demo Address', pmt_city: 'DC', pmt_state: 'DM', pmt_pin: '',
    medical_status: 'FIT', wage_type: 'D', ot_factor: 2, emp_type: 'SL', inactive_date: null, loc_code: 'L01', cost_code: 'C01', level: 'L1', emp_category_code: 'CL',
    contractor_name: i < 2 ? contractors[0].Contractor_Name : contractors[1].Contractor_Name,
  }));
  const masters = {
    'shift-groups': [{ sh_group: 'G1', sh_group_name: 'Demo General Shift', sh_group_desc: 'Demo General Shift', sh_group_type: 'SL', sh_shift_hours: '08:00:00', sh_flexi_min_mnts_full: 480, sh_flexi_min_mnts_half: 240, sh_halfday_allowd: 'Y', sh_fullday_allowed: 'Y', ot_eligible: 'Y' }],
    'shift-times': [{ sh_code: 'GEN', sh_group: 'G1', shift_day_night: 'D', shift_hours: '08:00:00', sh_start_time: '08:00:00', sh_end_time: '17:00:00', sh_tolerence_start: '07:00:00', sh_tolerence_end: '09:00:00', sh_tolerence_out: '18:00:00', sh_grace_time: '00:15:00', sh_hday_off_start: '12:00:00', sh_fday_off_start: '08:00:00', sh_hday_off_out: '13:00:00', sh_fday_off_out: '17:00:00' }],
    'business-units': [{ bu_code: 'B01', bu_name: 'Demo Works', entity_code: 'E01' }],
    cities: [{ city_code: 'DC', city_name: 'Demo City', state_code: 'DM' }],
    divisions: [{ Div_code: 'DV', div_name: 'Demo Operations', entity_code: 'E01', div_group: 'DEMO' }],
    holidays: [{ hol_date: '2026-10-02', hol_name: 'Demo Holiday', contractor_id: null }],
    locations: [{ loc_code: 'L01', loc_name: 'Demo Plant' }],
    'cost-centres': [{ COST_CODE: 'C01', COST_NAME: 'Demo Cost Centre' }],
  };
  const processMonths = [9, 10, 11].map(month => ({ pmonth: `2026-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`, period_name: ['Sep', 'Oct', 'Nov'][month - 9] + ' 2026 (DEMO)', billingType: 'M', billingtype: 'M', start_date: `2026-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`, end_date: new Date(Date.UTC(2026, month, 0)).toISOString(), is_active: 'Y' }));
  const ledger = employees.flatMap((e, i) => ['CL', 'EL', 'SL'].map((type, j) => ({ trans_id: i * 3 + j + 1, employee_code: e.Employee_Code, employee_name: e.display_name, display_name: e.display_name, contractor_id: e.contractor_id, contractor_name: e.contractor_name, leave_type_code: type, leave_type_name: type, trans_type: 'OB', trans_name: 'Opening Balance', balance_effect: '+', leave_days: [6, 10, 4][j], pmonth: '2026-09-01', trans_date: '2026-09-01T00:00:00Z', ref_type: 'MANUAL', ref_no: '', remarks: 'Fictional opening balance for development', created_by: 'demo' })));
  return { schemaVersion: 1, environment: 'LOCAL_SYNTHETIC_DEMO', contractors, employees, masters, processMonths, ledger, leaves: [], pendingEmployees: [], approvedManpower: [{ contractor_id: 'D001', dept_code: 'D01', bu_code: 'B01', emp_type: 'SL', approved_day: 6, approved_night: 2, eff_date: '2026-09-01' }], sandwichRules: [], shiftAllocations: [], wageLocks: [], serviceCharges: [], deductions: [], earnings: [], arrears: [], manualPunches: [], employeeRequests: [], fixedWages: employees.map((e, i) => ({ EmployeeCode: e.Employee_Code, EmployeeName: e.display_name, BillingType: 'M', eff_date: '2026-09-01', BasicRate: 500 + i * 25, DARate: 100, JaggeryRate: 0, OTHALWRT: 0, HRART: 0, TRALWRT: 0, UNALWRT: 0, MEDIALWRT: 0, CONALWRT: 0, HRAOLDRT: 0, PFApply: 'N', ESIApply: 'N', LWFApply: 'N', OTFactor: 2 })) };
}

export function referenceData(state) {
  return {
    salutation: ['MR', 'MS', 'MX'].map(salutation_code => ({ salutation_code })),
    gender: [{ gender_code: 'F', gender_name: 'Female' }, { gender_code: 'M', gender_name: 'Male' }, { gender_code: 'O', gender_name: 'Other' }],
    nationality: [{ nationality_code: 'IN', nationality_name: 'Indian' }],
    religion: [{ religion_code: 'NA', religion_name: 'Not specified (DEMO)' }],
    cast: [{ cast_code: 'NA', cast_name: 'Not specified (DEMO)' }],
    bloodgroup: ['O+', 'A+', 'B+'].map(blood_group => ({ blood_group })),
    skillcategory: ['Skilled', 'Semi Skilled', 'Unskilled'].map(skill_category => ({ skill_category })),
    maritalstatus: ['Single', 'Married'].map(marital_status => ({ marital_status })),
    billingtype: [{ billingtype_code: 'M', billingtype_name: 'Monthly' }, { billingtype_code: 'F', billingtype_name: 'Fortnightly' }],
    alldesignation: [{ design_code: 'OP', design_name: 'Demo Operator' }],
    section: [{ section_code: 'S01', section_name: 'Demo Section' }],
    emptype: [{ emp_type_code: 'SL', emp_type_desc: 'Skilled Labour' }, { emp_type_code: 'US', emp_type_desc: 'Unskilled Labour' }],
    empcategory: [{ emp_category_code: 'CL', emp_category_desc: 'Contract Labour', emp_category_name: 'Contract Labour' }],
    loccode: state.masters.locations,
    level: [{ level: 'L1', level_desc: 'Demo Level 1' }],
    bankmast: [{ bank_code: 'DEMO', bank_name: 'Fictional Demo Bank' }],
    statemast: [{ state_code: 'DM', state_name: 'Demo State' }],
    citymast: state.masters.cities,
  };
}
