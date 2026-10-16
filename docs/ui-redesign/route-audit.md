# UI route and screen coverage audit

Planning baseline: 16 October 2026. This document describes the current isolated replica source and the complete migration inventory. It is not a claim that every screen has been exercised in the browser or that a redesign has been implemented.

## Evidence and repeatability

The inventory is derived from the actual `<Route>` declarations and imports in `src/App.jsx`, evaluated `MENUS` exported by `server/seed.mjs`, all JavaScript/JSX navigation references under `src/`, and the feature links in `server/modules/workspace.mjs`. It includes the current labels after the menu transformation code runs; older unused `routeGroups` labels are not treated as the current menu.

Run from `D:\CLMS\replica`:

```powershell
node docs/ui-redesign/build-route-inventory.mjs
```

The script writes `route-inventory.csv` and `route-audit-evidence.json` under this documentation directory only. It checks that every route's component import resolves, every route has a screen family and wave, and route declarations are unique when case is ignored. Source navigation is parsed with the locally installed Babel parser so commented-out calls do not count as active references. The module-level string constant `MENU_URL` is resolved as well as direct string literals. Arbitrary expressions are retained as explicit dynamic references rather than guessed.

`route-inventory.csv` is the implementation checklist: one row per current route declaration, its component and source line, current module menu labels/groups, configuration variants, screen family, proposed wave, priority and special requirements. `route-audit-evidence.json` keeps the machine-readable counts, every resolved source navigation reference, the dynamic references and menu ambiguities.

## Counts

| Inventory measure | Verified count |
| --- | ---: |
| React route declarations | 73 |
| Static route declarations | 68 |
| Parameterized route declarations | 4 |
| Wildcard fallback declarations | 1 |
| Distinct routed JSX component files | 66 |
| JSX screen files under `src/screens` | 66 |
| Screen JSX files without any route use | 0 |
| Seeded module menu groups | 8 |
| Seeded child menu items with links | 72 |
| Unique seeded menu destinations | 70 |
| Route declarations reached by at least one seeded menu item | 62 |
| Non-fallback route declarations outside the seeded module menu | 10 |
| Seeded menu links with no explicit matching route | 0 |
| Statically resolved source navigation references | 84 |
| Resolved source references with no explicit matching route | 1 |
| Remaining dynamic source navigation expressions | 4 |
| Feature-workbench links | 15 |
| Feature-workbench links with no matching route | 0 |

These are different units. Six compliance menu paths share one parameterized React route; four menu paths share the generic workspace route; two menu destinations are deliberately present in two groups. Therefore menu and declaration totals should not be made equal by removing screens or inventing routes.

## Actual navigation gap and ambiguity

1. **Leave Ledger close destination needs correction.** `src/screens/Leave/LeaveLedgerEntry.jsx:12` sets `MENU_URL = "/menu"`; the close handler calls `navigate(MENU_URL)` at line 280. There is no `/menu` route in `App.jsx`, so route resolution reaches the wildcard unavailable screen. The redesign should target the canonical dashboard or an explicitly defined leave landing destination. This is established from source and has not been browser-exercised in this audit.
2. **Repeated menu destinations are not missing screens.** `/ApproveEmployeeChanges` appears as **Approve Employee Changes** in Masters Module and **Employee Change Approvals** in Approvals. `/regularizePunches` appears as **Regularize Punches** in Attendance Module and **Attendance Regularisation** in Approvals. Preserve accessible entry points while deciding one canonical page title, breadcrumb and active-navigation rule for each. Do not create duplicate data flows just to preserve two menu labels.
3. **Dashboard and fixed-wage casing is compatible today.** The declared `/Dashboard` is reached by `/dashboard`; `/ManageFixWages` is also reached by the component's `/manageFixWages` call. Current routes do not set `caseSensitive`, so the case-insensitive matcher accepts these. Normalize route naming through a central registry during migration while preserving existing addresses. Do not report them as current missing routes.
4. **The post-login menu branch needs a design decision.** `LoginScreen.jsx:94` uses `menu.url` and `menu.name`, whereas the API-backed dashboard/header use `menu_url` and `menu_name`. Successful login currently navigates to `/dashboard` immediately. Treat the redundant branch as source ambiguity to remove or align during W1; this audit does not establish that a user can interact with the branch at runtime.

The four dynamic navigation expressions are `Header`'s `menuItem.menu_url`, `Dashboard`'s `menuUrl`, `FeatureWorkbench`'s `feature.path` and `LoginScreen`'s `menu.url`. Evaluated seed menus cover the first two; the 15 feature links all match explicit routes. The login branch ambiguity remains as described above.

## Routes outside the module menu

| Declared route | Current access / coverage requirement |
| --- | --- |
| `/` | Landing/entry route; authenticated users may navigate to dashboard. Preserve entry and sign-in transition. |
| `/Dashboard` | Header logo, development banner and programmatic navigation; preserve `/dashboard` compatibility. |
| `/login` | Landing sign-in link and session-expiry navigation. |
| `/change-password` | Header action. |
| `/register` | Explicit routed account-registration surface; no current module-menu item. Decide its supported access and consolidate with admin account creation only after preserving required behavior. |
| `/registerContractor` | Explicit separate contractor-registration screen; not currently seeded in the module menu. Decide whether to expose or consolidate with contractor creation while preserving address compatibility. |
| `/resetSuccess` | Recovery-flow result route; preserve safe retry/sign-in behavior. |
| `/resetPassword` | Login recovery action. |
| `/development/unavailable/:module` | Specific unavailable-module explanation; no active seeded menu item currently points here. |
| `/development/import/:kind` | Worker/contractor Upload actions and workspace navigation; three import variants. |

These are not ten automatic navigation defects. Entry, utility and flow-result routes appropriately need not all appear in the main module menu.

## Parameterized, shared and nested views

All current route declarations are flat children of one `<Routes>` element. There are no declared nested layout routes or explicit redirect/alias route objects. Shared component configurations and route casing should not be confused with nested routes.

| Route / shared surface | Required named variants | Additional states that must be designed |
| --- | --- | --- |
| `/development/:tool` | `accounting`, `approvals`, `audit`, `outbox`, `jobs` | Unknown tool, loading, empty, error, refresh; tool-specific columns and actions. Jobs is reached by workspace/attendance links rather than its own module-menu entry. |
| `/development/import/:kind` | `employees`, `contractors`, `punches` | Unknown kind; template, file selected, parse error, row validation error, validated, committing and saved. Employee/contractor create versus upsert; punch preview versus server validation. |
| `/compliance/:form` | Form XII contractor register; Form XIII worker register; Form XIX wage slip; Form XVI muster; Form XVIII wages plus muster; Form XXIII overtime | Invalid slug, missing period, missing rules, preview, no records, filter/search results, selected columns, XLSX and print. Working-data status must remain explicit. |
| `/development/unavailable/:module` | Arbitrary unavailable-module context | Distinct reason and recovery action; do not merge copy blindly with the generic 404. |
| `*` | Arbitrary unmatched address | Route-not-found page with a safe dashboard destination. |
| `/masters/shifts` | Shift Groups and Shift Timings tabs | Both `MasterDataManager` field definitions, validation, row selection/editing and tab transition. Tabs are state within a page, not separate current routes. |
| Six `/masters/...` routes | Business units, cities, divisions, holidays, locations, cost centres | Shared manager with six separate `master` props and key/lookup/date schemas. |
| Worker, contractor, user and fixed-wage managers | List/search, create, selected-record edit and validation/result views | Current dialogs, lookup-dependent fields, import/export handoffs, dirty state, protected records and account-specific password semantics. These remain part of whole-UI scope. |

The 68 static declarations plus five named workspace tools, three import kinds and six compliance forms produce **82 named address/configuration cases** before error patterns, shift tabs, form modes, dialogs and transient states. This is a minimum migration coverage count, not the number of screenshots needed or a claim that these cases are already visually verified. Unavailable and wildcard paths are unbounded patterns.

## Complete screen-family coverage

| Screen family | Route declarations | Wave | Migration-specific requirement |
| --- | ---: | --- | --- |
| Entry / authentication | 6 | W1 | Cohesive sign-in, password change/recovery and result flow; visible local-demo context and accessible error/focus behavior. |
| Dashboard / navigation | 1 | W1 | Task-oriented home, searchable real navigation, canonical page titles and active menu/breadcrumbs; retain permission visibility. |
| Contractor management | 2 | W2 | Consistent list/detail/create/edit sections, identity/contact/licence/payment fields and duplicate-route strategy. |
| Administration / access | 2 | W2 | Separate create/edit account semantics; clear role, activity and data-scope assignments; recovery restrictions. |
| Worker management | 4 | W2 | Worker list/detail, long-form sections, effective shift allocation, inactive workflow and employee change approval. |
| Reference masters | 7 | W2 | Shared CRUD template, master-specific schemas and both shift tabs. |
| Attendance operation | 10 | W3 | Month grid, manual muster, department changes, regularisation, requests, manpower and local jobs; clear draft/approval/save scope. |
| Leave operation | 3 | W3 | Entry, ledger and calculated-output posting; source protection, query/dirty guards and state-specific prerequisite explanations. |
| Wage input / setup / processing | 9 | W4 | Effective wage inputs, amounts, period locks, imports/setup and rule-dependent processing status; no invented calculation. |
| State profiles / feature coverage | 1 | W4 | Distinct state/version/effective-period context, rule intake, draft history and feature readiness. |
| Attendance report / export | 8 | W5 | Common filter/results/export/print organization with unique data columns and full filtered scope. |
| Worker report / export | 1 | W5 | Explicit worker dump scope and literal identifiers. |
| Wage output / report | 12 | W5 | Shared output template; show unavailable prerequisites and avoid empty success masquerading as calculated data. |
| Leave report | 2 | W5 | Summary versus balance clarity, period/contractor filtering and numeric balances/export metadata. |
| Local operational workspace | 1 | W5 | Five differentiated tools; readable business columns, approval/job state and restricted recovery token display. |
| Workbook import | 1 | W5 | Three import schemas with preview, row errors, explicit create/upsert intent and atomic commit feedback. |
| Compliance report working data | 1 | W5 | Six form datasets, clear working-data notice, field selection and print/export boundaries. |
| Unavailable / error state | 2 | W6 | Separate unavailable-module and 404 patterns; consistent recovery actions. |
| **Total** | **73** | | |

W0 covers the shared shell, tokens, type/spacing, navigation primitives and reusable components used by all 73 declarations; it does not add a new route. W6 also includes cross-route error/loading/empty/permission/locked/dirty states and final regression across every wave; its two counted routes do not limit W6's scope.

Wave totals are W1 **7**, W2 **15**, W3 **13**, W4 **10**, W5 **26**, W6 **2**. Priority is independent of wave: P0 in the CSV identifies entry/navigation dependency, while P1 marks required module migration. Every row remains required for whole-UI completion; P1 does not mean optional or deferred beyond completion.

## Shared surfaces outside route counting

The plan also needs explicit design coverage for `App`'s layout/container and global licence state; `Header`, `Footer`, `DevelopmentBanner`, `MainScreen`, `Loading`, `ErrorMessage`; attendance/muster/punch grid components; employee-search and identity dialogs; each upload component; export/print renderer layouts; form selects and portal menus; tooltips/legends; pagination; and success/error feedback. These do not become extra page routes simply because they require redesign work.

Global lock/expiry state has a dedicated `LicenseLockScreen` and a modal definition in `App`; the current early hard-stop rendering branch must be considered when designing that exceptional state. Whether it is reachable in the isolated replica is separate from preserving its source-level design requirement.

## Migration acceptance evidence

For every CSV row, retain a completed migration status, desktop and narrow-screen observation, keyboard/focus and state checks, any print/export comparison and relevant behavioral contract checks. Add a child checklist for all named parameter variants, both shift tabs and each manager create/edit mode. Verify active navigation and direct URL refresh as well as clicking from the dashboard. Correct the `/menu` close link and add a navigation check that cannot be satisfied merely by the wildcard rendering.

Shared shell/theme changes can affect every route even without editing its component. Each wave should therefore smoke-test already migrated families, and the completion pass must visit every named route/configuration case rather than using one successful page as proof of whole-UI quality. Preserve local isolation, synthetic fixtures, API contracts, wage locks, protected ledger rows, draft rules and all currently explicit unsupported behavior throughout the redesign.

Only planning artifacts were created for this route audit. No runtime application file, seed data, session, stored local record or live system was changed.
