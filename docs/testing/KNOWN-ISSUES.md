# CLMS replica: known issues and limits

What the audit found and **did not change**, plus the limits of the replica itself. Read this before logging a defect: a match here is already known. Each entry says whether it is a defect in the replica, a decision the owner has to make, or a limit by design.

| ID | Type | Sev | Summary | Workaround |
| --- | --- | --- | --- | --- |
| KI-01 | Defect | Low in India, Medium elsewhere | Some screens turn `YYYY-MM-DD` text into a date with `new Date(...)` and read it back in local time, which shows or sends the previous day west of UTC. The date inputs of manual muster, fixed wages, inactive workers and the employee form were fixed (found by running the UI suite under America/New_York); the whole UI suite now passes in Asia/Kolkata and America/New_York. Still unproven: the Manage Process Month add row and a few date comparisons that reviewers flagged from the code but no scenario exercises | Run the browser with time zone Asia/Kolkata (Playwright: `timezoneId`; Chrome: set the OS zone) |
| KI-02 | Decision | Medium | A leave that spans two months posts **all** its days to the month it starts in. Splitting it needs the leave-year and month-end rules from BFCL | Enter one leave per month |
| KI-03 | Defect | Low | Process-month dates come in two shapes: seed rows are full ISO date-times, rows added through the API are `YYYY-MM-DD`. The server compares the first 10 characters; a test or export that compares raw strings sees the difference | Compare `slice(0, 10)` |
| KI-04 | Decision | Medium | No approver separation: whoever submits a worker change can approve it, and the `approver_id` the screen sends is ignored. The record shows who approved, not who may | Use two accounts in tests and check the audit trail by hand |
| KI-05 | Decision | Medium | Aadhaar and PAN numbers are not unique; the employee screen only warns | None needed for testing; do not rely on uniqueness |
| KI-06 | By design | Medium | Most references in the data model are not fully enforced. Of 66: 41 are checked when a record is created, 4 of those are also protected on delete, 6 are protected on delete only (a worker **can** be created with a location, division, cost centre or city that does not exist, but such a master row cannot be deleted while in use), and **15 are not enforced at all** (worker designation, section, employee type, category, bank and state; business-unit and division entity; city state; holiday contractor; the leave-ledger link to its leave; audit actor; compliance state). The full list is in [../erd/ERD.md](../erd/ERD.md) and is pinned by `tests/erd.test.mjs` | Test against the ERD's "Enforcement" column; a stricter rule is a product decision |
| KI-07 | Decision | Medium | Menu rights only decide which menu entries a user sees. The API enforces **worker scope** (contractor, department, business unit and location) and a **write activity**, not menu access: a user with no menu entries can still call an API they know | Do not use menu hiding as evidence of access control |
| KI-08 | Defect | Low | The "Print SL" and "Print PR" daily registers list the same workers (the server ignores `emp_type` for this report). PT and Bonus reports send range filters the server ignores; they only matter once payroll runs exist | None |
| KI-09 | Defect | Low | The session token is still copied into the JSON body of requests made by 20 shared export helpers in `src/components` (the screens no longer add it). The server ignores it and also reads the Authorization header | None; remove `token` from those request bodies when convenient |
| KI-10 | Defect | Low | Some failures are still only logged to the console: the wage-slip fetch, PrintWageSlips' blob errors (generic message), and a few list loads | Watch the console and the Network tab |
| KI-11 | Defect | Low | Leave ledger: after a delete the list is re-read, so unsaved edits to **saved** rows are lost (unsaved **new** rows are kept). Regularisation: the remarks box on an approved row stays editable although it cannot be saved | Save before deleting; withdraw the approval to edit remarks |
| KI-12 | By design | Low | Upload and rejection reports open in a new window; a browser that blocks pop-ups shows nothing | Allow pop-ups for 127.0.0.1 |
| KI-13 | Defect | Low | The initial JavaScript bundle is over 500 kB (no code splitting) | None; no performance targets exist |
| KI-14 | Test debt | Medium | These fixes were **verified by reading the code and the API contract, not by an automated browser test**: save/delete in the earnings, deductions and arrears grids (period and key handling); the wage-lock grid; service-charge designation list; process-month billing select; leave ledger Add/Save/Delete; employee request; Select-all on three filters; AssignRoles replace/copy semantics; ManageEmployees (Aadhaar/PAN checks, code lock, modal text); upload components other than the muster upload and the wage-component upload; contractor GST fields | Cover them in the manual checklist (TEST-PLAN section 6); add UI scenarios as these screens are next changed |
| KI-15 | Docs | Low | `AGENTS.md`, `README.md` and `VERIFICATION.md` were written for Windows and say `npm.cmd`; on macOS and Linux use `npm` | Use `npm` |
| KI-16 | By design | Info | No payroll engine, wage slips, statutory statements or sandwich processing. 23 routes answer 422 ("BFCL rules required") and 131 answer 501 ("not supported"). **A test passes when these say so; it fails if a figure appears** | None |
| KI-17 | Behaviour change | Info | After this audit, **anonymous reads are refused (401)**, sessions end after 8 hours (`CLMS_SESSION_TTL_MS`), ten wrong passwords lock that user ID for a minute, and `/api/dev/state` withholds password hashes and reset tokens. Any script that read the API without signing in must sign in first | Sign in; or reset with `npm run reset` if an ID is locked and you are not waiting a minute |
| KI-18 | Defect | Low | Worker and contractor records accept extra, unknown fields and store them as sent (`{...body}`) | None |
| KI-19 | Limit | Info | Only Chromium was used. Firefox and Safari are untested | Test on the target browser before relying on a result |
| KI-20 | Defect | Low | Two separate state lists exist: the employee form's (`State`, one demo state) and the compliance profiles' (`StatutoryState`, all Indian states). They never meet | None |
| KI-21 | Defect | Low | `PrintDailyAttendance` still passes a stray `searchTerm` shorthand in a helper config object on the XLS separate-page branch (pre-existing, harmless today) | None |

## Where each open audit finding went

| Audit entry | Known issue |
| --- | --- |
| D-11 leave across months | KI-02 |
| D-12 process-month date shapes | KI-03 |
| D-13 approver separation | KI-04 |
| D-14 Aadhaar and PAN uniqueness | KI-05 |
| S-12 token in request bodies | KI-09 |
| F-10, F-16 and others fixed without a browser test | KI-14 |
