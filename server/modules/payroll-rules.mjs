/** Rule intake only. Null values deliberately have no legal or company-policy default. */
const fields = names => Object.fromEntries(names.split(' ').map(name => [name, null]));

export function emptyRuleSections() {
  return {
    central: {
      pf: fields('applicability wageBase employeeRate employerRate ceiling rounding'),
      esi: fields('applicability wageBase employeeRate employerRate eligibilityCeiling contributionPeriod rounding'),
      bonus: fields('eligibility wageBase formula period'),
    },
    state: {
      professionalTax: fields('applicability jurisdiction slabs frequency exemptions'),
      labourWelfareFund: fields('applicability employeeContribution employerContribution frequency'),
      minimumWages: fields('categories rates variableDearnessAllowance effectiveNotification'),
      leave: fields('entitlement carryForward encashment'),
      registers: fields('requiredFormats retention'),
    },
    company: {
      wageBasis: fields('rateBasis paidDayCodes monthlyDivisor partialPeriodProration weeklyOffHolidayEligibility'),
      overtime: fields('eligibility hoursSource baseComponents multiplier rounding'),
      earnings: fields('componentDefinitions calculationFormulas arrearsTreatment'),
      deductions: fields('componentDefinitions negativeNetPayHandling'),
      leavePosting: fields('sourceMapping creditFormula availedTreatment encashmentFormula doublePostingPolicy'),
      serviceCharges: fields('base rulePriority rateUnit taxTreatment'),
      rounding: fields('componentPrecision netPayMethod statutoryMethods'),
    },
  };
}

export const INDIAN_STATES = {
  AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam',
  BR: 'Bihar', CH: 'Chandigarh', CG: 'Chhattisgarh', DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana', HP: 'Himachal Pradesh', JK: 'Jammu and Kashmir',
  JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MP: 'Madhya Pradesh',
  MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha',
  PY: 'Puducherry', PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana',
  TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', WB: 'West Bengal',
};

export function newRuleProfile(stateCode = 'JH', metadata = {}) {
  return {
    id: metadata.id || stateCode, name: metadata.name || INDIAN_STATES[stateCode] || stateCode,
    stateCode, schemaVersion: 1, status: 'DRAFT', version: 1,
    effectiveFrom: null, effectiveTo: null, sourceRef: null, sourceReferences: [],
    verificationStatus: 'UNVERIFIED', rules: emptyRuleSections(), history: [],
  };
}

export function mergeRuleSections(input = {}, base = emptyRuleSections()) {
  const result = structuredClone(base);
  for (const [section, groups] of Object.entries(input)) {
    if (!groups || typeof groups !== 'object' || Array.isArray(groups)) {
      result[section] = groups;
      continue;
    }
    result[section] ||= {};
    for (const [group, value] of Object.entries(groups)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) result[section][group] = { ...result[section][group], ...value };
      else result[section][group] = value;
    }
  }
  return result;
}

function meaningful(value) {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true; // Explicit zero and false are user-supplied policies, never defaults.
}

const words = name => name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
export function payrollReadiness(profile) {
  const missingFields = [];
  for (const field of ['effectiveFrom', 'sourceRef']) if (!meaningful(profile[field])) missingFields.push({ path: field, label: words(field) });
  const defaults = emptyRuleSections();
  for (const [section, groups] of Object.entries(defaults)) {
    for (const [group, values] of Object.entries(groups)) {
      for (const field of Object.keys(values)) {
        if (!meaningful(profile.rules?.[section]?.[group]?.[field])) missingFields.push({ path: `rules.${section}.${group}.${field}`, label: `${words(section)} / ${words(group)} / ${words(field)}` });
      }
    }
  }
  return {
    profileId: profile.id, stateCode: profile.stateCode, profileName: profile.name,
    ruleVersion: profile.version, verificationStatus: profile.verificationStatus,
    status: missingFields.length ? 'AWAITING_BFCL_RULES' : 'AWAITING_RULE_VERIFICATION_AND_IMPLEMENTATION',
    calculationEnabled: false, engineImplemented: false, missingCount: missingFields.length, missingFields,
    message: missingFields.length
      ? 'Provide BFCL company policies and the applicable central and state rules with effective dates and source references. Draft values do not enable payroll.'
      : 'Draft rule intake is complete. The supplied rules still require verification, implementation and approved expected-result tests before payroll can run.',
  };
}
