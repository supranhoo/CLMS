// Gate A04 evidence: measures the rendered design-system reference page (/development/design-system).
//
//   node docs/ui-redesign/w0/design-system-check.mjs [--out docs/ui-redesign/w0/baseline/design-system-measurements]
//
// Local-only (loopback). Exits 1 if any requirement fails. It checks, from the real DOM:
//   1. text contrast of every non-disabled control and status badge (>= 4.5:1)
//   2. non-text contrast of field boundaries and focus indicators (>= 3:1)
//   3. target size of every interactive control (>= 24x24 CSS px; 40/44 reported as the design aim)
//   4. parity: the mirrored .is-hover/.is-focus/.is-active demo states compute the same as REAL hover, keyboard focus
//      and mouse-down, so the reference page cannot show a state the product would not render
//   5. the page's own live contrast table and the four size tokens
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from './ui-style-baseline.mjs';
import { contrastRatio } from '../../../src/utils/contrast.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.CLMS_BASE || 'http://127.0.0.1:5173';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) throw new Error('Harness only drives loopback: ' + BASE);
const outBase = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(here, 'baseline/design-system-measurements');

// Controls transition colours for up to 180ms (--ui-motion). Computed style is read mid-transition unless we wait.
const TRANSITION_SETTLE_MS = 300;
const STATE_PROPS = ['color', 'backgroundColor', 'borderTopColor', 'borderTopStyle', 'outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow'];

// ---- runs in the page
function describe(el) {
  const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const effectiveBg = (node) => { for (let n = node; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return `rgb(${c.r}, ${c.g}, ${c.b})`; } return 'rgb(255, 255, 255)'; };
  const cs = getComputedStyle(el); const box = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 30), disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
    color: cs.color, ownBg: cs.backgroundColor, bg: effectiveBg(el), parentBg: effectiveBg(el.parentElement),
    borderColor: cs.borderTopColor, borderWidth: parseFloat(cs.borderTopWidth), borderStyle: cs.borderTopStyle,
    outlineColor: cs.outlineColor, outlineWidth: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle,
    width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10, fontSize: cs.fontSize,
  };
}
function styleOf({ sel, props }) { const el = document.querySelector(sel); const cs = getComputedStyle(el); return Object.fromEntries(props.map((p) => [p, cs[p]])); }

(async () => {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(300); };
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' }); await settle();
  await page.getByRole('button', { name: /demo workspace/i }).click(); await settle();
  await page.goto(BASE + '/development/design-system', { waitUntil: 'domcontentloaded' }); await settle();

  const failures = []; const rows = [];
  const fail = (id, msg) => failures.push(`${id}: ${msg}`);
  const sel = (id) => `[data-ds="${id}"]`;

  // 1-3: static measurements of every demo control
  const ids = await page.locator('[data-ds]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ds')));
  for (const id of ids) {
    if (id.startsWith('pair:') || id.startsWith('target:')) continue;
    const d = await page.locator(sel(id)).first().evaluate(describe);
    const kind = id.split(':')[0]; const state = id.split(':')[1];
    const interactive = !kind.startsWith('status');
    const row = { id, tag: d.tag, disabled: d.disabled, size: `${d.width}x${d.height}` };

    row.textContrast = +contrastRatio(d.color, d.ownBg === 'rgba(0, 0, 0, 0)' ? d.bg : d.ownBg).toFixed(2);
    if (d.disabled) row.textContrast = { ratio: row.textContrast, note: 'disabled: exempt, recorded for legibility' };
    else if (row.textContrast < 4.5) fail(id, `text contrast ${row.textContrast}:1 < 4.5:1`);

    if (kind === 'field' || kind === 'select') {
      row.boundaryContrast = +contrastRatio(d.borderColor, d.parentBg).toFixed(2);
      if (!d.disabled && row.boundaryContrast < 3) fail(id, `boundary contrast ${row.boundaryContrast}:1 < 3:1`);
    }
    if (state === 'focus') {
      row.focusIndicator = { width: d.outlineWidth, style: d.outlineStyle, contrast: +contrastRatio(d.outlineColor, d.parentBg).toFixed(2) };
      if (d.outlineStyle === 'none' || d.outlineWidth < 2) fail(id, `focus indicator missing or thin (${d.outlineStyle} ${d.outlineWidth}px)`);
      else if (row.focusIndicator.contrast < 3) fail(id, `focus indicator contrast ${row.focusIndicator.contrast}:1 < 3:1`);
    }
    if (interactive) {
      row.targetAim = d.height >= 44 ? '44+' : d.height >= 40 ? '40+' : d.height >= 36 ? '36+' : 'below 36';
      if (d.width < 24 || d.height < 24) fail(id, `target ${d.width}x${d.height} < 24x24`);
      if (!d.disabled && d.height < 36) fail(id, `target height ${d.height} below the 36px compact floor`);
    }
    rows.push(row);
  }

  // 4: mirrored states vs real interaction. Order matters: keyboard focus first (no pointer yet), then hover, then press.
  const parity = [];
  const compare = (label, mirroredId, realStyle, mirrored) => {
    const diffs = STATE_PROPS.filter((p) => realStyle[p] !== mirrored[p]).map((p) => `${p}: real ${realStyle[p]} vs mirrored ${mirrored[p]}`);
    parity.push({ label, ok: !diffs.length, diffs });
    if (diffs.length) fail(`parity ${label}`, diffs.join('; '));
  };
  const subjects = [['button-primary', 'btn'], ['button-secondary', 'btn'], ['button-danger', 'btn'], ['button-outline-primary', 'btn'], ['field', 'field']];
  await page.keyboard.press('Shift'); // establish keyboard modality so :focus-visible matches on script focus
  for (const [prefix] of subjects) {
    const def = sel(`${prefix}:default`); const mir = sel(`${prefix}:focus`);
    await page.locator(def).focus(); await page.waitForTimeout(TRANSITION_SETTLE_MS);
    const real = await page.evaluate(styleOf, { sel: def, props: STATE_PROPS });
    await page.locator(def).evaluate((e) => e.blur());
    compare(`${prefix} focus`, mir, real, await page.evaluate(styleOf, { sel: mir, props: STATE_PROPS }));
  }
  for (const [prefix] of subjects) {
    const def = sel(`${prefix}:default`); const mir = sel(`${prefix}:hover`);
    await page.locator(def).hover(); await page.waitForTimeout(TRANSITION_SETTLE_MS);
    const real = await page.evaluate(styleOf, { sel: def, props: STATE_PROPS });
    compare(`${prefix} hover`, mir, real, await page.evaluate(styleOf, { sel: mir, props: STATE_PROPS }));
  }
  for (const [prefix, kind] of subjects) {
    if (kind !== 'btn') continue;
    const def = sel(`${prefix}:default`); const mir = sel(`${prefix}:active`);
    const box = await page.locator(def).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(TRANSITION_SETTLE_MS);
    const real = await page.evaluate(styleOf, { sel: def, props: STATE_PROPS });
    await page.mouse.up(); await page.mouse.move(0, 0);
    compare(`${prefix} active`, mir, real, await page.evaluate(styleOf, { sel: mir, props: STATE_PROPS }));
  }

  // Combined state: a keyboard-focused button that is then hovered must show hover colours AND keep its focus ring.
  for (const [prefix] of subjects.filter(([, kind]) => kind === 'btn')) {
    const def = sel(`${prefix}:default`); const hov = sel(`${prefix}:hover`);
    await page.mouse.move(0, 0); await page.keyboard.press('Shift'); await page.locator(def).focus(); await page.locator(def).hover(); await page.waitForTimeout(TRANSITION_SETTLE_MS);
    const both = await page.evaluate(styleOf, { sel: def, props: STATE_PROPS });
    const hoverOnly = await page.evaluate(styleOf, { sel: hov, props: STATE_PROPS });
    const colourDiffs = ['color', 'backgroundColor', 'borderTopColor'].filter((p) => both[p] !== hoverOnly[p]);
    const ring = both.outlineStyle !== 'none' && parseFloat(both.outlineWidth) >= 2;
    const ok = !colourDiffs.length && ring;
    parity.push({ label: `${prefix} focus+hover`, ok, diffs: ok ? [] : [`${colourDiffs.join(',') || 'colours ok'}; ring ${ring ? 'present' : 'MISSING'}`] });
    if (!ok) fail(`combined ${prefix} focus+hover`, `colours differ in ${colourDiffs.join(',') || 'none'}; focus ring ${ring ? 'present' : 'missing'}`);
    await page.locator(def).evaluate((e) => e.blur()); await page.mouse.move(0, 0);
  }

  // Reduced motion: transitions must collapse to ~0 when the user asks for it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const id of ['button-primary:default', 'field:default']) {
    const seconds = await page.locator(sel(id)).evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration.split(',')[0]));
    if (!(seconds <= 0.001)) fail(`reduced-motion ${id}`, `transition-duration ${seconds}s should be ~0 under prefers-reduced-motion`);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const motion = await page.locator(sel('button-primary:default')).evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration.split(',')[0]));
  if (!(motion > 0.05 && motion <= 0.2)) fail('motion default', `expected 120-180ms transitions without reduced motion, got ${motion}s`);

  // 5: the page's own live contrast table and size tokens
  const pairs = await page.locator('[data-ds^="pair:"]').evaluateAll((trs) => trs.map((tr) => ({ id: tr.getAttribute('data-ds'), cells: [...tr.children].map((c) => c.textContent.trim()) })));
  for (const p of pairs) { const result = p.cells[4]; if (result === 'Fail') fail(p.id, `page reports contrast failure (${p.cells[2]})`); }
  const targets = await page.locator('[data-ds^="target:"]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-ds'), w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
  const expected = { 'target:--ui-target-min': 24, 'target:--ui-control-h-compact': 36, 'target:--ui-control-h': 40, 'target:--ui-target-touch': 44 };
  for (const t of targets) if (t.w !== expected[t.id] || t.h !== expected[t.id]) fail(t.id, `rendered ${t.w}x${t.h}, expected ${expected[t.id]}`);
  for (const id of Object.keys(expected)) if (!targets.some((t) => t.id === id)) fail(id, 'size sample missing from page');

  await browser.close();
  const result = { checkedAt: new Date().toISOString(), base: BASE, controlsMeasured: rows.length, pairsOnPage: pairs.length, parity, failures, rows };
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  fs.writeFileSync(outBase + '.json', JSON.stringify(result, null, 1) + '\n');

  const md = ['# Design-system measurements (W0/U03, gate A04)', '', `Measured from the rendered reference page \`/development/design-system\` against ${BASE}. Regenerate with \`node docs/ui-redesign/w0/design-system-check.mjs\`.`, '',
    `**Result: ${failures.length ? failures.length + ' failure(s)' : 'all requirements met'}** — ${rows.length} controls/badges measured, ${parity.length} state-parity comparisons, ${pairs.length} live token pairings.`, '',
    '## Mirrored demo states vs real interaction', '', '| Comparison | Result |', '| --- | --- |', ...parity.map((p) => `| ${p.label} | ${p.ok ? 'identical' : 'DIFFERS: ' + p.diffs.join('; ')}`.replace(/$/, ' |')), '',
    '## Rendered controls', '', '| Element | Size | Text contrast | Boundary / focus | Target aim |', '| --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| \`${r.id}\` | ${r.size} | ${typeof r.textContrast === 'object' ? r.textContrast.ratio + ' (disabled, exempt)' : r.textContrast + ':1'} | ${r.boundaryContrast ? r.boundaryContrast + ':1' : r.focusIndicator ? r.focusIndicator.width + 'px ' + r.focusIndicator.style + ', ' + r.focusIndicator.contrast + ':1' : '—'} | ${r.targetAim || 'n/a'} |`), '',
    failures.length ? '## Failures\n\n' + failures.map((f) => '- ' + f).join('\n') : '## Failures\n\nNone.', ''].join('\n');
  fs.writeFileSync(outBase + '.md', md);
  console.log(`measured ${rows.length} controls, ${parity.length} parity comparisons, ${pairs.length} pairings; failures: ${failures.length}`);
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('CHECK FAILED TO RUN:', e.message); process.exit(2); });
