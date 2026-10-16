# CLMS replica: code audit report

Audit of the whole replica (React front end, Node mock API, data model) carried out on 16 October 2026, ahead of testing. It covers what was found, how each finding was confirmed, and what was done about it. The data model is documented separately in [../erd/ERD.md](../erd/ERD.md).

## 1. Scope and method

| Part | Size | How it was examined |
| --- | --- | --- |
| Server (`server/`) | 1,573 lines in 8 files | Read in full; every high-impact claim reproduced against a running server |
| Front end (`src/`) | 128 files: 67 screens, 51 components, utilities, store | Four reviewers each read one area (wages; attendance and leave; people, authentication and masters; shared components, grids and exports). Every finding rated High was then reproduced or re-read by the lead before it was accepted; findings that could not be reproduced were dropped, not reported |
| Dynamic probe | 25 checks | An in-process server and real HTTP requests: anonymous access, 327 routes fuzzed without a token, Origin/Host handling, body handling, scope leaks, sessions, throttling, concurrency, persistence, prototype pollution |
| Route sweep | 85 routes | Every static route, every variant and one unknown address opened in Chromium as the administrator; script errors, console errors and 5xx answers collected |
| Automated measures | n/a | `npm audit` (0 known vulnerabilities), isolation scan, endpoint contract cross-check (every `/api` path the front end calls is registered), server coverage |
| Data model | 47 entities, 66 references | Catalogue checked against live data and attacked through the API (see the ERD) |

Four candidate findings were examined and **rejected** as false positives, and are not in the lists below: a "delete all wage locks" route (it is overridden by a stricter one), an unregistered master-data path (it is registered dynamically), a mismatched DELETE for service charges (the code is commented out), and two unused dependencies.

**What this audit cannot say.** It cannot compare the replica with the live CLMS (no access, by design), so a behaviour can be correct for the replica and still differ from production. Time-zone findings were derived from code; the browser suite was afterwards run under Asia/Kolkata and America/New_York, which exposed one real failure (fixed wages) that is fixed; see KI-01 for what remains unproven.

## 2. Result in one table

| Severity | Entries | Fixed, named automated test that fails before and passes after | Fixed, verified by reading the code or by one browser run | Open (KNOWN-ISSUES.md) |
| --- | --- | --- | --- | --- |
| High | 15 | 14 | 1 | 0 |
| Medium | 25 | 15 | 7 | 3 |
| Low | 9 | 6 | 1 | 2 |
| **Total** | **49** | **35** | **9** | **5** |

An entry can bundle several closely related defects (for example all nine `document.write` templates are one entry). The reviewers' raw lists were longer; items that were cosmetic or duplicated were folded into the entry they belong to.

"Named automated test" means the ID in the Status column fails on the original code and passes now. Each of those tests was run against the pre-fix code to prove it fails there (section 4); the exception is UI-02's console check, which was proved on the individual defects it caught. "Verified by reading" means the fix was reviewed and the API contract exercised, but no automated test drives that screen (listed as test debt in KI-14).

## 3. Findings

IDs are stable: `AUD-xx` regressions in `tests/audit-regressions.test.mjs`, `UI-nn` in `tests/ui/smoke.mjs`, `HTML-nn`, `SWEEP-nn`, `ERD-nn` as named. "Verified" says how the lead confirmed the finding before fixing it.

### 3.1 Security and sessions

| ID | Sev | Finding | Evidence | Status / test |
| --- | --- | --- | --- | --- |
| S-01 | High | **Any read was allowed without signing in**, so `GET /api/users/getAllUsers` and `/api/employee/getAllEmployees` returned account details and worker records (identity numbers) to anyone who could reach the port | `administration.mjs`: a blanket "GET without a session is allowed"; reproduced with eight routes | Fixed: every route except health, capabilities, features, login, logout, reset and the menu bootstrap needs a session. AUD-A01, SWEEP-02 |
| S-02 | High | **A scoped user saw other contractors' data** in the nested accounting summary (rows and totals): 600 shown, 100 in scope | `workspace.mjs` accounting summary; the scope filter only looked at top-level lists. Reproduced | Fixed: the filter now works at every depth and the totals are computed from in-scope rows. AUD-A11 |
| S-03 | High | **A user with no worker scope could approve or reject any pending worker change**, and the approval replaced the whole record with a stale copy (an inactivated worker became active again) | `index.mjs` approve handler; reproduced both | Fixed: scope is checked on the pending record's worker; approval merges only the fields the submitter changed. AUD-D12 |
| S-04 | High (latent) | **Nine upload and error reports built HTML with `document.write` and unescaped cell values**: a workbook cell containing markup would run script in the app's origin | `Upload*.jsx` (7), `UpdDeptInMust.jsx`, `ManageEmployees.jsx`; read | Fixed: every interpolation goes through `escapeHtml`; a source scanner fails the build on any new unescaped one. HTML-01 to HTML-03 |
| S-05 | Medium | Ordinary users could not change their own password: the whole `/api/users` area was administrator-only | Reproduced (403); the screen exists for everyone | Fixed. AUD-A06, UI-08 |
| S-06 | Medium | A deactivated user's open session kept working | Reproduced | Fixed. AUD-A07 |
| S-07 | Medium | No logout and no session expiry (a token lived until the process restarted) | No route; sessions were a plain map | Fixed: `POST /api/users/logout`, 8-hour sessions (`CLMS_SESSION_TTL_MS`), the header calls logout. AUD-A08, UI-09 |
| S-08 | Low | No throttling of failed sign-ins; sign-in time revealed whether an ID exists (about 158 ms against 16 ms) | Probe | Fixed: ten failures lock that ID for 60 s (HTTP 429); an unknown ID pays for one hash. AUD-A09 (the timing change is not asserted: timing tests are unreliable) |
| S-09 | Medium | Created-by / modified-by columns were the literal "demo" for every user, and a contractor update let the client set them | Reproduced | Fixed: the signed-in user is recorded; the client cannot set audit columns. AUD-A12 |
| S-10 | Low | A malformed percent-encoded path answered 500 | Reproduced | Fixed: 400. AUD-A05 |
| S-11 | Low | The fixture export (`/api/dev/state`, administrator only) included password hashes and reset tokens | Read | Fixed: both withheld. AUD-A13 |
| S-12 | Low | The session token was also copied into the body of print and export requests | Read | Partly fixed: removed from the screens; 20 shared export helpers still send it (KI-09) |

### 3.2 Data integrity

| ID | Sev | Finding | Evidence | Status / test |
| --- | --- | --- | --- | --- |
| D-01 | Medium | A worker could be created with a contractor, department, business unit or entity that does not exist; a numeric code was stored as a number and could not be found by its text | Reproduced | Fixed: references are checked, codes stored as text. AUD-D01, ERD-04 |
| D-02 | Medium | A master record could be renamed onto another record's key (two rows with the same key) | Reproduced | Fixed: 409. AUD-D02/D03 |
| D-03 | Medium | A master record could be deleted or re-keyed while workers, manpower, allocations or muster rows still used it | Reproduced (business unit B01 deleted under four workers) | Fixed for business units, locations, divisions, cost centres, shift groups and cities: 409. AUD-D02/D03, ERD-06 |
| D-04 | Medium | Leave: 400 days accepted for a one-day range (balance went to -394); overlapping leave accepted | Reproduced | Fixed: days must fit the dates (whole or half days) and may not overlap. AUD-D04 |
| D-05 | Medium | An approved regularisation could still be edited (through the API and the screen) and stayed approved | Reproduced | Fixed: 409 until approval is withdrawn; the screen makes the row read-only. AUD-D13 |
| D-06 | Medium | A multi-byte character split across two network chunks was corrupted (U+FFFD) | Reproduced with 120,000 Devanagari characters | Fixed: the body is decoded once after the last chunk. AUD-R02 |
| D-07 | Medium | The punch-mark list the API published had 6 marks while 11 are accepted, so the screen could not offer HD, LOP, WFH, OD or HLD | Reproduced | Fixed: the list is exactly the accepted set. AUD-D14 |
| D-08 | Low | The sandwich-rule Active flag was never saved | Reproduced | Fixed. AUD-D14 |
| D-09 | Low | Department checks used a master that does not exist, so a built-in department that no worker used yet would be rejected | Read | Fixed (checks the built-in list). ERD-04 controls |
| D-10 | Low | Workbook import stored numeric cells as numbers (contractor, department, Aadhaar, phone), which broke later strict comparisons | Read | Fixed: coerced to text. import-workbook tests |
| D-11 | Medium | Leave across two months posts all its days to the first month | Probe | Open: KI-02 |
| D-12 | Low | Process months mix `YYYY-MM-DD` (added through the API) and full ISO date-times (seed) | Probe | Open: KI-03 |
| D-13 | Medium | No approver separation: the submitter of a worker change can approve it, and the `approver_id` the screen sends is ignored | Read | Open: KI-04 |
| D-14 | Medium | Aadhaar and PAN uniqueness is not enforced (the screen only warns) | Read | Open: KI-05 |

### 3.3 Front-end functional defects

| ID | Sev | Finding | Status / test |
| --- | --- | --- | --- |
| F-01 | High | **Earnings and deductions could not be added**: the code dropdown's option values were `undefined` (the grid read `ernCode`, the API sends `ern_code`) | Fixed. UI-03, UI-04 |
| F-02 | High | **Fixed wages could never be saved**: no billing-type field (400), PF options 0-4 where the API needs Y/N, edit copied a field that does not exist | Fixed. UI-06 |
| F-03 | High | **Manual muster offered two marks (A, HDP) the API rejects**, and Add could not be blocked because empty selections were truthy | Fixed. UI-05 |
| F-04 | High | **Failed prints and exports said "printed successfully"** (13 screens): the export helpers swallowed every error | Fixed: helpers rethrow, screens show the server's reason, an empty result says so. UI-13 |
| F-05 | High | **Monthly attendance export, one sheet per contractor**: Department and BU values were swapped and every overtime cell read 00:00 | Fixed. UI-12 (fails on the original) |
| F-06 | High | **Monthly attendance sheet (XLS)**: the AB column was always 0 (the API's mark "AB" was not recognised); HD, WFH and LOP counted nowhere | Fixed (legacy production codes still recognised). UI-12 |
| F-07 | High | **Attendance summary report always empty**: it offered employee types PR and LS, but workers are SL or US; the PDF/XLS choice followed the wrong control | Fixed. UI-11 (type list); the PDF/XLS switch was fixed by reading |
| F-08 | High | **Registering a contractor or user that already exists showed success** and cleared the form: a rejected request was treated as accepted | Fixed. UI-07 |
| F-09 | High | **Role assignment could silently wipe a user's roles** (Submit without Show Roles) or copy one user's roles onto another | Fixed: Show/Copy replace the selection, changing the code clears it, an empty save asks first. UI-10 |
| F-10 | High | **Wage grids deleted or saved the wrong month's record** when a header dropdown was changed without reloading; rows of one worker with several reference months were mixed up | Fixed by reading and API contract; not UI-tested (KI-14) |
| F-11 | High | **Wage-component upload** dropped GrossRate, rejected an exported file, and failed the whole batch with "Data Issue" on any blank cell | Fixed: UI-15 |
| F-12 | Medium | Upload components: numeric employee codes failed; midnight and zero were treated as missing; rows without a date were dropped silently; `UploadArrears` tested the wrong variable; dates were read in UTC and shown in local time | Fixed. UI-14 (muster), others by reading and builder-run function tests |
| F-13 | Medium | The wage-lock grid showed the wrong month and wrong contractor for every lock; Delete could act on an edited row | Fixed (read-only rows). Reading |
| F-14 | Medium | Service-charge designation list came from departments, so every designation rule failed; the success message did not reset the form | Fixed. Reading |
| F-15 | Medium | Export Fix Wages Dump: the Active filter sent values the API does not know (empty result) and a typo (`axios.pos`) stopped the entity list loading | Fixed. The typo was found by the route sweep (UI-02) |
| F-16 | Medium | Leave ledger: "+ Add" replaced the queried rows; Save re-stamped every manual row and could double-submit; a mixed delete left ghost rows | Fixed. Reading (KI-14) |
| F-17 | Medium | Employee request: the success path threw (`ref` never attached) and reported failure; a dead Delete button | Fixed. Reading |
| F-18 | Medium | Employee screen error handlers threw inside `catch` (a SQL Server error shape that the replica never sends) in 48 places across 8 screens; the real message was lost | Fixed: one helper, `apiErrorMessage`. `ui-helpers.test` |
| F-19 | Medium | Employee screen: Aadhaar check popped up for every 12-digit number ("No details" for an empty array) and matched the worker with themself; PAN check required 12 characters; editing the code created a second pending worker; the success text always said "User Registered" | Fixed. Reading |
| F-20 | Medium | Change password: the session stayed in the browser after a successful change; contractor GST fields differed between the register and manage screens; "N" displayed as ticked; the manage screen forged Created_* on update | Fixed. UI-08; reading |
| F-21 | Low | Location "Select all filtered" filled the business-unit filter (3 screens); user ID input was numeric ("007" became 7, "demo" showed blank); ManageFixWages / ApproveEmployeeChanges used duplicate React keys; invalid DOM nesting in 5 tables; a stray quote in every error message; the menu builder threw on an unknown parent | Fixed. UI-02 (no console errors on any route) |
| F-22 | Medium | Manual muster: after the first fix Add stayed disabled if the employee was validated before the shift and mark were chosen | Fixed (found by the UI suite). UI-05 |
| F-23 | Medium | Date inputs showed (and sent) the previous day west of UTC on four screens (manual muster, fixed wages, inactive workers, employee form): a `YYYY-MM-DD` string was parsed as UTC and read back in local time | Fixed. Found by running the UI suite under America/New_York (UI-06 failed); the suite now runs in both zones in CI |

### 3.4 Dismissed or deferred

See KNOWN-ISSUES.md for everything that was found and **not** changed, with the reason and a workaround.

## 4. Proof that the new tests discriminate

A test that has never failed proves little. Each group was run against the code as it was before the audit:

| Suite | On the original code | On the fixed code |
| --- | --- | --- |
| `audit-regressions.test.mjs` (16 tests) | 15 of 15 then-existing tests failed (the 16th was added later) | pass |
| `api-sweep.test.mjs` (SWEEP-02) | fails (anonymous reads allowed) | pass |
| `html-escaping.test.mjs` (HTML-02) | fails (9 files, dozens of unescaped values) | pass |
| UI scenarios UI-03 to UI-08 and UI-10 to UI-15 (original front end against the fixed API) | all fail | all pass |

## 5. Method notes for reviewers of this audit

- Reviewer reports were treated as claims, not facts. Of the claims rated High, each was reproduced by a probe, a browser run or a direct read before it was fixed. Where a claim was only true on one code path (the swapped Department/BU columns appear only in the "separate sheet per contractor" layout), the test exercises that exact path.
- Fixes to screens were made in parallel by separate workers on disjoint folders; the lead integrated them, ran the browser suite and fixed what it found (three defects were introduced or exposed by that integration and are in F-22, F-15 and the ChangePassword confirmation delay).
