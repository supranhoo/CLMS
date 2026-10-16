// W0/U01-U02 evidence harness. Local-only: it drives the loopback replica (default http://127.0.0.1:5173).
//
//   node docs/ui-redesign/w0/ui-style-baseline.mjs capture --out docs/ui-redesign/w0/baseline/before.json [--shots <dir>]
//   node docs/ui-redesign/w0/ui-style-baseline.mjs compare docs/ui-redesign/w0/baseline/before.json docs/ui-redesign/w0/baseline/after.json
//
// Requires Playwright (not a project dependency). Resolution order: local node_modules, then
// $PLAYWRIGHT_MODULE_PATH, then NODE_PATH / global install.
//
// What it measures
//   1. Neutral probe  - plain Bootstrap markup injected into EVERY route. Its computed style is compared with a
//                       pristine page that loads only Bootstrap + src/index.css. Any difference is CSS that leaks
//                       from a screen stylesheet onto elements that screen does not own (gate A02).
//   2. Route content  - style signatures of the route's own buttons/tables/inputs/headings (regression review).
//   3. Print          - how much of a page remains visible under print media (gate A03).
//   4. Order          - the neutral probe after client-side navigation in forward and reverse order (gate A02).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const BASE = process.env.CLMS_BASE || 'http://127.0.0.1:5173';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error('Harness only drives loopback: ' + BASE);

// ---------------------------------------------------------------- cases
const SLUGS = ['form-xii-register-of-contractors', 'form-xiii-register-of-workmen', 'form-xix-wage-slip', 'form-xvi-muster-roll', 'form-xviii-wages-cum-muster-roll', 'form-xxiii-register-of-overtime'];
const VARIANTS = [
  ...['accounting', 'approvals', 'audit', 'outbox', 'jobs'].map(t => `/development/${t}`),
  ...['employees', 'contractors', 'punches'].map(k => `/development/import/${k}`),
  ...SLUGS.map(s => `/compliance/${s}`),
  '/development/unavailable/payroll',
  '/__w0_unknown_route__',
];
function csvFirstColumn(text) {
  const out = []; let i = 0; text = text.replace(/^﻿/, ''); let inQ = false; let field = ''; let col = 0; let rowStart = true;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') inQ = false; else field += c; continue; }
    if (c === '"') { inQ = true; continue; }
    if (c === ',') { if (col === 0) out.push(field); col++; field = ''; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; if (col === 0 && field) out.push(field); col = 0; field = ''; continue; }
    field += c;
  }
  return out.slice(1); // drop header
}
export function staticRoutes() {
  const csv = fs.readFileSync(path.join(root, 'docs/ui-redesign/route-inventory.csv'), 'utf8');
  return csvFirstColumn(csv).filter(p => p.startsWith('/') && !p.includes(':'));
}

// ---------------------------------------------------------------- in-page probes
const NEUTRAL_FIXTURE = `
<div id="__w0_probe" style="position:absolute;left:0;top:0;width:900px;background:#fff;z-index:2147483000">
  <button id="p-btn" class="btn btn-primary" type="button">Probe</button>
  <button id="p-btn-plain" type="button">Plain</button>
  <table id="p-table-bs" class="table"><thead><tr><th id="p-th-bs">Head</th></tr></thead><tbody><tr><td id="p-td-bs">Cell with a fairly long value that should wrap or not depending on leaked rules</td></tr><tr><td id="p-td-bs2">Second</td></tr></tbody></table>
  <table id="p-table-bare"><thead><tr><th id="p-th-bare">Head</th></tr></thead><tbody><tr><td id="p-td-bare">Cell with a fairly long value that should wrap or not depending on leaked rules</td></tr></tbody></table>
  <input id="p-input" class="form-control" value="value"/>
  <select id="p-select" class="form-select"><option>One</option></select>
  <label id="p-label">Label</label>
  <a id="p-a" href="#">Link</a>
  <h2 id="p-h2">Heading</h2>
  <div class="modal-content" id="p-modal-content" style="position:static">Modal content</div>
  <div class="alert alert-success" id="p-alert">Alert</div>
  <div class="pagination-controls" id="p-pagination">Pagination</div>
</div>`;
const NEUTRAL_IDS = ['p-btn', 'p-btn-plain', 'p-table-bs', 'p-th-bs', 'p-td-bs', 'p-table-bare', 'p-th-bare', 'p-td-bare', 'p-input', 'p-select', 'p-label', 'p-a', 'p-h2', 'p-modal-content', 'p-alert', 'p-pagination'];
const PROPS = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'whiteSpace', 'overflowX', 'overflowY', 'maxWidth', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'color', 'backgroundColor', 'borderTopWidth', 'borderBottomWidth', 'borderTopColor', 'borderBottomColor', 'borderRadius', 'borderCollapse', 'position', 'display', 'textAlign', 'boxShadow', 'transform', 'cursor'];

function neutralProbe({ fixture, ids, props }) {
  document.getElementById('__w0_probe')?.remove();
  document.body.insertAdjacentHTML('beforeend', fixture);
  const out = {};
  const targets = [...ids.map(id => [id, document.getElementById(id)]), ['__body', document.body], ['__html', document.documentElement]];
  for (const [id, el] of targets) {
    const cs = getComputedStyle(el); const o = {};
    for (const p of props) o[p] = id.startsWith('__') && /^(width|height)$/.test(p) ? '' : cs[p]; // page size is route content, not CSS
    out[id] = o;
  }
  document.getElementById('__w0_probe').remove();
  return out;
}

function routeSignatures() {
  const SEL = ['button.btn', '.btn', 'table', 'th', 'td', 'input:not([type=checkbox]):not([type=radio])', 'select', 'textarea', 'label', 'h1', 'h2', 'h3', '.modal-content', '.alert'];
  const sigs = {};
  for (const sel of SEL) {
    const els = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).slice(0, 400);
    const counter = {};
    for (const e of els) {
      const cs = getComputedStyle(e);
      const sig = [cs.fontSize, cs.fontWeight, Math.round(e.getBoundingClientRect().height), cs.paddingTop + '/' + cs.paddingRight, cs.maxWidth, cs.whiteSpace, cs.overflowX, cs.textTransform, cs.position].join('|');
      counter[sig] = (counter[sig] || 0) + 1;
    }
    sigs[sel] = { count: els.length, signatures: counter };
  }
  const de = document.documentElement;
  return { signatures: sigs, pageOverflowPx: Math.max(0, de.scrollWidth - de.clientWidth), h1: [...document.querySelectorAll('h1')].slice(0, 2).map(h => h.textContent.trim().slice(0, 60)), bodyChars: document.body.innerText.length };
}

function printVisibility() {
  let visible = 0; let total = 0; const sample = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.trim(); if (!text) continue;
    const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || !el.getClientRects().length) continue;
    total += text.length;
    if (cs.visibility === 'visible') { visible += text.length; if (sample.length < 3) sample.push(text.slice(0, 40)); }
  }
  return { visibleChars: visible, totalChars: total, visibleRatio: total ? +(visible / total).toFixed(3) : null, sample };
}

// ---------------------------------------------------------------- playwright
async function loadPlaywright() {
  const tries = [() => createRequire(path.join(root, 'package.json'))('playwright'), () => process.env.PLAYWRIGHT_MODULE_PATH && createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH), () => createRequire(import.meta.url)('playwright'), () => createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright')];
  for (const t of tries) { try { const m = t(); if (m?.chromium) return m; } catch { /* try next */ } }
  throw new Error('Playwright not found. Set PLAYWRIGHT_MODULE_PATH or install it outside the project.');
}
const slug = p => (p === '/' ? 'root' : p.replace(/^\//, '').replace(/[^A-Za-z0-9]+/g, '_'));

async function capture(argv) {
  const out = argv[argv.indexOf('--out') + 1]; const shots = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
  if (!out || out.startsWith('--')) throw new Error('--out <file.json> is required');
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text().replace(/\s+/g, ' ').slice(0, 160)); }); page.on('pageerror', e => errors.push('PAGEERROR ' + e.message.slice(0, 160)));
  const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(350); };

  // pristine reference: Bootstrap + the app's real global base only
  const pristinePage = await ctx.newPage();
  await pristinePage.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  await pristinePage.addStyleTag({ path: path.join(root, 'node_modules/bootstrap/dist/css/bootstrap.min.css') });
  await pristinePage.addStyleTag({ path: path.join(root, 'src/index.css') });
  const pristine = await pristinePage.evaluate(neutralProbe, { fixture: NEUTRAL_FIXTURE, ids: NEUTRAL_IDS, props: PROPS });
  await pristinePage.close();

  // sign in with the public demo account
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await settle();
  await page.getByRole('button', { name: /demo workspace/i }).click(); await settle();
  if (!(await page.evaluate(() => !!localStorage.getItem('user')))) throw new Error('Demo sign-in did not establish a session');

  const cases = [...staticRoutes(), ...VARIANTS];
  const routes = {};
  for (const route of cases) {
    errors.length = 0;
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await settle();
    const own = await page.evaluate(routeSignatures);
    const neutral = await page.evaluate(neutralProbe, { fixture: NEUTRAL_FIXTURE, ids: NEUTRAL_IDS, props: PROPS });
    if (shots) await page.screenshot({ path: path.join(shots, slug(route) + '.png') });
    routes[route] = { finalPath: new URL(page.url()).pathname, ...own, neutral, consoleErrors: [...new Set(errors)].slice(0, 5) };
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  // print: real PDF through Chromium's print path (print media + @page rules), text extracted with pdftotext.
  // Compliance pages only render their print area after "Preview working data", so preview first.
  const printRoutes = ['/manageContractors', '/manageEmployees', '/printDailyAttendance', '/Dashboard', '/masters/shifts', `/compliance/${SLUGS[0]}`, `/compliance/${SLUGS[3]}`];
  const printResults = {};
  const pdfDir = fs.mkdtempSync(path.join(shots || (process.env.TMPDIR || '/tmp'), 'w0pdf-'));
  const nonSpace = s => s.replace(/\s+/g, '').length;
  async function previewIfCompliance(route) {
    if (!route.startsWith('/compliance/')) return;
    const month = page.getByLabel(/process month/i);
    if (await month.locator('option').count() > 1 && route.includes(SLUGS[3])) await month.selectOption({ index: 1 });
    await page.getByRole('button', { name: /preview working data/i }).click();
    await page.locator('[class*="printArea"]').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  for (const sequence of [printRoutes, [...printRoutes].reverse()]) {
    for (const route of sequence) {
      await page.emulateMedia({ media: 'screen' });
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await settle();
      await previewIfCompliance(route);
      const screenChars = await page.evaluate(() => document.body.innerText.replace(/\s+/g, '').length);
      const pdf = path.join(pdfDir, slug(route) + '.pdf');
      // Playwright renders the PDF with whatever media is emulated; it must be print or @media print never applies.
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
      let pdfChars = null; let pdfPages = null;
      try {
        pdfChars = nonSpace(execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }));
        pdfPages = +(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }))?.[1] || 0);
      } catch { /* pdftotext/pdfinfo unavailable */ }
      const v = await page.evaluate(printVisibility);
      await page.emulateMedia({ media: 'screen' });
      (printResults[route] ||= []).push(pdfChars);
      printResults[route + '#detail'] = { screenChars, pdfChars, pdfPages, pdfToScreenRatio: pdfChars == null || !screenChars ? null : +(pdfChars / screenChars).toFixed(3), cssVisibleRatio: v.visibleRatio };
    }
  }

  // order independence: client-side navigation (no reload) forward and reverse
  const chain = ['/Dashboard', '/manageAttendance', '/masters/shifts', '/manageEmployees', '/Dashboard'];
  const order = { forward: [], reverse: [] };
  for (const [label, seq] of [['forward', chain], ['reverse', [...chain].reverse()]]) {
    await page.goto(BASE + seq[0], { waitUntil: 'domcontentloaded' }); await settle();
    for (const r of seq) {
      await page.evaluate(to => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }, r); await settle();
      order[label].push({ route: r, neutral: await page.evaluate(neutralProbe, { fixture: NEUTRAL_FIXTURE, ids: NEUTRAL_IDS, props: PROPS }) });
    }
  }

  await browser.close();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, viewport: '1440x900', caseCount: cases.length, pristine, routes, print: printResults, order }, null, 1) + '\n');
  console.log(`captured ${cases.length} cases -> ${out}`);
}

// ---------------------------------------------------------------- compare / report
function diffProbe(a, b) { const d = []; for (const id of Object.keys(a)) for (const p of Object.keys(a[id])) if (a[id][p] !== b[id]?.[p]) d.push(`${id}.${p}: ${a[id][p]} -> ${b[id]?.[p]}`); return d; }
function compare(beforeFile, afterFile) {
  const A = JSON.parse(fs.readFileSync(beforeFile, 'utf8')); const B = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  const lines = [];
  const leak = (label, data) => {
    const per = Object.entries(data.routes).map(([r, v]) => [r, diffProbe(data.pristine, v.neutral)]);
    const leaky = per.filter(([, d]) => d.length);
    const distinct = new Set(per.map(([, d]) => d.join('|'))).size;
    lines.push(`${label}: neutral probe differs from pristine Bootstrap on ${leaky.length}/${per.length} routes (${distinct} distinct leak signatures)`);
    return per;
  };
  lines.push('== A02 leakage against pristine Bootstrap + src/index.css ==');
  const pa = leak('before', A); const pb = leak('after ', B);
  const sample = pb.find(([, d]) => d.length);
  if (sample) lines.push('   remaining leak example (' + sample[0] + '): ' + sample[1].slice(0, 6).join('; '));
  const first = pa.find(([, d]) => d.length);
  if (first) lines.push('   before example (' + first[0] + '): ' + first[1].slice(0, 6).join('; '));
  lines.push('\n== A02 order independence (client-side navigation) ==');
  for (const [label, D] of [['before', A], ['after ', B]]) {
    const all = [...D.order.forward, ...D.order.reverse]; const ref = JSON.stringify(all[0].neutral);
    lines.push(`${label}: ${all.every(s => JSON.stringify(s.neutral) === ref) ? 'identical on all ' + all.length + ' steps' : 'DIFFERS between steps'}`);
  }
  lines.push('\n== A03 print: non-whitespace characters on the printed PDF / on screen (forward+reverse visit order) ==');
  const fmt = d => d ? `pdf ${d.pdfChars}/${d.screenChars} chars, ${d.pdfPages}p, ratio ${d.pdfToScreenRatio}` : 'n/a';
  for (const r of Object.keys(A.print).filter(k => !k.endsWith('#detail'))) lines.push(`${r.padEnd(46)} before [${A.print[r]}] ${fmt(A.print[r + '#detail'])}\n${''.padEnd(46)} after  [${B.print[r]}] ${fmt(B.print[r + '#detail'])}`);
  lines.push('\n== route content signature changes (own elements) ==');
  let changed = 0; const changedRoutes = [];
  for (const r of Object.keys(A.routes)) {
    const a = A.routes[r].signatures; const b = B.routes[r]?.signatures; if (!b) continue;
    const selChanged = Object.keys(a).filter(s => JSON.stringify(a[s]) !== JSON.stringify(b[s]));
    if (selChanged.length) { changed++; changedRoutes.push(`${r}: ${selChanged.join(', ')}`); }
  }
  lines.push(`${changed}/${Object.keys(A.routes).length} routes have different style signatures for their own elements`);
  lines.push(...changedRoutes.slice(0, 80).map(s => '   ' + s));
  const overflow = Object.entries(B.routes).filter(([r, v]) => v.pageOverflowPx > (A.routes[r]?.pageOverflowPx || 0));
  lines.push(`\npage-level horizontal overflow increased on ${overflow.length} routes` + (overflow.length ? ': ' + overflow.map(([r, v]) => `${r}(+${v.pageOverflowPx - (A.routes[r]?.pageOverflowPx || 0)}px)`).join(', ') : ''));
  const newErr = Object.entries(B.routes).filter(([r, v]) => v.consoleErrors.some(e => !(A.routes[r]?.consoleErrors || []).includes(e)));
  lines.push(`new console errors on ${newErr.length} routes` + (newErr.length ? ': ' + newErr.map(([r]) => r).join(', ') : ''));
  console.log(lines.join('\n'));
}

const [mode, ...rest] = process.argv.slice(2);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (mode === 'capture') await capture(rest);
  else if (mode === 'compare') compare(rest[0], rest[1]);
  else { console.error('usage: capture --out <file> [--shots <dir>] | compare <before.json> <after.json>'); process.exit(2); }
}
