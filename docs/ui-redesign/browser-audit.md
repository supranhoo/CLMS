# Current UI browser audit

Observed on 16 October 2026 against `http://127.0.0.1:5173`, the isolated synthetic-data replica. A separate audit tab was used; no save, import commit, approval, password change or record deletion was performed. The user's existing app tab was preserved.

This is evidence for a redesign plan, not proof that every screen has been visually tested. Source-based coverage is broader than this browser sample; see the route and workflow audits.

## Observations

| Surface | Browser finding | Evidence |
| --- | --- | --- |
| Dashboard | Many equally weighted action tiles across eight module groups; small labels and a full-width account/header band. The page functions as a screen catalog rather than prioritizing tasks. | [Desktop](evidence/dashboard-desktop.jpg) |
| Workers | 46 table headers observed. The table has local horizontal scrolling, while a long blank/selected form follows below the list. Essential identity/work context is distributed across many columns. At the measured desktop state, document and content width were both1265px; the table, rather than the document, overflowed horizontally. | [List](evidence/workers-desktop.jpg), [selected record](evidence/worker-edit-desktop.jpg) |
| Worker edit | Repeated section titles, audit metadata alongside editable fields, many required markers and long multi-column sections. Full data must remain available after regrouping. Merely selecting DEMO001 opened the form; no field was changed. | [Selected record](evidence/worker-edit-desktop.jpg); DOM labels reviewed |
| Attendance calendar | Two worker identity columns followed by31 daily columns, text/code legend, terse Print SL/PR actions and filter/search/pagination controls. Preserve the matrix's date/worker meaning when redesigning density. | [Attendance](evidence/attendance-desktop.jpg) |
| Shift master | A more structured local card/header/search/table pattern already exists, but shares the older global shell. This is useful internal prior art, not a complete common design system. | [Master data](evidence/masters-desktop.jpg) |
| Wage earnings | Billing/month/component filters, query/upload controls and an editable add row. Before a query, the UI shows “No records found for the selected date”; the redesign must distinguish unqueried from genuinely empty results. | [Wage inputs](evidence/wage-input-desktop.jpg) |
| Assign roles | Repeated Available/Assigned listboxes with symbol-only transfer controls, user lookup/copy actions and a long menu inventory. Proposed sections/search/summary should retain all six assignment dimensions. No assignment action was taken. | [Roles](evidence/roles-desktop.jpg) |
| State profiles | Feature coverage precedes the draft editor. Jharkhand/Bihar draft choices, central/state/company sections and64 missing rule requirements are visible. The calculation-disabled statement is explicit and must remain accurate. | [Profiles](evidence/profiles-desktop.jpg); DOM reviewed |
| Local users | Existing user table includes a Password heading even though server values are blank; form includes audit metadata and mixed field semantics. This was observed in the user's original tab accessibility state, with no interaction or screenshot. | Current AX observation; source details in workflow/component audits |
| Narrow dashboard | With a390×844 viewport override, measured content width375px; environment strip and expanded account header consume substantial vertical space. Tiny tile labels and a long catalog remain. No page-level horizontal overflow was observed in this sample. | [390px viewport](evidence/dashboard-mobile-390.jpg) |
| Narrow workers | With the same override, document/content width375px and46 data headers. A compact default list plus detail view is needed; do not solve the information-density problem by making text smaller. | [390px viewport](evidence/workers-mobile-390.jpg) |

The temporary viewport override was reset after the narrow-screen checks. Screenshots capture the actual viewport, not a staged full-page composition. All visible records are the app's fictional fixtures.

## Not verified during this planning audit

- Every route, permission state, editable field, create/edit/save sequence or report variant in the browser.
- Actual screen-reader operation, complete keyboard traversal, contrast ratios or WCAG conformance of the current application.
- The source-predicted cross-route print-hiding problem in a generated print preview/PDF.
- Performance, real-user task times, production parity, statutory applicability, or final user acceptance.

These are explicit implementation acceptance tasks, not reasons to reduce the redesign scope. See [acceptance-checklist.md](acceptance-checklist.md).

## Visual proposal verification

The standalone `design-preview.html` was opened through the existing local Vite server and checked separately from the current app. It embeds its logo, has no external asset links, API connection or network-call code, and stores no business records. Its fixture names and values are illustrative, not live queries or a claim that all app fields are reproduced in the mock-up.

## W1 implementation verification — 17 October 2026

The feature branch `ui/modern-bfcl-shell-dashboard` was verified against the running local replica at `http://127.0.0.1:5173/dashboard`. The authenticated demo view showed the navy sidebar, active dashboard route, grouped menu rows, task cards, module inventory and capability status. Screen search for `worker` returned the permitted Worker Management destination and navigated to `/manageEmployees`, where the existing worker table still rendered inside the shell. The user menu exposed Change password and Sign out; signing out returned to the public login shell with no operational navigation. Desktop accessibility inspection found a skip link, main landmark, named search field, menu disclosure buttons, active links and named account actions.

The mobile drawer and 390px layout remain an explicit follow-up verification item. No save, import, approval, password change or record deletion was performed.

| Proposal check | Observed result |
| --- | --- |
| Desktop shell | Navy sidebar, white topbar, readable task panels; mobile drawer controls hidden at desktop after correcting a prototype CSS specificity issue |
| Five concept views | Dashboard, worker directory, worker record sections, attendance and report workspace all opened |
| Directory | Searching Asha reduced the table to one synthetic worker; Clear restored the list; contact-column toggle provided visible feedback |
| Record concept | Edited a synthetic display name; value survived section navigation; leaving prompted a named unsaved-edit dialog; Keep editing retained it; Reset restored prototype fields |
| Attendance concept | A pending regularisation cell opened the matching worker/full-date detail and explicitly said approval was not applied |
| Report concept | Workmen preview displayed four illustrative records; wage-slip selection displayed calculated-output prerequisite and disabled export, with no fabricated pay |
| Search | Searching worker exposed directory and record-section destinations; choosing directory opened it |
| Narrow layout |390×844 override showed stacked report filters and a usable drawer; choosing Dashboard closed it and reset aria-expanded. Override reset afterward |
| Browser console | No proposal error appeared in the inspected log sample. Existing React list-key and uncontrolled-input warnings came from the earlier current-app inspection; they are part of implementation cleanup, not proof of prototype failure |
| Offline/source check | No remote src/href assets or fetch/XMLHttpRequest/WebSocket calls found in the final self-contained proposal |

Proposal screenshots: [desktop dashboard](evidence/proposal-dashboard-desktop.jpg), [worker list](evidence/proposal-workers-desktop.jpg) and [narrow report](evidence/proposal-report-mobile.jpg). The proposal tab is retained for review. It demonstrates visual and interaction direction only; the application-wide release checks remain pending.

## Planning-package completion check

The route generator was rerun and reproduced73 declarations/66 routed screen files with no unmapped family/wave or missing component. The saved CSV was reopened; the main plan contains all25 named work packages, and the implementation checklist contains42 distinct acceptance gates. Supporting documents were reviewed for whole-app coverage, with shift-allocation wave ownership and Manual Muster import coverage corrected. All28 local Markdown links present at the link-check run resolved; subsequently added proposal screenshot links point to saved inspected files.

No application build/behavior test was rerun solely for these documentation/proposal files. The preceding feature-release test baseline is documented separately; its56 passing tests are not presented as UI redesign implementation evidence.
