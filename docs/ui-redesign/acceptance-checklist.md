# UI redesign acceptance checklist

The first W1 implementation is complete on `ui/modern-bfcl-shell-dashboard`; later route-family work remains pending. The statuses below are limited to the evidence actually collected for this wave and do not imply whole-app redesign completion. Follow the authoritative W0–W6 waves in [UI_REDESIGN_PLAN.md](UI_REDESIGN_PLAN.md); audit documents supply supporting detail, not a competing schedule.

## First-wave evidence

| Gate | Current status | Evidence |
| --- | --- | --- |
| A01 | Passed for the preserved route/menu inventory | Existing route inventory retained; normalized menu tree renders 72 permitted destinations from the local menu API. |
| A05 | Passed for local demo navigation | Sidebar active state, legacy route casing alias, deep-link worker navigation and permitted screen search were verified in the local browser. |
| A06 | Partial | Search is derived from the permitted menu response; non-admin account scoping still requires later role-specific browser coverage. |
| A07 | Partial | Desktop account menu and keyboard semantics are implemented; mobile viewport evidence remains pending with the W6 responsive review. |
| A08 | Passed for the local demo dashboard | Task cards, module links and capability counts render from accessible menu/capability data; rules-gated areas remain labeled. |
| A09 | Passed | Sign-out returned to the public login shell with the local development notice and no operational sidebar. |
| A41 | Passed for this wave | `npm.cmd test` (56 tests), `npm.cmd run check`, and `npm.cmd run build` passed; no backend or persisted demo-state changes were made. |

## Coverage and evidence recording

For each row in `route-inventory.csv`, record the tested URL/parameter value, shell/template, field/action parity result, applicable states, desktop/tablet/phone evidence, keyboard result, defects and reviewer/date. Add the five local-workspace tools, three import kinds and six compliance forms as separate executed cases. The current inventory derives 82 named static/configuration cases before invalid variants, tabs and modes. A component shared by multiple routes does not remove the need to check each route's configuration.

Statuses to use during implementation: Planned, In progress, Passed, Failed, Not applicable with reason. Evidence must link to actual screenshots, test output or reviewed files. Never mark a route Passed from build success alone.

## Wave gates

| ID | Wave/package | Check | Passing evidence |
| --- | --- | --- | --- |
| A01 | W0/U01 | Rebuild route/menu inventory and preserve all routed fields/actions | CSV/JSON reopened; no missing family/wave/component; field/action parity tables include special surfaces |
| A02 | W0/U02 | Shared control/table styles do not change when an unrelated route is visited | Compare dashboard → attendance → master → worker → dashboard and reverse order; computed font/spacing/overflow unchanged |
| A03 | W0/U02 | Print rules affect only the intended report | Print preview/PDF of non-compliance report after compliance; compliance report; ordinary page. No unintended blank output |
| A04 | W0/U03 | Token/components demonstrate all interaction states | Default/hover/focus/active/disabled/busy/error/read-only examples; contrast and target measurements |
| A05 | W1/U04 | All permitted screen destinations are reachable and current item is identified | Menu/deep-link walkthrough; search aliases map to actual routes; no undefined `/menu` return |
| A06 | W1/U04 | Search uses the user's permitted screen inventory | Scoped local account sees assigned destinations only; keyboard selection and no-results state work |
| A07 | W1/U05 | Drawer, topbar, environment context and user menu work with keyboard | Focus enters/returns correctly; Escape closes; no hidden focused item; disclosure persists |
| A08 | W1/U06 | Dashboard shortcuts/status are truthful | Shortcuts resolve; counts derive from accessible data or are omitted; failed requests never display zero or success |
| A09 | W1/U07 | Public/account pages use the right shell | Login/recovery/registration show appropriate actions; errors and busy state visible; no password values in lists |
| A10 | W2/U08 | Four reference screens establish the system before bulk migration | Master dialog, worker form, attendance matrix and report reviewed at three widths; documented component exceptions |
| A11 | W2/U09 | Worker list/detail retains the complete inventory | Default list focused; every original field remains reachable; selected list search/page survives detail return |
| A12 | W2/U09 | Worker form rejects invalid data and protects unsaved work | Required/conditional rules retained; focus moves to linked error summary/field; cancel/navigation/profile/filter changes do not silently discard edits |
| A13 | W2/U09 | Approval comparison is complete and correct | Selected worker original/proposed values align; changed-only and all-fields modes; permitted approve/reject and denied/failed states |
| A14 | W2/U10 | Both contractor entry paths remain consistent | Same values/validation across register/manage; correct licence-date labels/unique IDs; creation does not overwrite the login session |
| A15 | W2/U11 | Every master key/schema still works | Shift group/time plus all six master configurations; short-edit dialogs, keyboard trap/return, successful/failed/duplicate saves |
| A16 | W2/U12 | Local user and assignment edits preserve authorization semantics | Alphanumeric ID, blank-edit-password semantics, protected demo account, six scopes, copy preview, explicit empty scope and atomic save |
| A17 | W3/U13 | Attendance identity and dates remain unambiguous | Pinned worker/date context; text legend; keyboard detail; same-number days across month boundaries do not merge |
| A18 | W3/U14 | Manual/regularised/department changes preserve source state | Pending has no approved effect; approval/withdrawal reflected; invalid late batch preserves every row |
| A19 | W3/U15 | Effective dates/counts and request status are represented accurately | Before/after effective-date cases, including downstream integration of the shift-allocation route migrated in W2/U09; whole-number counts; pending/approved/rejected requests; no inferred paid credit |
| A20 | W3/U15 | Processing truthfully reports supported local activity | Imported punch first/last times and real job counts; no pretend biometric progress; rules-required sandwich explanation |
| A21 | W3/U16 | Ledger ownership, dirty edits and return navigation remain safe | Manual-only edit/delete; owned rows preserved; save strips UI flags; unsaved edits block export; Close returns to canonical route |
| A22 | W3/U16 | Payroll leave posting never clears unrelated/source data | No matching output blocked; repeated post idempotent; wrong contractor/malformed/overlapping outputs and locks preserve ledger |
| A23 | W4/U17 | Wage-input forms preserve raw values and correct semantics | Earnings/deductions/arrears, zero vs blank, raw arrear days, optional remarks, code/name labels and amount formatting |
| A24 | W4/U17 | Fixed-wage flags and effective dates survive edits/imports | PF/ESI/LWF Y/N/blank mappings, components and dates preserved; no invented calculation result |
| A25 | W4/U18 | Period/lock/service-charge scope is explicit | Billing cycle/month/entity/contractor visible; locked edits prevented; current contractor names rendered |
| A26 | W4/U19 | Rules/profile lifecycle retains all guards | State switch, blank state create, central/state/company sections, source/effective dates, version conflict, history, dirty-state guard |
| A27 | W4/U19 | Missing payroll rules produce an actionable blocked state | Start disabled or replaced by prerequisites; response422 renders correct explanation/link; no generic retry success or fake pay |
| A28 | W5/U20 | Every report has an explicit query state and scope | Initial vs loading vs empty vs failed vs blocked; explicit month for monthly forms; display snapshot agrees with exported scope |
| A29 | W5/U20 | Actual exports retain row/column/type provenance | Reopened workbook shows selected rows/columns, leading zeros, numeric values, date/time and source/filters/generation metadata |
| A30 | W5/U20 | Print is isolated, readable and truthful | Intentional paper orientation, repeated headers, metadata, no shell/overlap/clipping; working-data notice retained |
| A31 | W5/U21 | Every input row is reviewable before import | Templates/adapters for worker, contractor, local punch, Manual Muster mark/work-hours/OT, wage-component/adjustment and inactivation schemas; more than200 rows fully accessible; total and pagination accurate |
| A32 | W5/U21 | Invalid uploads cannot silently lose rows or partially commit | Missing required values, duplicate codes, unknown worker, invalid date and late invalid row all reported; stored state unchanged |
| A33 | W5/U21 | Validated state belongs to the current import inputs | Replacing file/changing mode/mapping invalidates Commit; duplicate click guarded; accurate committed/rejected summary |
| A34 | W5/U21 | Punch and identifier types survive spreadsheet reading | Serialized XLSX/CSV incl1904 date system, UTC and India; full wall-clock timestamps and date-only fields retained |
| A35 | W5/U22 | Local workspace summaries retain their boundaries | Accounting labeled recorded inputs; jobs show supported state; outbox local-only/used/expired status; no token/password in generic exports |
| A36 | W6/U23 | Special states have an accurate recovery action | Expired session → sign-in; forbidden/unknown/unavailable/licence lock remain distinct; no unauthorized action exposed |
| A37 | W6/U24 | Copy and style cleanup is complete | No contradictory case transforms/typos; no dead visible controls; no unreferenced duplicate styles; deliberate grid/print exceptions listed |
| A38 | W6/U25 | All route configurations pass smoke/deep-link review | 73 declarations plus supported/invalid parameter variants, key tabs and create/edit/read-only modes; valid refresh/back behavior |
| A39 | W6/U25 | Responsive review covers all screen families |1440,1280,1024,768,390 viewports;320 CSS-pixel reflow; 200%/400% zoom; local table scrolling only where required |
| A40 | W6/U25 | Keyboard and screen-reader review is complete | Labels/IDs/landmarks/headings, named row controls, select menus, modal focus, status/errors, no traps/obscured focus |
| A41 | W6/U25 | Full behavior, build and isolation checks pass | Contract tests, appropriate UI tests, `npm.cmd run check`, `npm.cmd run build`; no unexplained new console errors |
| A42 | W6/U25 | User tasks meet proposed usability targets or limitations are recorded | Same five before/after scripts; complete critical tasks; measured task time and feedback; no claim of unmeasured improvement |

## Minimum state matrix by template

| Template | Required states beyond ordinary data |
| --- | --- |
| Shell/navigation | Initial menu loading, empty permitted menu, denied route, search no results, session expiry, drawer open/closed |
| List/master | Initial loading, no records, search zero matches, request failure/retry, selected row, permitted/denied actions |
| Long form | Create/edit/read-only, dirty, invalid field/section, saving, rejected save, successful save, discard/keep editing |
| Editable grid | Unqueried, loading, empty, dirty/new row, invalid row, locked/source-owned row, save failure/success, selection scope |
| Approval | No pending changes, original/proposed comparison, review in progress, approved/rejected, failed/denied review |
| Report | Unqueried, loading, empty, request error, blocked rules/output, stale snapshot, column selection, export/print states |
| Import | No file, malformed/oversize file, preview/pagination, invalid rows, validated, changed inputs, committing, result/failure |
| Process | Missing inputs, missing rules, period locked, ready if supported, running if supported, real completion/failure, job history |
| Rule intake | No profile, selected draft, dirty, saving, conflict, history, missing sources/effective dates, calculation disabled |
| Local tools | Empty/loading/error, source/scope notice, supported statuses, complete paged data or explicit export scope |

## Preserved invariants

1. All runtime requests stay local; no production files/data/config are introduced.
2. API permissions, scopes and locks remain authoritative. Navigation visibility is not authorization.
3. Display changes do not alter API field names, values, leading zeros, date/time meaning or calculation rules.
4. No silent import row drop, incomplete query export, accidental ledger replacement or false success.
5. Existing source ownership, approval transitions and effective dates remain intact.
6. Local/synthetic, DRAFT, WORKING DATA and missing-rule disclosures remain accurate.
7. Implementation proof records actual observed behavior; planned tests and visual proposals are not release evidence.

## Completion review

Read the completed inventory/checklist against current source and runtime. Uncertain, indirect or missing evidence leaves the affected item pending. Do not sign off the whole redesign from a representative page, automated accessibility score, preserved old tests or attractive screenshots alone.
