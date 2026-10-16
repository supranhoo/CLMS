// Generates docs/testing/test-case-matrix.csv and docs/testing/TEST-CASES.md: one row for every API route the server
// lists, every UI route the app declares (with its variants), and each end-to-end workflow, with the automated check
// that covers it (or "manual").
//
//   node scripts/test-matrix.mjs            write the files
//   node scripts/test-matrix.mjs --check    exit 1 when the committed files are stale (run by `npm test`)
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/testing');
const check = process.argv.includes('--check');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// ---------------------------------------------------------------- inputs
const server = createServer({ persist: false }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const capabilities = (await (await fetch(`http://127.0.0.1:${server.address().port}/api/dev/capabilities`)).json()).endpoints;
await new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); });

function csvRows(text) {
  const rows = []; let row = []; let field = ''; let quoted = false; text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; continue; }
    if (c === '"') quoted = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows; return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const inventory = csvRows(read('docs/ui-redesign/route-inventory.csv'));
const byRoute = new Map(inventory.map(r => [r.route_path, r]));
const testFiles = fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs'));
const testText = Object.fromEntries(testFiles.map(f => [f, read('tests/' + f).toLowerCase()]));

// ---------------------------------------------------------------- UI route cases
const SLUGS = ['form-xii-register-of-contractors', 'form-xiii-register-of-workmen', 'form-xix-wage-slip', 'form-xvi-muster-roll', 'form-xviii-wages-cum-muster-roll', 'form-xxiii-register-of-fines'];
const appRoutes = [...new Set([...read('src/App.jsx').matchAll(/path="([^"]+)"/g)].map(m => m[1]))].filter(p => p.startsWith('/'));
const expand = route => {
  if (route === '/development/unavailable/:module') return ['/development/unavailable/payroll'];
  if (route === '/development/import/:kind') return ['employees', 'contractors', 'punches'].map(k => `/development/import/${k}`);
  if (route === '/development/:tool') return ['accounting', 'approvals', 'audit', 'outbox', 'jobs'].map(t => `/development/${t}`);
  if (route === '/compliance/:form') return SLUGS.map(s => `/compliance/${s}`);
  return [route];
};
const uiRoutes = [...new Set(appRoutes.flatMap(expand)), '/__unknown_route__'];
const SCENARIOS = { '/login': ['UI-01'], '/wageEarnings': ['UI-03'], '/wageDeductions': ['UI-04'], '/ManualMuster': ['UI-05', 'UI-14'], '/ManageFixWages': ['UI-06'], '/registerContractor': ['UI-07'], '/change-password': ['UI-08'], '/Dashboard': ['UI-09'], '/AssignRoles': ['UI-10'], '/printAtndSummary': ['UI-11'], '/monthlyAtndRegTimes': ['UI-12', 'UI-13'], '/monthlyAtndSheet': ['UI-12'], '/UploadEmpWageComp': ['UI-15'], '/ExportFixWagesDump': ['UI-15'] };
const inventoryFor = route => byRoute.get(route) || [...byRoute.values()].find(r => r.route_path.toLowerCase() === route.toLowerCase()) || byRoute.get(route.replace(/\/[^/]+$/, '/:' + (route.startsWith('/compliance') ? 'form' : route.startsWith('/development/import') ? 'kind' : route.startsWith('/development/unavailable') ? 'module' : 'tool')));
const ui = uiRoutes.map((route, i) => {
  const meta = inventoryFor(route) || {}; const scenarios = SCENARIOS[route] || SCENARIOS['/' + route.slice(1)] || [];
  const unknown = route === '/__unknown_route__';
  return {
    id: `UI-R-${String(i + 1).padStart(3, '0')}`, type: 'UI route', area: meta.screen_family || (unknown ? 'Routing' : 'Other'), target: route,
    expectation: unknown ? 'An unknown address shows the not-found view, not a blank page or an error' : `${meta.component_symbol || 'The screen'} renders for a signed-in administrator with no script, console or 5xx errors; controls are labelled; empty, loading and error states are visible; unsupported actions say so`,
    automated: ['UI-02', ...scenarios].join('; '), manual: 'Layout at 1440 px and 390 px, keyboard order, error and empty states (checklist TC-UI in TEST-PLAN.md section 6)', priority: meta.priority || 'P2',
  };
});

// ---------------------------------------------------------------- API cases
const AREA_PRIORITY = { users: 'P0', menu: 'P1', employee: 'P1', contractor: 'P1', attendance: 'P1', leave: 'P1', wages: 'P1', assignRoles: 'P1', 'master-data': 'P1', entity: 'P2', accounting: 'P2', compliance: 'P2', payroll: 'P2', payslip: 'P3', dev: 'P1' };
// A single common word ("state", "jobs", "query") would match unrelated text, so those need the whole path; camelCase action names are distinctive enough on their own.
const covered = (action, fullPath) => testFiles.filter(f => {
  if (testText[f].includes(fullPath.toLowerCase())) return true;
  return /[A-Z]/.test(action) && new RegExp('(^|[^a-z0-9])' + action.toLowerCase().replace(/[^a-z0-9]/g, '') + '([^a-z0-9]|$)').test(testText[f]);
}).map(f => f.replace('.test.mjs', ''));
const EXPECT = {
  implemented: 'Refused without a session (401) unless public; refused outside the user\'s scope (403); validates input (400/404/409); succeeds with valid input; never a 5xx',
  simulated: 'As implemented, but the result is labelled as simulated and must not be read as a business outcome',
  'rules-required': 'Answers 422 listing the BFCL rules still needed; never a calculated figure',
  unsupported: 'Answers 501 "not supported" (no fake success, no proxy to production)',
};
const api = capabilities.map((c, i) => {
  const area = c.path.split('/')[2] || 'root'; const action = c.path.split('/').filter(p => p && !p.startsWith(':')).at(-1);
  const behaviours = c.status === 'unsupported' ? [] : covered(action, c.path.replace(/:[A-Za-z]+/g, ''));
  const automated = ['SWEEP-02 (auth)', 'SWEEP-03 (no crash)', c.status === 'unsupported' ? 'SWEEP-04 (501)' : '', ...behaviours.map(b => `${b}.test`)].filter(Boolean).join('; ');
  return {
    id: `API-${String(i + 1).padStart(3, '0')}`, type: 'API', area, target: `${c.method} ${c.path}`, expectation: EXPECT[c.status] || EXPECT.implemented, automated,
    manual: c.status !== 'unsupported' && !behaviours.length ? 'No behavioural test names this endpoint: exercise happy path, validation and scope by hand or add a contract test' : '',
    priority: c.status === 'unsupported' ? 'P3' : AREA_PRIORITY[area] || 'P2',
    status: c.status,
  };
});

// ---------------------------------------------------------------- workflows (end to end)
const WORKFLOWS = [
  ['Sign in, use the app, change password, sign out', 'P0', 'Sign in as demo; change nothing; register an ordinary user (admin); sign in as that user; change their password; confirm the message, the automatic sign-out and that the old password no longer works; sign out and replay the old token', 'The new password works, the old one and the old token are refused', 'UI-01; UI-08; UI-09; AUD-A06; AUD-A08; mock-api.test'],
  ['Account recovery', 'P1', 'Ask for a reset token for a user; read it from the local outbox (admin Development > Outbox); reset the password; sign in; try the token again', 'The token works once, expires after 10 minutes, and three requests a day are allowed', 'feature-workflows.test'],
  ['Lock-out and revoke', 'P1', 'Enter ten wrong passwords for one ID; deactivate a signed-in user; reset the data', '429 for that ID only; a deactivated user\'s session ends at once; reset revokes every session', 'AUD-A09; AUD-A07; SWEEP-07'],
  ['Roles and scope', 'P0', 'Register a user; assign business unit, contractor, department, location and a WRITE activity; sign in as that user', 'The user sees and edits only workers in all four scopes; an empty assignment shows nothing; nested reports respect the scope', 'AUD-A11; isolation.test; feature-workflows.test; UI-10'],
  ['Onboard a contractor and a worker', 'P0', 'Add a contractor; add a worker for that contractor with department, business unit and entity; edit the worker (pending); approve the change as an administrator', 'The worker is created; the edit is applied only after approval and keeps any later change; unknown references are refused', 'AUD-D01; AUD-D12; mock-api.test; UI-07'],
  ['Import workers from a workbook', 'P1', 'Open Development > Import; validate (dry run) a workbook with a bad row; fix it; commit; repeat the commit', 'A bad row blocks the whole batch; a clean one inserts; a repeat is refused unless UPSERT is chosen; numeric cells become text', 'import-workbook.test; feature-workflows.test'],
  ['Maintain master data', 'P1', 'Add, rename and delete a business unit, location, division, cost centre, city, shift group and holiday', 'Duplicate keys and renames onto an existing key are refused; a record still used by workers, allocations or manpower cannot be deleted or re-keyed', 'AUD-D02/D03; ERD-06'],
  ['Daily attendance', 'P0', 'Enter a manual muster mark (every mark in the list); upload a muster workbook; regularise a punch; approve it; try to edit it; withdraw the approval and edit', 'Only listed marks are accepted; duplicates are refused with the reason; an approved regularisation is read-only until withdrawn', 'attendance.test; AUD-D13; AUD-D14; UI-05; UI-14'],
  ['Punch import to processed attendance', 'P1', 'Upload punches; run Process attendance; read the job', 'Punches are stored, first and last punch become IN/OUT, duplicates are counted, and no payable-day rule is applied (the screen says so)', 'attendance.test'],
  ['Approved manpower and requests', 'P2', 'Add approved manpower; add an on-duty request; approve and reject requests', 'References are checked; overlapping requests are refused; approval stays "awaiting BFCL rules"', 'attendance.test; ERD-04'],
  ['Attendance reports and exports', 'P0', 'Export monthly attendance with times (single sheet and per contractor), monthly sheet (XLS) and daily register; try an empty range; try From after To', 'Workbooks have the right columns and totals; an empty or failing export shows an error, never "printed successfully"', 'UI-12; UI-13; export-workbook.test; attendance.test'],
  ['Leave', 'P0', 'Add a leave; query the ledger; add a manual ledger row; delete the leave; try overlapping and over-long leave', 'Balance moves by the days taken and returns on delete; overlap and days longer than the dates are refused; payroll posting answers 422', 'leave-ledger.test; AUD-D04; payroll-posting.test'],
  ['Wage periods and rates', 'P0', 'Add a process month; add a fixed wage (billing type M, PF Y/N); add a second effective-dated rate; delete a month that has inputs', 'Rates are effective-dated rows; a month with inputs cannot be deleted; PF/ESI/LWF accept Y or N only', 'payroll.test; UI-06'],
  ['Wage inputs', 'P0', 'Add an earning, a deduction and an arrear; try duplicates; upload a workbook with one bad row; add a service-charge rule', 'The code lists work in the screens; duplicates and bad rows are refused whole; amounts of 0 are allowed', 'feature-workflows.test; payroll.test; UI-03; UI-04; UI-15'],
  ['Lock a period', 'P0', 'Lock a month for a contractor; try to edit its inputs and rates; unlock', 'Edits answer 423 for that contractor only', 'feature-workflows.test; payroll-posting.test'],
  ['Wage processing (not available)', 'P1', 'Try Process wages and every statement and report', '422/501 with the missing BFCL rules; no figure is ever shown as a result', 'payroll.test; SWEEP-04'],
  ['Compliance profiles', 'P2', 'Create a state profile; make it active; edit its rules with a stale version; open each compliance report', 'Version conflicts answer 409; unverified status cannot be set to verified; reports show recorded data only', 'feature-workflows.test'],
  ['Reset and repeat', 'P0', 'Reset the data (admin); sign in again; run a workflow twice', 'Seed fixtures return, every session is revoked, the second run starts clean', 'SWEEP-07; UI suite (fresh server per run)'],
];
const workflows = WORKFLOWS.map(([name, priority, steps, expected, automated], i) => ({ id: `WF-${String(i + 1).padStart(2, '0')}`, type: 'Workflow', area: 'End to end', target: name, expectation: expected, automated, manual: steps, priority }));

// ---------------------------------------------------------------- write
const cases = [...workflows, ...ui, ...api];
const COLUMNS = ['id', 'type', 'area', 'target', 'expectation', 'automated', 'manual', 'priority'];
const csvCell = value => { const text = String(value ?? ''); return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; };
const csv = [['Case ID', 'Type', 'Area', 'Target', 'Expected behaviour', 'Automated by', 'Manual check / steps', 'Priority'].join(','), ...cases.map(c => COLUMNS.map(k => csvCell(c[k])).join(','))].join('\n') + '\n';

const count = (rows, pick) => rows.reduce((a, r) => (a[pick(r)] = (a[pick(r)] || 0) + 1, a), {});
const apiByStatus = count(api, r => r.status); const apiNamed = api.filter(r => r.status !== 'unsupported' && !r.manual).length; const apiNeedsTests = api.filter(r => r.manual);
const md = [
  '# CLMS replica: test case matrix', '',
  `Generated by \`node scripts/test-matrix.mjs\` from the server's own route list, the router in \`src/App.jsx\`, the route inventory and the test files. The full table is [test-case-matrix.csv](test-case-matrix.csv) (${cases.length} rows; open it in a spreadsheet and filter by Type, Area or Priority).`, '',
  '| Type | Cases | Automated by |', '| --- | --- | --- |',
  `| End-to-end workflows | ${workflows.length} | named in each row (unit/contract tests, UI scenarios) |`,
  `| UI routes and variants | ${ui.length} | UI-02 route sweep for every route; ${Object.keys(SCENARIOS).length} routes also have a scripted flow |`,
  `| API routes | ${api.length} | SWEEP-02 (no session = 401), SWEEP-03 (never a 5xx), SWEEP-04 (unsupported = 501), and SWEEP-06 (administrator-only routes refused to ordinary users) for every route; ${apiNamed} implemented routes are also named by a behavioural test |`, '',
  `API routes by status: ${Object.entries(apiByStatus).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '',
  '## What "automated" means here', '',
  '- **SWEEP / AUD / ERD / HTML** are node:test suites in `tests/` (`npm test`, about 20 seconds, no browser).',
  '- **UI-nn** are browser scenarios in `tests/ui/smoke.mjs` (`npm run test:ui`, about 3 minutes, needs Chromium).',
  '- "Named by a behavioural test" is a text match: the route\'s action name appears in a test file. It shows where to look, not that every branch is covered. Server line coverage is measured separately (see READINESS.md).', '',
  '## End-to-end workflows', '',
  ...workflows.flatMap(w => [`### ${w.id} ${w.target}  (${w.priority})`, '', `1. **Steps:** ${w.manual}.`, `2. **Expected:** ${w.expectation}.`, `3. **Automated:** ${w.automated}.`, '']),
  `## API routes with no behavioural test of their own (${apiNeedsTests.length})`, '',
  'These are covered by the sweeps only (authentication, no crash, scope). Give each a contract test when its area is next changed.', '',
  ...Object.entries(count(apiNeedsTests, r => r.area)).sort().map(([area, n]) => `- **${area}**: ${n}`), '',
].join('\n');

const files = { 'test-case-matrix.csv': csv, 'TEST-CASES.md': md };
if (check) {
  const stale = Object.entries(files).filter(([n, t]) => !fs.existsSync(path.join(outDir, n)) || fs.readFileSync(path.join(outDir, n), 'utf8') !== t).map(([n]) => n);
  if (stale.length) { console.error('docs/testing is out of date: ' + stale.join(', ') + '. Run `node scripts/test-matrix.mjs`.'); process.exit(1); }
  console.log('docs/testing matrix is up to date.');
} else {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(outDir, n), t);
  console.log(`Wrote ${cases.length} cases (${workflows.length} workflows, ${ui.length} UI routes, ${api.length} API routes); ${apiNeedsTests.length} API routes have no behavioural test of their own.`);
}
