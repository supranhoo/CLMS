# Replica verification

Updated on 16 October 2026 on this Windows computer. These checks apply to the local development replica, not the live CLMS application. Automated coverage and browser observations are recorded separately.

## Automated checks

- **56 tests pass, zero failures.** Coverage includes local login/menu contracts, contractor and master persistence, employee approvals, leave operations, explicit payroll blocking, HTTP origin/host restrictions and the shared frontend request guard.
- New workflow tests cover atomic attendance and workbook imports; date/worker validation; pending-to-approved regularisation behavior; effective allocations; department changes; manpower counts; consistent attendance reports; local punch-processing idempotency; request transitions; draft sandwich rules; state-profile history and version conflicts; adjustment locks; recorded-input accounting; local account hashing and scope; single-use recovery; and compliance working-data boundaries.
- XLSX tests serialize and reopen the generated workbook. They verify explicit columns, numeric leave-day values, preservation of text identifiers, literal treatment of formula-like text, metadata and rejection of empty exports.
- Serialized import tests preserve full punch timestamps and date-only worker dates in UTC and Asia/Kolkata, including Excel's 1904 date system and CSV text. Posting tests use explicit synthetic calculated-output fixtures in temporary directories: preview never writes, repeat posting retains IDs and dates, wrong-contractor or absent outputs cannot clear existing rows, and locks or malformed batches preserve all ledger rows. These fixtures do not constitute a payroll calculation engine.
- Saved manual ledger rows strip UI edit flags and derived values, validate calendar months, preserve source-owned entries and reject invalid batches atomically. Expired local sessions return sign-in rather than an empty dashboard. Arrear days remain raw inputs and do not derive pay.
- Application isolation scan passes. The shared client rejects remote, protocol-relative and non-API targets; a supplied remote base URL cannot override the local destination.
- Vite frontend build passes. The recovered app still has a large initial bundle; code splitting is a future improvement.
- Current `npm.cmd audit --omit=dev` reports zero known vulnerabilities in production dependencies. The build still reports its large-bundle warning.

## Earlier browser checks: initial recovered replica

These observations belong to the earlier recovery baseline. They do not certify browser behavior of the newly implemented screens below.

| Check | Observed result |
| --- | --- |
| Landing page and demo sign-in | Original branding and development banner display; demo login opens the dashboard |
| Dashboard | Eight original module groups appear, with available routes and explicit unavailable items |
| Worker management | Four fictional workers load |
| Contractor management | Fictional contractor edit saved and survived a page refresh |
| Contractor registration | Fictional contractor added; refresh retained the demo login and the new row |
| Contractor validation and feedback | Invalid form showed errors; corrected save cleared those errors and displayed Contractor saved successfully |
| Attendance calendar | Four fictional employees render with daily columns for the selected month |
| Leave balance report | September 2026 demo results return four records with synthetic balances |
| Leave report export | Browser downloaded an XLSX; reopened file has one sheet, eight columns and four demo data rows |
| Shift setup | Shift Groups and Shift Timings load synthetic rows |
| Missing compliance form, initial baseline | Form XII opened an unavailable-screen explanation; the current working-data page replaces that screen and needs current browser QA |
| Deep-link refresh | Existing contractor route renders after reload and retains the demo session |
| HTTP fallback and CSP | Local deep-link response is HTTP 200 with the loopback-only connection policy |

At that initial baseline, a fresh contractor-screen reload, row selection, validation and save produced no new browser console errors. Original source-map hashes were rechecked against the recovery manifest; the installed frontend source-map files were unchanged.

Temporary browser-test records were reset to the original fictional fixtures after testing. Automated persistence tests use temporary directories rather than the app's sample workspace.

## Current release browser QA

The following observations were made in the local browser on 16 October 2026. Workflows marked contract-tested were not exercised end to end in this browser pass.

| Current workflow | Browser observation / evidence |
| --- | --- |
| State profile selection, blank profile creation, draft save/reload and version feedback | Created blank Bihar profile, selected it, saved an unverified source note, saw version 2 and confirmed note/version after reload. Restored Jharkhand selection. No rates or formulas supplied. |
| Feature coverage and pending BFCL requirements display | Dashboard shows Accounting, Approvals and all six report links. Workbench separates locally available, BFCL-rule-dependent and external-integration features. |
| Leave Ledger XLSX download, filter metadata and unsaved-edit guard | September Casual Leave query returned four records. Download reopened with 10 business columns, four worker rows and Metadata sheet. Unsaved day edit blocked export; re-query discarded that edit without saving. |
| Payroll Leave Posting preview XLSX download | Export helper serialized/reopened in tests. No calculated outputs exist in the user workspace, so posting/preview remains gated. Explicit calculated-output posting behavior is contract-tested only. |
| Six compliance working-data previews, field selection, XLSX and print / Save PDF | Form XII preview/download reopened with two contractors and metadata. Form XVI October preview had 124 source records; search DEMO001 and removal of out-time column produced a reopened workbook with 31 rows, seven columns and correct October/search metadata. Other four forms and browser print were not exercised in this pass. |
| Worker/contractor workbook template, validation, rejection and commit | Worker Upload opens import tool. A two-row CSV including existing DEMO001 was rejected in CREATE mode and Save stayed disabled. Explicit UPSERT validation succeeded and enabled Save; no rows committed. Contractor/commit behavior remains contract-tested only. |
| Local punch import, processing result and job history | Timestamp parsing and processing contracts pass automated tests; no browser job run in this pass. |
| Attendance edits, regularisation approvals and downstream report updates | Contract-tested; no new browser mutation in this pass. |
| Request approvals and recorded-input accounting | Dashboard destinations visible; contract-tested behavior. |
| Local users, assignments, recovery outbox and audit trail | Dashboard destinations visible; contract-tested behavior. Stale-session refresh returned sign-in and demo sign-in restored module menus. |

For downloaded workbooks, reopen the saved file and check rows, text identifiers and scope metadata. For changed forms, inspect feedback and reload persistence. Record console or network failures with the affected screen and action. Reset disposable test records only after preserving any drafts needed for further work.

Browser QA found a worker-form option warning caused by missing lowercase cost-centre aliases; the API now supplies those aliases and a regression assertion passes. The nine recovered CSS stubs and broad legacy-screen coverage limitation remain. Screenshots are saved under `qa/`; the import QA CSV is fictional and was not committed into sample records. Existing sample records were not globally reset; the new blank Bihar draft is retained.

## Boundaries

This is a recovered editable frontend with a local API and fictional data. It is not a reproduced SQL backend. Imports, exports, local account/recovery controls, attendance input processing and approvals are implemented in this sandbox. The two original leave XLS placeholders have been replaced with actual XLSX generation.

All state compliance profiles remain **DRAFT**. BFCL payroll calculations, payment outputs, paid-attendance interpretation, calculated payroll leave posting, sandwich processing and certified statutory layouts still require supplied source rules, verification, implementation and expected-result checks. A completed draft form does not enable calculation. Biometric/operating-system jobs and external email/WhatsApp delivery are not connected. Compliance previews are explicitly **WORKING DATA / BFCL FORMAT REQUIRED**.

Nine CSS imports were absent from the source maps and have documented placeholder files. All screens and all user workflows have not been exhaustively verified. The frontend build still warns about a large bundle; that warning does not change its successful build result.

The API capability endpoint describes method-level coverage. Its implemented status means a local sample contract exists; it does not certify production business-rule parity.
