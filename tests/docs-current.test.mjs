// Generated documents must match the code that generates them, so the test plan, case matrix and ERD cannot go stale
// unnoticed. Regenerate with `npm run docs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const script of ['scripts/test-matrix.mjs', 'scripts/erd.mjs']) {
  test(`DOCS-01 ${script} --check: the committed output is current`, () => {
    const result = spawnSync(process.execPath, [path.join(root, script), '--check'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, (result.stderr || result.stdout).trim());
  });
}
