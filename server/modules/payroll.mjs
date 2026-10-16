import { INDIAN_STATES, newRuleProfile, mergeRuleSections, payrollReadiness } from './payroll-rules.mjs';

const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const same = (a, b) => String(a ?? '') === String(b ?? '');
const wildcard = value => !present(value) || value === 'ALL' || value === '*';
const billing = row => row.billingType || row.BillingType || row.billingtype;
const contractor = row => row.contractor_id || row.ContractorId || row.contractorId || row.ContractorID;
const entity = row => row.entity_code || row.entityCode;
const employeeCode = row => row.employee_code || row.EmployeeCode || row.Employee_Code;
const date = value => String(value || '').slice(0, 10);
const selected = (value, selection) => {
  if (!present(selection) || (Array.isArray(selection) && !selection.length)) return true;
  const values = Array.isArray(selection) ? selection : [selection];
  return values.some(item => wildcard(item) || same(value, item));
};
const mutation = { mutation: true };

/** All wage inputs are local records. There is deliberately no payroll calculation implementation. */
export function registerPayrollRoutes(ctx) {
  const { route, both, getState, save, fail, required, nextId, success } = ctx;
  const state = () => getState();
  const employees = () => state().employees;
  const employee = code => {
    const result = employees().find(row => row.Employee_Code === code);
    if (!result) fail(400, 'Select an existing local employee.');
    return result;
  };
  const validDate = (value, field) => {
    const text = date(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) fail(400, `${field} must be a valid YYYY-MM-DD date.`);
    return text;
  };
  const amount = (value, field, { positive = false } = {}) => {
    if (!present(value) || typeof value === 'boolean' || typeof value === 'object' || !Number.isFinite(Number(value)) || Number(value) < 0 || (positive && Number(value) === 0)) fail(400, `${field} must be a finite ${positive ? 'positive' : 'non-negative'} number.`);
    return Number(value);
  };
  const validBilling = value => { if (!['M', 'F'].includes(value)) fail(400, 'billingType must be M or F.'); return value; };
  const processMonth = (pmonth, cycle) => {
    const normalized = validDate(pmonth, 'pmonth');
    const found = state().processMonths.find(row => date(row.pmonth) === normalized && billing(row) === cycle);
    if (!found) fail(400, 'Select an existing process month for this billing type.');
    return found;
  };
  const matchesEmployee = (emp, filter = {}) => selected(emp.Employee_Code, filter.employee_code || filter.EmployeeCode || filter.employee || filter.employees) &&
    selected(emp.contractor_id, filter.contractor_id || filter.contractor || filter.ContractorId) && selected(emp.entity_code, filter.entity_code || filter.entityCode || filter.entity) &&
    selected(emp.bu, filter.bu) && selected(emp.dept, filter.department || filter.dept) && selected(emp.loc_code, filter.location || filter.loc_code) &&
    selected(emp.emp_type, filter.emp_type) && (!present(filter.activeEmp) || filter.activeEmp === 'ALL' || same(emp.Is_Active, filter.activeEmp));
  const lockMatches = (lock, pmonth, cycle, emp) => date(lock.pmonth) === date(pmonth) && (!cycle || billing(lock) === cycle) &&
    (wildcard(entity(lock)) || same(entity(lock), emp.entity_code)) && (wildcard(contractor(lock)) || same(contractor(lock), emp.contractor_id));
  const assertUnlocked = (pmonth, cycle, emp) => {
    if (state().wageLocks.some(lock => lockMatches(lock, pmonth, cycle, emp))) fail(423, `WAGE_PERIOD_LOCKED: ${date(pmonth)} / ${cycle || 'all billing types'} is locked for this entity and contractor.`);
  };
  const assertPeriodUnlocked = row => {
    if (state().wageLocks.some(lock => date(lock.pmonth) === date(row.pmonth) && billing(lock) === billing(row))) fail(423, 'WAGE_PERIOD_LOCKED: Remove the period locks before changing this process month.');
  };
  const stamp = row => ({ ...row, modified_by: 'demo', modified_at: new Date().toISOString() });

  // Process-month maintenance is calendar input validation, never a pay-day divisor policy.
  const normalizeMonth = input => {
    required(input, ['pmonth', 'start_date', 'end_date']);
    const pmonth = validDate(input.pmonth, 'pmonth');
    const cycle = validBilling(billing(input));
    const start = validDate(input.start_date, 'start_date'); const end = validDate(input.end_date, 'end_date');
    if (start > end || pmonth < start || pmonth > end) fail(400, 'The process date must fall inside an ordered start/end date range.');
    if (input.is_active && !['Y', 'N'].includes(input.is_active)) fail(400, 'is_active must be Y or N.');
    return { ...input, pmonth, billingType: cycle, billingtype: cycle, start_date: start, end_date: end };
  };
  const monthFilter = body => state().processMonths.filter(row => (!billing(body) || billing(row) === billing(body)) && (!body.pmonth || date(row.pmonth) === date(body.pmonth)));
  for (const endpoint of ['getAllProcessMonth', 'getProcessMonth', 'getProcessMonthByBillingCycle', 'getAllProcessMonthByBillingCycle', 'getArrearProcessMonth', 'getProcessMonthDates']) both('/api/wages/' + endpoint, monthFilter);
  route('POST', '/api/wages/addProcessMonth', body => {
    const row = normalizeMonth(body.newProcessMonth || body);
    if (state().processMonths.some(old => date(old.pmonth) === row.pmonth && billing(old) === row.billingType)) fail(409, 'This process month and billing type already exist.');
    state().processMonths.push(stamp(row)); save(); return success();
  }, mutation);
  route('POST', '/api/wages/updateProcessMonth', body => {
    const row = normalizeMonth(body.updatedProcessMonth || body);
    const index = state().processMonths.findIndex(old => date(old.pmonth) === row.pmonth && billing(old) === row.billingType);
    if (index < 0) fail(404, 'Process month not found.');
    assertPeriodUnlocked(row);
    if ((state().payrollRuns || []).some(run => date(run.pmonth) === row.pmonth && billing(run) === row.billingType && run.status === 'CALCULATED')) fail(409, 'A calculated payroll run references this period.');
    state().processMonths[index] = stamp({ ...state().processMonths[index], ...row }); save(); return success();
  }, mutation);
  route('POST', '/api/wages/deleteProcessMonth', body => {
    const input = body.updatedProcessMonth || body;
    const pmonth = validDate(input.pmonth, 'pmonth'); const cycle = validBilling(billing(input));
    const row = { pmonth, billingType: cycle }; assertPeriodUnlocked(row);
    const index = state().processMonths.findIndex(old => date(old.pmonth) === pmonth && billing(old) === cycle);
    if (index < 0) fail(404, 'Process month not found.');
    if (['earnings', 'deductions', 'arrears', 'payrollRuns'].some(key => (state()[key] || []).some(item => date(item.pmonth) === pmonth && billing(item) === cycle))) fail(409, 'The period is referenced by wage adjustments or payroll runs.');
    state().processMonths.splice(index, 1); save(); return success();
  }, mutation);

  const normalizeLock = input => {
    const pmonth = validDate(input.pmonth, 'pmonth'); const cycle = validBilling(billing(input)); processMonth(pmonth, cycle);
    const contractorId = wildcard(contractor(input)) ? 'ALL' : contractor(input);
    const entityCode = wildcard(entity(input)) ? 'ALL' : entity(input);
    if (contractorId !== 'ALL' && !state().contractors.some(row => row.Contractor_ID === contractorId)) fail(400, 'Select an existing local contractor.');
    if (entityCode !== 'ALL' && !employees().some(row => row.entity_code === entityCode) && !(state().masters?.['business-units'] || []).some(row => row.entity_code === entityCode)) fail(400, 'Select an existing local entity.');
    return { pmonth, billingType: cycle, entityCode, ContractorId: contractorId, contractorId };
  };
  const sameLock = (a, b) => date(a.pmonth) === date(b.pmonth) && billing(a) === billing(b) && same(entity(a), entity(b)) && same(contractor(a), contractor(b));
  both('/api/wages/getWageProcessLock', body => state().wageLocks.filter(row => (!body.pmonth || date(row.pmonth) === date(body.pmonth)) && (!billing(body) || billing(row) === billing(body))));
  route('POST', '/api/wages/addWageProcessLock', body => {
    const row = normalizeLock(body);
    if (state().wageLocks.some(old => sameLock(old, row))) fail(409, 'This wage period scope is already locked.');
    state().wageLocks.push(stamp(row)); save(); return success('The selected local wage period, entity and contractor are locked.');
  }, mutation);
  route('POST', '/api/wages/deleteWageProcessLock', body => {
    const row = normalizeLock(body.updatedProcessMonth || body);
    const index = state().wageLocks.findIndex(old => sameLock(old, row));
    if (index < 0) fail(404, 'This wage period lock was not found.');
    state().wageLocks.splice(index, 1); save(); return success();
  }, mutation);

  // Fixed wage rates are user-entered values, not assumed calculation rules.
  const wageNumbers = ['BasicRate', 'DARate', 'JaggeryRate', 'OTHALWRT', 'HRART', 'TRALWRT', 'UNALWRT', 'MEDIALWRT', 'CONALWRT', 'HRAOLDRT', 'GrossRate', 'OTFactor'];
  const fixedKey = row => [row.EmployeeCode, date(row.eff_date), billing(row)].join('|');
  const fixedRows = body => state().fixedWages.filter(row => matchesEmployee(employee(row.EmployeeCode), body) && (!billing(body) || billing(row) === billing(body)) && (!body.eff_date || date(row.eff_date) === date(body.eff_date))).map(row => ({ ...row, EmployeeName: employee(row.EmployeeCode).display_name, contractor_id: employee(row.EmployeeCode).contractor_id, entity_code: employee(row.EmployeeCode).entity_code }));
  both('/api/wages/getFixWagesDump', fixedRows);
  const normalizeFixed = input => {
    const code = employeeCode(input); const emp = employee(code);
    const cycle = validBilling(billing(input)); const effective = validDate(input.eff_date, 'eff_date');
    const row = { ...input, EmployeeCode: code, EmployeeName: emp.display_name, BillingType: cycle, eff_date: effective };
    delete row.billingType; delete row.billingtype;
    row.BasicRate = amount(input.BasicRate, 'BasicRate', { positive: true });
    for (const field of wageNumbers) if (present(input[field])) row[field] = amount(input[field], field);
    if (present(input.OTFACTOR)) row.OTFactor = amount(input.OTFACTOR, 'OTFactor');
    for (const field of ['PFApply', 'ESIApply', 'LWFApply']) if (present(input[field]) && !['Y', 'N'].includes(input[field])) fail(400, `${field} must be Y or N.`);
    // A rate effective on/before a locked period affects that period even when its own start date is earlier.
    const periods = state().processMonths.filter(period => billing(period) === cycle).sort((a, b) => date(a.start_date).localeCompare(date(b.start_date)));
    const nextRate = state().fixedWages.filter(old => old.EmployeeCode === code && billing(old) === cycle && date(old.eff_date) > effective).map(old => date(old.eff_date)).sort()[0];
    for (const period of periods) if (effective <= date(period.end_date) && (!nextRate || nextRate > date(period.start_date))) assertUnlocked(period.pmonth, cycle, emp);
    return row;
  };
  for (const action of ['add', 'update']) route('POST', '/api/wages/' + action + 'FixWages', body => {
    const row = normalizeFixed(body); const index = state().fixedWages.findIndex(old => fixedKey(old) === fixedKey(row));
    if (action === 'add' && index >= 0) fail(409, 'This employee, billing type and effective date already have fixed wage rates.');
    if (action === 'update' && index < 0) fail(404, 'Fixed wage record not found. Add a new effective-dated record instead.');
    if (index >= 0) state().fixedWages[index] = stamp({ ...state().fixedWages[index], ...row });
    else state().fixedWages.push(stamp(row));
    save(); return success();
  }, mutation);
  route('POST', '/api/wages/uploadWageComponents', body => {
    if (!Array.isArray(body.components) || !body.components.length) fail(400, 'components must be a non-empty array.');
    const rows = body.components.map(normalizeFixed); const keys = new Set(state().fixedWages.map(fixedKey));
    for (const row of rows) { const key = fixedKey(row); if (keys.has(key)) fail(409, 'Duplicate fixed wage record in the upload or local data. No rows were imported.'); keys.add(key); }
    state().fixedWages.push(...rows.map(stamp)); save(); return { ...success(), insertedCount: rows.length, notInsertedRecords: [] };
  }, mutation);

  const adjustments = [
    { noun: 'Deductions', table: 'deductions', prefix: 'ded', kind: 'Ded' },
    { noun: 'Earnings', table: 'earnings', prefix: 'ern', kind: 'Ern' },
    { noun: 'Arrears', table: 'arrears', prefix: 'arrear', kind: 'Arrear' },
  ];
  for (const spec of adjustments) {
    const codeField = spec.prefix + 'Code'; const valueField = spec.prefix + 'Value';
    const codeOf = row => row[codeField] || row[spec.prefix + '_code'] || row[spec.prefix[0].toUpperCase() + spec.prefix.slice(1) + 'Code'];
    const adjustmentKey = row => [row.employee_code, date(row.pmonth), billing(row), codeOf(row), spec.table === 'arrears' ? date(row.arrearRefPmonth) : ''].join('|');
    const normalizeAdjustment = (input, requireValue = true) => {
      const code = employeeCode(input); const emp = employee(code); const cycle = validBilling(billing(input));
      const pmonth = validDate(input.pmonth, 'pmonth'); processMonth(pmonth, cycle);
      const payCode = codeOf(input); if (!present(payCode)) fail(400, `${codeField} is required.`);
      const row = { employee_code: code, display_name: emp.display_name, pmonth, billingType: cycle, [codeField]: String(payCode).trim(), remarks: String(input.remarks || '') };
      if (requireValue) row[valueField] = amount(input[valueField] ?? input[spec.prefix + '_value'], valueField);
      if (spec.table === 'arrears') {
        row.arrearRefPmonth = validDate(input.arrearRefPmonth || input.arrear_ref_pmonth, 'arrearRefPmonth'); processMonth(row.arrearRefPmonth, cycle);
        if (row.arrearRefPmonth > pmonth) fail(400, 'The arrear reference period cannot be later than the posting period.');
        if (Object.hasOwn(input, 'arrearDays')) row.arrearDays = present(input.arrearDays) ? amount(input.arrearDays, 'arrearDays') : null;
      }
      assertUnlocked(pmonth, cycle, emp); return row;
    };
    both('/api/wages/get' + spec.kind + 'Codes', () => {
      const codes = new Set(['DEMO', ...state()[spec.table].map(codeOf)]);
      return [...codes].map(value => ({ [spec.prefix + '_code']: value, [spec.prefix + '_desc']: value === 'DEMO' ? 'Demo Adjustment' : value, [spec.prefix + '_name']: value === 'DEMO' ? 'Demo Adjustment' : value }));
    });
    both('/api/wages/getWage' + spec.noun, body => state()[spec.table].filter(row => (!body.pmonth || date(row.pmonth) === date(body.pmonth)) && (!billing(body) || billing(row) === billing(body)) && (!codeOf(body) || codeOf(row) === codeOf(body)) && matchesEmployee(employee(row.employee_code), body)).map(row => ({ ...row, display_name: employee(row.employee_code).display_name, [spec.prefix + '_code']: codeOf(row), [spec.prefix + '_name']: codeOf(row) })));
    for (const action of ['add', 'update', 'delete']) route('POST', '/api/wages/' + action + 'Wage' + spec.noun, body => {
      const row = normalizeAdjustment(body, action !== 'delete');
      const index = state()[spec.table].findIndex(old => adjustmentKey(old) === adjustmentKey(row));
      if (action === 'add' && index >= 0) fail(409, 'This employee, period, billing type and pay code already have an adjustment.');
      if (action !== 'add' && index < 0) fail(404, 'Wage adjustment not found.');
      if (action === 'delete') state()[spec.table].splice(index, 1);
      else if (action === 'update') state()[spec.table][index] = stamp({ ...state()[spec.table][index], ...row });
      else state()[spec.table].push(stamp(row));
      save(); return success();
    }, mutation);
    route('POST', '/api/wages/upload' + spec.noun, body => {
      if (!Array.isArray(body[spec.table]) || !body[spec.table].length) fail(400, `${spec.table} must be a non-empty array.`);
      const rows = body[spec.table].map(input => normalizeAdjustment(input));
      const keys = new Set(state()[spec.table].map(adjustmentKey));
      for (const row of rows) { const key = adjustmentKey(row); if (keys.has(key)) fail(409, 'Duplicate adjustment in the upload or local data. No rows were imported.'); keys.add(key); }
      state()[spec.table].push(...rows.map(stamp)); save(); return { ...success(), insertedCount: rows.length, notInsertedRecords: [] };
    }, mutation);
  }

  const serviceKey = row => [row.ContractorID, row.entity_code, date(row.Eff_PMonth), row.RuleType, row.EmployeeCode, row.BasicRate, row.DesignCode, row.BuCode].join('|');
  const normalizeService = input => {
    required(input, ['ContractorID', 'RuleType', 'Eff_PMonth', 'entity_code']);
    if (!state().contractors.some(row => row.Contractor_ID === input.ContractorID)) fail(400, 'Select an existing local contractor.');
    const ruleTypes = { EmployeeCode: 'EmployeeCode', Designation: 'DesignCode', BuCode: 'BuCode', BasicRate: 'BasicRate' };
    const target = ruleTypes[input.RuleType]; if (!target) fail(400, 'Select a supported service charge rule type.');
    required(input, [target]); const effective = validDate(input.Eff_PMonth, 'Eff_PMonth');
    if (!state().processMonths.some(row => date(row.pmonth) === effective)) fail(400, 'Select an existing effective process month.');
    if (!employees().some(row => row.entity_code === input.entity_code)) fail(400, 'Select an existing local entity.');
    if (target === 'EmployeeCode') { const emp = employee(input.EmployeeCode); if (emp.contractor_id !== input.ContractorID || emp.entity_code !== input.entity_code) fail(400, 'The employee must belong to the selected contractor and entity.'); }
    if (target === 'DesignCode' && !employees().some(row => row.design_code === input.DesignCode)) fail(400, 'Select an existing local designation.');
    if (target === 'BuCode' && !(state().masters['business-units'] || []).some(row => row.bu_code === input.BuCode)) fail(400, 'Select an existing local business unit.');
    const row = { ContractorID: input.ContractorID, entity_code: input.entity_code, RuleType: input.RuleType, Eff_PMonth: effective, EmployeeCode: '', BasicRate: '', DesignCode: '', BuCode: '', rate: amount(input.rate, 'rate') };
    row[target] = target === 'BasicRate' ? amount(input.BasicRate, 'BasicRate') : input[target];
    // No rate unit, precedence, formula, tax or percentage interpretation is assumed.
    for (const period of state().processMonths.filter(period => date(period.end_date) >= effective)) {
      for (const emp of employees().filter(emp => emp.contractor_id === row.ContractorID && emp.entity_code === row.entity_code && (target !== 'EmployeeCode' || emp.Employee_Code === row.EmployeeCode) && (target !== 'DesignCode' || emp.design_code === row.DesignCode) && (target !== 'BuCode' || emp.bu === row.BuCode))) assertUnlocked(period.pmonth, billing(period), emp);
    }
    return row;
  };
  const enrichService = row => ({ ...row, ContractorName: state().contractors.find(contractor => contractor.Contractor_ID === row.ContractorID)?.Contractor_Name || '' });
  both('/api/wages/getServiceCharges', body => state().serviceCharges.filter(row => selected(row.ContractorID, body.contractor_id || body.ContractorID) && selected(row.entity_code, body.entity_code)).map(enrichService));
  route('POST', '/api/wages/addServiceCharges', body => {
    const row = normalizeService(body); if (state().serviceCharges.some(old => serviceKey(old) === serviceKey(row))) fail(409, 'This effective service charge rule already exists.');
    const record = stamp({ ...row, RuleID: nextId(state().serviceCharges, 'RuleID') }); state().serviceCharges.push(record); save(); return enrichService(record);
  }, mutation);
  route('POST', '/api/wages/updateServiceCharges', body => {
    const index = state().serviceCharges.findIndex(row => Number(row.RuleID) === Number(body.RuleID)); if (index < 0) fail(404, 'Service charge rule not found.');
    normalizeService(state().serviceCharges[index]); const row = normalizeService({ ...state().serviceCharges[index], ...body });
    if (state().serviceCharges.some((old, i) => i !== index && serviceKey(old) === serviceKey(row))) fail(409, 'This effective service charge rule already exists.');
    state().serviceCharges[index] = stamp({ ...row, RuleID: Number(body.RuleID) }); save(); return enrichService(state().serviceCharges[index]);
  }, mutation);
  const deleteService = (body, params = {}) => {
    const index = state().serviceCharges.findIndex(row => String(row.RuleID) === String(params.id || body.RuleID)); if (index < 0) fail(404, 'Service charge rule not found.');
    normalizeService(state().serviceCharges[index]); state().serviceCharges.splice(index, 1); save(); return success();
  };
  route('DELETE', '/api/wages/deleteServiceCharges/:id', deleteService, mutation);
  route('POST', '/api/wages/deleteServiceCharges', deleteService, mutation);

  // Versioned state-specific compliance profiles. These records are drafts and cannot enable calculations.
  const profiles = () => state().complianceProfiles?.length ? state().complianceProfiles : [newRuleProfile('JH')];
  const activeProfile = () => profiles().find(profile => profile.id === state().activeComplianceProfileId) || profiles()[0];
  const storedProfiles = () => { state().complianceProfiles ||= profiles(); state().activeComplianceProfileId ||= state().complianceProfiles[0].id; return state().complianceProfiles; };
  const normalizeProfile = (body, previous) => {
    if (body.status && body.status !== 'DRAFT') fail(400, 'Rule profiles remain DRAFT until verified rules are implemented and tested.');
    if (body.verificationStatus && !['UNVERIFIED', 'SOURCE_REVIEW_PENDING'].includes(body.verificationStatus)) fail(400, 'Draft intake supports UNVERIFIED or SOURCE_REVIEW_PENDING only.');
    if (body.expectedVersion !== undefined && body.expectedVersion !== previous.version) fail(409, 'This profile changed since it was loaded. Reload before saving.');
    if (body.stateCode && body.stateCode !== previous.stateCode) fail(400, 'Create a separate profile to configure another state.');
    if (body.rules !== undefined && (!body.rules || typeof body.rules !== 'object' || Array.isArray(body.rules))) fail(400, 'rules must be an object with central, state and company sections.');
    if (body.rules && Object.keys(body.rules).some(key => !['central', 'state', 'company'].includes(key))) fail(400, 'Supported rule sections are central, state and company.');
    const effectiveFrom = body.effectiveFrom === undefined ? previous.effectiveFrom : body.effectiveFrom || null;
    const effectiveTo = body.effectiveTo === undefined ? previous.effectiveTo : body.effectiveTo || null;
    if (effectiveFrom) validDate(effectiveFrom, 'effectiveFrom'); if (effectiveTo) validDate(effectiveTo, 'effectiveTo');
    if (effectiveTo && (!effectiveFrom || effectiveTo < effectiveFrom)) fail(400, 'effectiveTo requires an earlier or equal effectiveFrom.');
    if (body.sourceReferences !== undefined && !Array.isArray(body.sourceReferences)) fail(400, 'sourceReferences must be an array.');
    return { ...previous, name: body.name || previous.name, effectiveFrom, effectiveTo,
      sourceRef: body.sourceRef === undefined ? previous.sourceRef : body.sourceRef || null,
      sourceReferences: body.sourceReferences === undefined ? previous.sourceReferences : body.sourceReferences,
      verificationStatus: body.verificationStatus || previous.verificationStatus, status: 'DRAFT',
      rules: body.rules === undefined ? previous.rules : mergeRuleSections(body.rules, previous.rules),
    };
  };
  const updateProfile = (id, body) => {
    const previous = profiles().find(profile => profile.id === id); if (!previous) fail(404, 'Compliance profile not found.');
    const next = normalizeProfile(body, previous);
    const { history, ...snapshot } = previous;
    next.history = [...(history || []), { ...snapshot, archivedAt: new Date().toISOString() }];
    next.version = previous.version + 1; next.modifiedAt = new Date().toISOString();
    const rows = storedProfiles(); rows[rows.findIndex(profile => profile.id === id)] = next; save(); return next;
  };
  route('GET', '/api/compliance/profiles', () => ({ activeProfileId: activeProfile().id, profiles: profiles(), availableStates: Object.entries(INDIAN_STATES).map(([stateCode, name]) => ({ stateCode, name })) }));
  route('POST', '/api/compliance/profiles', body => {
    const stateCode = String(body.stateCode || '').toUpperCase(); if (!INDIAN_STATES[stateCode]) fail(400, 'Select an Indian state or union territory.');
    const id = body.id || stateCode;
    if (!/^[a-z0-9_-]{1,40}$/i.test(id)) fail(400, 'Profile id must use letters, numbers, underscore or hyphen.');
    if (profiles().some(profile => profile.id === id)) fail(409, 'A profile with this id already exists.');
    const profile = normalizeProfile(body, newRuleProfile(stateCode, { id, name: body.name }));
    storedProfiles().push(profile); save(); return profile;
  }, mutation);
  route('PUT', '/api/compliance/profiles/active', body => {
    const profile = profiles().find(profile => profile.id === body.profileId); if (!profile) fail(404, 'Compliance profile not found.');
    storedProfiles(); state().activeComplianceProfileId = profile.id; save(); return profile;
  }, mutation);
  route('PUT', '/api/compliance/profiles/:id', (body, params) => updateProfile(params.id, body), mutation);
  route('GET', '/api/payroll/rules', () => activeProfile());
  route('PUT', '/api/payroll/rules', body => updateProfile(activeProfile().id, body), mutation);
  route('GET', '/api/payroll/readiness', () => payrollReadiness(activeProfile()));
  const rulesRequired = purpose => fail(422, `BFCL_RULES_REQUIRED: ${purpose} needs verified BFCL policies and applicable ${activeProfile().name} and central rules, followed by calculation implementation and expected-result tests. Draft rules do not enable payroll. See Payroll Readiness for missing fields.`);
  route('POST', '/api/wages/processWages', body => {
    if (body.pmonth && billing(body)) { processMonth(body.pmonth, billing(body)); for (const emp of employees().filter(emp => matchesEmployee(emp, body))) assertUnlocked(body.pmonth, billing(body), emp); }
    rulesRequired('Payroll processing');
  }, { mutation: true, status: 'rules-required', notes: '422 until supplied rules are verified, implemented and tested. No calculation or partial payroll writes.' });

  const calculatedRuns = body => (state().payrollRuns || []).filter(run => run.status === 'CALCULATED' && (!body.pmonth || date(run.pmonth) === date(body.pmonth)) && (!billing(body) || billing(run) === billing(body)));
  const reportRows = body => {
    const filter = { ...body, ...body.filters };
    const rows = calculatedRuns(body).flatMap(run => (run.rows || []).map(row => ({ ...row, pmonth: date(run.pmonth), billingType: billing(run), run_id: run.run_id, profileId: run.profileId, ruleVersion: run.ruleVersion }))).filter(row => {
      const emp = employees().find(emp => emp.Employee_Code === employeeCode(row)); return emp && matchesEmployee(emp, filter);
    });
    if (!rows.length) rulesRequired('This payroll report');
    return rows;
  };
  for (const name of ['getWageRegister', 'wageSlip', 'getBankStatement', 'getPFStatement', 'getESIStatement', 'getCashStatement', 'getPTReport', 'getPTMonthWiseReport', 'getBonusReport', 'getWageComparision']) both('/api/wages/' + name, reportRows, { status: 'rules-required', notes: 'Reads existing explicit CALCULATED payroll rows only. 422 when absent; never derives amounts from demo attendance or fixed wages.' });
  route('POST', '/api/wages/generateWageSlips', () => rulesRequired('Wage slip generation'), { status: 'rules-required', notes: 'Verified calculated payroll and an implemented document renderer are required.' });
  route('GET', '/api/payslip/progress/:id', () => fail(404, 'No local payroll document job exists.'), { status: 'implemented' });

  route('POST', '/api/leave/payroll-posting', body => {
    if (!['PREVIEW', 'POST'].includes(body.mode)) fail(400, 'mode must be PREVIEW or POST.');
    const pmonth = validDate(body.pmonth, 'pmonth'); required(body, ['contractor_id']);
    if (!state().contractors.some(row => row.Contractor_ID === body.contractor_id)) fail(400, 'Select an existing local contractor.');
    const runs = calculatedRuns({ ...body, pmonth }).filter(run => Array.isArray(run.rows) && run.rows.some(row => employees().some(emp => emp.Employee_Code === employeeCode(row) && emp.contractor_id === body.contractor_id)));
    if (!runs.length) rulesRequired('Payroll leave posting');
    const keys = new Set(); const outputs = [];
    for (const run of runs) {
      if (!present(run.run_id) || !['M', 'F'].includes(billing(run)) || !state().processMonths.some(period => date(period.pmonth) === pmonth && billing(period) === billing(run))) fail(422, 'Calculated payroll run needs a run id and valid billing period metadata. No ledger rows were changed.');
      const calculatedEmployees = new Set(run.rows.map(employeeCode));
      if (!Array.isArray(run.leaveRows)) rulesRequired('Payroll leave posting from calculated leave outputs');
      for (const source of run.leaveRows) {
        const code = employeeCode(source);
        if (!calculatedEmployees.has(code)) fail(422, 'A payroll leave output does not belong to an employee in this calculated run. No ledger rows were changed.');
        const emp = employee(code); if (emp.contractor_id !== body.contractor_id) continue;
        if (!['CL', 'EL', 'SL'].includes(source.leave_type_code) || !['CREDIT', 'AVAILED', 'ENCASHED'].includes(source.trans_type)) fail(422, 'Calculated payroll contains an invalid leave type or transaction type. No ledger rows were changed.');
        const days = amount(source.leave_days, 'leave_days', { positive: true });
        const key = [emp.Employee_Code, source.leave_type_code, source.trans_type, billing(run)].join('|');
        if (keys.has(key)) fail(409, 'Overlapping calculated payroll leave outputs need resolution. No ledger rows were changed.'); keys.add(key);
        if (state().ledger.some(row => row.ref_type !== 'PAYROLL' && row.employee_code === emp.Employee_Code && date(row.pmonth) === pmonth && row.leave_type_code === source.leave_type_code && row.trans_type === source.trans_type)) fail(409, 'A manual or leave transaction already records this payroll leave movement. Resolve the source mapping before posting; existing ledger rows were preserved.');
        if (body.mode === 'POST') assertUnlocked(pmonth, billing(run), emp);
        outputs.push({ employee_code: emp.Employee_Code, employee_name: emp.display_name, contractor_id: emp.contractor_id, contractor_name: emp.contractor_name,
          leave_type_code: source.leave_type_code, trans_type: source.trans_type, leave_days: days,
          balance_effect: source.trans_type === 'CREDIT' ? '+' : '-', billingType: billing(run), pmonth,
          ref_type: 'PAYROLL', ref_no: String(run.run_id), source_key: key, ruleVersion: run.ruleVersion, profileId: run.profileId,
          remarks: source.remarks || 'From explicit calculated local payroll leave output', period_name: pmonth });
      }
    }
    if (!outputs.length) rulesRequired('Payroll leave posting from calculated leave outputs for this contractor');
    if (body.mode === 'PREVIEW') return { demo: true, data: outputs, message: 'Preview of existing calculated payroll leave outputs only.' };
    // Validate the complete batch and scope before replacing any payroll-owned ledger rows.
    const scopeCycles = new Set(runs.map(billing));
    const inScope = row => row.ref_type === 'PAYROLL' && date(row.pmonth) === pmonth && scopeCycles.has(billing(row)) && (row.contractor_id || employees().find(emp => emp.Employee_Code === row.employee_code)?.contractor_id) === body.contractor_id;
    for (const row of state().ledger.filter(inScope)) assertUnlocked(pmonth, billing(row), employee(row.employee_code));
    const previous = new Map(state().ledger.filter(inScope).map(row => [row.source_key, row]));
    const retained = state().ledger.filter(row => !inScope(row)); let id = nextId(state().ledger, 'trans_id');
    const posted = outputs.map(row => ({ ...row, trans_id: previous.get(row.source_key)?.trans_id || id++, trans_date: previous.get(row.source_key)?.trans_date || new Date().toISOString(), created_by: 'demo' }));
    state().ledger = [...retained, ...posted]; save();
    return { ...success('Calculated local payroll leave outputs posted. Manual and leave-owned transactions were preserved.'), data: [{ posted_rows: posted.length }], postedRows: posted.length };
  }, { mutation: true, status: 'rules-required', notes: '422 without explicit CALCULATED payroll leave outputs. Atomic scoped and idempotent PAYROLL ledger posting; no fixture-to-payroll inference.' });
}
