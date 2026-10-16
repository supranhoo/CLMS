# Developing features in the CLMS replica

## What was recovered

The first-party React source and application CSS were recovered from the current build's JavaScript and CSS source maps. Brand assets were copied from the frontend build. The original source-map filenames are `main.5696f25c.js.map` and `main.a3c501b4.css.map`.

Recovered source is a starting point, not a clean upstream repository: original commit history, package manifest, lockfile, backend source, SQL schema, stored procedures, automated tests, deployment configuration, and historical development decisions were not available in the inspected folder. A new dependency manifest and lockfile are supplied for this local development copy.

The source maps did not contain nine referenced CSS files; these are documented stubs. Representative screens are checked visually, but complete pixel parity is not claimed. See `src/recovery-manifest.json` for exact recovery counts and source-map hashes.

No production environment file, database password, backend executable, licence material, application logs, or employee records are copied into the replica.

## Architecture

```text
Browser: original React screens + development banner
  |
  | same-origin /api requests
  v
Vite on 127.0.0.1:5173
  |
  | fixed local proxy
  v
Node simulator on 127.0.0.1:5001
  |
  v
Fictional sample records and local JSON persistence
```

The shared Axios client rejects remote request destinations. A browser content-security policy limits connections to this local application. The simulator contains no SQL client or outbound networking code. Unknown endpoints return an explicit unsupported response instead of a fabricated success.

## Source layout

| Location | Purpose |
| --- | --- |
| `src/App.*` | Existing routes |
| `src/screens/` | Recovered screens plus local development and compliance workflows |
| `src/components/` | Shared UI |
| `src/api/` | Local-only HTTP client |
| `src/utils/exportWorkbook.js` | Explicit-column XLSX exports with local-data notice, filters and generation metadata |
| `src/features/` and `src/store/` | Recovered session/state logic |
| `server/` | Synthetic data, menu configuration, persistence and API registration |
| `server/modules/attendance.mjs` | Validated attendance inputs, approvals, reports and local processing jobs |
| `server/modules/payroll.mjs` | Wage inputs, locks, state-profile drafts and blocked calculation contracts |
| `server/modules/payroll-rules.mjs` | Blank central/state/company rule schema and readiness checks |
| `server/modules/administration.mjs` | Local accounts, role/scope checks, recovery and audit |
| `server/modules/workspace.mjs` | Feature inventory, workbook import validation, accounting inputs and compliance working data |
| `server/contracts.json` | Endpoint inventory derived from recovered source |
| `scripts/dev.mjs` | Combined local launcher and shutdown handling |
| `scripts/check-isolation.mjs` | Isolation validation |
| `tools/recover-frontend.py` | Source recovery provenance/tooling |

## Coverage boundaries

The frontend preserves the available application routes. Local API support is intentionally separate from frontend recovery: an available screen does not prove that its original production calculations have been reproduced. Inspect `/api/dev/capabilities` for simulator coverage and `server/contracts.json` for the recovered endpoint inventory.

Demo sessions remain valid for the lifetime of the API process. If it restarts, a rejected authenticated request returns the browser to demo sign-in. Contractor creation does not replace the saved demo login.

Worker and contractor records, reference data, wage inputs, attendance, leave reports, account management and approvals use fictional fixtures and local persistence. Validated batch imports reject erroneous workbooks before committing records. Wage locks prevent affected input changes. Local passwords are hashed; menu, write-activity and worker-scope checks support development of local account workflows. These controls are not a production security certification.

Attendance processing accepts locally supplied punch data and records first/last punches, elapsed time and job history. Approval controls whether a regularisation affects local reports. Elapsed time does not establish paid hours, a presence mark, overtime or BFCL attendance credit. Sandwich patterns can be maintained as drafts; applying company policy remains blocked pending verified BFCL rules.

The two original leave export placeholders now generate real XLSX downloads from displayed results. Saved Leave Ledger exports cover all matching pages and reject unsaved changes. Payroll Leave Posting exports are previews with the selected period, contractor and preview timestamp; exporting does not post leave or calculate payroll.

The six compliance menu entries now lead to working-data previews with selectable fields, XLSX export and user-invoked browser printing. Missing required rules and formats remain visible. A wage-slip working-data preview contains no wage values until genuine calculated local payroll outputs exist. Working-data availability does not establish the applicability or completeness of a statutory form.

Do not treat demo wage, leave, attendance, tax, PF, ESI, bonus, manpower, or statutory values as verified business or legal outputs. The backend procedures and rules have not been recovered or validated.

## State profiles and BFCL rule intake

`/development/features` shows local feature coverage, pending BFCL requirements and external integration boundaries. The selected initial profile is Jharkhand; further state profiles can be created without inheriting assumed rates or company rules.

Each profile holds separate `rules.central`, `rules.state` and `rules.company` sections. Metadata includes `effectiveFrom`, `effectiveTo`, `sourceRef`, `verificationStatus`, version and history. Draft rule fields deliberately start empty. Draft edits support version-conflict checks and preserve earlier versions. The intake accepts unverified policy text; it does not execute formulas supplied as text.

Useful API contracts:

| Contract | Purpose |
| --- | --- |
| `GET /api/dev/features` | Feature status, local scope and pending requirements |
| `GET /api/compliance/profiles` | State-profile inventory and active profile |
| `POST /api/compliance/profiles` | Create a blank state draft |
| `PUT /api/compliance/profiles/active` | Select a profile |
| `GET /api/payroll/rules` / `PUT /api/payroll/rules` | Read / save the selected draft with version checks |
| `GET /api/payroll/readiness` | Missing fields and explicit calculation-disabled status |
| `GET /api/compliance/report` | Working data, explicit columns, format status and missing requirements |

Profiles remain `DRAFT`; entering every field still does not approve a profile or enable payroll. Before implementing calculations, obtain BFCL source rules, applicable central/state provisions, effective dates, approved formats and expected-result examples. Then implement the supplied behavior and test it against those examples. No statutory rate, wage divisor, allowance formula or overtime multiplier is inferred.

Payment statements, PF/ESI/professional-tax/bonus calculations, calculated payroll leave posting and approved statutory layouts depend on that work. Device and operating-system integrations need an explicit separate test interface. Password recovery currently uses a local administrator outbox; external token delivery is not connected.

## Workbook imports and administration tools

`/development/import/employees`, `/development/import/contractors` and `/development/import/punches` provide templates and local import workflows. Validate before committing. Worker and contractor imports support explicit create/upsert intent and return row errors; invalid batches do not partially import. Other recovered upload screens use their matching local contracts for muster, wage-component and employee-inactivation data.

`/development/approvals` reviews employee requests. `/development/jobs` lists local attendance jobs. `/development/accounting` summarizes recorded wage adjustments only. `/development/audit` and `/development/outbox` provide administrator views of local audit events and recovery tokens. A token is local, expires and can be used only once. No external message delivery is implied.

## Adding a module

Create a screen under `src/screens/`, add its route in `src/App.*`, then add a menu row in the simulator's menu data. Use the existing shared API client for `/api/...` calls. Define the request/response contract before implementing a handler. Add a test that exercises the feature's meaningful behavior, including an error case; do not test only a hard-coded rendering detail.

## Resetting demo data

The authenticated local `POST /api/dev/reset` operation restores fictional fixtures and revokes local sessions. Keep any rule drafts and test changes needed for feature work before resetting. If resetting manually, stop both local servers first and remove only the `.local-demo/` directory inside this replica. Restarting recreates the sample state. Automated persistence tests use temporary directories instead of resetting the running workspace.

## Future backend integration

Keep this sandbox isolated. A future integration should add an explicit test adapter and separate test configuration, with a non-production database and verified API contracts. The replica currently has no production connection switch.

## Dependency maintenance

Dependencies were reconstructed from imports rather than an original lockfile. PDF and routing libraries were updated after an npm audit. SheetJS is vendored as the official `xlsx-0.20.3.tgz` distribution because the public npm package is outdated; see the [official installation guidance](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). The tarball is a build dependency, not an external browser script. The lockfile records its integrity. ExcelJS uses a compatible patched UUID dependency override.
