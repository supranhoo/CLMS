import json, re
from pathlib import Path

base = Path(__file__).resolve().parent
source_map = json.loads((base.parents[1] / 'build/static/js/main.5696f25c.js.map').read_text(encoding='utf-8'))
contracts = []
for name, source in zip(source_map['sources'], source_map['sourcesContent']):
    if not source or 'node_modules' in name or not name.startswith(('screens/', 'components/', 'features/', 'App')):
        continue
    source = source.replace('\r\r\n','\n').replace('\r\n','\n')
    for path in sorted(set(re.findall(r'["\x27`](/api/[^"\x27`\s]+)', source))):
        line = source[:source.find(path)].count('\n') + 1
        contracts.append({'path': path, 'source': name, 'line': line})
(base / 'contracts.json').write_text(json.dumps(contracts, indent=2), encoding='utf-8')
print('\n'.join(sorted(set(c['path'] for c in contracts))))
