// The logical data model of the CLMS replica, written down once and checked against the running system.
//
// The replica has no SQL schema: its "tables" are the collections in the server's JSON state (server/seed.mjs plus the
// keys modules add at run time), and its "foreign keys" are business codes. This catalogue names every entity, its
// business key, and each reference between entities. scripts/erd.mjs renders it (Mermaid + data dictionary) and
// tests/erd.test.mjs holds it to the real data, so it cannot drift silently.
//
// enforced:  'create'  the API rejects a write whose reference does not exist
//            'restrict' the API refuses to delete (or re-key) a parent that is still referenced
//            'both'    create + restrict
//            'none'    nothing checks it; a dangling value is accepted and stored

import { INDIAN_STATES } from '../../server/modules/payroll-rules.mjs';

const date10 = value => String(value ?? '').slice(0, 10);

export const GROUPS = {
  org: 'Organisation and reference data',
  people: 'People',
  attendance: 'Attendance',
  leave: 'Leave',
  wages: 'Wages and payroll inputs',
  security: 'Users, roles and audit',
};

/**
 * rows(ctx) returns the records of the entity. ctx = { state, lists }; lists are the server's built-in constant
 * lists (legal entities, departments, leave types ...), which are entities too but never stored in the state file.
 */
export const ENTITIES = [
  // ---------------------------------------------------------------- organisation
  { id: 'LegalEntity', group: 'org', key: ['entity_code'], implicit: true, rows: c => c.lists.entities, note: 'Built-in list (one fictional entity, E01). Not stored in state.json.' },
  { id: 'Department', group: 'org', key: ['dept_code'], implicit: true, rows: c => c.lists.departments, note: 'Built-in list (D01, D02). Not stored in state.json and not editable.' },
  { id: 'BusinessUnit', group: 'org', key: ['bu_code'], stateKey: 'masters.business-units', note: 'Master data > Business units.' },
  { id: 'Division', group: 'org', key: ['Div_code', 'entity_code'], stateKey: 'masters.divisions', note: 'Master data > Divisions. Employees reference Div_code only.' },
  { id: 'Location', group: 'org', key: ['loc_code'], stateKey: 'masters.locations', note: 'Master data > Locations (also the location scope of a user).' },
  { id: 'CostCentre', group: 'org', key: ['COST_CODE'], stateKey: 'masters.cost-centres', note: 'Master data > Cost centres.' },
  { id: 'City', group: 'org', key: ['city_code', 'state_code'], stateKey: 'masters.cities', note: 'Master data > Cities.' },
  { id: 'Holiday', group: 'org', key: ['hol_date'], stateKey: 'masters.holidays', note: 'Master data > Holidays; optionally limited to one contractor.' },
  { id: 'Contractor', group: 'org', key: ['Contractor_ID'], stateKey: 'contractors', note: 'The labour contractors the principal employer engages.' },
  { id: 'State', group: 'org', key: ['state_code'], implicit: true, rows: c => c.lists.states, note: 'Built-in reference list (Indian states and union territories).' },
  { id: 'StatutoryState', group: 'org', key: ['state_code'], implicit: true, rows: () => Object.entries(INDIAN_STATES).map(([state_code, state_name]) => ({ state_code, state_name })), note: 'Built-in list of Indian states used by the compliance profiles. It is separate from State (the employee-form list, which holds one demo state), so the two never meet.' },
  { id: 'Designation', group: 'org', key: ['design_code'], implicit: true, rows: c => c.lists.designations, note: 'Built-in reference list; service-charge rules and employees use it.' },
  { id: 'Section', group: 'org', key: ['section_code'], implicit: true, rows: c => c.lists.sections, note: 'Built-in reference list.' },
  { id: 'EmployeeType', group: 'org', key: ['emp_type_code'], implicit: true, rows: c => c.lists.employeeTypes, note: 'Built-in reference list (SL, US).' },
  { id: 'EmployeeCategory', group: 'org', key: ['emp_category_code'], implicit: true, rows: c => c.lists.employeeCategories, note: 'Built-in reference list.' },
  { id: 'Bank', group: 'org', key: ['bank_code'], implicit: true, rows: c => c.lists.banks, note: 'Built-in reference list.' },

  // ---------------------------------------------------------------- people
  { id: 'Employee', group: 'people', key: ['Employee_Code'], stateKey: 'employees', note: 'The worker master. Employee_Code is the business key every other record points at.' },
  { id: 'PendingEmployeeChange', group: 'people', key: ['record_id'], stateKey: 'pendingEmployees', note: 'A new or changed worker waiting for approval. On approval the changed fields are merged into Employee.' },

  // ---------------------------------------------------------------- attendance
  { id: 'ShiftGroup', group: 'attendance', key: ['sh_group'], stateKey: 'masters.shift-groups', note: 'Master data > Shift setup.' },
  { id: 'Shift', group: 'attendance', key: ['sh_code'], stateKey: 'masters.shift-times', note: 'Master data > Shift setup. Belongs to a shift group.' },
  { id: 'ShiftAllocation', group: 'attendance', key: ['employee_code'], stateKey: 'shiftAllocations', note: 'At most one shift group (and weekly off) per worker.' },
  { id: 'ApprovedManpower', group: 'attendance', key: ['contractor_id', 'dept_code', 'bu_code', 'emp_type'], stateKey: 'approvedManpower', note: 'Approved headcount per contractor, department, business unit and worker type.' },
  { id: 'ManualMusterEntry', group: 'attendance', key: ['employee_code', 'attendance_date'], stateKey: 'manualPunches', note: 'A hand-entered or uploaded attendance mark. Overrides the generated muster for that worker and day.' },
  { id: 'RegularisedPunch', group: 'attendance', key: ['employee_code', 'attendance_date'], stateKey: 'regularisedPunches', note: 'A corrected IN/OUT pair; it only affects reports once approved.' },
  { id: 'MusterDepartment', group: 'attendance', key: ['employee_code', 'attendance_date'], stateKey: 'musterDepartments', note: 'Department / business-unit override for one worker-day.' },
  { id: 'ImportedPunch', group: 'attendance', key: ['employee_code', 'attendance_date_with_time'], stateKey: 'importedPunches', note: 'A raw punch uploaded from a workbook (there is no biometric feed).' },
  { id: 'ProcessedAttendance', group: 'attendance', key: ['employee_code', 'attendance_date'], stateKey: 'processedAttendance', note: 'Result of "Process attendance": first/last punch only. No payable-day rules are applied.' },
  { id: 'AttendanceJob', group: 'attendance', key: ['job_id'], stateKey: 'attendanceJobs', note: 'Log of local attendance processing runs.' },
  { id: 'EmployeeRequest', group: 'attendance', key: ['request_id'], stateKey: 'employeeRequests', note: 'On-duty / work-from-home request with its approval status.' },
  { id: 'SandwichRule', group: 'attendance', key: ['rule_id'], stateKey: 'sandwichRules', note: 'Draft sandwich-leave pattern. Stored only; no processing uses it.' },

  // ---------------------------------------------------------------- leave
  { id: 'LeaveType', group: 'leave', key: ['leave_type_code'], implicit: true, rows: c => c.lists.leaveTypes, note: 'Built-in list: CL, EL, SL.' },
  { id: 'LedgerTransactionType', group: 'leave', key: ['trans_type'], implicit: true, rows: c => c.lists.transTypes, note: 'Built-in list; balance_effect says whether a row adds (+) or subtracts (-).' },
  { id: 'LeaveApplication', group: 'leave', key: ['leave_id'], stateKey: 'leaves', note: 'A leave taken. Creating one also posts an AVAILED ledger row.' },
  { id: 'LeaveLedgerEntry', group: 'leave', key: ['trans_id'], stateKey: 'ledger', note: 'The leave balance ledger: opening balances, credits, leave availed, manual adjustments.' },

  // ---------------------------------------------------------------- wages
  { id: 'ProcessMonth', group: 'wages', key: ['pmonth', 'billingType'], normalise: { pmonth: date10 }, stateKey: 'processMonths', note: 'A wage period (monthly M or fortnightly F) with its start and end dates.' },
  { id: 'FixedWage', group: 'wages', key: ['EmployeeCode', 'BillingType', 'eff_date'], normalise: { eff_date: date10 }, stateKey: 'fixedWages', note: 'Effective-dated wage rates of a worker. A new rate is a new row, not an edit.' },
  { id: 'WageEarning', group: 'wages', key: ['employee_code', 'pmonth', 'billingType', 'ernCode'], normalise: { pmonth: date10 }, stateKey: 'earnings', note: 'A recorded extra earning. An input only; nothing computes gross pay from it.' },
  { id: 'WageDeduction', group: 'wages', key: ['employee_code', 'pmonth', 'billingType', 'dedCode'], normalise: { pmonth: date10 }, stateKey: 'deductions', note: 'A recorded deduction. An input only.' },
  { id: 'WageArrear', group: 'wages', key: ['employee_code', 'pmonth', 'billingType', 'arrearCode', 'arrearRefPmonth'], normalise: { pmonth: date10, arrearRefPmonth: date10 }, stateKey: 'arrears', note: 'A recorded arrear for an earlier reference period. An input only.' },
  { id: 'ServiceChargeRule', group: 'wages', key: ['RuleID'], stateKey: 'serviceCharges', note: 'A contractor service-charge rate; the rule type decides which one other column it applies to.' },
  { id: 'WageProcessLock', group: 'wages', key: ['pmonth', 'billingType', 'entityCode', 'ContractorId'], normalise: { pmonth: date10 }, stateKey: 'wageLocks', note: 'Closes a period for a contractor (or ALL). Locked periods reject wage edits with HTTP 423.' },
  { id: 'PayrollRun', group: 'wages', key: ['pmonth', 'billingType'], stateKey: 'payrollRuns', reserved: true, note: 'Reserved. No payroll engine exists, so this collection is never created; reports that read it always see nothing.' },

  // ---------------------------------------------------------------- security
  { id: 'UserAccount', group: 'security', key: ['emp_id'], stateKey: 'authUsers', secret: ['passwordHash', 'passwordSalt'], note: 'A sign-in account. Not linked to Employee: a user is not a worker.' },
  { id: 'RoleAssignment', group: 'security', key: ['emp_id'], rows: c => Object.entries(c.state.roles || {}).map(([emp_id, value]) => ({ emp_id, ...value })), stateKey: 'roles', note: 'Per user: the business units, contractors, departments, locations, menus and activities the user may use. The selections are embedded lists copied by value, so renaming a business unit or contractor does not update them, and an empty list means nothing (never everything).' },
  { id: 'AuditLogEntry', group: 'security', key: ['id'], stateKey: 'auditLog', note: 'Who created, changed or reset which account.' },
  { id: 'RecoveryToken', group: 'security', key: ['id'], stateKey: 'recoveryOutbox', secret: ['token'], note: 'A password-reset token held in the local outbox (nothing is e-mailed).' },
  { id: 'ComplianceProfile', group: 'security', key: ['id'], stateKey: 'complianceProfiles', note: 'A state-wise statutory rule draft (unverified). Exactly one is active.' },
];

/** Keys of the state file that are bookkeeping, not entities. */
export const STATE_META_KEYS = ['schemaVersion', 'environment', 'activeComplianceProfileId', 'recoveryRequests'];

// from.fields reference to.fields (same order). optional: an empty value is allowed. also: values accepted besides a parent key.
export const RELATIONSHIPS = [
  // ---- organisation
  { from: 'BusinessUnit', fields: ['entity_code'], to: 'LegalEntity', toFields: ['entity_code'], enforced: 'none' },
  { from: 'Division', fields: ['entity_code'], to: 'LegalEntity', toFields: ['entity_code'], enforced: 'none' },
  { from: 'City', fields: ['state_code'], to: 'State', toFields: ['state_code'], enforced: 'none', soft: true },
  { from: 'Holiday', fields: ['contractor_id'], to: 'Contractor', toFields: ['Contractor_ID'], optional: true, enforced: 'none' },
  { from: 'Shift', fields: ['sh_group'], to: 'ShiftGroup', toFields: ['sh_group'], enforced: 'restrict', note: 'A shift group that still has shifts cannot be deleted.' },

  // ---- people
  { from: 'Employee', fields: ['contractor_id'], to: 'Contractor', toFields: ['Contractor_ID'], enforced: 'create', note: 'Checked on add, pre-approve and workbook import.' },
  { from: 'Employee', fields: ['dept'], to: 'Department', toFields: ['dept_code'], enforced: 'create' },
  { from: 'Employee', fields: ['bu'], to: 'BusinessUnit', toFields: ['bu_code'], enforced: 'both' },
  { from: 'Employee', fields: ['entity_code'], to: 'LegalEntity', toFields: ['entity_code'], enforced: 'create' },
  { from: 'Employee', fields: ['loc_code'], to: 'Location', toFields: ['loc_code'], enforced: 'restrict' },
  { from: 'Employee', fields: ['division'], to: 'Division', toFields: ['Div_code'], optional: true, enforced: 'restrict' },
  { from: 'Employee', fields: ['cost_code'], to: 'CostCentre', toFields: ['COST_CODE'], optional: true, enforced: 'restrict' },
  { from: 'Employee', fields: ['design_code'], to: 'Designation', toFields: ['design_code'], optional: true, enforced: 'none' },
  { from: 'Employee', fields: ['section'], to: 'Section', toFields: ['section_code'], optional: true, enforced: 'none', soft: true },
  { from: 'Employee', fields: ['emp_type'], to: 'EmployeeType', toFields: ['emp_type_code'], optional: true, enforced: 'none' },
  { from: 'Employee', fields: ['emp_category_code'], to: 'EmployeeCategory', toFields: ['emp_category_code'], optional: true, enforced: 'none' },
  { from: 'Employee', fields: ['bank_code'], to: 'Bank', toFields: ['bank_code'], optional: true, enforced: 'none' },
  { from: 'Employee', fields: ['local_city'], to: 'City', toFields: ['city_code'], optional: true, enforced: 'restrict', soft: true, label: 'local_city' },
  { from: 'Employee', fields: ['pmt_city'], to: 'City', toFields: ['city_code'], optional: true, enforced: 'restrict', soft: true, label: 'pmt_city' },
  { from: 'Employee', fields: ['local_state'], to: 'State', toFields: ['state_code'], optional: true, enforced: 'none', soft: true, label: 'local_state' },
  { from: 'Employee', fields: ['pmt_state'], to: 'State', toFields: ['state_code'], optional: true, enforced: 'none', soft: true, label: 'pmt_state' },
  { from: 'PendingEmployeeChange', fields: ['Employee_Code'], to: 'Employee', toFields: ['Employee_Code'], optional: true, soft: true, enforced: 'none', note: 'A change points at an existing worker; a new worker has no Employee row until it is approved, so this reference is dangling by design.' },

  // ---- attendance
  { from: 'ShiftAllocation', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'ShiftAllocation', fields: ['sh_group'], to: 'ShiftGroup', toFields: ['sh_group'], enforced: 'both' },
  { from: 'ApprovedManpower', fields: ['contractor_id'], to: 'Contractor', toFields: ['Contractor_ID'], enforced: 'create' },
  { from: 'ApprovedManpower', fields: ['dept_code'], to: 'Department', toFields: ['dept_code'], enforced: 'create' },
  { from: 'ApprovedManpower', fields: ['bu_code'], to: 'BusinessUnit', toFields: ['bu_code'], enforced: 'both' },
  { from: 'ApprovedManpower', fields: ['emp_type'], to: 'EmployeeType', toFields: ['emp_type_code'], enforced: 'create', note: 'The API also accepts PR, which is not in the type list.' },
  { from: 'ManualMusterEntry', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'ManualMusterEntry', fields: ['shift'], to: 'Shift', toFields: ['sh_code'], enforced: 'create', note: 'Deleting a shift that muster rows still use is not blocked.' },
  { from: 'RegularisedPunch', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'RegularisedPunch', fields: ['contractor_id'], to: 'Contractor', toFields: ['Contractor_ID'], enforced: 'create', note: 'Taken from the worker; the API rejects a contractor that is not the worker\'s.' },
  { from: 'MusterDepartment', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'MusterDepartment', fields: ['dept_code'], to: 'Department', toFields: ['dept_code'], enforced: 'create' },
  { from: 'MusterDepartment', fields: ['bu_code'], to: 'BusinessUnit', toFields: ['bu_code'], enforced: 'both' },
  { from: 'MusterDepartment', fields: ['entity_code'], to: 'LegalEntity', toFields: ['entity_code'], enforced: 'create' },
  { from: 'MusterDepartment', fields: ['div_code'], to: 'Division', toFields: ['Div_code'], optional: true, enforced: 'create' },
  { from: 'ImportedPunch', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'ProcessedAttendance', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create', unverified: true, note: 'Derived from imported punches, which are checked; there is no direct write path to test.' },
  { from: 'EmployeeRequest', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },

  // ---- leave
  { from: 'LeaveApplication', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'LeaveApplication', fields: ['leave_type_code'], to: 'LeaveType', toFields: ['leave_type_code'], enforced: 'create' },
  { from: 'LeaveLedgerEntry', fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  { from: 'LeaveLedgerEntry', fields: ['leave_type_code'], to: 'LeaveType', toFields: ['leave_type_code'], enforced: 'create' },
  { from: 'LeaveLedgerEntry', fields: ['trans_type'], to: 'LedgerTransactionType', toFields: ['trans_type'], enforced: 'create' },
  { from: 'LeaveLedgerEntry', fields: ['ref_no'], to: 'LeaveApplication', toFields: ['leave_id'], when: row => row.ref_type === 'LEAVE', enforced: 'none', label: 'ref_no (ref_type = LEAVE)', note: 'Deleting a leave application deletes its ledger rows.' },

  // ---- wages
  { from: 'FixedWage', fields: ['EmployeeCode'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
  ...[['WageEarning', 'earnings'], ['WageDeduction', 'deductions'], ['WageArrear', 'arrears']].flatMap(([id]) => [
    { from: id, fields: ['employee_code'], to: 'Employee', toFields: ['Employee_Code'], enforced: 'create' },
    { from: id, fields: ['pmonth', 'billingType'], to: 'ProcessMonth', toFields: ['pmonth', 'billingType'], enforced: 'create', label: 'pmonth + billingType' },
  ]),
  { from: 'WageArrear', fields: ['arrearRefPmonth', 'billingType'], to: 'ProcessMonth', toFields: ['pmonth', 'billingType'], enforced: 'create', label: 'arrearRefPmonth + billingType' },
  { from: 'ServiceChargeRule', fields: ['ContractorID'], to: 'Contractor', toFields: ['Contractor_ID'], enforced: 'create' },
  { from: 'ServiceChargeRule', fields: ['entity_code'], to: 'LegalEntity', toFields: ['entity_code'], enforced: 'create' },
  { from: 'ServiceChargeRule', fields: ['EmployeeCode'], to: 'Employee', toFields: ['Employee_Code'], when: row => row.RuleType === 'EmployeeCode', enforced: 'create', label: 'EmployeeCode (RuleType = EmployeeCode)' },
  { from: 'ServiceChargeRule', fields: ['DesignCode'], to: 'Designation', toFields: ['design_code'], when: row => row.RuleType === 'Designation', enforced: 'create', label: 'DesignCode (RuleType = Designation)' },
  { from: 'ServiceChargeRule', fields: ['BuCode'], to: 'BusinessUnit', toFields: ['bu_code'], when: row => row.RuleType === 'BuCode', enforced: 'create', label: 'BuCode (RuleType = BuCode)' },
  { from: 'WageProcessLock', fields: ['pmonth', 'billingType'], to: 'ProcessMonth', toFields: ['pmonth', 'billingType'], enforced: 'create', label: 'pmonth + billingType' },
  { from: 'WageProcessLock', fields: ['entityCode'], to: 'LegalEntity', toFields: ['entity_code'], also: ['ALL'], enforced: 'create' },
  { from: 'WageProcessLock', fields: ['ContractorId'], to: 'Contractor', toFields: ['Contractor_ID'], also: ['ALL'], enforced: 'create' },

  // ---- security
  { from: 'RoleAssignment', fields: ['emp_id'], to: 'UserAccount', toFields: ['emp_id'], enforced: 'create', note: 'Roles can only be saved for an existing account; deactivating or renaming the account does not touch them.' },
  { from: 'AuditLogEntry', fields: ['actor'], to: 'UserAccount', toFields: ['emp_id'], also: ['local-recovery'], enforced: 'none' },
  { from: 'RecoveryToken', fields: ['emp_id'], to: 'UserAccount', toFields: ['emp_id'], enforced: 'create', unverified: true, note: 'A reset request for an unknown ID answers success but stores no token (it does not reveal which IDs exist).' },
  { from: 'ComplianceProfile', fields: ['stateCode'], to: 'StatutoryState', toFields: ['state_code'], enforced: 'none' },
];
