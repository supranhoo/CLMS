# CLMS development replica

An editable, local development copy of the BFCL CLMS frontend recovered from the source maps shipped with the current application build. Its original screens and styling are retained so that new features can be developed against a familiar interface.

**This is a development sandbox with fictional data.** It does not connect to the live CLMS server, SQL Server, biometric devices, payroll, email, or any external service. Local workflows are editable and persistent. BFCL payroll calculations and approved statutory formats await the rules and source documents you will provide.

## Start on this computer

Double-click `Start-Replica.cmd`, then open <http://127.0.0.1:5173>.

Or run in PowerShell:

```powershell
cd D:\CLMS\replica
npm.cmd ci
npm.cmd run dev
```

Use the demo sign-in button, or user ID **demo** and password **demo123**. These are public sample credentials for the simulator, not live CLMS credentials. Press Ctrl+C in the terminal to stop the local servers.

The UI listens on `127.0.0.1:5173`; its `/api` requests are proxied only to the mock API at `127.0.0.1:5001`. The launcher refuses to reuse occupied ports. Node.js 22.12 or later is recommended.

## Available local workflows

| Area | Available now |
| --- | --- |
| Records and imports | Worker and contractor maintenance, employee change approvals, XLSX templates, validation previews and atomic local imports |
| Attendance | Manual muster, punch imports, regularisation approval, date-specific department changes, effective shift allocations, manpower comparisons and recorded-data reports |
| Local punch processing | Summarize imported first/last punches and review job history; paid attendance and overtime interpretation remain dependent on BFCL rules |
| Wage inputs | Fixed wages, earnings, deductions, arrears, component uploads, service-charge inputs, process months and period locks |
| Leave exports | Working XLSX downloads for the saved Leave Ledger and Payroll Leave Posting preview, with explicit columns and filter metadata |
| Compliance working data | Six Form XII/XIII/XIX/XVI/XVIII/XXIII source-data previews, field selection, XLSX export and browser print / Save PDF; these are not approved statutory formats |
| Administration | Local accounts, hashed passwords, menu/activity and worker-scope assignments, employee request review, audit trail and administrator recovery outbox |
| Accounting | Summaries of recorded earnings, deductions and arrears inputs; no gross wages, net pay or statutory dues are inferred |

Open the [feature workbench](http://127.0.0.1:5173/development/features) for current coverage and BFCL rule intake. The initial selected state profile is **Jharkhand**. Additional state profiles preserve separate **central**, **state** and **BFCL company** sections, effective dates, source references, draft versions and history.

All state profiles remain **DRAFT**. Enter only supplied rules, leaving unknown values blank. Saving a draft does not verify its legal applicability or enable wage calculation. BFCL payroll, payment statements, calculated payroll leave posting, sandwich interpretation and certified statutory layouts remain pending verified rules and implementation.

Workbook imports use fictional test rows only. Download the relevant template, validate the workbook, inspect any row errors, then save. Recovery tokens appear only in the local administrator outbox; no email or WhatsApp message is sent.

## Work on a feature

1. Find the existing screen in `src/screens/` or component in `src/components/`.
2. Edit the React source; Vite refreshes the local browser as you save.
3. Add or change a local API handler in `server/` when the feature needs data. Keep sample records fictional.
4. Run `npm.cmd test`, `npm.cmd run check`, and `npm.cmd run build`.
5. Review the local UI. Production integration is separate work and requires the actual backend source, a dedicated test database, and validation of the business rules.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the architecture, recovery provenance, coverage boundaries, and extension guidance.

The [whole-app UI redesign plan](docs/ui-redesign/UI_REDESIGN_PLAN.md) defines the selected Modern BFCL direction, complete route coverage, delivery waves and acceptance checks. Its visual proposal is a planning artifact; the application has not yet been migrated to that design.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start both local UI and local API |
| `npm.cmd run dev:ui` | Start only the UI |
| `npm.cmd run dev:api` | Start only the local API |
| `npm.cmd test` | Run local workflow, export, API and isolation tests |
| `npm.cmd run check` | Check application files for remote URLs and copied production configuration |
| `npm.cmd run build` | Build the editable frontend into `dist/` |

The `.local-demo/` directory contains only local sample state and is excluded from version control. Original deployment files outside this replica directory are not edited.

Current automated verification: **56 tests pass**, the isolation check passes, and the frontend build succeeds. See [VERIFICATION.md](VERIFICATION.md) for the distinction between automated checks, earlier browser checks and current release browser QA.
