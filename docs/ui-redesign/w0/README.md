# W0 — Foundation (UI redesign)

Status: **implemented, awaiting review.** Date: 16 October 2026. W0 contains no screen redesign. It removes the
global CSS leaks that made per-screen design unreliable (U02), adds design tokens and an opt-in theme (U03), and
records a measured baseline (U01). Gates A01–A04 are reported below with their actual evidence and limits.

## What changed

| Package | Change | Where |
| --- | --- | --- |
| U01 Baseline | Loopback-only Playwright harness measuring 84 route cases (68 static routes + 16 variants): leakage against pristine Bootstrap, per-route style signatures, invisible-text detection, real-PDF print output, order independence. "Before" captured from unmodified source. | `w0/ui-style-baseline.mjs`, `w0/baseline/before.json` |
| U02 Containment | Scoped every leaking rule to its owner, keeping specificity with `:where()` (see list below). Print-hiding rule keyed to a body class that exists only while a compliance report is mounted. | `src/**/*.css`, `MainScreen`, owner screens |
| U03 Tokens | `src/styles/tokens.css` (custom properties only), `base.css` (theme **opt-in under `.bfcl-ui`**), one global import entry, `src/utils/contrast.js`, development reference page `/development/design-system`, unit test and rendered check. | `src/styles/`, `src/screens/Development/DesignSystem.*`, `tests/design-tokens.test.mjs`, `w0/design-system-check.mjs` |

One route was added: `/development/design-system` (development only, no menu entry, no API calls). The route
inventory now has **74 rows** (the original 73 plus this W0 reference); `build-route-inventory.mjs` classifies it as W0.

### Leaks contained (U02)

| Rule | Was | Now |
| --- | --- | --- |
| `AttendanceGrid.css` `button.btn` (10px, `!important`) and `.pagination-controls` | every Bootstrap button in the app | under `.legacy-attendance` (ManageAttendance root) |
| Bare `td {nowrap; max-width:150px; overflow:hidden}` ×6 grid modules | every table cell in the app | under `.regularize-punch-grid-container, .compact-grid` |
| `MasterDataManager.module.css` `:root` variables, bare `table/th/td/tbody tr` | global | variables on `.page,.tabs` (ShiftSetup renders `.tabs` outside `.page`); table rules under `.tableWrap` |
| `Employee/Paginated1.css`, `Wages/Paginated1.css`, `Wages/Paginated2.css` (`.table*`, `.pagination-*`, `body, html`) | global | under `.legacy-paginated`, opted into by the five screens that import a `Paginated*.css` via `<MainScreen scope="legacy-paginated">`; the redundant `body, html` rules were removed (measured: no effect) |
| `LoginScreen.css` `.modal-content/-header/-body/-footer` | every Bootstrap modal | the login error modal only (`dialogClassName`) |
| `ChangePassword.css` `.alert-success`, `.input-field` | every success alert | `.change-password-container` |
| `ComplianceReports.module.css` `body * {visibility:hidden}` in `@media print` | every page printed blank | active only while a compliance report is mounted |

The last four rows go beyond the plan's named findings (F01–F03); they leaked the same way and were measured by the same probe.

## Gate results

| Gate | Status | Evidence |
| --- | --- | --- |
| A01 inventory | **In progress** | Inventory regenerates from source: identical content to the committed CSV apart from line endings and a locale-dependent sort in the JSON, plus the one new W0 row. The field/action *parity tables* named by the gate were not re-audited in W0. |
| A02 style containment | **Passed** | Neutral Bootstrap probe differing from pristine Bootstrap + `index.css`: **84/84 → 0/85** cases. 0 new console errors, 0 page-overflow increases, 0 newly invisible text. Caveat: order independence was already true before W0 (all CSS is eager), so that half of the gate is satisfied trivially; the leakage measurement is the meaningful evidence. |
| A03 print isolation | **Passed** | Real PDFs via Chromium's print path, text extracted with `pdftotext`, visit order forward and reverse plus client-side navigation away from a compliance report. Ordinary pages: **0 characters (blank pages) → content prints**; compliance forms still print their report; Form XVI now prints timestamps in full instead of `2026-09-02T00:00:…`. |
| A04 tokens and states | **Passed** | `w0/baseline/design-system-measurements.md`: 41 controls and badges measured in the rendered DOM, 18 state-parity comparisons (mirrored demo states vs real hover, keyboard focus, press, and focus+hover), 9 live token pairings, reduced-motion rule. Plus 8 token unit tests (WCAG ratios, status distinctness, ordered z-index, scope guard). |

Project gates: `npm test` 64/64 (56 existing + 8 new), `npm run check` passes, `npm run build` passes.

## Visible effect on existing screens — by design

Screens that were relying on leaked rules now render as Bootstrap plus their own CSS. Across the 84 baseline cases, 55 routes
have a different style signature for their own buttons, tables or headings. Reviewed before/after images are in `evidence/`.

- Buttons lose the leaked 10px size and 600 weight (Attendance keeps its own compact buttons, scoped to that screen).
- Table headers are no longer forced uppercase, sticky or `nowrap`; cells are no longer truncated at 150px.
- Raw header casing that CSS used to hide is now visible (for example `doj`, `display name` in the employee list) —
  the style audit's finding #15 (copy needs an inventory, not CSS capitalisation).
- The five legacy Paginated screens keep the light-blue table skin and pagination layout. Other screens that used
  `.table` now show Bootstrap's default table styling.
- Sticky table headers that existed only through the MasterData leak no longer stick.

If an interim look-and-feel freeze is preferred over this, the alternative is an explicit opt-in "legacy table skin"
applied through `MainScreen`. That was not done because it re-creates the shared override sheet the plan warns against.

## Running the checks

Requirements: the replica running (`npm run dev`, or `npm.cmd run dev` on Windows), Playwright resolvable (not a project
dependency; set `PLAYWRIGHT_MODULE_PATH` if needed), and `pdftotext`/`pdfinfo` (poppler) for the print measurements.

```text
node docs/ui-redesign/w0/ui-style-baseline.mjs capture --out <file.json> [--shots <dir>] [--only /route,/route]
node docs/ui-redesign/w0/ui-style-baseline.mjs compare docs/ui-redesign/w0/baseline/before.json <file.json>
node docs/ui-redesign/w0/design-system-check.mjs          # exits 1 on any failed requirement
node --test tests/design-tokens.test.mjs                  # no browser needed
```

Both scripts refuse non-loopback targets. `before.json` is a capture of unmodified source and should not be regenerated
from changed code.

## Limits and known follow-ups

- **Measurement jitter.** With identical source one dashboard tile occasionally measures 63px instead of 60px (2 of the 7
  captures examined). Treat single-tile height differences of that size as noise.
- **Not covered:** screen-reader testing, forced-colors/high-contrast mode, browsers other than Chromium, and real
  print dialogs (the print gate uses Chromium's PDF path, which applies `@media print`).
- **Not contained (lower risk, listed for W1+):** `Header.css` navbar overrides (replaced by the W1 shell), `Wages.css`
  `.error-message`, `DetailedAttendanceGrid.css` generic class names, `index.css` `body`/`code` font declarations (the
  `body` one is overridden by Bootstrap today, which was verified; the `code` one is expected to be, but was not checked;
  the import order preserves both).
- **Import order is load-bearing.** `src/index.jsx` imports `index.css` *before* Bootstrap on purpose; reversing them changes
  the base font on every screen (see `src/styles/index.css`).
- `.legacy-attendance` and `.legacy-paginated` are migration scaffolding: delete them as the owning screens move to the
  shared components in W2–W4.
- The development banner still uses `z-index: 11000`; it joins the token layering scale with the W1 shell.
- The token palette is the plan's proposal, not a BFCL brand manual. One deviation from the plan's table: its `#CBD5E1`
  border is only 1.48:1 against white, so it is used for decorative dividers only and controls use `#64748B` (4.76:1).

## Rollback

Each package is a separate commit. Reverting the U02 commit restores the previous (leaking) CSS; the harness will then
report the leak again, which is the intended regression signal.
