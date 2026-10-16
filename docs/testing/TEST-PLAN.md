# CLMS replica: test plan

Applies to the **development replica** in this repository (React front end, dependency-free Node mock API, fictional data). It does not apply to the live CLMS, which this project has never been connected to.

Companion documents: [TEST-CASES.md](TEST-CASES.md) and [test-case-matrix.csv](test-case-matrix.csv) (every route and workflow), [../erd/ERD.md](../erd/ERD.md) (data model), [AUDIT-REPORT.md](AUDIT-REPORT.md) (what was found and fixed), [KNOWN-ISSUES.md](KNOWN-ISSUES.md) (what is still open), [READINESS.md](READINESS.md) (go / no-go).

## 1. What is being tested, and what is not

**In scope**

- The 85 front-end route cases (69 static routes, 15 variants, one unknown address) and the workflows listed in TEST-CASES.md.
- The 459 API routes the server lists: 305 implemented, 23 that answer "BFCL rules required" (HTTP 422) and 131 that answer "not supported" (HTTP 501).
- Local accounts, scopes and sessions; worker, contractor and master data; attendance inputs and reports; leave ledger; wage inputs, periods and locks; workbook import, export and upload; compliance working data.
- The data model as documented in the ERD, including which references the API enforces and which it does not.

**Out of scope, by design of the replica**

- BFCL payroll, wage slips, statutory statements, and sandwich-leave processing. The replica has no engine: those actions must answer 422/501 and must never show a figure. A tester **passes** a case when it says "unavailable", and **fails** it if it shows a made-up result.
- Biometric devices, e-mail, WhatsApp, the live server, SQL Server. Nothing in the replica contacts them.
- Performance and load. The initial JavaScript bundle is large (over 500 kB); there are no performance targets.
- Browsers other than Chromium. Other browsers are untested.

## 2. Environment

| Item | Value |
| --- | --- |
| Node.js | 22.12 or later |
| Install | `npm ci` (macOS/Linux) or `npm.cmd ci` (Windows PowerShell). The older docs write `npm.cmd`; on macOS and Linux use `npm`. |
| Start | `npm run dev`: UI on <http://127.0.0.1:5173>, API on 127.0.0.1:5001. Both refuse non-loopback clients. |
| Sign in | **demo / demo123** (administrator), or the "Enter demo workspace" button. Every other account is created by the tester. |
| Browser for manual work | Chromium-based, window at least 1366 px wide, plus one pass at 390 px. Time zone **Asia/Kolkata** (the UI suite also runs under America/New_York in CI) (a few screens parse `YYYY-MM-DD` text with local time and can show the previous day west of UTC; see KNOWN-ISSUES KI-01). |
| Browser for the UI suite | Playwright with Chromium (`npm i --no-save playwright`, then `npx playwright install chromium`). The suite starts and stops its own servers on 5001/5173, so stop `npm run dev` first. |
| Persistence | `.local-demo/state.json`. Delete it, or run `npm run reset`, to return to the seed. |

### Starting from a known state

```text
npm run reset      # restores the seed fixtures: through the API if it is running (all sessions are revoked),
                   # otherwise by deleting .local-demo/state.json
```

Unit/contract tests and the UI suite never touch `.local-demo`: they use servers that keep their data in memory only. Run them as often as you like.

### Seed data (what a fresh start contains)

| Entity | Fixture |
| --- | --- |
| Contractors | D001 Demo Fabrication Services; D002 Sample Maintenance Partners |
| Workers | DEMO001 Asha Demo and DEMO002 Ravi Sample (D001, department D01); DEMO003 Mira Example and DEMO004 Dev Test (D002, department D02). All business unit B01, location L01, type SL, designation OP |
| Masters | Business unit B01; location L01; cost centre C01; division DV; city DC; shift group G1 with shift GEN; holiday 2 Oct 2026 |
| Wage periods | Monthly September, October and November 2026; fixed wages of 500, 525, 550 and 575 basic for DEMO001 to DEMO004 |
| Leave | Opening balances for every worker: CL 6, EL 10, SL 4 |
| Approved manpower | One row: D001, D01, B01, SL, 6 day / 2 night |
| Accounts | demo only. Roles are empty (an empty assignment means no access, never full access) |

Creating a **scoped operator** (needed for every authorisation test): sign in as demo, Register a user, then open Assign Roles and give that user at least one business unit, contractor, department **and** location (all four, otherwise the user sees no workers) and the WRITE activity (otherwise the user can read but not save).

## 3. Test levels

| Level | Tool | What it proves | Run |
| --- | --- | --- | --- |
| Contract and unit | `node --test` (`tests/*.test.mjs`) | Each endpoint's validation, scope, locking and persistence; audit regressions (AUD-*); data-model claims (ERD-*); HTML escaping (HTML-*) | `npm test` (about 20 s, no browser) |
| API sweep | `tests/api-sweep.test.mjs` | Every listed route: 401 without a session, no crash with an empty body, 501/422 where declared, 403 on admin-only routes for ordinary users | included in `npm test` |
| UI smoke | `tests/ui/smoke.mjs` (Playwright) | The app renders every route without script or server errors (UI-02), and 13 scripted workflows (UI-01, UI-03 to UI-14) work in a browser, including downloaded and uploaded workbooks | `npm run test:ui` (about 3 min) |
| Static checks | `npm run check`, `npm run build` | No remote URLs; the bundle builds | before every merge |
| Manual and exploratory | Checklists in section 6 | Layout, keyboard use, print, wording, anything a script cannot judge | per release |

How to read a failure: an `AUD-` or `ERD-` failure names a documented defect or data-model claim that has regressed; a `UI-` failure leaves a screenshot path in the output; the matrix rows say which automated check covers which route.

## 4. Entry criteria (start a test cycle when all hold)

1. `npm ci`, `npm run build`, `npm run check` and `npm test` pass on the commit under test.
2. `npm run docs` produces no changes (the ERD and case matrix match the code).
3. The environment is reset (`npm run reset`) or the tester is using a fresh clone.
4. KNOWN-ISSUES.md has been read; a defect that matches an entry is not logged again.

## 5. Exit criteria (a cycle is complete when all hold)

1. All P0 cases in the matrix have been run, by script or by hand, with no open Critical or High defect.
2. `npm test` and `npm run test:ui` pass on the final commit.
3. Every Medium defect is fixed or has an entry in KNOWN-ISSUES.md with a workaround and an owner.
4. Server line coverage from `node --test --experimental-test-coverage` has not dropped below the figure in READINESS.md.
5. Test evidence is attached to the cycle's report: the commit hash, the output of both suites, and the manual checklist results.

**Suspend** testing if the API will not start, `npm run build` fails, or a Critical defect (data loss, a screen that cannot be used, an exposed credential) is found. **Resume** after a fix and a re-run of the entry criteria.

## 6. Manual checklists

### TC-UI: every screen (85 routes)

1. Opens from the menu and by typing the address; a refresh keeps the session.
2. Heading and labels read sensibly; required fields are marked; tab order follows the visual order; focus is visible.
3. Empty state, loading state and error state each say what happened (switch the API off to see the error state).
4. A rejected save shows the server's reason; it never shows a success message. Duplicate, invalid and out-of-scope input give different messages.
5. Anything unavailable says so. No screen shows a wage, tax or statutory figure.
6. At 390 px wide the page scrolls vertically only, and tables scroll inside their own container.
7. Print preview (Ctrl+P) of a report shows the report and not the menu.
8. No error appears in the browser console (the UI suite checks this for every route).

### Exploratory charters (45 minutes each; record what you tried, not only what failed)

| Charter | Ideas |
| --- | --- |
| Roles and scope | Create operators with each of the four scopes missing in turn; with and without WRITE; confirm they see only their workers in the grid, in reports and in the accounting summary; try to open an admin screen by address |
| Attendance | Every mark in the list; midnight and overnight punches; a range that crosses two months; duplicate and out-of-order punches; regularise, approve, try to edit, withdraw |
| Leave | Half days; a leave that starts in one month and ends in the next (all days post to the first month: KI-02); overlapping leave; deleting a leave; manual ledger rows with a negative balance |
| Wages | Two effective-dated rates for one worker; earnings, deductions and arrears with and without a reference month; locks for one contractor and for ALL; editing under a lock (HTTP 423); deleting a month that has inputs |
| Workbooks | Upload with numeric codes, blank rows, text in date columns, a 2,000-row file, a file that is not a workbook; export, reopen the file, compare with the screen |
| Accounts | Wrong passwords (ten in a row locks that ID for a minute); reset token expiry; deactivate while signed in; sign out and replay the token |
| Data model | Delete or re-key a master row that workers use (blocked); create a worker with an unknown contractor (blocked) and with an unknown designation (accepted: not enforced) |

## 7. Defects

| Severity | Meaning | Examples |
| --- | --- | --- |
| Critical | Data is lost or exposed, the app cannot be used, or the replica contacts the outside world | A password hash in a response; a request to a non-loopback address |
| High | A core workflow fails or gives a wrong result with no warning | A screen that cannot save; an export with columns swapped; a scope breach |
| Medium | A workflow works but misleads, or an error hides its reason | A success message after a failure; a missing validation |
| Low | Cosmetic, wording, or an edge case with a workaround | A label typo; a console warning |

A good report gives: the case ID, the commit, the account used, exact steps, expected and actual result, the browser console and the API response (browser dev tools, Network tab), and a screenshot. Check KNOWN-ISSUES.md first.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| The replica is mistaken for the live system and results are quoted as production behaviour | The UI shows a development banner and workbook exports carry a local-data notice; results from this environment describe the replica only |
| Behaviour that a test accepts today is a defect against production (references that are not enforced; one-month leave posting) | The ERD marks every unenforced reference; tests pin today's behaviour so a change is noticed, not silently inherited |
| Front-end vocabulary differs from the replica (production mark codes such as PX, HDP, WOP are still understood by the exports; the replica emits P, AB, WO, HD ...) | The exports accept both; add a code to both sides when the BFCL list is supplied |
| The UI suite depends on Chromium and on the layout of a few screens | Selectors use roles, names and field names, not CSS classes; a failure includes a screenshot |
| Test data bleeds between runs | Suites use in-memory servers; manual runs start with `npm run reset` |
