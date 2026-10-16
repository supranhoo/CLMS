# CLMS style and component audit

Date: 16 October 2026. Scope: the isolated application in `D:\CLMS\replica`. Planning artifact only; no application, API, state, dependency or production changes were made for this audit.

## Evidence and limits

This audit inspected the current source, not an assumed design system. It covers the app shell, dashboard, representative employee/contractor/user forms, attendance grids, leave ledger, master-data dialogs, state profiles and compliance preview styles. Browser observations and the complete route inventory are maintained by the parent planning task. The issues described as source-confirmed below are visible in code; predicted layout/print consequences still require the specified browser checks.

The existing instruction to preserve recovered screen conventions is superseded for the requested whole-UI redesign. Preserve field values, validation, source boundaries, approval permissions and API contracts while changing presentation. Nothing in this plan enables wage calculations, verifies draft rules, changes data scope or certifies statutory reports.

Source counts from a recursive scan of `src` on this date:

| Measure | Count | Interpretation |
| --- | ---: | --- |
| CSS files | 47 | 26 ordinary stylesheets and 21 CSS modules |
| JSX files | 86 | Components plus screens, not a route count |
| Literal `style={{` occurrences in JSX | 210 | Candidate migration work; not 210 independently proven defects |
| `!important` occurrences in CSS | 124 | Specificity debt; raw text count |
| `@media` occurrences in CSS | 15 | Includes print and duplicate breakpoints; not 15 responsive screens |
| Explicit font sizes of 12px or smaller | 38 | CSS declarations only; excludes rem values and inline styling |
| `alert(` / `confirm(` occurrences in JSX | 76 / 4 | Search indicators for feedback/confirmation standardization |

There are three nonempty groups of exactly identical CSS files: four grid/upload stylesheets (`ManualMusterMark.module.css`, `UploadInActiveEmp.module.css`, `AddWageDeductionsGrid.module.css`, `UploadEmpWageComp.module.css`); three report/export stylesheets (`PrintDailyAttendance.module.css`, `ExportEmpMastDump.module.css`, `ExportFixWagesDump.module.css`); and two processing-rule stylesheets (`RegenerateMuster.module.css`, `SandwichRuleMaster.module.css`). Nine other files are identical one-line recovery stubs, not recovered visual definitions: Contractor.css, its two pagination files, Employee.css, Employee/Paginated2.css, User.css and its two pagination files, RegisterScreen.css. Deduplicate actual styles; do not treat the stubs as a working style foundation.

## Prioritized source findings

### P0: Global rules make a screen-by-screen visual fix unreliable

1. **A screen stylesheet shrinks every Bootstrap button.** `src/components/AttendanceGrid.css:129-138` defines global `button.btn` with `font-size:10px !important`, padding and movement on hover. The attendance screen is eagerly imported through `src/App.jsx`, so this is not confined to the attendance route. Scope/remove this rule before approving component typography. Evidence to collect: computed size of primary buttons on dashboard, state profiles and employee forms before/after the containment change.

2. **CSS modules still leak bare table-element selectors.** `src/screens/MasterData/MasterDataManager.module.css:2` contains bare `table`, `th`, `td`, `tbody tr:nth-child(even)` and `tbody tr:hover`. CSS Modules scopes class names, not these element names. It also sets global variables in `:root` at line 1. `src/screens/AttendanceMuster/RegularizePunchGrid.module.css:112-117` sets bare `td` to nowrap, hidden overflow, 150px maximum width; the same bare rule is present at line 112 in ManualMusterMark, UploadInActiveEmp, AddWageEarningsGrid, AddWageDeductionsGrid and UploadEmpWageComp modules. This can truncate unrelated master and report cells. Wrap element selectors in the owning local root, and centralize global tokens.

3. **Compliance printing can hide content outside that report.** `src/screens/Compliance/ComplianceReports.module.css:16-21` applies `:global(body *) { visibility:hidden }` in print and restores only its `.printArea`. `src/App.jsx` eagerly imports this screen and its stylesheet. This is a source-confirmed global print rule and a high-confidence risk to other routes that call `window.print`; a blank unrelated print preview has not been reproduced by this source audit. Replace the rule with a print root applied only while printing the intended report, or use a dedicated print document. Verify an ordinary non-compliance print flow as well as compliance.

4. **Global generic classes collide and encourage extra overrides.** `src/screens/Employee/Paginated1.css:16-22,49-70` changes `.pagination-controls`, `.table`, `.table th` and `.table td` for the whole app. `AttendanceGrid.css:142-153` also defines `.pagination-controls` with different behavior. Scope the old CSS by module during migration. Do not add another global override sheet that masks the collision.

### P1: Layout, navigation and hierarchy require a common foundation

5. **The shell constrains wide workspaces repeatedly.** `src/App.jsx:110-112,334-336` places Header, route main and Footer inside a Bootstrap `Container`. Header adds its own `Container` (`Header.jsx:136-137`), and `MainScreen.jsx:5-18` adds another Container/Row. Dashboard's `Container fluid` (`Dashboard.jsx:54`) cannot recover width lost by ancestors. Establish one shell content boundary, a comfortable form width and a distinct full-width data-workspace layout. Do not solve this by applying `width:100vw` inside nested containers.

6. **Navigation and search are visually present without a complete interaction model.** `Header.jsx:110-132,138-143` recursively puts module navigation into a Menu dropdown and nested NavDropdowns. The search input at `149-156` has no value, change handler or submitted navigation behavior. Change Password and Logout are repeated/distributed (`139-143,173-179`), and the logo uses an onClick brand without a route link (`183-189`). Build persistent module navigation from the existing permission-filtered menu data, a genuinely working command/search control, one user menu and semantic links. Never expose unassigned modules through a new search index.

7. **The dashboard is an unranked link catalog.** `Dashboard.jsx:58-91` renders all returned groups/children as uniform buttons. `Dashboard.css:26-40` forces 60px height and capitalization; lines 61-65 attempt tiny mobile text, but the base font/height `!important` prevents those mobile overrides from winning. Lines 70-72 conflict with Bootstrap's column sizing by setting a 12% maximum. Replace with a small useful landing area (recent/favorite permitted tasks, navigation groups, truthful local status); do not invent business KPI cards from unavailable data.

8. **Independent typography and density systems coexist.** Examples: attendance 10px (`AttendanceGrid.css:2-3,31-40`), regularization 14px with 24px controls (`RegularizePunchGrid.module.css:23-43`), leave labels 0.7rem and 26px controls (`Leave.module.css:189-206`), master rows 13px and modal inputs 39px (`MasterDataManager.module.css:2`), feature workbench heading 1.6rem (`FeatureWorkbench.module.css:2`). The whole app needs a single readable hierarchy plus an explicit compact table mode. Do not reduce mobile font sizes to make desktop columns fit.

9. **Repeated and contradictory definitions obscure the intended design.** `ProcessWages.module.css` redefines `.container` at lines 3,104,174 and `.heading` at 13,113,179. The exact duplicate grid/report styles identified above are further maintenance risk. Consolidate shared patterns only after recording each screen's intentional exceptions.

### P1: Dense work needs better information and interaction design

10. **The employee list exposes 46 columns by default.** The literal header block at `ManageEmployees.jsx:1195-1240` includes separate name parts, demographic fields, all timestamps and identifiers in one horizontally scrolling table. The selected record's very long form follows immediately below (`1304 onward`). Keep a focused default column set (code, name, contractor, department, status and essential work context), a column chooser/details view for the complete inventory, and an explicit edit panel/page. Preserve all existing fields and export scope; hiding default columns must not delete data.

11. **A toolbar is built as a separate data table.** `ManageEmployees.jsx:1109-1189` uses `thead > tr > td` for page-size control, symbol-only pagination, search and actions, with invalid style values `midle` and `50$` at lines 1111-1114. Similar pagination layouts exist in contractor/user screens. Replace with a flex/grid DataToolbar and one labeled Pagination component outside the table. Use semantic headers only for actual data columns; provide First/Previous/Next/Last accessible names.

12. **Leave entry has a non-responsive filter override and unlabeled edit controls.** `LeaveLedgerEntry.jsx:383-388` sets `gridTemplateColumns:'repeat(4, 1fr)'` inline; its shared CSS also uses fixed 220px column minima (`Leave.module.css:181-185`) without a mobile media query. The queried ledger at lines 452-576 lacks a local responsive wrapper. Filter `Form.Group`s at 390-420 have no controlId/inputId linkage to the React Selects; row selection at 477 and row controls at 487,513,534,547 do not provide row-specific accessible names. Add a shared responsive FilterBar, contained table scrolling, and explicit labels such as “Leave days for DEMO001”. Preserve dirty-row/export protections.

13. **Long controls can exceed their cells.** `RegularizePunchGrid.module.css:81-86` and `Leave.module.css:88-93` set `.big-input` to 150% width. Alongside hidden table overflow and 150px cell maxima, this creates conflicting expectations. Table columns should declare intentional widths and wrap/truncate policy; edit controls should use `min-width:0; width:100%` within a known cell. Give attendance matrices local horizontal scrolling and pinned identity columns rather than shrinking the entire UI.

### P1/P2: Accessibility and feedback need behavior, not only repainting

14. **Master-data custom dialogs have no dialog semantics or focus management.** `MasterDataManager.jsx:281-355` uses overlay div/section structures for editing and delete confirmation without `role=dialog`, aria-modal, labeling, initial/returned focus, Escape handling or a focus trap. Its × buttons (`201,301`) also lack explicit accessible names. Standardize on the already-installed React Bootstrap Modal, with named title/description, dirty-close confirmation, predictable Escape/backdrop behavior and focus return. Inspect keyboard behavior before claiming accessibility completion.

15. **Duplicate control IDs misassociate labels.** `ManageUsers.jsx:461,471` reuses controlId `email_id` for email and mobile; `ManageContractors.jsx:832,851` reuses `labour_license_valid_from` for both validity dates. The mobile placeholder also says email (`ManageUsers.jsx:477`), and password is `type=text` (`484`). Correct unique ID/label/field relationships and semantic input types while retaining payload names. Screen copy needs an inventory, not CSS capitalization. `Wages.css:24-26,54-56` forces section headings lowercase; Dashboard forces capitalization, altering acronym presentation.

16. **Loading/error patterns are inconsistent and sometimes malformed.** `Loading.jsx:4-16` creates a default 100px spinner with no status text or announced role. `ErrorMessage.jsx:7-8` uses 20px bold content with a stray apostrophe. Numerous screen-local alerts/confirm calls use blocking browser feedback. Establish section-level loading, inline field errors, page error summary/retry, success status and a single confirmation pattern; retain actionable server error detail and avoid success on rejected operations.

17. **Layering is arbitrary.** `DevelopmentBanner.css:1-4` fixes a sticky banner at z-index 11000, above the custom master overlay at z-index 1000 (`MasterDataManager.module.css:2`) and normal Bootstrap dialogs. Define one stacking scale and portal policy. Keep local/synthetic scope visibly available, with the banner below blocking dialogs and without obscuring keyboard focus. Do not remove the local/working-data disclosure to make screens cleaner.

## Proposed architecture

Use the existing React, React Bootstrap and react-select dependencies. A second UI framework or new table library is unnecessary for the foundation. Reconsider a specialist grid only after a measured attendance editing prototype proves native tables cannot meet the real interaction needs.

Suggested structure (new files to create during implementation, not created by this audit):

```text
src/styles/tokens.css             single global token definitions
src/styles/base.css               limited reset, typography, focus, print entry rules
src/components/layout/AppShell.jsx
src/components/layout/SidebarNav.jsx
src/components/layout/Topbar.jsx
src/components/layout/PageHeader.jsx
src/components/layout/PageLayout.jsx
src/components/ui/{Button,IconButton,StatusBadge,EmptyState,Feedback}.jsx
src/components/forms/{Field,SelectField,FormSection,FilterBar,FormActions}.jsx
src/components/data/{DataToolbar,DataTable,Pagination,ColumnChooser}.jsx
src/components/dialogs/{EditDialog,ConfirmDialog}.jsx
src/components/reports/{ReportFrame,ReportFilters,ExportActions}.jsx
src/components/attendance/{AttendanceLegend,AttendanceMatrix}.jsx
src/screens/.../*.module.css     screen-specific layout and genuine exceptions
```

These names describe responsibilities, not a mandate to create one wrapper per Bootstrap element. Add an abstraction where multiple screens need the same behavior. Keep screen business logic/API calls in the screen or its feature hooks; shared visual components receive rows, state and callbacks without knowing payroll or attendance rules.

### Token proposal

Start with restrained BFCL navy/blue and neutral surfaces, then validate with the reviewed visual direction. This is a proposed palette, not a claim of an approved brand manual.

| Token group | Proposed foundation | Required behavior |
| --- | --- | --- |
| Brand | navy `#17365D`, action `#1D4ED8`, action hover `#1E40AF` | Define focus/hover/active/disabled through semantic tokens; verify actual contrast |
| Surfaces | canvas `#F5F7FB`, panel `#FFFFFF`, subtle `#F8FAFC` | Tables and fields use real boundaries rather than heavy gradients/shadows |
| Text | strong `#172B4D`, regular `#334155`, muted `#526477` | Never substitute low opacity for essential information |
| Borders | default `#CBD5E1`, subtle `#E2E8F0` | Separate non-text contrast checks for input/focus boundaries |
| Status | success, warning, danger, info, draft each with foreground/background/border | Text/icon label always accompanies color; draft and locked are separate states |
| Type | local/system Segoe UI stack; body 16px, tables 14px; labels 14px; helper text 13px; page title 24–28px | Explicit compact table density may use 13px; avoid essential data at 9–11px |
| Spacing | 4,8,12,16,20,24,32,40px | Use named scale rather than arbitrary per-screen margins |
| Radius | fields/buttons 6–8px; cards/dialogs 10–12px | Avoid pills on every cell and decorative nested cards |
| Controls | 40px default field/button; 36px compact; 44px touch interaction target where layout allows | Never rely on 24px grid inputs as the universal interaction model |
| Width | form content 960–1120px; reports/grids fill shell; content gutters 24 desktop /16 small | Single ancestor controls width; local table overflow is permitted |
| Layering | table sticky < banner/topbar < drawer < modal < controlled menu portal < toast | Align actual Bootstrap modal/backdrop and react-select portal values centrally; verify nested overlays |
| Motion | 120–180ms color/opacity, no table-cell zoom | Reduced-motion preference removes nonessential transition/animation |

Set Bootstrap CSS variables/theme alongside these tokens in one controlled entry. Do not put new design tokens in a lazy screen module. Define import order once: Bootstrap/vendor, global tokens/base, scoped component/screen CSS. If CSS cascade layers are adopted, put vendor CSS in an explicit lower layer too; layered app rules do not automatically override unlayered Bootstrap rules. Avoid a cascade-layer migration until this precedence is tested.

### Shared component contracts

| Component | Contract and states | Migration protection |
| --- | --- | --- |
| AppShell / navigation | Permission-filtered existing menu; current item, parent expansion, keyboard operation, mobile drawer, session actions; one main landmark/skip link | Use route metadata and existing menu IDs/URLs. Preserve case-insensitive legacy destinations or add deliberate aliases, never guess new permissions |
| PageHeader / PageLayout | Breadcrumb, one h1, description, primary action; form/data/report width variants | No route wraps another page container; all existing screens receive a consistent title |
| Field / SelectField | Stable unique ID, visible label, required indicator, hint/error linkage, disabled/read-only differences, native input modes; react-select inputId and portal policy | Preserve field names/value types and all server validation; no coercing blank numeric/date values to zero/current date |
| FilterBar | Responsive CSS grid, explicit Apply/Clear, active filter summary, loading and stale-preview indicator | Preserve each report's current query semantics; unsaved work cannot silently disappear on filter change |
| DataTable / DataToolbar | Semantic table/caption/headers, row identity keys, focused default columns, text/numeric/date alignment, loading/empty/error states, local overflow | Keep row order/filter/export scope defined by screen; column hiding never removes data from payload or silently changes exports |
| Pagination | Labeled first/previous/next/last, per-page control, “x–y of z”, no-result behavior; reset/clamp after filter changes | Respect existing source pagination; do not paginate already limited server data a second time |
| EditDialog / FormActions | Accessible modal for short edits; dedicated form layout for long employee/contractor records; dirty/saving/error/success/permission states | Reuse existing mutation and success conditions. Close only after confirmed successful save or explicit discard |
| ConfirmDialog | Action-specific title/body, safe initial focus, clear destructive label, busy guard and focus return | Respect server-owned/locked rows and existing delete protection |
| Feedback | Inline field messages + focused error summary; nonblocking announced success; truthful unavailable/needs-rules state | Display rejected API operations accurately; no generic green success to simplify workflow |
| StatusBadge | Text and optional icon for active/inactive/pending/approved/rejected/draft/locked/needs rules/local only | These are distinct business states; visual redesign must not merge them |
| ReportFrame / ExportActions | Filter/query snapshot, print metadata, column chooser, stale-result prevention, working-data notice, empty behavior | Preserve safe spreadsheet helper, no hidden extra records, explicit local/draft disclaimer and official-layout limitation |
| AttendanceMatrix | Pinned identity columns, date grouping, legend labels, keyboard-reachable cells/actions, deliberate density, scroll hint | Manual/imported/approved sources and paid-attendance calculations remain separate; color never creates a new business meaning |

### CSS rules for new and migrated work

- Use global selectors only in tokens/base and deliberately scoped vendor adapters. A module file must not contain bare `table`, `th`, `td`, `input`, `button`, body rules or global print hiding.
- Scope descendants beneath a local component root, including `:global(...)` vendor classes. For react-select prefer its supported style/class configuration; a CSS Module class named `.react-select__control` will be renamed and may not match vendor output as intended.
- Prefer `minmax(0,1fr)` and `min-width:0` in flex/grid children. At narrow widths filters become one column and actions wrap; contain data scrolling in a clearly named region.
- Keep IDs deterministic per field/row. Avoid document-wide duplicate control IDs and unnamed table controls.
- Avoid fixed heights for multiline navigation labels, truncated actions and validation text. Truncate only chosen informational cells with a usable full-value mechanism.
- Keep print layout independent of interactive screen width; use a named print root, repeated table headers, deliberate paper orientation and repeatable metadata.
- Use semantic links for navigation and buttons for actions. No `href="#"` edit links that also scroll or change location.
- Don't remove outlines without an equivalent visible focus treatment. Shared buttons and icon buttons need hover, focus-visible, active, disabled and busy states.

## Migration sequence and release gates

| Stage | Work | Exit evidence |
| --- | --- | --- |
| 0. Baseline | Record every route and capability, exact visible fields, sample page states, critical tasks and existing computed styles; preserve API/export checks | Route inventory and screenshots at desktop/tablet/mobile; baseline contract tests; list of expected draft/unavailable behaviors |
| 1. Contain cascade | Remove/scope global grid button and table leaks, quarantine generic pagination classes, isolate compliance print rules; no route redesign yet | Navigate between unrelated routes in both orders; identical computed controls across navigation; non-compliance print remains visible |
| 2. Foundation | Implement tokens, typography, focus, AppShell, sidebar/topbar, breadcrumbs, PageHeader, width variants, local disclosure and user menu | Keyboard/menu/search checks; drawer at narrow widths; every route remains reachable with current permissions |
| 3. Reference screens | Migrate one master list/dialog, one long employee edit, one report and attendance matrix; review design before bulk conversion | Four representative screens demonstrate shared components, all states and narrow-width handling without contract changes |
| 4. Lists/forms | Migrate employee, contractor, users/roles and master modules; replace toolbar tables, column defaults and long forms; consolidate duplicate CSS | Complete field inventory retained; unique IDs; dirty/save/error states; export scope preserved; approve/read-only behavior unchanged |
| 5. Attendance/leave | Migrate matrix, punches/regularization, manpower, allocations, requests, leave entry/ledger/posting/summary | Source and approval states distinguishable; manual edits/dirty exports protected; keyboard/local scrolling usable; no invented paid-day rules |
| 6. Wage/config/report workflows | Migrate adjustment grids, fixed wages, periods/locks/service charges, profile workbench, compliance previews, imports/jobs/accounting | Rules-required/locked/external integration states visible; profile version/date/source context retained; download/print metadata verified |
| 7. Finish and remove legacy styles | Migrate authentication/recovery/license/unavailable views, clean copy/footer, delete only unreferenced duplicate/stub CSS, document intentional exceptions | Every reachable route has a reviewed screen family and states; no unexpected global selectors or obsolete UI classes; route/deep-link smoke checks |
| 8. Whole-app acceptance | Run source/contract checks, UI keyboard/state/viewport/print/export review and focused cross-route regression | Signed route coverage checklist, screenshots, issue list with no unresolved critical/high UI blockers; build/isolation/tests pass |

Apply migration in small feature batches with clearly reviewable diffs. A migration is not complete merely because a shared button appears on a screen. The stage must preserve the screen's empty/error/loading/dirty/read-only/locked and unavailable states as applicable.

## Verification checklist for implementation

1. At 1440px and 1280px desktop, 1024px tablet, 768px and 390px narrow layouts: readable labels, no page-level horizontal overflow, no clipped action text or offscreen save controls. Data-heavy grids may scroll inside their own region. Include long contractor names, long errors and multiword menu titles.
2. At 200% browser zoom, all ordinary forms/navigation remain usable; verify reflow at a 320 CSS-pixel viewport. Do not mark responsive complete using only desktop screenshots.
3. Keyboard-only: skip link; sidebar/drawer; active route; command search; each dialog open/close/focus return; react-select menu; paging; row checkbox labels; edit/save/cancel; no trapped focus outside a modal or inaccessible hover-only detail.
4. Contrast: actual rendered normal text, muted text, placeholders, buttons, status badges, borders and focus indicators. Target WCAG 2.2 AA; automated results are supporting evidence, not a substitute for manual interaction checks.
5. Every data screen: loading, first use/no query, no matches, load failure/retry, access denied, saved success; edit screens additionally dirty, invalid, saving, server rejection, disabled/read-only/locked. Do not use one generic blank table for all these states.
6. Cross-route CSS test: open master data → leave → attendance → compliance → master data and the reverse sequence; compare key computed styles and print visibility. Eager versus lazy CSS loading must not change behavior.
7. Downloads: query/sort/filter scope and complete row count; current saved snapshot; no unsaved rows exported; XLSX metadata preserved; print and PDF preview retain local/draft labels, repeat headers and do not hide unrelated reports.
8. Navigation/session: current menu is highlighted; authorized deep links work; unauthorized modules remain excluded; expired session reaches login; back/forward restores predictable location; no dead decorative global search.
9. Contract gates: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run build`. Add focused UI tests for shared keyboard/form/table behaviors during implementation; preserve existing API/ledger/import/lock tests. Existing green contract tests alone do not prove a design is fixed.

## Completion definition

The whole UI is fixed when every reachable route is assigned to and implements a consistent shell/screen pattern; the current field/action inventory remains available; key states and permissions work; ordinary content reflows while dense tables have contained scrolling; keyboard and visual accessibility checks pass; print/export behavior is intact; global style leaks and duplicated pattern definitions are removed or explicitly scoped; and route-level review evidence exists. Actual payroll calculations and statutory approval remain their separate requirements and must continue to be represented truthfully in the redesigned UI.
