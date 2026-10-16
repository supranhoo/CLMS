# Workflow requirements for the CLMS UI redesign

Prepared 16 October 2026 from the current source in `D:\CLMS\replica`. This is a planning audit, not a claim that the changes below are implemented. No application code or sample records were changed for this audit. Browser appearance is covered separately in the main plan; findings here are supported by source inspection.

## Scope and boundaries

The redesign must make every route usable within one interface, including the recovered screens, recently added local tools, import dialogs, print/export screens and rule-dependent destinations. A more attractive dashboard alone will not satisfy this scope. Route families are listed below so rare administration and payroll pages are not omitted.

The isolated local sandbox, fictional data, same-origin API client and existing business contracts remain intact. Do not interpret a UI redesign as permission to connect production, calculate wages using assumed policies, certify a statutory form or simulate external delivery. The API deliberately returns `BFCL_RULES_REQUIRED` for calculations; that is a supported product state. The design problem is communicating it before the action and preserving the explanatory response.

Priority meanings: **P0** prevents misleading or unsafe interaction and establishes reusable behavior; **P1** completes the daily operations workflows; **P2** completes report, administration and secondary-screen consistency. Every priority remains in whole-app scope.

## Source-backed issues that cross page families

| Finding | Current evidence | Design requirement | Priority |
| --- | --- | --- | --- |
| Dense styling leaks into unrelated screens | `src/components/AttendanceGrid.css:129` styles global `button.btn` with 10px text, `!important`, hover movement and shadow. It is imported by `AttendanceGrid.jsx:5`. Related compact CSS repeatedly forces 24px fields and 10–14px text. | Remove global feature-owned button overrides during migration. One control/density system owns typography, height, focus, loading and disabled states. Dense tables can be compact; essential labels and controls must remain readable and reachable. | P0 |
| Toolbars are built as data tables | `ManageEmployees.jsx:1110`, `ManageContractors.jsx:381` and `ManageUsers.jsx:298` use table cells for search, pagination, page size and actions. User-table toolbar even places cells directly in `thead`. | Replace with a semantic wrapping toolbar: search and filters, record count, primary action and export menu. Put pagination after results. It must reflow independently of horizontal table scrolling. | P0 |
| Wide grids hide the task | Employee master contains roughly 45 displayed columns at `ManageEmployees.jsx:1192`; change approval iterates the long `allFields` array at `ApproveEmployeeChanges.jsx:86,175`. | Show task-specific defaults, selected identity, optional columns and an explicit detail view. Do not delete fields or narrow export inventories. Changes should be reviewed as field / previous / proposed rows rather than requiring horizontal comparison of every field. | P1 |
| Mutations and exports often use generic browser alerts | Examples: `ProcessWages.jsx:249–255`, `PrintWages.jsx:333–345`, `AssignRoles.jsx:383–386`, legacy upload components. Some messages refer to the wrong workflow. | Inline persistent result with a status region; field-level validation and error summary; retry only for recoverable errors. Replace generic console instructions with actionable detail. Use a designed confirmation for deletion, approval withdrawal, replacement or permission clearing. | P0 |
| Some visible actions have no handler | `ManageUsers.jsx:371–372` Upload/Export have no `onClick`; `EmpRequest.jsx:189` Delete button has no handler. | Remove these from the primary action set or show an explicitly unavailable explanation until a backed contract is wired. Do not leave a button that silently does nothing. Connecting a supported contract is permitted implementation work; inventing a user-import backend is not a UI requirement. | P0 |
| Dirty-state protection is uneven | Ledger blocks export for new/dirty rows (`LeaveLedgerEntry.jsx:286`) but changing filters clears rows (`:122–125`), Query replaces them (`:166`), and Cancel navigates (`:279–280`). Profile selection/create are protected (`FeatureWorkbench.jsx:95–110`) but arbitrary route departure is not handled there. Master modal closes on backdrop with `setEditing(null)` (`MasterDataManager.jsx:280–285`). | A shared unsaved-change controller must guard record switches, Add, filter application, Query/Refresh, profile switches, Cancel/Close, navigation and browser unload. Offer Keep editing / Discard / Save where supported. Never silently autosave a record or bypass a validation error. | P0 |
| Filter changes can leave stale scope and selection | Many wage/report screens fetch months after billing-cycle change without explicitly clearing an earlier selected month; examples `ProcessWages.jsx:98–105`, `PrintWages.jsx:222–230`. Employee/contractor search does not reset the current page in its handler while page-size changes do. | A parent-filter change clears invalid child selections and invalidates prior results. Valid selections remain when still in the refreshed options. Clamp page indices, clear obsolete selections and label the applied result scope separately from filter drafts. | P0 |
| Legacy upload preprocessing can hide rejected source rows | `UploadEarnings.jsx:40–56`, `UploadDeductions.jsx:39–48`, `UploadArrears.jsx:34–44`, `UploadManualMuster.jsx:34–44`, `UploadManualPunches.jsx:34–42`, `UploadInActiveEmp.jsx:34–39` use `flatMap`/empty arrays for incomplete rows before the API sees them. | Standardize import stages and original row accounting across old and new uploads. All non-empty source rows must appear as valid or invalid; saving must never be described as a full workbook success after silently discarding rows. Preserve existing API atomicity. | P0 |
| Runtime-disabled features look executable | Process Wages renders a normal enabled action and generic retry on error; server `payroll.mjs:283` intentionally returns the BFCL dependency message. Several wage-report exporters have similar generic catches. | Use a prerequisite panel with the selected period/profile and a link to rule intake. A disabled action has a visible reason. Preserve server validation as the authority and show its specific reason if state changes after rendering. Missing rules are not a transient service failure. | P0 |
| Custom overlays lack full dialog semantics in source | `MasterDataManager.jsx:280–376` renders overlay/section elements, close glyph and buttons without dialog role, focus management or Escape behavior. | A shared accessible dialog/drawer with labelled title, focus containment, Escape handling, initial focus and return focus; backdrop cancellation must respect dirty state. Existing Bootstrap modals must use equivalent rules. | P0 |
| Status often relies on color | Attendance uses inline mark/approval colors (`AttendanceGrid.jsx:183–207`); worker diff classes are only warning/light (`ApproveEmployeeChanges.jsx:72–74`). | Show textual statuses and accessible names alongside color. Add visible selected row/cell states, approval state, source provenance and a useful legend. | P0 |

Source line numbers are anchors for the current snapshot and may shift during implementation. A source issue is not a claim that every corresponding runtime failure was reproduced.

## Required page families

### 1. Worker and contractor records — P1

**Routes/files:** `/manageEmployees`, `/manageContractors`, `/registerContractor`; `screens/Employee/ManageEmployees.jsx`, `screens/Contractor/ManageContractors.jsx`, `RegisterContractor.jsx`. Also include `/InActiveEmp` and `/exportEmpMastDump` in the record tools family.

**Proposed interaction:** A compact list with worker code, display name, contractor, department, business unit, active state and an Open action. Keep identity columns visible while the table scrolls. Support search by the currently supported identities, explicit column chooser, row count and filtered XLSX download. Opening a row leads to a distinct detail/edit surface with a title such as “Edit worker · DEMO001”, section navigation and a sticky Save / Cancel bar. Default sections: identity, work assignment, contact/address, bank/statutory identifiers, employment/pay inputs, and system metadata. Contractor sections: organization/contact, registration/licence, applicable charge inputs and system metadata. Long forms may use tabs or an anchored single form; validation must reveal the relevant section automatically.

**Preserve:** Original field inventory, lookup dependencies, input normalization and validation. Contractor/worker codes cannot be confused with names. Audit fields are read-only metadata. Worker approval state remains visible after a save; the UI must not describe every edit as immediately approved. Search, applied filters, page and scroll position should survive opening and closing details. Preserve all matching filtered rows in exports, not just the rendered page (`ManageEmployees.jsx:1185`, `ManageContractors.jsx:455`). Do not export hidden sensitive fields automatically.

**Fix specifically:** Replace `href="#"` row selectors with real buttons/links and prevent a page jump (`ManageEmployees.jsx:1248`, `ManageContractors.jsx:506`). Clearly distinguish new and edit modes. Avoid displaying every personal attribute in the default grid. Normalize labels for users while keeping import column headers documented as contract keys. Replace the ambiguous “No.Records” with “Rows per page” and a separate result count. Empty lists show 0 records and disabled pagination, never “Page 1 of 0”.

**QA:** Search after moving beyond page 1 returns to a valid page and displays matches. Select DEMO001, edit a value, try to switch to DEMO002 and verify the unsaved guard. Validation focuses the first invalid field even if it is in a collapsed section. Cancel returns to the original selected row. Download after search includes every matching row, identifier strings remain strings and no unselected personal fields are added.

### 2. Accounts, assignments and recovery — P1/P2

**Routes/files:** `/manageUsers`, `/AssignRoles`, `/change-password`, `/resetPassword`, `/resetSuccess`, `/register`, `/development/outbox`, `/development/audit`; user screens and `LocalWorkspace.jsx`.

**Proposed interaction:** Accounts list shows user ID, name, role/active metadata available from the contract and contact information, followed by explicit edit and assignment actions. Remove the empty “Password” column (`ManageUsers.jsx:384–414`); it does not provide a useful status because passwords are not returned. Account create requires a password; edit has an optional “Set new password” section with clear unchanged behavior. Put worker/data scopes and menu/activity scopes into named tabs or sections, each with searchable options, assigned counts and a concise permission summary. Available/assigned transfer controls may be retained if keyboard operation and directional labels are clear. Saving an empty scope must be an intentional visible removal.

**Preserve:** Atomic `/api/assignRoles/saveAll`, six assignment dimensions, clearing assignments through empty arrays, parent/menu relationships and server authorization. Keep demo-account recovery constraints. UI visibility never replaces API checks. The public demo login remains clearly local. Recovery tokens stay in the administrator local outbox; no external-delivery success message. Password inputs never appear in an export or audit detail. Outbox has no ordinary bulk export action.

**Fix specifically:** Remove temporary red borders/backgrounds in `AssignRoles.module.css:17–18`. Make every transfer arrow have a name such as “Assign selected departments” rather than relying on its shape. Separate the selected target user from assigned items and warn before switching a user with changes. Consolidate native success alerts into durable feedback. Resolve inert user Upload/Export controls by supported action wiring or explicit unavailable presentation. Fix repeated `controlId="email_id"` and mobile placeholder in `ManageUsers.jsx:461–477` while redesigning labels.

**QA:** Non-admin account cannot enter the admin screens through direct URL; forbidden state gives a return destination. Empty assignments save and reload as empty. Changing the target user with unsaved transfers is guarded. Password edit left blank keeps the password. A successful password change/recovery handles revoked sessions as sign-in. Keyboard selection and transfer require no mouse. No account response or workbook contains password material.

### 3. Attendance calendar and day detail — P1

**Routes/files:** `/manageAttendance`; `ManageAttendance.jsx`, `AttendanceGrid.jsx`, `MusterGrid.jsx`, `DetailedAttendanceGrid.jsx`, `PunchesGrid.jsx`.

**Proposed interaction:** Page title and period toolbar above a single attendance workspace. Default monthly view with explicit full month/year, date navigation, worker search and available scope filters. Freeze worker code/name and date headers. Keep horizontal scrolling inside the grid, with a visible scroll affordance; do not shrink the whole page to fit 31 columns. Use mark text plus approval cue; provide a legend collapsible after first use. A focused worker/date opens contextual detail showing imported punches, manually supplied values, regularisation and approval/source state. Preserve current worker-level drill-down if date-level API selection is not added. No implied paid-hour or overtime calculation from elapsed time.

**Preserve:** Current record selection and detail data across the exact date range. Full date is the identity, not only day-of-month: `AttendanceGrid.jsx:118–119,156–157,466` groups by day number and the redesign must address cross-month ambiguity before supporting arbitrary multi-month grids. This is an interaction/data-mapping prerequisite, not a new attendance policy. Keep regularisation approval distinctions and optional upload permission. A filter refresh must not leave a detail panel showing an unrelated worker or old period.

**QA:** Test 31-day month, February and a range crossing a month boundary with distinct same-numbered days. Clicking or keyboard-activating the worker/date identifies that exact scope. No mark is conveyed solely by green/red background. At 200% zoom the filter controls are usable and the grid is locally scrollable. Pending regularisation must be visibly pending and must not be described as applied.

### 4. Attendance entry, regularisation, department, shifts and manpower — P1

**Routes/files:** `/ManualMuster`, `/regularizePunches`, `/updDeptInMust`, `/manageShGrpAlloc`, `/ManageApprovedManpower`, `/EmpRequest`; corresponding attendance/employee screens. `/regenerateMuster`, `/manualProcessAttendance`, `/ProcessSandwich`, `/SandwichRuleMaster` belong to this workflow family as operational utilities.

**Proposed interaction:** Use one entry-page pattern: applied period/scope, saved records, Add entry and an edit panel. Do not use a cramped blank row as the only route to creating a record. Worker picker returns code/name/contractor consistently and validates before enabling save. Date, shift, supplied mark, work-hours input and overtime-hours input retain their units and provenance. Regularisation actions show Pending / Approved / Withdrawn with reviewer metadata where available. Department batch change has a review stage with before/after department and affected row count. Effective shift and manpower records foreground effective dates. Employee requests are separate from approval decisions, with status and a link to the approval queue.

**Preserve:** Validated worker/date lookup, saved input values, exact local API identities, effective allocation dates, permissions and downstream override rules. Approval affects report application; entering a regularisation alone does not approve it. Manual hours remain supplied inputs. Employee-request approval alone does not create policy-derived paid attendance. No sandwich processing until verified BFCL policy is implemented. No OS/device job is represented as a running connected task.

**Fix specifically:** Manual Muster’s wide 11-column input row and inconsistent “deduction” errors come from reused code (`ManualMuster.jsx:638–714`); replace labels/messages without altering payload keys. Search results in ManualMuster and wage-entry dialogs are clickable `li` elements; use a keyboard-operable result list. Date-specific department errors should remain in the page, replacing “Failed to upload punches. Check the console” (`UpdDeptInMust.jsx:131`). Approval withdrawal and deletion get record-specific confirmation, not an unqualified immediate action. Inert EmpRequest Delete must be explicitly handled as above.

**QA:** Invalid worker keeps Add disabled and explains why. Save failure retains inputs. Approve regularisation refreshes the displayed state and downstream report; withdraw needs explicit confirmation. Department review shows exact dates and workers, cancel writes nothing, server rejection preserves edits. Effective-date sorting and missing/null effective date use an explicit interpretation from the API. A draft sandwich save says “Draft saved” and never “Policy applied”.

### 5. Leave entry, editable ledger, posting and reports — P1

**Routes/files:** `/LeaveEntryTimeKeeper`, `/leave-ledger-entry`, `/leave-payroll-posting`, `/leave-ledger-summary`, `/leave-balance-report`; all five leave screen files.

**Proposed interaction:** Shared period and contractor filters with clear required fields, supported date format and applied-results summary. Separate entry from reporting. Ledger toolbar shows changed-row count, selected manual-row count, Save changes, Delete selected and Export saved results. Rows display reference/source and a read-only explanation for source-owned entries. Keep ledger totals and report totals aligned with active search. Posting page is a preview/review/confirm workflow with the period, contractor, generation time and impact summary visible immediately before posting. In the current sandbox it primarily presents the calculated-output prerequisite.

**Preserve:** `LeaveLedgerEntry.jsx:286–315` blocks export when dirty and exports saved search results across all pages with explicit columns and metadata. Keep query revision protection so a late response cannot replace newer filters (`:156–165`). Preserve source-owned ledger rows and their disabled selection (`:472–479`). Posting export uses a frozen preview snapshot, rejects changed filters and remains a preview (`LeavePayrollPosting.jsx:134–161`). Preserve posting idempotency and scoped replacement as API semantics; the UI must not imply manual rows will be deleted. Missing calculated outputs remain a prerequisite state.

**Fix specifically:** Extend dirty protection from export to filter changes, Query, Cancel and route leave. Distinguish idle “Choose a period and query” from queried-empty “No rows match …”. Disable mutation controls during save, retain errors and selected row count. Keep the draft form wide enough for read-only sources without disabling their legibility. Align date display rules while preserving date-only payloads.

**QA:** Edit then attempt filter switch, Query and navigation; each path respects the unsaved decision. Source-owned row cannot be edited or selected for deletion through UI or API. A saved ledger export includes all searched rows beyond the page. A late query response is ignored. Posting filter change invalidates preview/export/post readiness. Empty or wrong-scope calculated output must not present a successful replacement; local synthetic calculated fixtures can prove this without implementing payroll.

### 6. Wage input, process-month setup, locks and service charges — P1

**Routes/files:** `/ManageFixWages`, `/wageEarnings`, `/wageDeductions`, `/wageArrears`, `/UploadEmpWageComp`, `/ServiceCharges`, `/manageProcessMonth`, `/manageWageProcessLock`; wage screens and legacy upload components.

**Proposed interaction:** A common payroll-input shell identifies billing cycle and period, applied contractor/entity scope and lock status. Earnings/deductions/arrears use one table/editor pattern with semantic component names, numeric value/unit, remarks and clear row-save or batch-save semantics. Fixed wages shows effective date and component columns without interpreting them as a calculated salary. Service charges separates target scope and input values. Process months shows period name, boundaries, billing cycle and active state; locking is a separate scope-specific action with exact entity and contractor shown.

**Preserve:** Current supported fields and numeric meaning. Arrear days remain raw inputs, not derived pay. A 423 lock response preserves edits and identifies the locked month/billing/entity/contractor; do not silently retry or discard. Dates and billing dependencies must match the selected process month. Preserve source-specific upload contracts and atomic errors. Inputs are not gross/net wages or confirmed statutory dues.

**Fix specifically:** Use visible lock indicators before editing when the available contract can resolve the scope; always preserve server enforcement (`server/modules/payroll.mjs:48–54`). A billing-cycle change invalidates a period no longer in its options. Distinguish “Save this row” from “Save all changes”. Delete gets record/component context. Replace generic inherited “deduction” messages across month and locking pages with their actual action.

**QA:** Change billing cycle with an old period selected; no mutation can send the stale combination. A locked adjustment/fixed-rate update retains the typed values and gives the scoped lock reason. Numeric zero is handled according to the API validation rather than discarded by truthiness. Row save does not accidentally commit other edited rows. Effective-date inputs retain date-only identity after reload.

### 7. Payroll calculations and payment/statutory outputs — P0/P2

**Routes/files:** `/processWages`, `/printWages`, `/wageSlip`, `/PrintWageSlips`, `/getBankStatement`, `/getCashStatement`, `/getPFStatement`, `/getESIStatement`, `/PTReport`, `/PTMonthReport`, `/BonusReport`, `/ExportWageComparission`, `/ExportFixWagesDump`; corresponding wage screen and exporter files.

**Proposed interaction:** Put source-backed readiness ahead of the action. Display selected state profile and version, draft/verification status, missing requirements, whether an engine exists, applicable scope and a link to the rule workspace. Inputs-only downloads remain available where supported; calculated reports remain clearly unavailable until real outputs exist. When calculation is eventually implemented, separate Prepare / Calculate / Review / Approve or Lock according to the confirmed contract; do not invent that workflow now.

**Preserve:** API `calculationEnabled:false` and `engineImplemented:false` are independent of whether rule fields contain text (`server/modules/payroll-rules.mjs:87–89`). A complete draft still does not enable calculation. Current `BFCL_RULES_REQUIRED` response and genuine output existence determine availability. Payroll report filters, multi-selection and sheet options remain represented. Never put fabricated zero dues into an empty report and call it processed.

**Fix specifically:** `ProcessWages.jsx:249–255` hides a specific prerequisite behind generic failure/retry. `PrintWages.jsx:333–345` reports printing success for an XLSX operation and labels failure as attendance; normalize output/action language to “Download XLSX”, “Open PDF” or “Print” as appropriate. Actions expose busy state and prevent repeat submission. Empty, blocked, permission-denied and service-error states must look different.

**QA:** With no BFCL rules/engine, first render explains the block and provides the rule-intake destination. Entering every draft field never enables calculation. Server 422 remains visible if invoked through stale UI. No file or success toast appears after blocked request. Existing inputs-only export still works. Each output action’s label matches the actual saved format and scope.

### 8. Attendance and leave reporting/export family — P2

**Routes/files:** `/printDailyAttendance`, `/PrintAttendanceFormat2`, `/printAtndSummary`, `/monthlyAtndSheet`, `/monthlyAtndRegTimes`, `/printApprovedVsPresent`, `/printApprVsPresentPeriod`, `/ExpRegPunchDetToXLS`, plus leave summary/balance reports. Includes print/XLS exporters under `src/components`.

**Proposed interaction:** Standard report layout: title/purpose, date or month scope, advanced filters, output options, View/Preview and distinct Download/Print actions. State exactly whether “All” means every permitted option or every visible filtered option. Show applied filter summary and record count before download. Preserve each supported grouping/sheet/format switch. A reusable report job/feedback pattern is appropriate; a full common report engine is not required.

**Preserve:** Assigned data scope, full filter payloads, optional single-/multi-sheet export, per-contractor breaks and original report inventory. UI format change must not drop columns or change attendance interpretation. No browser-generated print should include navigation or hidden personal fields. Inputs/filters/results must use coherent date-only handling across month boundaries.

**QA:** Compare filter payload and output scope before and after migration for a representative daily, monthly, approved-vs-present and leave report. “Select all filtered” has a visible count and does not silently select unseen out-of-scope values. Search does not change export scope without the summary changing. Browser pop-up blocked case shows a useful path to retry. Preview, download and print errors identify the report by name.

### 9. State profiles and six compliance working-data forms — P1/P2

**Routes/files:** `/development/features`, all `/compliance/:form` slugs; `FeatureWorkbench.jsx`, `ComplianceReports.jsx`. Forms XII, XIII, XIX, XVI, XVIII and XXIII remain separately discoverable.

**Proposed interaction:** Split broad feature inventory from the focused profile editor within the same workspace or subnavigation. The profile editor foregrounds state, saved version, effective period, verification state, source reference and dirty state. Use section navigation for central, state and BFCL rules, with missing-field counts and links to each input. History should show human-readable changed fields where possible while retaining raw text detail. Compliance pages share a report shell with a durable “Working data · BFCL format required” designation, selected column controls and an applied scope summary.

**Preserve:** Blank rule creation and independent profiles; do not clone assumed statutory rates. Saving text is not legal verification or code execution. Draft/Source review pending are the only editable verification choices. Preserve `expectedVersion` and do not overwrite conflicting edits. Keep dirty guard on profile switch/create. Six compliance forms retain specific source columns, missing requirements, matching search/selected-column XLSX and print metadata. `ComplianceReports.jsx:45–58` revisions ignore stale responses and filter changes invalidate preview. Print/export must keep the working-data designation visible.

**Fix specifically:** A version conflict needs a review/reload choice that retains the user’s unsaved text until they decide, rather than a generic failed-save alert. Rule paths are developer details; prefer readable labels and contextual source help. Do not place the large feature table ahead of the focused editing task on every visit. Empty wages in Form XIX must say “Calculated payroll output required,” distinct from “No matching contractors.”

**QA:** Create a blank second state; no rates or company rules inherited. Dirty profile cannot change silently. Concurrent version save returns conflict and retains unsaved text. Saving updates version and history without enabling payroll. For every compliance form, change month/contractor during a pending request and confirm old data cannot appear. Search and selected fields match the downloaded workbook and printed preview, including the working-data notice.

### 10. Local imports, jobs, approvals, accounting, audit and outbox — P1/P2

**Routes/files:** `/development/import/employees`, `/development/import/contractors`, `/development/import/punches`, `/development/jobs`, `/development/approvals`, `/development/accounting`, `/development/audit`, `/development/outbox`; `LocalWorkspace.jsx` and `ManualProcessAttendance.jsx`.

**Proposed interaction:** A small set of task-specific views replaces the raw generic object-key table while sharing a table primitive. Imports use Template → Select file → Review rows/errors → Validate → Confirm scope/mode → Save → Result. Display filename, worksheet, original/valid/invalid counts, CREATE/UPSERT meaning and whether validation is server-complete. Jobs show status, input scope, counts and run time; detail explains exactly what was processed. Approvals show pending queue, a record summary and review decision. Accounting labels values as recorded inputs. Audit expands a row for detail. Outbox emphasizes local token lifecycle without making external-message claims.

**Preserve:** Existing 5 MB/2,000-row limits and supported XLS/XLSX/CSV types, full timestamp and Excel date-system handling (`utils/importWorkbook.js`), explicit CREATE versus UPSERT, changed-file/mode invalidation, atomic commits and no silent row drops. Worker/contractor dry run is server validation; punch preview is currently preparatory and server validation occurs on Save (`LocalWorkspace.jsx:55–62`). Do not describe these two states as equivalent. The current table shows only the first 200 (`:18`) but export covers all rows; the redesign must expose total scope and allow reviewing every source row/errors through pagination or virtualization.

**Fix specifically:** Structured row-error list with row number/field/reason replaces one long concatenated paragraph. Keep selected file and preview after validation failure so the user can diagnose it. Disable validation/commit while pending; guard leaving an unsaved import. Pending approvals prevent repeated decisions while the request runs and use explicit final-state labels. Tool-specific column schemas should replace raw JSON in the main list. Recoverable read failures keep prior rows labelled stale rather than appearing as fresh current results.

**QA:** Invalid row near the end of a 2,000-row workbook is visible and blocks the whole commit. Changing mode/file invalidates earlier validation. No incomplete row disappears. Punch preview does not say server-validated until it actually is. Cancelling before Save writes nothing. Commit failure retains source preview. Approve double-click sends one decision; final state reloads. Input-summary totals are labelled as inputs and never net wages. Outbox has no ordinary download-all action and never says delivered.

### 11. Master/reference data and shifts — P2

**Routes/files:** `/masters/business-units`, `/masters/cities`, `/masters/divisions`, `/masters/holidays`, `/masters/locations`, `/masters/cost-centres`, `/masters/shifts`; `MasterDataManager.jsx`, `config/masterDefinitions.js`, `ShiftSetup.jsx`.

**Proposed interaction:** Keep the useful configuration-driven table/editor pattern, migrated to shared page header, search, empty/loading states, dialog, fields and confirmation. Group shift timings and groups with clear subnavigation. Preserve immutable composite key fields in edit mode. Related field labels and effective dates must remain explicit.

**Preserve:** All configured field/column definitions, lookup filtering and key identity. A failure to load reference options cannot be silently treated as an empty valid list. Deletion dependencies returned by the API must be visible. Calendar holidays are configured inputs, not an assertion that the state’s legal holiday requirements have been verified.

**QA:** Open/edit composite-key row, keys stay fixed. Lookup failure shows an error and appropriate unavailable selection state. Modal keyboard cycle, Escape, close, backdrop and route departure respect dirty state. Delete dependency error keeps the selected record context. Empty grid has Add and Refresh actions without invalid pagination.

## Shared state and interaction contract

Implement these once, then reuse them across the families:

1. **Page state:** idle, loading, loaded-empty, loaded-data, stale-data-after-error, error, forbidden and rules/integration-required. A spinner alone cannot replace a specific prerequisite.
2. **Filter state:** distinguish edited filters from the applied query snapshot. Apply/Query validates dependencies, invalidates incompatible results and selections, and ignores superseded responses. Search within results is separate and visibly changes result/export counts. The same option should never ambiguously mean both “all permitted” and “all filtered”.
3. **Selection state:** explicit identity and count; selection persists across pages only when advertised; applying incompatible scope clears it. Bulk actions describe whether they affect current page, selected rows or all filtered rows. Do not carry a prior employee into a new contractor scope.
4. **Edit state:** clean → dirty → saving → saved/error; one tracked saved baseline. Save failures retain edits. Discard is intentional. Dialog, row, filter and route changes share the guard. Do not implement generic autosave across approval-sensitive records.
5. **Mutation feedback:** prevent duplicate requests, label pending action, keep record/scope context on errors, refresh only after success, announce the result once and return focus to the affected row/control.
6. **Download state:** require a valid applied snapshot; make rows/pages/search/columns/format explicit; no false success after a blocked/empty/error response; preserve identifier strings, safe literal cells, dates/numbers and local-data metadata. Hidden columns and unfiltered source arrays do not accidentally replace the user-approved scope.
7. **Import state:** maintain original row count and row identity; do not transform invalid source rows into absence. Reset validity after any file/mode/mapping change. Distinguish local parsing, server dry run and server commit. Display the server’s atomic outcome precisely.
8. **Approval state:** pending/current decision and who/when if available; decision actions become busy/disabled during request and disappear or change after confirmation. Withdrawal/replacement is separate from initial approval. Do not add rejection reasons or bulk endpoints as if already supported.
9. **Compliance state:** local synthetic, unverified draft, source-review pending, BFCL rules required, engine unavailable, working format required and external integration required have distinct words and icon/color combinations. A green locally-available badge must not imply approved legal output.

## Acceptance coverage required before calling the whole UI fixed

At least one representative workflow from every page family must pass the scenarios above, and every route must pass a render/navigation/state review. Family coverage cannot be inferred from one attractive screen. Use temporary synthetic fixtures for mutations and preserve user drafts in the workspace.

The main redesign plan should provide the final token/spacing palette, viewport matrix and component implementation phases. These workflow-specific gates are mandatory:

| Gate | Evidence required |
| --- | --- |
| Inventory completeness | All route entries in `App.jsx` mapped to one family/component and an implementation/QA row, including unknown/unavailable and authentication states. |
| Safe navigation | Dirty edits across record, profile, import, dialog and route changes retain or discard data only after the chosen decision. |
| Keyboard/accessibility | Every primary task is operable without a mouse; controls have names; no clickable `tr`/`li` is the only interaction; dialogs contain/restore focus; errors and status are announced; color-only states removed. |
| Responsive behavior | Forms/toolbars fit narrow and zoomed viewports; essential actions remain available; wide data grids scroll locally with identity/context preserved; no global horizontal page overflow. |
| Correct filters and selection | Dependent filters reset safely, search/page indices stay valid, selection scope is explicit, stale async responses ignored. |
| Data/output fidelity | Before/after payloads and exported sample workbooks preserve supported fields, dates, strings, scope and metadata; print excludes navigation and keeps local/working-data designation. |
| Error and blocked states | 401/403, 409 version conflict, 422 rules prerequisite, 423 wage lock, empty results, validation/import failure, network error and unavailable integration each have a suitable action and accurate text. |
| Business boundary preservation | Filling profile draft fields alone cannot enable payroll; no invented paid attendance/OT or external-delivery success; working statutory previews remain labelled. |
| Regression | Existing meaningful API/export/isolation tests still pass, new interaction checks cover the changes, build succeeds and browser QA distinguishes observed from contract-tested behavior. |

This audit recommends interaction corrections and visual restructuring only. Calculation engines, certified layouts and connected production/device/message integrations remain separate requirements with their original evidence gates.

