import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issues = [];
const forbidden = [
  { pattern: /192\.168\.10\.150/g, reason: 'live CLMS address' },
  { pattern: /(?:https?|wss?):\/\/(?!127\.0\.0\.1(?::\d+)?(?:[/'"\s;]|$)|localhost(?::\d+)?(?:[/'"\s;]|$)|\[::1\])[^\s'"<>`]+/g, reason: 'remote URL; review whether this can make an external request' },
];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(?:[cm]?jsx?|html|css|json)$/.test(file)) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        // Vendor notices, XML namespaces, documentation and schema identifiers are not request targets.
        if (/^(?:\/\/|\/\*|\*|\*\/)/.test(line) || /xmlns|schema\.org|\$schema/.test(line)) continue;
        for (const rule of forbidden) {
          rule.pattern.lastIndex = 0;
          if (rule.pattern.test(line)) issues.push(`${path.relative(root, file)}:${index + 1}: ${rule.reason}`);
        }
      }
    }
  }
}
for (const directory of ['src', 'server', 'public']) walk(path.join(root, directory));
for (const file of ['.env', 'SQL PASSWORD.txt', 'clms_backend.exe', 'keys', 'license', 'logs', 'iAS']) {
  if (fs.existsSync(path.join(root, file))) issues.push(`${file}: production configuration or binary must not be copied into the replica`);
}
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else console.log('Isolation check passed: application files contain no remote request URLs or copied production configuration.');
