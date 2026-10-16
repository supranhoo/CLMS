# CLMS whole-app UI redesign plan

**Direction:** Modern BFCL workspace, selected by the user on 16 October 2026.  
**Scope:** The isolated development replica in `D:\CLMS\replica`.  
**Status:** Implementation plan and visual proposal. The application has not been redesigned by this planning task.

## Read this first

The redesign should make CLMS a coherent operational workspace: persistent navigation, readable information, focused record lists, structured forms and predictable report flows. Retain the BFCL identity, existing business fields, permissions and working API contracts. Migrate the entire interface through shared patterns; changing the dashboard alone does not satisfy this plan.

Start with the shared CSS and shell, prove the design on four different screen types, then migrate every route. Payroll calculation and statutory-rule implementation remain separate dependencies. Their screens can be fully redesigned now with accurate blocked, draft and working-data states.

| Artifact | Use |
| --- | --- |
| [Visual proposal](design-preview.html) | Interactive layout concepts: dashboard, workers, worker edit, attendance and reports. Illustrative data; no API calls or writes. |
| [Route inventory](route-inventory.csv) | All 73 React route declarations, component files, menu mapping, migration wave and special requirements. |
| [Route audit](route-audit.md) | Counts, dynamic variants, alternate paths and navigation gaps. |
| [Style/component audit](style-and-component-audit.md) | Source findings, exact file references, component contracts and CSS containment work. |
| [Workflow requirements](workflow-requirements.md) | Field/workflow preservation and family-specific interaction requirements. |
| [Acceptance checklist](acceptance-checklist.md) | Implementation release gates and test scenarios; currently a planned checklist. |
| [Browser evidence](browser-audit.md) | Current-state observations, screenshots and limits of this audit. |

The delivery waves in this plan are authoritative. Lower priority tags and alternative stage groupings in supporting audits indicate sequence, not permission to omit existing screens from the whole-app migration.

## 1. Problem and evidence

HR, attendance and payroll operators currently encounter different layouts for similar tasks. A worker list exposes 46 columns and shares a page with a long form; role assignment uses repeated dual lists; reports and wage grids each arrange filters/actions differently. This increases scanning and navigation effort. Task timing and user-error rates have not been measured; improvements below are proposed targets, not demonstrated outcomes.

The main causes are structural:

| ID | Finding | Evidence | Design response |
| --- | --- | --- | --- |
| F01 | A global `button.btn` rule forces 10px text across screens | `src/components/AttendanceGrid.css:129–138`; small actions visible in current browser screenshots | Contain legacy styles before applying shared type/control tokens. |
| F02 | Bare table selectors leak out of CSS modules | `MasterDataManager.module.css:2`; `RegularizePunchGrid.module.css:112–117` and related grid modules | Scope all screen rules under local roots; one explicit shared table system. |
| F03 | Global compliance print hiding can affect other reports | `ComplianceReports.module.css:16–21`; eagerly imported by App | Isolate a report print root. Reproduce and verify print behavior during implementation; a blank unrelated printout is not yet browser-confirmed. |
| F04 | Nested fixed-width containers reduce workspace width | `App.jsx`, `Header.jsx`, `MainScreen.jsx` | One application shell; full-width data pages and constrained form pages. |
| F05 | Dashboard is an unranked catalog; header search has no behavior | `Dashboard.jsx:58–91`; `Header.jsx:149–156`; current dashboard screenshot | Permission-aware sidebar, working screen search and a task-oriented home page. |
| F06 | Worker default table is too broad for routine work | `ManageEmployees.jsx:1195–1240`; 46 headers observed in browser | Focused default columns, complete detail sections and explicit column/export choices. |
| F07 | Labels, dialogs and feedback are inconsistent | Duplicate IDs in Users/Contractors; custom master overlays; native alerts across source | Accessible shared fields/dialogs and consistent field, page and status feedback. |
| F08 | Some visible controls do not have handlers; some uploads silently discard incomplete rows | Workflow source audit | Inventory each action; wire to a supported contract or show an accurate unavailable state. Preview all imported rows and report errors. |
| F09 | Some navigation flows have invalid destinations | Leave Ledger's `MENU_URL='/menu'` reaches wildcard; route audit | Canonical route metadata and an explicit safe return destination. |

Current source inventory: **73 route declarations** (68 static, four parameter patterns and one fallback), **66 unique routed screen files**, eight menu groups, 72 child menu entries and 70 unique menu destinations. All seeded menu destinations resolve to explicit routes. Casing such as `/Dashboard` versus `/dashboard` is compatible with the current case-insensitive router; do not report it as a missing route.

Source scan also identifies 47 CSS files, 21 of them CSS modules, 210 literal inline-style occurrences and 124 `!important` occurrences. These are migration indicators, not independently proven defects. Nine CSS files are recovery stubs; replace them through the design system rather than treating them as an approved reference.

## 2. Goals, boundaries and design users

### Required outcomes

1. Every declared route and meaningful dynamic variant uses the shared shell or a documented public/special-state shell, consistent typography, responsive layout and a reviewed action model.
2. Operators can reach a permitted destination through module navigation or screen search without returning to the full dashboard catalog. Search never exposes unassigned destinations.
3. Lists, forms, filters, grids, imports, reports and approvals follow documented shared interaction patterns while retaining all existing data fields and backend safeguards.
4. Keyboard operation, labeling, focus, contrast, responsive reflow and announced status changes meet the acceptance checklist. WCAG 2.2 AA is the implementation target, not a current certification.
5. No redesign change loses edits, silently drops import rows, expands data scope, changes export meaning or converts an unavailable calculation into apparent success.

### Boundaries

- Work only in the replica. Retain loopback servers, the local API client and synthetic-data disclosure.
- Keep React, React Router, React Bootstrap, react-select and the existing export helpers. Do not introduce a second UI framework or rewrite the backend for appearance.
- Preserve existing URLs or deliberate compatibility aliases. Keep menu IDs and API field/value mappings; improve display labels without renaming payload fields casually.
- Preserve BFCL branding. The proposed navy/blue palette is a design direction, not a claim that a formal BFCL brand manual was supplied.
- Production deployment, live devices, external message delivery, new legal interpretations, payroll formulas and certified statutory layouts are separate work. Their existing screens/states remain part of this UI migration.
- No existing field is removed from the product merely because it is absent from the default list. Field relocation must be recorded in a parity checklist.

Design personas are working assumptions from the app's tasks: an HR/master-data administrator; an attendance/timekeeping operator; and a payroll/compliance reviewer. These are task perspectives, not claims about the actual production permission model or completed user research.

User stories driving the design:

- As an attendance operator, I can retain worker/date context while reviewing a month, so scrolling does not make a mark ambiguous.
- As an HR administrator, I can find a worker and edit a clearly labeled section, so I do not scan every demographic and audit field for routine changes.
- As a reviewer, I can compare changed values and understand approval status before taking action.
- As a payroll operator, I can see the selected period, contractor, lock and rule readiness before entering inputs or starting a process.
- As any permitted user, I can distinguish an empty query, a failed request, unsaved work and an unavailable calculation, so I know the next valid action.

## 3. Information architecture and application shell

### Desktop and tablet shell

Use a 232–248px left navigation rail, a 64px top bar and one content area. Use Dashboard as the home destination plus eight recognizable module groups: Configuration; Masters; Attendance; Wages; Accounting; Approvals; Compliance Reports; Leave. Group names may be shortened in navigation; full original labels remain searchable aliases.

The top bar contains breadcrumbs/current module, **Search screens**, and one user menu containing Change password and Sign out. Put BFCL branding at the top of the rail. Current route and its parent are explicit. Use links for destinations and buttons for expansion/actions. Duplicate access to employee approvals and regularisation is intentional: keep both contextual links, with one canonical destination.

Screen search indexes only the current permission-filtered menu plus allowed account/home destinations. It searches screen names, approved aliases and module names. It does not imply employee-data search. Show keyboard navigation, no-results feedback and the full module path for ambiguous labels. Do not make a new global shortcut mandatory to operate it.

Keep a compact persistent environment strip: **Local development · Synthetic data**. Provide a normal link to Feature status. Do not dismiss the disclosure permanently, or place it above dialogs where it blocks focus. Business warnings belong near the affected action; avoid repeating full warning paragraphs in every header.

At narrow tablet widths the rail collapses to an accessible drawer. On phones use a compact top bar with Menu and page title, then the environment strip and content. Drawer focus is trapped and returned; Escape closes it. Search is available from the menu. Main content retains useful width.

### Page anatomy

Every operational page has:

1. Breadcrumb and one `h1` with a short task description when needed.
2. Page actions, with one clear primary action per task state.
3. Context/filter area and an applied-filter summary.
4. Query feedback, results/form content and persistent scope/status when relevant.
5. Pagination or form actions at a predictable location.

Use full shell width for data matrices and reports. Center ordinary forms within roughly 1040px; do not center a 46-column data workspace inside multiple fixed containers. Use 24px desktop gutters, 16px on small screens. Avoid nested cards around every field.

### Dashboard

Replace the full tile wall with permitted quick tasks, recent destinations, module groups and truthful local status. Offer an expandable **All screens** view so discoverability is preserved. Recent/favorite destination preferences are browser-local, scoped to the user and contain route IDs only. If that small preference feature is deferred, a useful static task list must still replace the tile wall; it does not justify delaying the complete navigation system.

Counts may be shown only when derived from actual accessible records/API responses, labeled with their scope and refresh time. No invented attendance percentages, payroll totals, statutory readiness score or production KPIs. A query failure is not zero.

## 4. Visual system

Define tokens in one global file and theme the existing components. The visual proposal demonstrates the direction; the implementation must validate actual rendered combinations.

| Category | Initial specification |
| --- | --- |
| Brand | Navy `#17365D`; primary action blue `#1D4ED8`; hover `#1E40AF`; existing BFCL logo on a neutral surface |
| Surfaces | Canvas `#F5F7FB`, panel white, subtle surface `#F8FAFC`; thin borders and restrained shadows |
| Text | Main `#172B4D`, regular `#334155`, secondary `#526477`; do not lower opacity on essential values |
| Status | Separate text/icon/color treatments for Active, Inactive, Pending, Approved, Rejected, Draft, Locked, Needs rules and Local only |
| Typography | Local Segoe UI/system sans; body 16px; labels/table text 14px; helper text 13px; page title 24–28px; section title 18px; explicit compact tables 13px |
| Spacing | 4/8/12/16/20/24/32/40px scale; consistent section and control gaps |
| Controls | 40px default height; 36px compact desktop controls; aim for 44px touch controls; visible focus and busy states |
| Shape | 6–8px controls; 10–12px panels/dialogs; no decorative pill treatment on all values |
| Data | Left-align text; right-align numbers; tabular numerals; consistent date, time and amount formatting |
| Motion | 120–180ms opacity/color changes, reduced-motion support; no scale-on-hover for data rows or action targets |

Use `DD MMM YYYY` for human date display where space permits and ISO dates at the API boundary. Display month labels clearly, keep genuine date-times distinguishable from date-only values, and never introduce a timezone conversion that shifts a punch day. Preserve leading zeros in identifiers. Use currency symbols only when the underlying field is an amount in that currency; distinguish recorded inputs from calculated pay.

## 5. Shared component and interaction contracts

| Pattern | Required behavior |
| --- | --- |
| AppShell / PublicShell | One main landmark, skip link, route title, navigation state; public sign-in/recovery do not inherit irrelevant operational actions |
| PageHeader | Heading, context, primary/secondary actions; wraps without overlapping at 320px content width |
| Field / SelectField | Visible label, unique ID, required/hint/error links, correct input type, read-only vs disabled distinction; react-select input IDs and sensible menu portals |
| FilterBar | Responsive grid; Apply and Clear; selected/applied snapshot; dates and required filters validated before query |
| DataToolbar | Search, result count, optional filters, column choice, import/export and page actions outside the data table |
| DataTable / Pagination | Semantic headers, stable row IDs, contained scrolling, clear selection scope, loading/empty/error states; first/previous/next/last accessible labels and x–y of z |
| FormSection / FormActions | Section navigation for long forms; field error summary; sticky actions on long forms without covering content; dirty/saving/saved/error/locked states |
| Dialog / Confirm | Named accessible modal, safe initial focus, focus trap/return, Escape policy, no loss of dirty data; row/action-specific confirmation |
| Feedback | Field errors + focused summary; announced nonblocking success; retryable page failures; actionable rules-required and permission states |
| ReportFrame | Applied filter/column snapshot, row count, generated time, source/working-data notice, preview/export/print controls |
| ImportWizard | Template → select/map/preview → validate all rows → inspect errors → commit → summary; no silent drops or partial success |
| AttendanceMatrix | Pinned worker identity and dates, text legend, local two-dimensional scroll, keyboard-reachable detail/actions, edit/approved/source indicators |
| ProcessPanel | Inputs, readiness/lock checks, explicit start/retry, busy result and job history where supported; no pretend progress percentages |

Do not create an abstraction for every HTML tag. Extract repeated visual/interaction responsibility; keep domain rules and API calls in feature hooks/screens. Use small adapters where backend casing/aliases differ, with tests preserving the wire contract.

Every action must have one of three explicit states: supported and operable, temporarily unavailable with its prerequisite, or absent from that user's permissions. Decorative action controls and generic retry prompts for permanent rule dependencies are unacceptable.

## 6. Complete screen-family redesign

The CSV assigns every route to a wave. This section defines the target experience for the complete family, including routes not exposed as ordinary menu items.

### 6.1 Entry, account and special states — W1/W6

- Landing/login: branded two-panel desktop layout and one-column mobile layout, one clear demo sign-in, visible local-data context, labeled credentials, password visibility toggle, inline failure and submission progress.
- Registration and password/recovery screens: consistent account form shell, correct field semantics, honest local-outbox recovery explanation. Preserve demo-account restrictions and separate create/change/reset semantics. Mask passwords; never render password values in record tables.
- Signed-out, session-expired, forbidden, unknown destination, unavailable feature and licence-lock states: task-specific explanation, safe next destination and appropriate focus. Retain actual server/license enforcement. Do not fabricate an error page that conceals the underlying reason.
- Header/footer: fix `Copyright & copy;` text; keep a compact BFCL footer. Use semantic navigation links, remove duplicate account controls and raw/debug copy from user-facing screens.

### 6.2 Workers, contractors and masters — W2

- Worker list defaults: code, display name, contractor, department, joining date, status and actions. All 46 existing list fields remain available through details/column choice and complete record exports. Export selection must explicitly identify visible columns versus the full permitted field set; never silently change the old export contract.
- Open an explicit record detail/edit workspace instead of showing a large blank form beneath the list. Preserve the selected list search/page on return. Group all existing fields into Identity; Employment & allocation; Contact & addresses; Statutory identifiers; Wage/payment setup; Other recorded attributes; and read-only Audit metadata. Long-form sections can use accessible tabs/anchors with invalid-section indicators. All form fields remain reachable and labeled.
- Required markers reflect actual validation, including conditional requirements. Changing a display label such as “Aadhaar” does not change its payload key. Do not mark an imported unknown value as confirmed by selecting a convenient default.
- Contractor list/edit uses the same list/form pattern; separate identity/billing, contacts/addresses, licence validity and configured charges. Keep registration and maintenance entry routes consistent; consolidate their shared fields, preserve both route destinations.
- Master-data screens use one reusable list, search, short edit dialog and explicit delete confirmation. Retain each master's key semantics, shift group/time tabs, effective dates and code/name formats.
- Shift group allocation at `/manageShGrpAlloc` migrates in W2 with worker setup. Its effective-date effect on attendance is verified again during W3; that downstream check does not move route ownership out of W2.
- Employee changes: keep the original and proposed values side by side for the selected record with only changed fields initially shown, an option for all fields, source metadata and approval/rejection feedback. Preserve every compared field; replace the 80-column default comparison, not the approval contract.

### 6.3 Local users and assignment — W2

- User list: user ID/name, email, active status/role where returned, last modified and actions. No Password column. IDs support current alphanumeric accounts; avoid numeric-only coercion. Use separate explicit create/edit states and read-only audit details.
- Replace repeated large dual-list panels with six clearly labeled scope sections: BU, Contractor, Department, Location, Menu and Activity. Show selected counts, searchable options, hierarchy for menus, explicit empty scope and a summary before atomic Save.
- “Copy assignments” requires a known source user and a review of the resulting selections. It must not silently save or expand permission. Preserve existing authorization and empty-assignment behavior. No permission change occurs as part of this planning task.
- Audit/outbox: readable event/token state, useful filtering and safe empty/error states. Keep local-only delivery context and expired/used status. Existing tokens are not added to generic exports or search results.

### 6.4 Attendance operations — W3

- Calendar/muster: worker identity remains pinned; month/day headers stay visible; distinguish source, approved regularisation and manual edits. Legend includes text/code, not color alone. Day cells open a labeled detail/edit panel; on narrow screens provide a worker/day or week view while keeping the complete monthly matrix available in a named scroll region.
- Use the complete calendar date as the column/cell identity. The source currently groups some data by day-of-month; a range crossing two months must not merge both occurrences of the same day number. Show month grouping or constrain the documented view to one month with validation.
- Manual muster, regularisation and department edits: consistent filter bar, selection and row controls. Name inputs by worker/date. Keep save/approve/withdraw separate and show pending/approved state. Preserve atomic department batches and effective allocations.
- Manpower: effective-date table with readable counts and scopes; separate list/edit flows and validation. Verify that the W2 shift-allocation screen still applies the correct effective dates in attendance. Attendance comparison reports explain selected period/contractor and recorded counts.
- Requests: pending/reviewed grouping, worker/request detail and clear review actions. A review does not imply paid leave/OD/WFH credit unless existing rules support it.
- Processing: local punch import and summarization are distinct steps. Show recorded first/last times and supported job history. Biometric/OS integrations and sandwich application display exact prerequisites. Rename ambiguous actions such as “Print SL/PR” using verified terminology, with the original abbreviation retained as helper text until its business meaning is confirmed.

### 6.5 Leave — W3/W5

- Leave entry: clear worker, leave type, date range and stated total; balance context only from supported data. Preserve existing transactions and source ownership.
- Ledger: applied period/contractor/type filters, readable transaction labels, right-aligned days, explicit selection and row editing, one predictable action bar. Preserve unsaved-edit/export protection and manual-only edit/delete restrictions. Replace the `/menu` close destination with a known canonical return route.
- Payroll posting: Preview → inspect matching calculated movements → Post, with a clear locked/missing-output state and no claim that export posts leave. Source/run/rule version context remains available. Do not introduce a calculated-output fixture into the user's workspace to make the screen appear ready.
- Summary/balance: shared report layout, stated period/type/contractor, empty vs no-query distinction, accurate filter metadata and export scope.

### 6.6 Wage inputs, process controls and rules — W4

- Earnings/deductions/arrears share one editable-table pattern with component, worker, amount, remarks, raw days where applicable, row feedback and locked-state treatment. Correct label/amount/time semantics, preserve zero vs blank and all optional fields.
- Fixed wages: effective-date list/detail with grouped components and explicit PF/ESI/LWF flags as configured inputs. A field value does not imply legal applicability or a verified payroll result.
- Process months, wage locks and service charges: consistent master/list/edit patterns; display exact billing cycle, entity/contractor scope, dates and lock state before actions.
- Process payroll and output routes: show readiness and missing prerequisites before an enabled Start action. A rules-required 422 is an actionable blocked panel linking to rule intake, not “try again later.” Redesign every blocked report page as deliberately as the available pages.
- State profiles: dedicated overview with active state, version, source, effective period and DRAFT status; Central/State/BFCL sections with requirement search/progress based on entered fields, not a legal compliance score. Preserve expected-version conflicts, saved history and dirty-state profile-switch guard. Feature coverage becomes a separate tab/section so it does not bury the rule editor.

### 6.7 Reports, exports and compliance — W5

- Apply one report flow to attendance, worker/fixed-wage dumps, approved-vs-present, wage register/slips, bank/cash/PF/ESI/PT/bonus/comparison, leave summaries and the six compliance form variants.
- Filters first; then selected scope and explicit Preview/Generate. Never show “No results” before a query. Distinguish loading, zero records, failure, missing rules and unavailable format.
- Results include stable column choices, numeric alignment and source/generation metadata. Changing filters or profile while results are displayed marks them stale or clears them safely; export can use only a visibly identified snapshot.
- The six compliance variants preserve their names and working-data notice. Attendance forms require an explicit month. Wage-dependent forms remain empty/blocked accurately. Print action must isolate the report, retain metadata and repeated headings, and not hide unrelated print routes.
- Export review reopens actual downloads to check rows, selected columns, text identifiers, date/time values and filter provenance. Support field/data completeness even where display defaults are compact.

### 6.8 Imports, jobs and local workspaces — W5

- Standardize employee, contractor, local punches, **Manual Muster mark/work-hours/OT**, wage-component/adjustment and inactivation imports without silently dropping incomplete rows. Preserve existing accepted schemas through adapters/templates; expose all validation errors before commit.
- Stepper names the row count and action intent (Create or explicit Update). Commit disabled until validation applies to the current file, mode and mapping. Changing any of them invalidates readiness. Prevent duplicate submission; show inserted/rejected results honestly.
- Offer paged or otherwise complete review of every imported row. The current local workspace only renders the first 200 rows; retain the total and make remaining rows reachable instead of suggesting that the first page is the complete workbook.
- Job history: status, start/end or available timestamps, changed/input counts, supported details and empty/error states. No fabricated real-device connectivity or continuous progress.
- Accounting: recorded earnings/deductions/arrears amounts with period/contractor scope and the explicit “recorded inputs” label; no gross/net/statutory inference.
- Invalid dynamic tool/import/form parameters use the appropriate unknown-feature screen and safe return link, not an empty generic table.

## 7. Responsive, accessible and state-complete behavior

Test representative viewports at 1440×900, 1280×800, 1024×768, 768×1024 and 390×844, plus 320 CSS-pixel content reflow and browser zoom. The browser's effective content width may be slightly narrower than the requested viewport because of scrollbars. The current narrow-screen audit used a 390px override with 375px observed content width.

- Desktop: persistent rail, expanded filter rows and dense tables. Tablet: collapsible rail, two-column filters/forms where readable. Phone: drawer, single-column forms/filters, wrapping actions and priority list fields; all remaining data accessible in details/contained grids.
- Page-level two-dimensional scrolling is not the solution to long forms. Data matrices may have a contained horizontal region; individual cell contents must remain usable. W3C documents a reflow exception for inherently two-dimensional data tables, not the whole page. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Normal text contrast at least 4.5:1 and qualifying large text at least 3:1. Verify statuses, focus states and secondary text in the actual theme. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Pointer targets meet the WCAG 2.2 AA minimum of 24×24 CSS pixels or a documented exception; this design aims for larger 40–44px controls where practical. [W3C target guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Keyboard focus is visible and not hidden by author-created sticky elements; dialogs/drawers manage focus and restore it. [W3C focus guidance](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- One h1/main, logical landmarks/headings, explicit labels, named row controls, semantic table headers/captions, visible error summary, `aria-describedby` and appropriate status announcements. Test with keyboard and a screen reader; automated checks alone do not establish conformance.

Every page family must cover: initial/unqueried; loading; data; empty; failed request/retry; invalid input; saving; success; permission/read-only; unsaved changes; locked period; missing rule/source; stale preview; and session expiry where applicable. The checklist records applicability rather than forcing meaningless states onto every page.

## 8. Implementation architecture and migration method

Proposed locations, to create during implementation:

```text
src/styles/                 tokens, base, vendor adapters, print roots
src/navigation/             canonical route metadata and permitted menu adapters
src/components/layout/      AppShell, PublicShell, navigation, PageHeader, width variants
src/components/forms/       fields, sections, filter bar, action bar
src/components/data/        toolbar, table, pagination, column chooser
src/components/feedback/    loading, empty, error, status and blocked panels
src/components/dialogs/     edit and confirmation dialogs
src/components/reports/     report frame, scope summary, export/print actions
src/components/attendance/  domain-specific calendar/matrix and legend
src/screens/                migrated screens and small contract-preserving adapters
```

1. Record baseline route/field/action inventories, screenshots and API/export behavior. Create a dedicated version-control snapshot/working branch if a repository is available; this folder is not assumed to have an existing Git history.
2. Contain unscoped styles before introducing new ones. CSS Modules do not scope bare element selectors. Avoid another large global override sheet or a blanket `!important` reset.
3. Keep vendor/base/token loading predictable. New components use scoped classes. Fix existing imports incrementally; deleting a shared stylesheet requires an import/reference search and visual checks of all consumers.
4. Prove four reference screens: a master list/dialog, worker record form, attendance matrix and report. These exercise layout, density, editing, scrolling and output. Record what is shared and what is a justified exception.
5. Migrate by the route waves below. Keep existing routes working while internals change. Do not run two competing full app shells on a page.
6. Preserve values/selection/query snapshots and API contracts through adapters. No raw replacement of business logic with mock-only visual state. Native `alert/confirm` migration must preserve the actual error and successful-save condition.
7. Use route-level loading/code splitting where appropriate only after removing cascade dependencies. Lazy loading must not make visual appearance depend on which screen was opened first. No invented bundle-size target before measuring the new build.
8. Remove unreferenced legacy CSS/components only after all consuming routes pass. Keep a short documented list of intentional print/grid exceptions.

## 9. Delivery waves, work packages and gates

All waves are required for whole-app completion. Priorities order risk and dependencies; P1 does not mean an existing screen may remain in the old design indefinitely. Foundation/reference screens are the first reviewable increment, not the full deliverable.

| Wave | Work packages | Depends on | Required exit evidence | Indicative effort* |
| --- | --- | --- | --- | --- |
| W0 Foundation | U01 baseline/field/action audit; U02 CSS containment/print isolation; U03 tokens and component states | None | Cross-route style tests, reference controls and baseline inventory | 3–4 dev days |
| W1 Shell & entry | U04 route/menu/search adapter; U05 sidebar/topbar/mobile drawer; U06 dashboard; U07 public/account shells | W0 | All destinations reachable, permission-aware search, keyboard/drawer/deep-link checks | 3–5 |
| W2 Records & setup | U08 four reference screens; U09 worker/details/shift allocation/change comparison; U10 contractors; U11 masters/shifts; U12 users/assignments | W0/W1; U08 first | Full field/action parity, accessible dialogs, create/edit/dirty/error/approval checks | 7–10 |
| W3 Attendance & leave | U13 matrix/legend; U14 muster/regularisation/department; U15 manpower/requests/process and W2 allocation integration; U16 leave/ledger/posting | Shared patterns from U08 | Worker/date context, atomic edits, source ownership, approved/locked/dirty states retained | 7–10 |
| W4 Wages & rules | U17 adjustment/fixed-wage patterns; U18 periods/locks/service charges; U19 profile/readiness/blocked process UI | W0/W1; U08 | Input parity and lock tests; source/version/dirty guards; no enabled unavailable calculation | 5–8 |
| W5 Reports & workspaces | U20 report/export/print family; U21 import wizard across schemas; U22 accounting/jobs/audit/outbox | Shared patterns; W3/W4 data/state contracts | Reopened downloads, isolated print, invalid import atomicity, exact scope and working-data notice | 5–8 |
| W6 Whole-app finish | U23 fallback/licence/session states; U24 copy/CSS cleanup; U25 full route/state/viewport/accessibility regression | W1–W5 | Completed route checklist, no high-severity UI defects, build/isolation/contracts/UI checks pass | 4–6 |

*Planning estimate for one experienced frontend implementer with review/QA support, not a delivery commitment. Approximately 34–51 development days before contingency; allow 10–20% for recovered-code coupling and field parity work. Parallelizing independent screen families can shorten calendar time after shared components stabilize. No deadline or team capacity was supplied. Measure the reference-screen work, then revise the estimate without reducing coverage.*

Each U-package produces changed screens/components, screenshots, parity notes and acceptance evidence. Review the reference designs before migrating large groups so disagreements are resolved once. This is a design review checkpoint within implementation, not a requirement to stop all independent work.

## 10. Verification and success measures

### Technical release gates

- Every one of the 73 route declarations has a reviewed outcome. Check the five supported local workspace tools, three import kinds, six compliance forms, supported unavailable-module paths, unknown parameters and wildcard in addition to static routes.
- Existing deep links and deliberate duplicate navigation destinations work. No `navigate('/menu')` dead end or decorative unsupported controls remain.
- Every existing field/action/export mapping has a recorded destination; source-owned and locked data protections are preserved.
- Run the existing contract/isolation suite and `npm.cmd run check`, then `npm.cmd run build`. The repository currently documents a 56-test baseline from the preceding feature work; this planning task does not claim a fresh implementation test run.
- Add meaningful UI behavior tests for navigation/filter snapshots, dirty close, validation/focus, atomic import review and rules/lock states. Add visual comparisons at representative widths, not a test for every CSS declaration. The UI-test runner/tooling choice is an engineering setup task, not assumed installed.
- Cross-route order checks cover screen CSS leakage. Print checks cover one non-compliance report after opening compliance, then a compliance report, and an ordinary page. Reopen actual XLSX exports.
- Every family passes keyboard/dialog/focus and narrow-width review. Run accessibility automation where available and manual screen-reader checks. No assertion of WCAG conformance before full evidence.
- No new remote destination, production config/data, permission expansion, calculated value or unsupported success is introduced by the redesign.

### Usability targets to validate

Before redesign, benchmark five representative tasks on the current app: find/edit a worker section; review a changed worker; inspect a worker/date in attendance; validate a workbook; and preview/export a scoped report. Use the same synthetic dataset and tasks after migration.

Targets: 100% successful completion of the critical scripted tasks without assistance; zero silent data loss or wrong-scope outputs; all permitted screens discoverable in navigation/search; and a proposed 25% reduction in median task time versus the measured baseline. The timing target is a hypothesis to test with BFCL operators, not a promised improvement. Record task time, navigation steps, validation mistakes and operator feedback. If user testing is not available, report that limitation instead of declaring the usability target met.

## 11. Decisions, risks and remaining questions

| Item | Default / action | Owner | Blocking? |
| --- | --- | --- | --- |
| Visual direction | Modern BFCL workspace; existing logo, restrained navy/blue, compact readable operations UI | User decision received | Resolved |
| Brand manual | Use proposal tokens; adjust if official palette/type rules are supplied | BFCL/design | No |
| Primary devices and operators | Desktop-first plus full responsive support; validate device priorities and five task scripts with users | BFCL operations | No for foundation; needed for usability sign-off |
| Field defaults / terminology | Preserve all fields; proposed worker list defaults; confirm ambiguous SL/PR terminology before relabeling | HR/attendance owner | Limited to affected labels/defaults |
| Statutory/BFCL rules | Design accurate blocked/draft UI now; calculation/output verification remains separate | Payroll/compliance owner | Blocks calculation availability, not redesign |
| Framework scope | Reuse current stack; specialist grid only after evidence from attendance prototype | Engineering | Resolved default |
| CSS dependencies | Scope global leaks first; test route order and print before deletion/lazy loading | Engineering/QA | Must pass W0 and W6 |
| Long forms and audit fields | Explicit detail/edit workspace, complete field parity, audit fields read-only | HR/engineering | Must pass W2 |
| External tool integrations | Keep Local only/Not connected accurate; no implied delivery/device status | Engineering | No for UI |
| Rollback | Snapshot before each wave; revert a complete route/component slice if parity fails; do not reset user sample drafts | Engineering | Must establish before edits |

## 12. Definition of done

The UI redesign is complete only when every existing route and dynamic variant has migrated, all named screen families and states are reviewed, field/action/output parity is verified, responsive/accessibility and keyboard checks pass, legacy style leakage is removed or explicitly contained, and the whole-app regression evidence is saved. A polished dashboard, four prototypes or a green build alone does not satisfy this definition.

**This planning deliverable is complete when its route inventory, source/browser evidence, visual direction, complete screen requirements, dependencies, work packages and acceptance checklist are internally consistent and reviewable. Implementation and UI-release acceptance remain future work.**
