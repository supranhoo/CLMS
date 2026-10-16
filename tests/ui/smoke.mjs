// Browser smoke suite for the CLMS replica. Not part of `npm test` (it needs a browser): run `npm run test:ui`.
//
//   node tests/ui/smoke.mjs                 start a throw-away API (memory only) and Vite on 5001/5173, run, stop
//   CLMS_BASE=http://127.0.0.1:5173 node tests/ui/smoke.mjs     drive servers you already started (see the warning below)
//   node tests/ui/smoke.mjs --only UI-03,UI-07                    run named scenarios
//   CLMS_BASE=... node tests/ui/smoke.mjs --reset                 first restore the seed fixtures of that instance
//   node tests/ui/smoke.mjs --json out.json                       also write a machine-readable result
//
// Needs Playwright with Chromium. It is not a project dependency: resolution order is local node_modules,
// $PLAYWRIGHT_MODULE_PATH, then a global install (CI installs it with `npm i --no-save playwright`).
//
// Every scenario uses the public demo account (or accounts it creates) on LOOPBACK only. Scenarios write to the
// server they drive, so with CLMS_BASE point it at a disposable instance, never at data you want to keep.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire as requireFrom } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = flag('--only')?.split(',');
const jsonOut = flag('--json');
const EXTERNAL = process.env.CLMS_BASE;
const BASE = EXTERNAL || 'http://127.0.0.1:5173';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error('The smoke suite only drives loopback: ' + BASE);

function loadPlaywright() {
  const tries = [
    () => createRequire(path.join(root, 'package.json'))('playwright'),
    () => process.env.PLAYWRIGHT_MODULE_PATH && createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH),
    () => createRequire(import.meta.url)('playwright'),
  ];
  for (const attempt of tries) { try { const mod = attempt(); if (mod?.chromium) return mod; } catch { /* try the next */ } }
  throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE_PATH.');
}

// ---------------------------------------------------------------- servers
const portFree = port => new Promise(resolve => { const probe = net.createServer(); probe.once('error', () => resolve(false)); probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true))); });
async function startServers() {
  for (const port of [5001, 5173]) if (!(await portFree(port))) throw new Error(`Port ${port} is busy. Stop the running replica first, or set CLMS_BASE to drive it.`);
  const { createServer } = await import(pathToFileURL(path.join(root, 'server/index.mjs')).href);
  const api = createServer({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'clms-ui-')), persist: false });
  await new Promise(resolve => api.listen(5001, '127.0.0.1', resolve));
  const vite = spawn(path.join(root, 'node_modules/.bin/vite'), ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/api/dev/health')).ok) break; } catch { /* still starting */ } await new Promise(r => setTimeout(r, 250)); }
  return { stop: async () => { vite.kill(); await new Promise(resolve => { api.closeAllConnections?.(); api.close(resolve); }); } };
}

// ---------------------------------------------------------------- helpers
const settle = async page => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(300); };
async function open(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const seen = { dialogs: [], consoleErrors: [], pageErrors: [], calls: [], serverErrors: [] };
  page.on('dialog', async dialog => { seen.dialogs.push(dialog.message()); await dialog.accept(); });
  page.on('console', m => { if (m.type() === 'error') seen.consoleErrors.push(m.text().replace(/\s+/g, ' ').slice(0, 200)); });
  page.on('pageerror', e => seen.pageErrors.push(e.message.slice(0, 200)));
  page.on('response', response => {
    const url = new URL(response.url()); if (!url.pathname.startsWith('/api/')) return;
    const request = response.request(); let body; try { body = request.postDataJSON(); } catch { body = undefined; }
    seen.calls.push({ method: request.method(), path: url.pathname, status: response.status(), body });
    if (response.status() >= 500) seen.serverErrors.push(`${request.method()} ${url.pathname} -> ${response.status()}`);
  });
  return { context, page, seen };
}
async function signInDemo(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await settle(page);
  await page.getByRole('button', { name: /demo workspace/i }).click(); await settle(page);
  assert.ok(await page.evaluate(() => !!JSON.parse(localStorage.getItem('user') || 'null')?.token), 'demo sign-in did not store a session');
}
async function signInAs(page, id, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await settle(page);
  await page.getByPlaceholder('Enter your user ID').fill(id); await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: 'Submit', exact: true }).click(); await settle(page);
}
const tokenOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('user') || 'null')?.token);
async function api(page, method, apiPath, body, token) {
  const t = token ?? await tokenOf(page);
  const response = await page.request.fetch(BASE + apiPath, { method, headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, ...(body === undefined ? {} : { data: JSON.stringify(body) }) });
  let json; try { json = await response.json(); } catch { json = undefined; }
  return { status: response.status(), json };
}
/** Pick an option from the n-th react-select on the page (keyboard open: the menu renders reliably that way). */
async function choose(page, index, text) {
  await page.locator('input[id^="react-select"]').nth(index).focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  const options = page.locator('[id*="react-select"][id*="option"]');
  await options.filter({ hasText: text }).first().click(); await page.waitForTimeout(150);
}
async function optionsOf(page, index) {
  await page.locator('input[id^="react-select"]').nth(index).focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  const texts = await page.locator('[id*="react-select"][id*="option"]').allInnerTexts(); await page.keyboard.press('Escape'); return texts;
}
const bodyText = page => page.evaluate(() => document.body.innerText);
/** The entry row (the one holding the Add button). Saved rows below it carry inputs with the same names. */
const addRow = page => page.locator('tr').filter({ has: page.getByRole('button', { name: 'Add', exact: true }) }).last();
const eventually = async (fn, ms = 4000) => { const end = Date.now() + ms; let last; while (Date.now() < end) { try { return await fn(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 150)); } } throw last; };

const XLSX = requireFrom(import.meta.url)(path.join(root, 'node_modules/xlsx'));
const ExcelJS = requireFrom(import.meta.url)(path.join(root, 'node_modules/exceljs/lib/exceljs.nodejs.js'));
/** Click a button that downloads a workbook, then read it back. */
async function downloadWorkbook(page, click) {
  const waiting = page.waitForEvent('download', { timeout: 15000 }); await click(); const download = await waiting;
  const file = path.join(os.tmpdir(), `clms-ui-${Date.now()}-${download.suggestedFilename()}`); await download.saveAs(file);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(file); fs.rmSync(file, { force: true }); return workbook;
}

// ---------------------------------------------------------------- scenarios
const VARIANTS = ['accounting', 'approvals', 'audit', 'outbox', 'jobs'].map(t => `/development/${t}`)
  .concat(['employees', 'contractors', 'punches'].map(k => `/development/import/${k}`), '/development/unavailable/payroll',
    ['form-xii-register-of-contractors', 'form-xiii-register-of-workmen', 'form-xix-wage-slip', 'form-xvi-muster-roll', 'form-xviii-wages-cum-muster-roll', 'form-xxiii-register-of-fines'].map(s => `/compliance/${s}`));
const appRoutes = () => [...new Set([...fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8').matchAll(/path="([^"]+)"/g)].map(m => m[1]))].filter(p => p.startsWith('/') && !p.includes(':') && !p.includes('*'));
const scenarios = [
  { id: 'UI-01', title: 'Sign-in: a wrong password shows the server message; the right one opens the dashboard', async run({ page }) {
    await signInAs(page, 'demo', 'not-the-password');
    assert.match(await bodyText(page), /Invalid local user ID or password/);
    assert.equal(await tokenOf(page), undefined, 'no session after a failed sign-in');
    await signInAs(page, 'demo', 'demo123');
    assert.match(page.url(), /\/dashboard$/i); assert.ok(await tokenOf(page));
  } },

  { id: 'UI-02', title: 'Route sweep: every static route and variant renders for the administrator without script or server errors', async run({ page, seen }) {
    await signInDemo(page); const failures = [];
    const routes = [...appRoutes(), ...VARIANTS, '/__unknown_route__'];
    for (const route of routes) {
      seen.consoleErrors.length = seen.pageErrors.length = seen.serverErrors.length = 0;
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await settle(page);
      const text = (await bodyText(page)).trim(); const problems = [];
      if (text.length < 20) problems.push('page is blank');
      if (/something went wrong|cannot read properties|is not a function/i.test(text)) problems.push('error text on the page');
      problems.push(...seen.pageErrors.map(e => 'script error: ' + e));
      problems.push(...seen.serverErrors.map(e => 'server error: ' + e));
      problems.push(...seen.consoleErrors.map(e => 'console error: ' + e));
      if (problems.length) failures.push(`${route}: ${[...new Set(problems)].join('; ')}`);
    }
    assert.deepEqual(failures, [], `${failures.length} of ${routes.length} routes had problems`);
  } },

  { id: 'UI-03', title: 'Wage earnings: the code list is usable, an entry saves, and a duplicate shows the server\'s reason', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/wageEarnings'); await settle(page);
    await choose(page, 0, 'Monthly'); await choose(page, 1, '2026-10');
    assert.ok((await optionsOf(page, 2)).some(t => /Demo Adjustment/.test(t)), 'the earning-code list has real options');
    await choose(page, 2, 'Demo Adjustment');
    const add = async () => { const row = addRow(page); await row.locator('input[name="employee_code"]').fill('DEMO001'); await row.locator('input[name="employee_code"]').press('Tab'); await page.waitForTimeout(500); await row.locator('input[name="ernValue"]').fill('125'); await row.getByRole('button', { name: 'Add', exact: true }).click(); await settle(page); };
    await add();
    const saved = seen.calls.find(c => c.path === '/api/wages/addWageEarnings');
    assert.equal(saved?.status, 200); assert.equal(saved.body.ernCode, 'DEMO'); assert.equal(saved.body.pmonth.slice(0, 10), '2026-10-01');
    const stored = (await api(page, 'POST', '/api/wages/getWageEarnings', { pmonth: '2026-10-01', billingType: 'M' })).json;
    assert.ok(stored.some(r => r.employee_code === 'DEMO001' && r.ernValue === 125));
    seen.dialogs.length = 0; await add();
    const shown = seen.dialogs.join(' ') + ' ' + await bodyText(page);
    assert.match(shown, /already have an adjustment/i, 'the duplicate message from the server is shown');
  } },

  { id: 'UI-04', title: 'Wage deductions: the code list is usable and an entry saves under its own period', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/wageDeductions'); await settle(page);
    await choose(page, 0, 'Monthly'); await choose(page, 1, '2026-10'); await choose(page, 2, 'Demo Adjustment');
    const row = addRow(page);
    await row.locator('input[name="employee_code"]').fill('DEMO002'); await row.locator('input[name="employee_code"]').press('Tab'); await page.waitForTimeout(500);
    await row.locator('input[name="dedValue"]').fill('40'); await row.getByRole('button', { name: 'Add', exact: true }).click(); await settle(page);
    const saved = seen.calls.find(c => c.path === '/api/wages/addWageDeductions');
    assert.equal(saved?.status, 200); assert.equal(saved.body.dedCode, 'DEMO');
    const stored = (await api(page, 'POST', '/api/wages/getWageDeductions', { pmonth: '2026-10-01', billingType: 'M' })).json;
    assert.ok(stored.some(r => r.employee_code === 'DEMO002' && r.dedValue === 40));
  } },

  { id: 'UI-05', title: 'Manual muster: only marks the server accepts are offered, and a duplicate shows the server\'s reason', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/ManualMuster'); await settle(page);
    const marks = await optionsOf(page, 3);
    for (const code of ['AB', 'HD', 'LOP', 'WFH']) assert.ok(marks.some(t => t.startsWith(code)), `${code} is offered (got ${marks.join(' | ')})`);
    assert.ok(!marks.some(t => /^A\b|^HDP/.test(t)), 'the codes the server rejects are not offered');
    assert.ok((await page.getByRole('button', { name: 'Add', exact: true }).isDisabled()), 'Add is disabled until a shift and mark are chosen');
    const fillEntry = async () => {
      const row = addRow(page);
      await row.locator('input[name="employee_code"]').fill('DEMO003'); await row.locator('input[name="employee_code"]').press('Tab'); await page.waitForTimeout(500);
      await row.locator('input[name="attendance_date"]').fill('2026-10-09'); await choose(page, 2, 'G'); await choose(page, 3, 'AB');
    };
    await fillEntry();
    const add = async () => { await page.getByRole('button', { name: 'Add', exact: true }).click(); await settle(page); };
    await add();
    assert.equal(seen.calls.findLast(c => c.path === '/api/attendance/addManualPunchMark')?.status, 200);
    const rows = (await api(page, 'POST', '/api/attendance/getManualMuster', { pmonth: '2026-10-01', billingType: 'M' })).json;
    assert.ok(rows.some(r => r.employee_code === 'DEMO003' && r.attendance_date.startsWith('2026-10-09') && r.punch_mark === 'AB'));
    await fillEntry(); seen.dialogs.length = 0; await add();
    assert.match(seen.dialogs.join(' ') + ' ' + await bodyText(page), /already|exists|duplicate/i);
  } },

  { id: 'UI-06', title: 'Fixed wages: a record can be added (billing type is a field and PF uses Y/N)', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/ManageFixWages'); await settle(page);
    await page.selectOption('#EmployeeCode', { index: 2 }); await page.selectOption('#BillingType', 'M');
    await page.fill('#eff_date', '2026-10-15'); await page.fill('#BasicRate', '510'); await page.fill('#DARate', '10');
    await page.selectOption('#PFApply', 'Y'); await page.selectOption('#ESIApply', 'N'); await page.selectOption('#LWFApply', 'N');
    await page.getByRole('button', { name: 'Submit', exact: true }).click(); await settle(page);
    const saved = seen.calls.find(c => c.path === '/api/wages/addFixWages');
    assert.equal(saved?.status, 200, JSON.stringify(seen.calls.filter(c => c.path.includes('FixWages')).map(c => [c.status, c.body])) + ' ' + seen.dialogs.join('|'));
    assert.equal(saved.body.BillingType, 'M'); assert.equal(saved.body.PFApply, 'Y');
    const rows = (await api(page, 'POST', '/api/wages/getFixWagesDump', {})).json;
    assert.ok(rows.some(r => r.eff_date.startsWith('2026-10-15') && r.BasicRate === 510));
  } },

  { id: 'UI-07', title: 'Contractors: registering an existing ID shows the server\'s error, not a success', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/registerContractor'); await settle(page);
    const before = (await api(page, 'GET', '/api/contractor/getAllContractors')).json.length;
    await page.fill('#contractor_ID', 'D001'); await page.fill('#contractorName', 'Duplicate Attempt'); await page.fill('#billingName', 'Duplicate Attempt');
    await page.getByRole('button', { name: 'Submit', exact: true }).click(); await settle(page);
    assert.equal(seen.calls.findLast(c => c.path === '/api/contractor/addContractor')?.status, 409);
    const shown = seen.dialogs.join(' ') + ' ' + await bodyText(page);
    assert.match(shown, /already exists/i); assert.doesNotMatch(shown, /registered successfully|success/i);
    assert.equal((await api(page, 'GET', '/api/contractor/getAllContractors')).json.length, before, 'nothing was added');
    assert.equal(await page.inputValue('#contractor_ID'), 'D001', 'the entered values are kept');
  } },

  { id: 'UI-08', title: 'Change password: an ordinary user can do it, sees the confirmation, and is signed out', async run({ page }) {
    await signInDemo(page); const admin = await tokenOf(page);
    assert.equal((await api(page, 'POST', '/api/users/register', { emp_id: 'uiuser', Name: 'UI User', password: 'Passw0rd1' }, admin)).status, 200);
    await signInAs(page, 'uiuser', 'Passw0rd1'); assert.ok(await tokenOf(page), 'operator signed in');
    await page.goto(BASE + '/change-password'); await settle(page);
    await page.fill('#formOldPassword', 'Passw0rd1'); await page.fill('#formNewPassword', 'Newpass123'); await page.fill('#formConfirmPassword', 'Newpass123');
    await page.getByRole('main').getByRole('button', { name: 'Change Password' }).click();
    await eventually(async () => assert.match(await bodyText(page), /Password updated successfully/), 3000);
    await eventually(async () => assert.match(page.url(), /\/login$/i), 6000);
    assert.equal(await tokenOf(page), undefined, 'the browser session is cleared');
    const login = async password => (await page.request.post(BASE + '/api/users/login', { data: { emp_id: 'uiuser', password } })).status();
    assert.equal(await login('Passw0rd1'), 401); assert.equal(await login('Newpass123'), 200);
  } },

  { id: 'UI-09', title: 'Logout revokes the token on the server', async run({ page }) {
    await signInDemo(page); const token = await tokenOf(page);
    assert.equal((await api(page, 'GET', '/api/employee/getAllEmployees', undefined, token)).status, 200);
    await page.locator('[title*="ogout" i], [aria-label*="ogout" i], button:has-text("Logout"), a:has-text("Logout"), .dropdown-item:has-text("Logout")').first().click({ timeout: 5000 }).catch(async () => {
      await page.locator('.navbar .dropdown-toggle, .navbar-nav .nav-link').last().click(); await page.getByText(/log ?out/i).first().click();
    });
    await settle(page);
    assert.equal(await tokenOf(page), undefined, 'the browser session is cleared');
    await eventually(async () => assert.equal((await api(page, 'GET', '/api/employee/getAllEmployees', undefined, token)).status, 401));
  } },

  { id: 'UI-10', title: 'Roles: saving an empty selection asks before it wipes a user\'s assignments', async run({ page, seen }) {
    await signInDemo(page); const admin = await tokenOf(page);
    await api(page, 'POST', '/api/users/register', { emp_id: 'uirole', Name: 'UI Role', password: 'Passw0rd1' }, admin);
    await page.goto(BASE + '/AssignRoles'); await settle(page);
    await page.locator('input[type="text"]').first().fill('uirole');
    seen.dialogs.length = 0; seen.calls.length = 0;
    await page.getByRole('button', { name: /^(submit|save)/i }).first().click(); await settle(page);
    assert.ok(seen.dialogs.some(d => /remove all assignments/i.test(d)), 'a confirmation was shown; dialogs: ' + seen.dialogs.join('|'));
  } },

  { id: 'UI-11', title: 'Attendance summary: employee types come from the server (the old PR/LS codes matched no worker)', async run({ page }) {
    await signInDemo(page); await page.goto(BASE + '/printAtndSummary'); await settle(page);
    const options = await page.evaluate(() => [...document.querySelectorAll('select')].flatMap(s => [...s.options].map(o => o.value)));
    for (const code of ['ALL', 'SL', 'US']) assert.ok(options.includes(code), `${code} among ${options.join(',')}`);
    assert.ok(!options.includes('PR') && !options.includes('LS'));
  } },

  { id: 'UI-12', title: 'Attendance exports: overtime, Department/BU columns and the absent count in the downloaded workbooks are right', async run({ page }) {
    await signInDemo(page);
    await api(page, 'POST', '/api/attendance/addManualPunchMark', { employee_code: 'DEMO001', attendance_date: '2026-10-12', shift: 'GEN', punch_mark: 'P', working_hours: '08:00', ot_hours: '02:30' });
    // Monthly attendance with in/out times, once as one sheet and once as a sheet per contractor (two code paths)
    const checkTimes = workbook => {
      const sheet = workbook.worksheets.find(ws => { let found = false; ws.eachRow(row => { if (row.getCell(1).value === 'DEMO001') found = true; }); return found; }); assert.ok(sheet, 'a sheet holds DEMO001');
      const head = sheet.getRow(3).values; const sub = sheet.getRow(4).values;
      const dept = head.indexOf('Department'); const bu = head.indexOf('BU'); assert.ok(dept > 0 && bu > 0, 'Department and BU columns exist');
      let worker; sheet.eachRow(row => { if (row.getCell(1).value === 'DEMO001') worker = row.values; });
      assert.equal(worker[dept], 'Demo Production', 'Department column holds the department'); assert.equal(worker[bu], 'Demo Works', 'BU column holds the business unit');
      const day12 = head.findIndex((v, i) => i > 6 && String(v) === '12'); assert.equal(sub[day12 + 4], 'OT Hours');
      assert.equal(worker[day12 + 4], '02:30', 'the OT cell shows the overtime that was entered');
    };
    for (const layout of ['N', 'Y']) {
      await page.goto(BASE + '/monthlyAtndRegTimes'); await settle(page);
      await page.locator('select').first().selectOption(layout);
      checkTimes(await downloadWorkbook(page, () => page.getByRole('button', { name: 'Export', exact: true }).click()));
    }
    // Monthly attendance sheet (XLS)
    await page.goto(BASE + '/monthlyAtndSheet'); await settle(page);
    await page.locator('select').selectOption({ label: 'XLS Format' });
    const muster = await downloadWorkbook(page, () => page.getByRole('button', { name: 'Print Muster', exact: true }).click());
    const grid = muster.worksheets[0]; const header = grid.getRow(4).values; const abColumn = header.indexOf('AB'); assert.ok(abColumn > 0, 'the sheet has an AB column');
    let checked = 0;
    grid.eachRow((row, n) => { const values = row.values; if (n < 5 || !/^DEMO/.test(String(values[1]))) return; const absent = values.slice(6, 6 + 31).filter(v => v === 'AB').length; assert.equal(values[abColumn], absent, `${values[1]}: AB total equals the AB days shown`); checked++; });
    assert.ok(checked >= 4, 'every worker row was checked');
  } },

  { id: 'UI-13', title: 'A failed export shows the error and never "printed successfully"', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/monthlyAtndRegTimes'); await settle(page);
    await page.route('**/api/attendance/printAtndReg2', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Simulated server failure' }) }));
    let downloaded = false; page.on('download', () => { downloaded = true; });
    seen.dialogs.length = 0; await page.getByRole('button', { name: 'Export', exact: true }).click(); await settle(page);
    assert.equal(downloaded, false, 'no file was produced');
    assert.ok(seen.dialogs.length > 0, 'the user was told something');
    assert.ok(!seen.dialogs.some(d => /success/i.test(d)), 'none of the messages claims success: ' + seen.dialogs.join(' | '));
    assert.ok(seen.dialogs.some(d => /Simulated server failure/.test(d)), 'the server\'s reason is shown: ' + seen.dialogs.join(' | '));
    // an empty result is an error too, not a silent no-op
    await page.unroute('**/api/attendance/printAtndReg2');
    await page.route('**/api/attendance/printAtndReg2', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    seen.dialogs.length = 0; await page.getByRole('button', { name: 'Export', exact: true }).click(); await settle(page);
    assert.ok(seen.dialogs.some(d => /No data/i.test(d)) && !seen.dialogs.some(d => /success/i.test(d)), 'empty export: ' + seen.dialogs.join(' | '));
  } },

  { id: 'UI-14', title: 'Muster workbook upload: good rows are saved, a bad row is reported by row number, midnight and zero are not treated as missing', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/ManualMuster'); await settle(page);
    const serial = iso => Math.round((Date.parse(iso) - Date.parse('1899-12-30')) / 86400000);
    const sheet = XLSX.utils.aoa_to_sheet([
      ['EmployeeCode', 'AttendanceDate', 'Shift', 'MusterMark', 'WorkingHours', 'OTHours', 'Remarks'],
      ['DEMO001', serial('2026-10-14'), 'GEN', 'P', 8 / 24, 0, 'overtime of exactly zero'],
      ['DEMO002', serial('2026-10-14'), 'GEN', 'AB', 0, 0, 'zero working hours'],
      ['DEMO003', 'not a date', 'GEN', 'P', 8 / 24, 0, 'bad date'],
    ]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Muster');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    await page.getByRole('button', { name: 'Upload Manual Muster' }).click(); await page.waitForTimeout(300);
    await page.locator('input[type="file"]').setInputFiles({ name: 'muster.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
    seen.dialogs.length = 0; await page.getByRole('button', { name: /^upload$/i }).click(); await settle(page);
    const message = seen.dialogs.join(' | ');
    assert.match(message, /Row 4/, 'the bad row is named: ' + message); assert.match(message, /AttendanceDate/);
    const rows = (await api(page, 'POST', '/api/attendance/getManualMuster', { pmonth: '2026-10-01', billingType: 'M' })).json;
    const one = rows.find(r => r.employee_code === 'DEMO001' && r.attendance_date.startsWith('2026-10-14')); const two = rows.find(r => r.employee_code === 'DEMO002' && r.attendance_date.startsWith('2026-10-14'));
    assert.ok(one && two, 'both good rows were saved: ' + message);
    assert.equal(one.ot_hours, '00:00'); assert.equal(two.punch_mark, 'AB'); assert.equal(two.working_hours, '00:00');
    assert.ok(!rows.some(r => r.employee_code === 'DEMO003' && r.attendance_date.startsWith('2026-10-14')), 'the bad row was not saved');
  } },

  { id: 'UI-15', title: 'Wage components: an exported file can be uploaded again (date text, BillingType header), GrossRate is kept, and a bad row names its row and column', async run({ page, seen }) {
    await signInDemo(page); await page.goto(BASE + '/ExportFixWagesDump'); await settle(page);
    const selects = page.locator('select'); await selects.nth(0).selectOption('ALL'); await selects.nth(1).selectOption({ index: 1 });
    const exported = await downloadWorkbook(page, () => page.getByRole('button', { name: 'Export', exact: true }).click());
    const sheet = exported.worksheets[0]; const header = sheet.getRow(1).values;
    assert.ok(header.includes('BillingType') && header.includes('eff_date'), 'the export has the BillingType and eff_date columns');
    // Build the upload from the export: same layout, new effective date, plus GrossRate.
    const column = name => header.indexOf(name); const gross = header.length;
    sheet.getRow(1).getCell(gross).value = 'GrossRate';
    // Earlier scenarios add rows of their own, so give every exported row its own date (a worker's key is employee + type + date).
    let count = 0; sheet.eachRow((row, n) => { if (n > 1) { count++; row.getCell(column('eff_date')).value = `2026-12-${String(count).padStart(2, '0')}`; row.getCell(gross).value = 700; } });
    assert.ok(count >= 4, 'the export has the workers');
    const good = Buffer.from(await exported.xlsx.writeBuffer());
    const upload = async buffer => {
      await page.goto(BASE + '/UploadEmpWageComp'); await settle(page);
      await page.getByRole('button', { name: 'Upload Wage Components' }).click(); await page.waitForTimeout(300);
      await page.locator('input[type="file"]').setInputFiles({ name: 'components.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      seen.dialogs.length = 0; await page.locator('div').filter({ has: page.locator('input[type="file"]') }).last().getByRole('button', { name: 'Upload', exact: true }).click(); await settle(page);
      return seen.dialogs.join(' | ') + ' | ' + await bodyText(page);
    };
    const shown = await upload(good);
    assert.match(shown, new RegExp(`${count} row\\(s\\) inserted`, 'i'), shown.slice(-400));
    const rows = (await api(page, 'POST', '/api/wages/getFixWagesDump', {})).json.filter(r => String(r.eff_date).startsWith('2026-12-'));
    assert.equal(rows.length, count); assert.ok(rows.every(r => r.GrossRate === 700), 'GrossRate was stored');
    // a bad row: no BasicRate on the second worker
    const bad = await new ExcelJS.Workbook().xlsx.load(good); const badSheet = bad.worksheets[0];
    badSheet.eachRow((row, n) => { if (n > 1) row.getCell(column('eff_date')).value = `2027-01-${String(n).padStart(2, '0')}`; });
    badSheet.getRow(3).getCell(column('BasicRate')).value = null;
    const message = await upload(Buffer.from(await bad.xlsx.writeBuffer()));
    assert.match(message, /Row 3/); assert.match(message, /BasicRate/);
    const after = (await api(page, 'POST', '/api/wages/getFixWagesDump', {})).json.filter(r => String(r.eff_date).startsWith('2027-01-'));
    assert.equal(after.length, 0, 'nothing from the bad file was saved');
  } },
];

// ---------------------------------------------------------------- run
const { chromium } = loadPlaywright();
const servers = EXTERNAL ? null : await startServers();
const browser = await chromium.launch();
const results = [];
if (EXTERNAL && args.includes('--reset')) { // restore the fixtures of an instance you started yourself (it is disposable by contract)
  const login = await (await fetch(BASE + '/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emp_id: 'demo', password: 'demo123' }) })).json();
  await fetch(BASE + '/api/dev/reset', { method: 'POST', headers: { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' }, body: '{}' });
}
try {
  for (const scenario of scenarios.filter(s => !only || only.includes(s.id))) {
    const started = Date.now(); const ctx = await open(browser);
    try { await scenario.run(ctx); results.push({ id: scenario.id, title: scenario.title, ok: true, ms: Date.now() - started }); }
    catch (error) {
      const shot = path.join(os.tmpdir(), `clms-ui-${scenario.id}.png`); await ctx.page.screenshot({ path: shot }).catch(() => {});
      results.push({ id: scenario.id, title: scenario.title, ok: false, ms: Date.now() - started, error: String(error.message || error).split('\n').slice(0, 60).join('\n'), screenshot: shot });
    } finally { await ctx.context.close(); }
    const r = results.at(-1); console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}  (${r.ms} ms)` + (r.ok ? '' : `\n      ${r.error.replace(/\n/g, '\n      ')}\n      screenshot: ${r.screenshot}`));
  }
} finally { await browser.close(); await servers?.stop(); }
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ base: BASE, results }, null, 2));
process.exit(failed.length ? 1 : 0);
