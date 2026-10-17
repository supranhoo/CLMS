# CLMS server implementation plan

Prepared: 17 October 2026. Status: proposed implementation plan, not a deployed release.

Implementation update (17 October 2026): approved. The repository now contains the first standalone SQL adapter, core migrations, account/session lifecycle, scoped and paged core records, runtime-aware UI and deployment runbook. Real SQL repository tests and an API/Nginx/SQL container smoke test pass. This advances P1/P2 but does not complete them: full domain validation, target infrastructure, HTTPS browser UAT and staging acceptance are still required. P3–P7 and remaining UI waves remain pending. See `deploy/SERVER_RUNBOOK.md` and `VERIFICATION.md` for exact scope and evidence; this is not a production deployment claim.

## 1. Intended outcome and agreed direction

Convert the recovered CLMS frontend and local workflows into a persistent, authenticated application suitable for use on a Windows-hosted server. Deploy a separate staging installation before production. Retain the Modern BFCL workspace and existing screen destinations while replacing simulator-only behavior with tested business operations.

User direction: Windows and Docker; configurable backend and hosting; database consistent with the actual application; authentication and permissions required; detailed planning before implementation; state-wise configurable rules with editable starting defaults.

This plan interprets “authentication: yes” as a requirement for secure user accounts and role/scope control. It does not assume Active Directory, SSO or a specific identity provider has already been selected.

## 2. Verified starting point

The repository currently contains a recovered React application, a Node synthetic API, endpoint inventory, fictional fixtures, local JSON persistence, and automated contracts. Existing modules cover workers, contractors, reference data, input imports, attendance processing, approvals, leave, wage inputs, local accounts and report previews.

The current code is not an implementation of the installed application's SQL backend. Original backend source, database schema, stored procedures and expected-result payroll examples are absent from the replica. A packaged executable in the parent installation does not supply a maintainable backend implementation. Parent installation files, credentials and live records are outside this plan's inspection and migration scope unless separately authorized.

Concrete conversion work includes replacing JSON persistence and process-local sessions; removing automatic demo-account creation in server mode; replacing simulator authorization shortcuts; making jobs durable; implementing approved calculations; and introducing deployment, backup and recovery procedures. Existing password hashing and local authorization checks are useful starting points, not proof of production readiness.

Reference files: `DEVELOPMENT.md`, `VERIFICATION.md`, `server/contracts.json`, `server/index.mjs`, `server/modules/administration.mjs`, `server/modules/payroll-rules.mjs`, and `src/api/axios.js`.

## 3. Recommended deployment architecture

Preferred arrangement:

```text
Users on LAN/VPN or an explicitly enabled internet endpoint
  -> configurable DNS name and HTTPS reverse proxy
  -> web service: compiled React assets and same-origin /api routing
  -> application API + durable background worker
  -> SQL database + persistent document/import storage
  -> separate backup destination and monitoring

Windows Server
  -> Hyper-V Linux VM
     -> Docker Engine + Compose services for web, API and worker
  -> existing or separately provisioned SQL Server, if selected
```

The VM is the recommended way to run the proposed Linux images on Windows infrastructure. Docker Desktop is not the proposed Windows Server runtime. If policy requires native Windows containers, use compatible Windows base images and a supported runtime; validate host/image compatibility and replace the Linux reverse-proxy image accordingly before packaging. Do not assume one Compose file or Dockerfile works unchanged across both operating systems.

SQL Server is the provisional database choice because existing project documentation identifies SQL Server as the original integration context. Version, edition, licence, schema and connection method remain unverified. Prefer an existing supported SQL Server service or a separate managed installation for the initial deployment. A database container is optional and needs its own storage, support and recovery decision.

Publish only the HTTPS entry point. Keep API, worker and database ports private. The browser continues using relative `/api` URLs; backend addresses and database credentials stay on the server. Same-origin routing avoids requiring every browser to know a backend host.

Start with one API instance and one worker; do not promise high availability. Persist sessions, jobs and idempotency records so restart does not lose work. Add replicas only after concurrency and shared-state tests pass.

## 4. Application modes and configuration

Create explicit `demo`, `staging` and `production` modes. Preserve the existing loopback demo command and fictional state. Server modes use separate databases and storage; never auto-import `.local-demo` or fall back to demo data after a connection failure.

| Setting group | Proposed configurable values | Management |
| --- | --- | --- |
| Environment | Mode, instance label, canonical origin, allowed proxy, internal port | Deployment configuration; restart |
| Backend | Standalone API or approved original-backend adapter, URL, timeouts, API version | Restricted deployment configuration |
| Database | SQL Server host, port/instance, database, encryption, certificate trust, pool and timeout | Deployment configuration; credentials as secrets |
| Hosting | Domain, HTTPS certificate source, LAN/VPN/public exposure, proxy configuration | Server administrator |
| Organisation | Company/site names, states, timezone, fiscal period and numbering conventions | Versioned administrator settings |
| Access | Roles, module activities, company/site/contractor scopes, identity provider | Authorised administrator; audit changes |
| Documents | Storage path, retention, file size/type rules | Restricted administrator settings |
| Notifications | SMTP/approved provider, sender, templates, enablement | Secrets plus administrator settings |
| Rules | State, establishment/category, effective dates, calculation rules and approved formats | Draft/review/publish workflow |
| Operations | Backup schedules, retention, log retention and alert destinations | Server administrator |

Backend choice is explicit per deployment, not a per-screen switch. An adapter must pass the same application contracts and prevent writes to two backends for one operation. Validate destinations against an administrator-controlled allowlist; ordinary users cannot supply proxy targets. Do not build arbitrary database-engine switching: each additional engine needs its own adapter, migrations and integration tests.

Proposed non-secret variables include `APP_MODE`, `PUBLIC_ORIGIN`, `API_ADAPTER`, `SQL_SERVER`, `SQL_DATABASE`, `STORAGE_PATH`, `TZ` and `LOG_LEVEL`. Proposed secret files include database password, session signing/encryption material, bootstrap credentials and SMTP credentials. Never put secrets in Vite variables, committed `.env` files, images or browser configuration. Compose secret files require restricted host permissions and a separate rotation procedure; they are not an encrypted secret vault by themselves.

Configuration has a validated schema. Missing required production settings fail startup with a useful diagnostic. UI-visible settings expose only non-sensitive values. Audit changes and show whether a restart is required. Changing domain updates secure cookies, redirects and trusted-origin settings as one operation.

## 5. Database and API implementation

### Establish the actual data model

First map recovered contracts and screen fields to domain entities. Request a redacted schema/data dictionary and procedure inventory from the original application owner. Verify SQL Server version, keys, relationships and business semantics through an approved staging source. Do not infer schema parity from frontend field names.

If the original schema is supplied, design a compatible adapter and migration mapping. If it is unavailable, create a new documented SQL Server schema for this application and treat old-data migration as a separate deliverable. New installation can proceed without claiming drop-in compatibility with the old database. Existing database access is disabled until explicitly configured and tested.

### Required persistent entities

- Companies, sites, states, contractors, departments, designations and other masters.
- Workers, effective-dated assignments, status changes, documents and approval requests.
- Users, password hashes/identity links, sessions, roles, scoped permissions and recovery tokens.
- Raw punch batches, deduplication keys, processing jobs, shift assignments and derived attendance.
- Leave types, applications, approvals, opening balances and immutable ledger movements.
- Wage inputs, component definitions, adjustments, payroll periods/runs, employee results, deductions, approvals, locks, reversals and payment exports.
- Rule-profile versions, source references, applicability, approvals, report templates and generated-file metadata.
- Audit events, import batches, notification outbox, delivery attempts and application settings.

Use typed columns and foreign keys for business records. Store monetary values with decimal precision, dates separately from timestamps, UTC event timestamps plus explicit business timezone, unique identifiers and optimistic concurrency versions. Preserve source import metadata without duplicating sensitive contents in logs.

Keep existing routes and request/response contracts where possible. Introduce a service/repository layer so route handlers no longer mutate a shared JSON object. Add transactions for imports, approvals, payroll finalisation and leave postings. Enforce validation and scope checks before reads or writes. Add paging, indexes and bounded exports. Provide consistent error codes with correlation IDs.

Migrations are ordered and versioned. Back up before deployment; run migrations as a controlled release job using a different database identity from the runtime account. No automatic destructive schema synchronisation at application startup.

## 6. Authentication, permissions and audit

Default to administrator-provisioned accounts with modern password hashing, configurable password policy, login throttling, inactivity timeout and revocable server-side sessions. Use secure HttpOnly SameSite cookies for the new server API, CSRF protection on cookie-authenticated writes, and TLS. Adapt recovered Redux state to keep identity and display information while removing persisted bearer secrets. Test refresh, expiry, logout, password change and account disablement.

Offer a later configured OIDC/Active Directory integration through an identity adapter; do not claim it is present today. Define the provider and MFA responsibility before enabling SSO. Public registration defaults to disabled. Recovery requires a configured delivery channel or an audited administrator reset; production must not expose reset tokens through a demo outbox.

Create the first administrator using a one-time, expiring bootstrap secret and force password replacement. Disable the bootstrap path afterwards. No `demo/demo123`, employee-code bypass or hidden fallback administrator in server modes.

Starting role templates: System Administrator, HR Administrator, Attendance Operator, Payroll Preparer, Payroll Approver, Contractor Operator and Read-only Auditor. Treat templates as editable proposals. Separate preparation from approval, disallow self-approval by default, and enforce company/site/contractor scope server-side for details, lists, searches, imports and exports. Menu filtering alone is insufficient authorization.

Audit actor, action, record reference, time, relevant version, reason and redacted before/after changes. Protect audit writes and prevent ordinary administrators from editing history. Never log passwords, reset tokens, full sensitive documents or connection strings. Audit retention and external archival remain configurable.

## 7. Functional module completion

| Module | Server implementation | Acceptance evidence |
| --- | --- | --- |
| Masters/workers/contractors | Database CRUD, validations, effective status, references and scoped search | Save/restart/reload, rejected duplicates, denied cross-scope access |
| Imports/documents | Staged validation, transaction/idempotency, controlled storage, file checks and download authorization | Invalid batch preserves data; retry creates no duplicates |
| Attendance | Durable punch ingestion, shifts, overnight spans, exceptions, approved regularisation and period control | Expected-result examples, retries and worker restart recovery |
| Leave | Approved policy engine, allocation, accrual/carry-forward, ledger, balances and encashment inputs | Reconciled ledger and concurrent approval tests |
| Payroll | Rule-based gross-to-net, approved paid attendance, deductions, arrears, validation, review, lock and reversal | Signed-off reference cases and no duplicate run/posting |
| Reports/compliance | State/category-aware layouts, effective versions, source traceability and controlled exports | Reconciliation to payroll/attendance; approved format comparison |
| Administration | Account lifecycle, role/scope administration, recovery and audit | Negative authorization and account/session lifecycle tests |
| Integrations | Explicit device/API/file adapters and notification outbox with retries | Sandbox delivery/import evidence and clear failure handling |

Preserve distinctions between elapsed punch time, approved attendance, paid days and payable overtime. No automatic payroll credit from first/last punches without an approved policy. Device integration can initially use validated file imports; live biometric connectivity is a separate adapter requiring the actual device protocol.

Payment files are exports for authorised review; automatic bank transmission is outside the initial release. Accounting initially means reconciled payroll summaries and approved export mappings, not a general-ledger system or an automatic ERP posting.

## 8. Editable defaults and state-wise rules

Supply useful operational defaults immediately and a separate labelled training profile. Numeric payroll examples in a training profile must use fictional employees and cannot be selected for production runs. Legal/company-specific defaults become executable only after applicability, source, effective date and approval have been recorded.

| Initial setting | Proposed editable default | Status |
| --- | --- | --- |
| Business timezone | Asia/Kolkata | Operational proposal |
| Currency and display | INR; two decimal places for display | Operational proposal; calculation rounding configured separately |
| Initial jurisdiction | Jharkhand | Profile-selection default, not applicability approval |
| Pay period | Calendar month | Draft company policy |
| Attendance source | Validated file/manual import | Operational proposal |
| Approvals | Preparer plus different approver; explicit period lock | Operational proposal |
| Public registration / notifications | Disabled until configured | Operational default |
| Session inactivity | 30 minutes; maximum session age 12 hours | Proposed security policy |
| Import limit | 5,000 rows per batch; 10 MB per file | Initial engineering limit; load-test and adjust |
| Backup / retention | Daily full backup; 30-day retention; encrypted separate destination | Initial operating proposal; recovery objectives below |
| Wage divisor, OT, paid-day codes, holiday/leave credit | Unset production values; training examples only | Company rules required |
| Minimum wages, VDA, PT, LWF and state forms | Effective-dated draft templates without assumed statutory amounts | Authoritative applicability/source required |
| PF, ESI, bonus and other central provisions | Separate central profiles linked to applicable establishment/category | Authoritative applicability/source required |

State name alone cannot determine every rule: establishment type, work location, worker category, employment terms, wage definition, eligibility and effective period may change applicability. Keep central, state and company layers separate with explicit, tested precedence. Company overrides cannot silently remove applicable statutory obligations; conflicts require review.

Expand the existing draft profile mechanism to `DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> RETIRED`, with role-controlled transitions, immutable published versions and effective-date overlap checks. Approved changes create a new version. Payroll records pin the exact rule versions, input snapshot and calculation version; later edits never silently recalculate locked periods.

Use a bounded formula/rule vocabulary (components, eligibility predicates, slabs, caps, proration and rounding) with schema validation and a preview calculator. Do not execute administrator-supplied JavaScript, SQL or arbitrary expressions. Start with required payroll rule types, not an unrestricted rule-programming product.

Every rule needs expected-result examples, source reference, review owner and applicability. Missing mandatory rules block the affected run and explain what is missing. Unaffected master-data and input workflows remain usable. Reports remain labelled previews until their required fields and layout are approved. Default templates are not a claim of Jharkhand or other-state compliance.

## 9. Delivery phases and dependencies

Effort below is a planning range in engineer-days, not a delivery promise. It assumes one company/site for the initial pilot, a limited approved payroll policy set, timely SME decisions and no undocumented device/ERP integration. Parallel staffing, broader rules, data quality and legacy-backend access change the calendar schedule.

| Phase | Work and deliverables | Exit condition | Initial effort |
| --- | --- | --- | --- |
| P0: discovery and contracts | Endpoint capability matrix; schema decision; server/runtime inventory; data volumes; rule/format inventory; permission matrix | Written implementation boundaries and selected DB/runtime path | 3–5 days |
| P1: server foundation | Explicit modes; configuration validation; container builds; SQL repository/migrations; health endpoints; secret handling; staging pipeline | Clean staging boot with empty persistent database; demo remains isolated | 5–8 days |
| P2: identity and core records | Persistent sessions/accounts, RBAC/scope, audit, masters, workers, contractors and transactional imports | Core operations survive restart; permission tests pass | 7–12 days |
| P3: attendance and leave | Durable jobs, processing policies, exception/approval flows, leave engine and ledger | Approved attendance/leave examples reconcile | 8–12 days |
| P4: configurable payroll | Profile lifecycle, rule evaluator, pay runs, approval, locks, corrections and exports | Agreed payroll reference cases reconcile to smallest currency unit | 12–20 days |
| P5: reports and integration | Approved first-state forms, payroll reconciliation, controlled file outputs, recovery delivery and required device adapter | Pilot reports signed off; configured adapters pass staging tests | 6–10 days |
| P6: UAT and operations | Migration rehearsal, realistic load/security checks, backup/restore, rollback, admin training and release runbook | UAT and recovery acceptance evidence recorded | 5–8 days |
| P7: controlled go-live | Scheduled cutover, final backup/import/reconciliation, smoke tests and observation | Agreed operational acceptance and support handover | 2–3 days |

Baseline total: 48–78 engineer-days. Re-estimate after P0. Adding other states is incremental analysis, configuration, format work and tests; a state selector does not make a new jurisdiction ready automatically. The remaining UI redesign waves W2–W6 stay separately tracked; include only changes needed to make these functional workflows usable and accessible unless scope is expanded.

## 10. Validation and release gates

1. Preserve meaningful existing contract tests and add SQL integration tests with disposable databases. Existing passing simulator tests do not prove database or live-backend parity.
2. Keep the existing isolation check for demo mode; add separate server-configuration checks. Do not simply disable the check to permit deployment.
3. Test authorization denials across every sensitive route and export; check CSRF, session revocation, import boundaries, concurrency and idempotency.
4. Test calculations against reviewed fixtures: joining/leaving mid-period, month lengths, shifts crossing midnight, absence/leave/holidays, OT eligibility, arrears, caps/slabs, rounding, reversals and locked-period edits. Include invalid/missing-rule cases.
5. Exercise representative flows end to end in staging: worker onboarding through attendance/leave, payroll approval and reconciled reporting. Test desktop and 390px layouts and all permitted menu destinations.
6. Measure realistic worker counts, punch history, concurrent users, imports and exports after P0 supplies volumes. Suggested initial targets: ordinary paged requests p95 under two seconds; long jobs asynchronous with visible progress and cancellation/retry semantics. These are proposed targets, not measured results.
7. Run dependency/security checks, production build, migration and container image scanning; document any accepted findings.
8. Restore backups into a separate instance and verify totals, permissions and files. Test container restart, host reboot, failed database connection, interrupted worker and duplicate submission.
9. Release gates: no demo credentials/fixtures/reset API in production; required settings valid; TLS and scopes verified; approved rules for enabled payroll; reconciled migration; tested recovery; UAT evidence. Disabled integrations clearly show their status.

## 11. Packaging, backup and operating procedures

Planned repository deliverables: `deploy/` Dockerfiles and environment-specific Compose files; non-secret configuration examples; restricted bootstrap utility; SQL migrations; production startup command; health/readiness endpoints; Windows/VM installation runbook; backup/restore scripts; deployment/rollback checklist; user/administrator guide; and traceable test evidence.

Build immutable, versioned images in CI, tag with commit/release, record image digests and deploy the same images through staging to production. Production serves compiled assets, not the Vite development server. Avoid source bind mounts. Run services with minimum privileges, health checks, resource limits, rotated logs and controlled restart policies.

Back up the database and generated/source files consistently; a Docker volume is not a backup. Keep encrypted copies off the application host with restricted access. Proposed pilot recovery targets: recovery point within 24 hours and restore within four hours, conditional on a demonstrated restore. A shorter recovery-point requirement needs more frequent backups or SQL log backups under an appropriate recovery model. Verify restore tests periodically and alert on backup failure.

Monitor health, readiness, failed logins, API errors/latency, worker failures, queue age, storage, database connectivity and backup age. Readiness fails when required dependencies are unavailable. Detailed health and operational endpoints require internal access. Define alert recipients and support owner during deployment.

## 12. Migration, cutover and rollback

Use an approved export or explicitly authorised read-only staging source, never credentials committed from the installed folder. Validate identifiers, duplicate workers, assignments, opening leave balances, approved payroll history and period locks. Preserve historical calculated results as historical records; do not recalculate them using current defaults.

Rehearse migration into staging and reconcile entity counts, opening balances and selected pay-period totals. Record rejected rows and remediate them. Final cutover has a bounded write-freeze, final export/import, reconciliation and smoke test. Start operational master/input workflows first; run payroll in parallel with the accepted process for at least one full cycle before relying on it for payment.

Rollback uses a known previous image and a verified compatible database state. Never downgrade a schema blindly. If rollback requires restoring a backup, record and reconcile post-backup transactions and file changes first; avoid silent loss of committed records. Keep the original installation separate until the new system's acceptance and retention decisions are complete.

## 13. Decisions to resolve during discovery, not prerequisites for writing code

- Exact Windows edition/version, Hyper-V availability, runtime policy, VM resources and administrators.
- SQL Server version/edition, original schema availability, database access method and licence owner.
- Standalone replacement backend versus supported original API adapter; if an API is used, its documentation and test credentials.
- Expected workers, sites, concurrent users, punch volume, historical years and storage volume.
- Initial user/scope matrix, account provider and any MFA requirement.
- DNS/HTTPS owner, network exposure and backup destination; addresses remain configurable until deployment.
- Payroll and statutory review owners, first-period expected results and approved report formats.
- Required first-release integrations, recovery objectives, maintenance window and support owner.

Proceed with the recommended design until discovery provides contrary evidence. These are deployment and business inputs, not reasons to require all seven details again before starting P0. No server access, schema compatibility, actual deployment or compliance certification has been established by this document.

## 14. Platform references

Reviewed official platform guidance for the architecture decision:

- Microsoft: [Windows container/runtime support policy](https://learn.microsoft.com/en-us/troubleshoot/windows-server/containers/support-for-windows-containers-docker-on-premises-scenarios).
- Microsoft: [Prepare the Windows container environment](https://learn.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment).
- Docker: [Use Compose in production](https://docs.docker.com/compose/how-tos/production/).
- Docker: [Compose secrets](https://docs.docker.com/reference/compose-file/secrets/).

These sources guide deployment choices. They do not establish BFCL business rules, database compatibility or statutory rates.
