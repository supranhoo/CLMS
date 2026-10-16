# CLMS replica: readiness for testing

Assessment date: 16 October 2026. Scope: the development replica (fictional data). Nothing here says anything about the live CLMS.

## Verdict

**Ready for functional testing of the replica, with conditions.** The defects that would have blocked or invalidated a test cycle are fixed and pinned by automated tests; the environment can be started, reset and rerun in minutes; and every screen, route and workflow has a written case. It is **not** ready to be used as evidence about payroll, statutory output, performance, or other browsers, and four product decisions (below) will change what some tests should expect.

| Condition | Why |
| --- | --- |
| Treat "unavailable" as a pass for payroll, wage slips, statutory statements and sandwich processing | The replica has no engine (23 routes answer 422, 131 answer 501). A figure appearing there is a defect |
| Read [KNOWN-ISSUES.md](KNOWN-ISSUES.md) first | 21 entries; 5 are decisions or by-design limits only the owner can change (leave across months, approver separation, Aadhaar/PAN uniqueness, menu rights and the API, unenforced references) |
| Run the first cycle with the manual checklist for the screens listed in KI-14 | About 20 screens were fixed and checked by reading the code and the API, not by a browser script |
| Use Chromium and time zone Asia/Kolkata for manual work | The suites ran there and in America/New_York only |

## Evidence

| Measure | Before the audit | Now | How to repeat |
| --- | --- | --- | --- |
| Contract and regression tests (`npm test`) | 68 pass | **178 pass, 0 fail**, about 20 seconds | `npm test` |
| Browser scenarios (`npm run test:ui`) | none (the UI had no automated tests) | **15 of 15 pass** under Asia/Kolkata and under America/New_York, about 3.5 minutes each | `npm run test:ui` |
| Server line coverage | 95% lines, 75% branches | **97.1% lines, 80.7% branches, 85.3% functions** | `node --test --experimental-test-coverage --test-coverage-include='server/**'` |
| Routes with an automated authentication, crash and "unsupported" check | 0 | **459 of 459** | `tests/api-sweep.test.mjs` |
| Screens opened without script, console or server errors | not measured | **85 of 85** (69 static, 15 variants, 1 unknown address) | UI-02 |
| Production dependencies with known vulnerabilities | 0 | **0** | `npm audit --omit=dev` |
| Isolation check (no remote URL, no production config) | pass | **pass** | `npm run check` |
| Build | pass (one bundle-size warning) | **pass** (same warning) | `npm run build` |
| Data model documented and checked | none | **47 entities, 66 references**, each reference checked against data; 48 enforcement claims attacked through the API, each rejection proved to be about the reference by 19 control calls | `docs/erd`, `tests/erd.test.mjs` |
| Test cases written | none | **562** (18 workflows, 85 screens, 459 routes) | `docs/testing/test-case-matrix.csv` |

**The new tests were shown to fail on the old code.** The audit regressions failed against the original server (15 of 15 when first run) and pass now; the anonymous-read sweep and the HTML-escaping scan fail on the original code; the browser scenarios UI-03 to UI-08 and UI-10 to UI-15 fail on the original front end (against the fixed API) and pass on the fixed one. Details in [AUDIT-REPORT.md](AUDIT-REPORT.md) section 4.

## What was fixed (summary)

49 audit entries: 15 High, 25 Medium, 9 Low. 35 are fixed and pinned by a named automated test, 9 are fixed and verified by reading or by one browser run, 5 are open and documented. The High ones, in plain terms:

- anyone who could reach the port could read the account list and every worker record without signing in;
- a scoped user saw other contractors' figures; an unscoped user could approve worker changes, and approving a stale change undid later edits;
- uploaded workbook text was written into HTML unescaped (nine places);
- earnings, deductions and fixed wages could not be added from the screens at all; manual muster offered marks the server refuses;
- failed prints and exports said "printed successfully"; the monthly attendance exports had swapped columns, zero overtime and a zero absent count;
- registering a duplicate contractor or user looked like a success; role assignment could silently wipe a user's roles;
- the wage-component upload dropped a rate, rejected its own export and aborted on any blank cell.

## Not verified, and why it matters

| Gap | Effect on testing |
| --- | --- |
| **Parity with the live CLMS** is unknowable here | A behaviour can pass every test and still differ from production. Test results describe the replica |
| About 20 screens fixed without a browser script (KI-14) | Higher chance of a defect there; they are on the manual checklist |
| Three of the riskiest changes (role assignment, leave ledger, wage upload) were read line by line; the other front-end changes (about 80 files) were checked by build, the route sweep and the scenarios above | A regression in an unscripted corner is possible |
| Print output and PDF layout were not inspected visually | Add print preview to the manual pass |
| Accessibility was not measured (no contrast or screen-reader run on the redesign-era screens) | Out of scope for this cycle; TC-UI item 2 covers the basics by hand |
| No load, no performance targets, bundle over 500 kB | Do not draw performance conclusions |
| Chromium only | Check the target browser before sign-off |
| Order-dependence between UI scenarios | One scenario was found to depend on rows an earlier one creates (fixed); the suite starts a fresh server per run, and `--only` runs a scenario alone on a fresh server |

## Decisions the owner should make before or during the first cycle

1. **Leave across months** (KI-02): split the days by month, or keep posting to the first month.
2. **Approver separation** (KI-04): may the person who submits a worker change approve it?
3. **Aadhaar and PAN uniqueness** (KI-05): enforce, or only warn.
4. **Menu rights and the API** (KI-07): should the API refuse a user whose menu does not include the screen?
5. **Unenforced references** (KI-06): which of the 15 should become rules (designation, employee type, bank, state ...).

Each of these changes expected results in the matrix; the ERD tests pin today's behaviour so a change is noticed.

## Entry criteria check (TEST-PLAN section 4)

| Criterion | State |
| --- | --- |
| `npm ci`, `npm run build`, `npm run check`, `npm test` pass | yes |
| `npm run docs` produces no changes | yes (enforced by `tests/docs-current.test.mjs`) |
| Environment can be reset | yes (`npm run reset`, tested) |
| KNOWN-ISSUES read | to do by each tester |

## Recommended first cycle

1. Run the two suites and attach their output to the cycle report.
2. Run the P0 workflows WF-01, WF-04, WF-05, WF-08, WF-11, WF-12, WF-13, WF-14, WF-15 and WF-18 by hand with a scoped operator (they cover sign-in, scope, onboarding, attendance and its exports, leave, wage periods and inputs, locks, and reset).
3. Work the KI-14 screens through the TC-UI checklist, and add a UI scenario for each as it is exercised.
4. Take the five decisions above and update the affected cases.
