// Planning-only audit. Reads application sources; writes evidence under this directory only.
// Run from the replica root: node docs/ui-redesign/build-route-inventory.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { MENUS } from '../../server/seed.mjs';

const outDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(outDir, '../..');
const appPath = path.join(root, 'src/App.jsx');
const app = fs.readFileSync(appPath, 'utf8');
const imports = new Map([...app.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+)["']/g)].map(m => [m[1], m[2]]));
const starts = [...app.matchAll(/<Route\b/g)].map(m => m.index);
const forward = p => p.split(path.sep).join('/');
const lineAt = (source, index) => source.slice(0, index).split('\n').length;
const readPath = importPath => {
  const base = path.resolve(path.dirname(appPath), importPath);
  const found = [base, `${base}.jsx`, `${base}.js`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  assert(found, `Missing component import ${importPath}`);
  return forward(path.relative(root, found));
};
const routes = starts.map((start, i) => {
  const block = app.slice(start, starts[i + 1]);
  const routePath = block.match(/\bpath="([^"]+)"/)?.[1];
  const component = block.match(/\bComponent=\{(\w+)\}/)?.[1] || block.match(/\belement=\{<(\w+)/)?.[1];
  assert(routePath && component && imports.has(component), `Unparsed Route at line ${lineAt(app, start)}`);
  return { routePath, component, componentPath: readPath(imports.get(component)), line: lineAt(app, start), config: block.match(/\bmaster="([^"]+)"/)?.[1] || '' };
});
assert.equal(new Set(routes.map(r => r.routePath.toLowerCase())).size, routes.length, 'Duplicate case-insensitive route declarations need manual review.');

const menuGroups = new Map(MENUS.filter(m => !m.parent_menu_id).map(m => [m.menu_id, m.menu_name]));
const children = MENUS.filter(m => m.parent_menu_id && m.menu_url);
const matches = (pattern, url) => {
  if (pattern === '*') return false;
  const p = pattern.replace(/\/$/, '').split('/');
  const u = url.replace(/\/$/, '').split('/');
  return p.length === u.length && p.every((segment, i) => segment.startsWith(':') || segment.toLowerCase() === u[i].toLowerCase());
};
const score = pattern => pattern.split('/').reduce((sum, segment) => sum + (segment.startsWith(':') ? 1 : 10), 0);
const resolve = url => routes.filter(r => matches(r.routePath, url)).sort((a, b) => score(b.routePath) - score(a.routePath))[0];

const familyFor = r => {
  const name = r.component;
  if (name === 'DevelopmentUnavailable') return ['Unavailable / error state', 'W6', 'P1'];
  if (name === 'FeatureWorkbench') return ['State profiles / feature coverage', 'W4', 'P1'];
  if (name === 'DesignSystem') return ['Design system reference (development only)', 'W0', 'P0'];
  if (name === 'ComplianceReports') return ['Compliance report working data', 'W5', 'P1'];
  if (name === 'LocalWorkspace') return [r.routePath.includes('/import/') ? 'Workbook import' : 'Local operational workspace', 'W5', 'P1'];
  if (name === 'Dashboard') return ['Dashboard / navigation', 'W1', 'P0'];
  if (/LandingPage|LoginScreen|ChangePassword|ResetSuccess|ResetPasswd|RegisterScreen/.test(name)) return ['Entry / authentication', 'W1', 'P0'];
  if (/ManageUSers|AssignRoles/.test(name)) return ['Administration / access', 'W2', 'P1'];
  if (/MasterDataManager|ShiftSetup/.test(name)) return ['Reference masters', 'W2', 'P1'];
  if (r.componentPath.includes('/Contractor/')) return ['Contractor management', 'W2', 'P1'];
  if (r.componentPath.includes('/Employee/')) return [name === 'ExportEmpMastDump' ? 'Worker report / export' : 'Worker management', name === 'ExportEmpMastDump' ? 'W5' : 'W2', 'P1'];
  if (r.componentPath.includes('/AttendanceMuster/')) {
    const report = /Print|MonthlyAtnd|ExpRegPunch/.test(name);
    return [report ? 'Attendance report / export' : 'Attendance operation', report ? 'W5' : 'W3', 'P1'];
  }
  if (r.componentPath.includes('/Leave/')) {
    const report = /SummaryReport|BalanceReport/.test(name);
    return [report ? 'Leave report' : 'Leave operation', report ? 'W5' : 'W3', 'P1'];
  }
  if (r.componentPath.includes('/Wages/')) {
    const report = /Print|Statement|WageSlip|Report|Comparission|Dump/.test(name);
    return [report ? 'Wage output / report' : 'Wage input / setup / processing', report ? 'W5' : 'W4', 'P1'];
  }
  throw new Error(`Unclassified ${name}`);
};

const parameterVariants = {
  '/development/unavailable/:module': 'Any module label; no active seeded menu uses this pattern. Preserve distinct unavailable-module explanation.',
  '/development/:tool': 'accounting; approvals; audit; outbox; jobs. Unknown tool currently renders the workspace with an error. /development/features has its own more-specific route.',
  '/development/import/:kind': 'employees; contractors; punches. Unknown kind must have an explicit invalid-tool design; this pattern is more specific than /development/:tool.',
  '/compliance/:form': 'form-xii-register-of-contractors; form-xiii-register-of-workmen; form-xix-wage-slip; form-xvi-muster-roll; form-xviii-wages-cum-muster-roll; form-xxiii-register-of-overtime. Unknown form has an unsupported-data/error state.',
};
function requirementsFor(r) {
  const notes = [];
  const c = r.component;
  if (r.routePath === '/Dashboard') notes.push('Preserve /dashboard navigation compatibility; current declaration uses uppercase D and router matching is case-insensitive. Menu/activity visibility must remain authoritative. No unsupported action may appear successful.');
  if (c === 'ManageEmployees') notes.push('Long worker form, list/detail/edit, Aadhaar/PAN dialogs, lookup fields, change approvals and workbook import/export need deliberate task sections; preserve field contracts and literal identifiers.');
  if (/ManageContractors|RegisterContractor/.test(c)) notes.push('Two contractor entry surfaces share a data domain but are separate route/component declarations; align design and validation before considering consolidation.');
  if (c === 'ManageUSers') notes.push('Preserve separate create/edit password semantics and recovery/demo-account restrictions; never display password material.');
  if (c === 'AssignRoles') notes.push('Six assignment dimensions and save state need clear scope summaries; preserve empty assignments and atomic save contract.');
  if (c === 'ShiftSetup') notes.push('Two non-route tabs: shift-groups and shift-times; cover both and their separate field sets.');
  if (c === 'MasterDataManager') notes.push(`Shared renderer with master="${r.config}"; preserve key fields, dates/lookups and master-specific labels.`);
  if (c === 'ManageAttendance') notes.push('Daily-column month grid: preserve worker/date headers, status legend and horizontal scrolling; sticky headers/columns and keyboard strategy require prototype validation.');
  if (/ManualMuster|RegularizePunchGrid|UpdDeptInMust|ManageShGrpAlloc|ManageApprovedManpower/.test(c)) notes.push('Editable dense grid: distinguish selected rows, dirty changes, validation, approval and save scope; retain worker/date identity and batch error details.');
  if (/EmpRequest|ApproveEmployeeChanges/.test(c)) notes.push('Pending/approved/rejected states and decision feedback need consistent treatment; preserve approval side effects and local-only scope.');
  if (c === 'ManualProcessAttendance') notes.push('Local first/last-punch summary only; show job lifecycle/history and imported-source scope; do not imply paid attendance or device integration.');
  if (/Sandwich/.test(c)) notes.push('Draft policy versus execution needs explicit distinction; verified BFCL interpretation remains required for processing.');
  if (/LeaveLedgerEntry|LeavePayrollPosting/.test(c)) notes.push('Keep source-owned rows protected, unsaved/stale preview guards, whole-filter XLSX scope and separate preview/post actions.');
  if (c === 'LeaveLedgerEntry') notes.push('Source navigation gap: close handler uses MENU_URL=/menu, which has no explicit route and reaches the wildcard. Replace with the canonical dashboard destination.');
  if (c === 'DesignSystem') notes.push('W0 reference added after the original 73-route inventory: tokens, contrast pairs and component states. Development-only, no menu entry, no API calls; keep it in sync with src/styles as shared components land.');
  if (c === 'FeatureWorkbench') notes.push('Separate state selection, effective dates, draft versions/history, rule intake and feature status; avoid implying draft text verifies legal compliance or enables payroll.');
  if (/ProcessWages|PrintWages|WageSlip|PrintWageSlips|BankStatement|PFStatement|ESIStatement|CashStatement|PTReport|PTMonthReport|BonusReport|WageComparission/.test(c)) notes.push('Rule-dependent calculation/output: present prerequisite/status/next action before submission; retain explicit BFCL-rule blocker and no invented totals.');
  if (/WageDeductions|WageEarnings|WageArraers|ManageFixWages|ServiceCharges/.test(c)) notes.push('Recorded inputs only; align money/number controls, effective dates, import validation and locked-period feedback without deriving unsupported pay.');
  if (c === 'ManageWageProcessLock') notes.push('Locked/unlocked period and contractor/entity scope must remain visible; confirm impact without bypassing existing server checks.');
  if (/Print|Export|Statement|Report|Dump|ExpReg/.test(c) && c !== 'ComplianceReports') notes.push('Separate filter, result, export and print layouts; maintain existing output contracts, full result scope and format metadata.');
  if (c === 'ComplianceReports') notes.push('Six distinct form datasets; preserve WORKING DATA / BFCL FORMAT REQUIRED, missing requirements, field selection, filters/search metadata and print-only layout.');
  if (c === 'LocalWorkspace') notes.push(r.routePath.includes('/import/') ? 'Three import schemas, create/upsert intent, file validation/preview/commit steps and row errors; no silent row loss; use domain labels rather than database keys.' : 'Five tools need domain-specific columns, filters and states instead of JSON/key-driven presentation; recovery outbox must retain restricted token visibility and no-export behavior.');
  if (r.routePath === '*') notes.push('404/unmatched address is distinct from unavailable recovered module and blocked feature; retain safe dashboard navigation.');
  if (c === 'DevelopmentUnavailable' && r.routePath !== '*') notes.push('Unavailable-module route is distinct from generic 404; preserve requested module context.');
  if (!notes.length) notes.push('Use shared page header, labelled controls, focus order, loading/empty/error/success states and responsive layout while preserving current local contracts.');
  return notes.join(' | ');
}

const rows = routes.map(r => {
  const linked = children.filter(m => resolve(m.menu_url)?.routePath === r.routePath);
  const [family, wave, priority] = familyFor(r);
  return {
    route_path: r.routePath,
    component_symbol: r.component,
    component_path: r.componentPath,
    route_kind: r.routePath === '*' ? 'fallback' : r.routePath.includes(':') ? 'parameterized' : 'static',
    variant_configuration: r.config ? `master=${r.config}` : parameterVariants[r.routePath] || '',
    menu_groups: [...new Set(linked.map(m => menuGroups.get(m.parent_menu_id)))].join(' | '),
    menu_labels: linked.map(m => m.menu_name).join(' | '),
    resolved_menu_paths: [...new Set(linked.map(m => m.menu_url))].join(' | '),
    menu_coverage: linked.length ? `${linked.length} menu item(s)` : r.routePath === '*' ? 'fallback only' : 'not in seeded module menu',
    screen_family: family,
    redesign_wave: wave,
    priority,
    special_requirements: requirementsFor(r),
    route_source: `src/App.jsx:${r.line}`,
  };
});
const headings = Object.keys(rows[0]);
const csv = value => `"${String(value).replaceAll('"', '""')}"`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'route-inventory.csv'), '\ufeff' + [headings.map(csv).join(','), ...rows.map(row => headings.map(key => csv(row[key])).join(','))].join('\r\n') + '\r\n');

const unmatchedMenus = children.filter(m => !resolve(m.menu_url)).map(m => ({ group: menuGroups.get(m.parent_menu_id), label: m.menu_name, path: m.menu_url }));
const noMenu = rows.filter(r => r.menu_coverage === 'not in seeded module menu');
const allSource = []; const dynamicNavigation = [];
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(directory, item.name)) : /\.[jt]sx?$/.test(item.name) ? [path.join(directory, item.name)] : []);
const visit = (node, fn) => {
  if (!node || typeof node !== 'object') return;
  if (node.type) fn(node);
  for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) {
    if (Array.isArray(value)) value.forEach(child => visit(child, fn));
    else if (value && typeof value === 'object') visit(value, fn);
  }
};
const memberName = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression' ? `${memberName(node.object)}.${memberName(node.property)}` : '';
for (const file of walk(path.join(root, 'src'))) {
  const content = fs.readFileSync(file, 'utf8');
  const ast = parse(content, { sourceType: 'module', plugins: ['jsx'] });
  const constants = new Map();
  // Only simple module-level string constants are resolved; API/prop-driven paths remain explicit review items.
  for (const statement of ast.program.body) if (statement.type === 'VariableDeclaration' && statement.kind === 'const') {
    for (const declaration of statement.declarations) if (declaration.id.type === 'Identifier' && declaration.init?.type === 'StringLiteral') constants.set(declaration.id.name, declaration.init.value);
  }
  const record = (expression, at, kind) => {
    const value = expression?.type === 'StringLiteral' ? expression.value : expression?.type === 'Identifier' ? constants.get(expression.name) : null;
    const source = `${forward(path.relative(root, file))}:${at}`;
    if (typeof value === 'string') {
      if (!value.startsWith('/')) return;
      const target = value.split(/[?#]/)[0];
      allSource.push({ source, path: target, route: resolve(target)?.routePath || null, resolvedFrom: expression.type === 'Identifier' ? expression.name : 'literal', kind });
    } else dynamicNavigation.push({ source, expression: content.slice(expression?.start, expression?.end), kind });
  };
  visit(ast, node => {
    if (node.type === 'CallExpression' && ['navigate', 'window.location.assign', 'window.location.replace'].includes(memberName(node.callee))) record(node.arguments[0], node.loc.start.line, 'navigation call');
    if (node.type === 'AssignmentExpression' && memberName(node.left) === 'window.location.href') record(node.right, node.loc.start.line, 'location assignment');
    if (node.type === 'JSXAttribute' && ['to', 'href'].includes(node.name.name) && node.value) record(node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value, node.loc.start.line, 'link attribute');
  });
}
const screenFiles = walk(path.join(root, 'src/screens')).filter(file => /\.jsx$/.test(file));
const routedComponents = new Set(rows.map(r => r.component_path));
const unroutedScreenFiles = screenFiles.map(file => forward(path.relative(root, file))).filter(file => !routedComponents.has(file));
const featureSource = fs.readFileSync(path.join(root, 'server/modules/workspace.mjs'), 'utf8');
const featureLinks = [];
visit(parse(featureSource, { sourceType: 'module' }), node => {
  if (node.type !== 'VariableDeclarator' || node.id.name !== 'features' || node.init?.type !== 'ArrayExpression') return;
  for (const entry of node.init.elements) if (entry?.type === 'ArrayExpression' && entry.elements[3]?.type === 'StringLiteral') {
    const target = entry.elements[3].value;
    featureLinks.push({ id: entry.elements[0]?.value, path: target, route: resolve(target)?.routePath || null, source: `server/modules/workspace.mjs:${entry.loc.start.line}` });
  }
});
const counts = {
  routeDeclarations: routes.length,
  staticRoutes: rows.filter(r => r.route_kind === 'static').length,
  parameterizedRoutes: rows.filter(r => r.route_kind === 'parameterized').length,
  fallbackRoutes: rows.filter(r => r.route_kind === 'fallback').length,
  routedComponentFiles: routedComponents.size,
  screenJsxFiles: screenFiles.length,
  menuGroups: menuGroups.size,
  menuEntries: children.length,
  uniqueMenuDestinations: new Set(children.map(m => m.menu_url.toLowerCase())).size,
  routesWithMenus: rows.filter(r => r.resolved_menu_paths).length,
  routesWithoutMenus: noMenu.length,
  unmatchedMenuEntries: unmatchedMenus.length,
  resolvedSourceNavigationReferences: allSource.length,
  unmatchedResolvedSourceNavigationReferences: allSource.filter(r => !r.route).length,
  dynamicSourceNavigationReferences: dynamicNavigation.length,
  featureWorkbenchLinks: featureLinks.length,
  unmatchedFeatureWorkbenchLinks: featureLinks.filter(r => !r.route).length,
  familyCounts: Object.fromEntries([...new Set(rows.map(r => r.screen_family))].map(f => [f, rows.filter(r => r.screen_family === f).length])),
  waveCounts: Object.fromEntries([...new Set(rows.map(r => r.redesign_wave))].sort().map(w => [w, rows.filter(r => r.redesign_wave === w).length])),
};
const groupedDuplicates = Object.entries(Object.groupBy(children, m => m.menu_url.toLowerCase())).filter(([, list]) => list.length > 1).map(([url, list]) => ({ url, entries: list.map(m => ({ group: menuGroups.get(m.parent_menu_id), label: m.menu_name })) }));
const evidence = { generatedFrom: ['src/App.jsx', 'server/seed.mjs', 'server/modules/workspace.mjs', 'src/screens/**/*.jsx'], counts, unmatchedMenus, noMenuRoutes: noMenu.map(r => r.route_path), duplicateMenuDestinations: groupedDuplicates, unroutedScreenFiles, resolvedSourceNavigationReferences: allSource, dynamicSourceNavigationReferences: dynamicNavigation, featureWorkbenchLinks: featureLinks };
fs.writeFileSync(path.join(outDir, 'route-audit-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ counts, noMenuRoutes: evidence.noMenuRoutes, duplicateMenuDestinations: groupedDuplicates, unmatchedMenus, unmatchedResolvedSourceNavigationReferences: allSource.filter(r => !r.route), dynamicSourceNavigationReferences: dynamicNavigation, unroutedScreenFiles }, null, 2));
