// Renders docs/erd/*.mmd to SVG so the diagrams show in viewers that do not draw Mermaid (the Markdown files already
// contain the Mermaid source, which GitHub draws itself). Optional tooling: neither package is a project dependency.
//
//   npm i --no-save mermaid playwright && node scripts/render-erd.mjs
//   (or point MERMAID_DIR at an installed mermaid package and PLAYWRIGHT_MODULE_PATH at Playwright)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/erd');
const mermaidDir = process.env.MERMAID_DIR || path.join(root, 'node_modules/mermaid');
const bundle = path.join(mermaidDir, 'dist/mermaid.min.js');
if (!fs.existsSync(bundle)) throw new Error(`mermaid not found at ${bundle}. Install it with \`npm i --no-save mermaid\` or set MERMAID_DIR.`);

function loadPlaywright() {
  const attempts = [() => createRequire(path.join(root, 'package.json'))('playwright'), () => process.env.PLAYWRIGHT_MODULE_PATH && createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH), () => createRequire(import.meta.url)('playwright')];
  for (const attempt of attempts) { try { const m = attempt(); if (m?.chromium) return m; } catch { /* next */ } }
  throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE_PATH.');
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body><div id="out"></div></body></html>');
await page.addScriptTag({ path: bundle });
await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', er: { useMaxWidth: false }, fontFamily: 'Arial, sans-serif' }));
let written = 0;
for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.mmd')).sort()) {
  const source = fs.readFileSync(path.join(dir, file), 'utf8');
  const svg = await page.evaluate(async ({ source, id }) => (await window.mermaid.render(id, source)).svg, { source, id: 'erd' + written });
  fs.writeFileSync(path.join(dir, file.replace(/\.mmd$/, '.svg')), svg);
  written++; console.log('rendered', file);
}
await browser.close();
console.log(`${written} SVG files written to docs/erd`);
