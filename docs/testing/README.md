# Testing the CLMS replica

Start here. Everything in this folder describes the **development replica** (fictional data, no connection to the live CLMS).

| Document | Read it to |
| --- | --- |
| [READINESS.md](READINESS.md) | decide whether testing can start (the go / no-go assessment, with the measured evidence) |
| [TEST-PLAN.md](TEST-PLAN.md) | know what is in and out of scope, how to set up and reset, the entry and exit criteria, the manual checklists |
| [TEST-CASES.md](TEST-CASES.md) and [test-case-matrix.csv](test-case-matrix.csv) | see every case: 18 workflows, 85 screens, 459 API routes, each with its expected behaviour and the automated check that covers it |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | avoid logging something that is already known, and see the limits of the replica |
| [AUDIT-REPORT.md](AUDIT-REPORT.md) | see what the pre-test code audit found and what was fixed |
| [../erd/ERD.md](../erd/ERD.md) and [DATA-DICTIONARY.md](../erd/DATA-DICTIONARY.md) | understand the data and which references the API enforces |

## From zero to a test environment

```text
git clone <repository> && cd CLMS
npm ci                  # Windows PowerShell: npm.cmd ci
npm run dev             # UI http://127.0.0.1:5173, API 127.0.0.1:5001
```

Open <http://127.0.0.1:5173> and use **Enter demo workspace** (user `demo`, password `demo123`).

| I want to | Run |
| --- | --- |
| start from the seed data | `npm run reset` (works with the API running or stopped) |
| run the fast automated tests (about 20 seconds) | `npm test` |
| run the browser suite (about 3 minutes) | `npm i --no-save playwright && npx playwright install chromium`, stop `npm run dev`, then `npm run test:ui` |
| run one browser scenario | `npm run test:ui -- --only UI-05` |
| check isolation and the build | `npm run check` and `npm run build` |
| refresh the ERD and case matrix after changing routes or data shapes | `npm run docs` (the tests fail if you forget) |
| see a coverage report | `node --test --experimental-test-coverage` |

## Test identifiers

| Prefix | Where | Meaning |
| --- | --- | --- |
| `AUD-` | `tests/audit-regressions.test.mjs` | a defect found in the audit, pinned so it cannot come back |
| `SWEEP-` | `tests/api-sweep.test.mjs` | applied to every route the server lists |
| `ERD-` | `tests/erd.test.mjs` | the data model and its enforcement claims |
| `HTML-` | `tests/html-escaping.test.mjs` | text written into generated HTML is escaped |
| `RESET-`, `DOCS-` | `tests/reset-script.test.mjs`, `tests/docs-current.test.mjs` | the reset command; generated documents are current |
| `UI-nn` | `tests/ui/smoke.mjs` | a scenario in a real browser |
| `WF-`, `UI-R-`, `API-` | the case matrix | end-to-end workflows, screens, API routes |
| `KI-`, `S-`, `D-`, `F-` | KNOWN-ISSUES, AUDIT-REPORT | known issues; security, data and front-end findings |

## Rules for anyone adding tests

- Use fictional data only. Never point a test at anything but loopback.
- A new endpoint needs a contract test in `tests/`; the sweep covers authentication and crashes automatically.
- A new collection in the state needs an entry in `scripts/lib/erd-catalogue.mjs`, then `npm run docs`.
- A new screen needs a row in `docs/ui-redesign/route-inventory.csv` (then `npm run docs`) and, if it changes data, a UI scenario.
- A test you add for a defect must be run against the code without the fix and shown to fail there.
