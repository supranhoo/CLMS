// Upload and error reports are written into a new window with document.write. Their text comes from a workbook or the API,
// so every interpolated value must pass through escapeHtml, or a cell such as <img src=x onerror=...> would run script in
// the app's origin. This reads the source and fails on any `${...}` inside such a template that is not escaped.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []));

/** Interpolation expressions found in the template literal that starts at text[start] === '`' (nested templates included). */
export function interpolations(text, start) {
  const found = []; const stack = [{ type: 'template', expression: '' }]; let i = start + 1; let current = '';
  while (i < text.length && stack.length) {
    const top = stack.at(-1); const ch = text[i];
    if (top.type === 'template') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { stack.pop(); i++; if (stack.length) { stack.at(-1).expression += '`…`'; } continue; }
      if (ch === '$' && text[i + 1] === '{') { stack.push({ type: 'expression', expression: '', depth: 1 }); i += 2; continue; }
      i++; continue;
    }
    // inside ${ ... }
    if (ch === '`') { stack.push({ type: 'template' }); top.nested = true; i++; continue; }
    if (ch === '"' || ch === "'") { const quote = ch; top.expression += ch; i++; while (i < text.length && text[i] !== quote) { if (text[i] === '\\') { top.expression += text[i++]; } top.expression += text[i++]; } top.expression += quote; i++; continue; }
    if (ch === '{') top.depth++;
    if (ch === '}') { top.depth--; if (top.depth === 0) { stack.pop(); found.push({ expression: top.expression.trim(), nested: Boolean(top.nested) }); i++; continue; } }
    top.expression += ch; i++;
  }
  return found;
}

const SAFE = [/^escapeHtml\(/, /^[\w.[\]]+\.length$/, /^[\w.]+\.toFixed\(\d\)$/, /^\d+$/];
export function unescaped(text) {
  const bad = []; let index = -1;
  while ((index = text.indexOf('document.write(`', index + 1)) !== -1) {
    for (const { expression, nested } of interpolations(text, index + 'document.write('.length)) {
      // An expression that builds nested markup (rows.map(r => `<tr>${...}</tr>`).join('')) is judged by its own interpolations, which are listed separately.
      if (nested || SAFE.some(re => re.test(expression))) continue;
      bad.push(expression.replace(/\s+/g, ' ').slice(0, 80));
    }
  }
  return bad;
}

test('HTML-01 the scanner understands nesting, and flags an unescaped value', () => {
  const sample = 'w.document.write(`<td>${row.name}</td>${rows.map(r => `<tr>${escapeHtml(r.a)}${r.b}</tr>`).join("")}${escapeHtml(x)}${list.length}`)';
  assert.deepEqual(unescaped(sample), ['row.name', 'r.b']);
  assert.deepEqual(unescaped('w.document.write(`<p>${escapeHtml(a)} and ${escapeHtml(b?.c ?? "")}</p>`)'), []);
});

test('HTML-02 every document.write template in the app escapes every interpolated value', () => {
  const offenders = []; let templates = 0;
  for (const file of walk(path.join(root, 'src'))) {
    const text = fs.readFileSync(file, 'utf8'); if (!text.includes('document.write(`')) continue;
    templates += text.split('document.write(`').length - 1;
    if (!/import\s*\{[^}]*\bescapeHtml\b[^}]*\}\s*from/.test(text)) offenders.push(`${path.relative(root, file)}: does not import escapeHtml`);
    for (const expression of unescaped(text)) offenders.push(`${path.relative(root, file)}: \${${expression}}`);
  }
  assert.ok(templates >= 9, `expected the nine known report templates, found ${templates}`);
  assert.deepEqual(offenders, []);
});

test('HTML-03 no screen sets markup from data in other ways (dangerouslySetInnerHTML, innerHTML, outerHTML, insertAdjacentHTML)', () => {
  const offenders = [];
  for (const file of walk(path.join(root, 'src'))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, n) => { if (/dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\(|\beval\(|new Function\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) offenders.push(`${path.relative(root, file)}:${n + 1}`); });
  }
  assert.deepEqual(offenders, []);
});
