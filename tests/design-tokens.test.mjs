import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrastRatio, WCAG_NON_TEXT_AA, WCAG_TEXT_AA } from '../src/utils/contrast.js';

const read = (name) => readFileSync(fileURLToPath(new URL(`../src/styles/${name}`, import.meta.url)), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function tokens() {
  const map = new Map();
  for (const [, name, value] of stripComments(read('tokens.css')).matchAll(/(--ui-[\w-]+)\s*:\s*([^;]+);/g)) map.set(name, value.trim());
  return map;
}
const T = tokens();
const token = (name) => {
  assert.ok(T.has(name), `missing token ${name}`);
  return T.get(name);
};
const ratio = (fg, bg) => contrastRatio(token(fg), token(bg));

test('text pairings meet WCAG AA 4.5:1 on every surface they are used on', () => {
  const surfaces = ['--ui-panel', '--ui-canvas', '--ui-subtle'];
  for (const fg of ['--ui-text-strong', '--ui-text', '--ui-text-muted', '--ui-navy', '--ui-action']) {
    for (const bg of surfaces) assert.ok(ratio(fg, bg) >= WCAG_TEXT_AA, `${fg} on ${bg} is ${ratio(fg, bg).toFixed(2)}:1`);
  }
  for (const [fg, bg] of [['--ui-on-action', '--ui-action'], ['--ui-on-action', '--ui-action-hover'], ['--ui-on-action', '--ui-action-active'], ['--ui-on-danger', '--ui-danger'], ['--ui-on-danger', '--ui-danger-hover']]) {
    assert.ok(ratio(fg, bg) >= WCAG_TEXT_AA, `${fg} on ${bg} is ${ratio(fg, bg).toFixed(2)}:1`);
  }
  assert.ok(ratio('--ui-danger', '--ui-panel') >= WCAG_TEXT_AA, 'error text on panel');
});

test('control boundaries and the focus ring meet 3:1 non-text contrast', () => {
  for (const bg of ['--ui-panel', '--ui-canvas']) {
    assert.ok(ratio('--ui-border-control', bg) >= WCAG_NON_TEXT_AA, `control border on ${bg}`);
    assert.ok(ratio('--ui-border-control-hover', bg) >= WCAG_NON_TEXT_AA, `hover border on ${bg}`);
    assert.ok(ratio('--ui-focus', bg) >= WCAG_NON_TEXT_AA, `focus ring on ${bg}`);
  }
});

test('the decorative divider is not allowed to be the only boundary of a control', () => {
  // It is knowingly below 3:1. If it ever passes, the two border roles have collapsed and the distinction is moot.
  assert.ok(ratio('--ui-border', '--ui-panel') < WCAG_NON_TEXT_AA);
});

test('every status has its own text/background/border and passes 4.5:1', () => {
  const names = ['success', 'warning', 'danger', 'info', 'neutral', 'draft', 'locked', 'needs-rules', 'local-only'];
  const triples = new Set();
  for (const name of names) {
    const [fg, bg, border] = ['fg', 'bg', 'border'].map((part) => token(`--ui-status-${name}-${part}`));
    assert.ok(contrastRatio(fg, bg) >= WCAG_TEXT_AA, `${name} text on its background is ${contrastRatio(fg, bg).toFixed(2)}:1`);
    triples.add(`${fg}|${bg}|${border}`);
  }
  assert.equal(triples.size, names.length, 'draft, locked, needs-rules and local-only must not collapse into another status');
});

test('size tokens keep the plan targets: 24px AA floor, 36 compact, 40 default, 44 touch', () => {
  assert.deepEqual(['--ui-target-min', '--ui-control-h-compact', '--ui-control-h', '--ui-target-touch'].map(token), ['24px', '36px', '40px', '44px']);
});

test('the layering scale is strictly ordered: sticky < topbar < banner < drawer < modal < menu < toast', () => {
  const order = ['sticky', 'topbar', 'banner', 'drawer', 'modal', 'menu', 'toast'].map((name) => Number(token(`--ui-z-${name}`)));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(new Set(order).size, order.length);
});

test('tokens are custom properties only, and theme rules apply solely inside the .bfcl-ui scope', () => {
  const tokenCss = stripComments(read('tokens.css'));
  const declarations = [...tokenCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.equal(declarations.length, 1, 'tokens.css must have a single :root block');
  assert.equal(declarations[0][1].trim(), ':root');
  for (const line of declarations[0][2].split(';').map((l) => l.trim()).filter(Boolean)) assert.match(line, /^--ui-[\w-]+\s*:/, `non-token declaration in tokens.css: ${line}`);

  // Walk base.css and check the selector list of every style rule (descending into @media).
  const css = stripComments(read('base.css'));
  const selectors = [];
  let depth = 0; let prelude = ''; const stack = [];
  for (const ch of css) {
    if (ch === '{') {
      const text = prelude.trim();
      if (text.startsWith('@media')) stack.push('media');
      else { stack.push('rule'); selectors.push(text); }
      depth++; prelude = '';
    } else if (ch === '}') { stack.pop(); depth--; prelude = ''; }
    else if (ch === ';' && stack[stack.length - 1] === 'rule') prelude = '';
    else if (stack[stack.length - 1] !== 'rule') prelude += ch;
  }
  assert.ok(selectors.length > 20, 'expected to find the theme rules');
  // Split a selector list on top-level commas only; `:is(a, button)` contains commas that are not separators.
  const splitList = (list) => {
    const parts = []; let level = 0; let current = '';
    for (const ch of list) {
      if (ch === '(') level++;
      if (ch === ')') level--;
      if (ch === ',' && level === 0) { parts.push(current.trim()); current = ''; } else current += ch;
    }
    return [...parts, current.trim()].filter(Boolean);
  };
  assert.deepEqual(splitList('.a :is(x, y):focus, .b'), ['.a :is(x, y):focus', '.b']);
  for (const list of selectors) {
    for (const selector of splitList(list)) assert.ok(selector.startsWith('.bfcl-ui'), `unscoped selector in base.css: "${selector}"`);
  }
});

test('design CSS is local only: no remote URLs, imports or web fonts', () => {
  for (const file of ['tokens.css', 'base.css']) {
    const css = stripComments(read(file));
    assert.doesNotMatch(css, /https?:\/\/|@import|url\(/i, `${file} must not reference remote resources`);
  }
});
