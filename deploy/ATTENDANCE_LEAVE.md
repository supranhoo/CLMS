# SQL attendance and leave inputs

Delivered 17 October 2026 as part of the standalone server adapter. This is recorded-input processing, not a paid-attendance or payroll policy engine. Use a separate staging database and complete operator UAT before operational use.

## Upgrade and access

Back up the dedicated database. Stop API writers, apply migrations through `scripts/database.mjs migrate` with the migration identity, verify with the runtime identity, and start the new API/web images. Both 001 and 002 checksums are verified at startup. Follow `SERVER_RUNBOOK.md` for secrets, HTTPS and bootstrap. Existing demo JSON is never migrated or read by the server.

Administrators have access; operators need explicit attendance/leave read, write and separate approve assignments. Review requires read plus approve. Auditors remain read-only. Worker access requires all assigned scope dimensions. The maker cannot approve, reject or cancel their own request. Permission changes revoke sessions; background jobs also recheck the current owner's permissions before publishing results.

## Attendance workflow

1. Configure core worker records and access scopes first.
2. At `/server/attendance`, import CSV/XLSX columns `employee_code`, `business_date`, `punched_at`. Dates are YYYY-MM-DD; timestamps are ISO text with seconds and an explicit offset, such as `2026-10-05T22:00:00+05:30`. The business date is an explicit source input for overnight work. Keep spreadsheet timestamp cells as text.
3. Preview the selected file and submit 1–1000 rows. Import is atomic. Reusing an unchanged batch reference is idempotent; changed payloads with the same reference are rejected. Existing worker/timestamp instants are deduplicated; conflicting business dates are rejected. Punches are immutable.
4. Queue processing for explicit comma-separated worker codes (maximum 200) and a date range of at most 93 days. The API worker processes the durable SQL queue. Refresh the report after COMPLETE.
5. Processing records first/last timestamps, punch count and elapsed seconds. One punch has no elapsed duration. Elapsed time includes intervening gaps and is not paid hours or OT. Missing days imply no presence/absence result.
6. Manual marks P/AB/WO/HLD/OD and optional complete first/last pairs are declarations submitted for independent review. Only APPROVED requests update the recorded mark. All changes are audited and version checked.

The worker claims one job at a time per process, with a five-minute lease. An expired lease can be reclaimed after a restart; the old lease cannot publish. Publication is transactional. Failed jobs show a failure code, including changed access and period locks. Correct the cause and queue a new job; there is no automatic retry of failed jobs, cancellation UI, device collector or external scheduler.

## Leave workflow

CL/EL/SL are editable starting labels, with zero entitlement credits. Administrators configure active types, minimum unit step (0.25, 0.5 or 1) and whether negative recorded balances are allowed. These settings do not establish statutory applicability.

Administrators record externally approved opening balances/credits with a unique source reference, effective date, units and source reason. Repeating the same credit is idempotent; conflicting reuse is rejected. There is no automatic accrual, carry-forward, expiry or credit reversal UI.

Operators submit explicit charged dates/units and source reasons. The screen currently handles one date per request; the API supports an explicit multi-day array. It never infers weekends, holidays, sandwich days or eligibility. A separate reviewer approves/rejects the request. Approval appends debits atomically and checks overlaps across types (at most one total approved unit per date), configured unit steps and running balances. Backdated requests cannot create an impermissible later deficit. Concurrent approvals cannot spend the same balance twice. Cancellation by an independent reviewer appends linked reversal entries; original debits remain in the ledger. Pending requests do not reserve balance.

Balances are calculated as of the requested date from ledger entries. They are recorded balances, not certified entitlement or payroll leave posting. Reports and requests are paged; report filters do not filter the separate request list. Full exports are not delivered in this phase.

## Locks and historical scope

Administrators lock/unlock attendance or leave by contractor and calendar month, with a reason and optimistic version. Locks block affected writes, including job publication. A later locked leave month also blocks backdated changes that would alter its running balance. Unlock is explicit and audited.

Changing contractor, department, business unit or location for a worker with operational history is blocked. A reviewed effective-dated transfer workflow is still required; historical rows are never silently reassigned.

## API contracts

All endpoints are same-origin and require server sessions; mutations require CSRF/Origin validation.

| Path under `/api/server` | Methods / purpose |
| --- | --- |
| `/attendance/punches` | POST atomic punch import |
| `/attendance/jobs` | POST queue; GET owner jobs (administrators see all) |
| `/attendance/report` | GET scoped recorded summary/approved marks |
| `/attendance/requests` | POST declaration; GET scoped requests |
| `/attendance/requests/:id/review` | POST versioned review |
| `/leave/types` | GET settings; PUT administrator save |
| `/leave/credits` | POST administrator source credit |
| `/leave/balances` | GET worker balance as of date |
| `/leave/ledger` | GET scoped ledger |
| `/leave/requests` | POST explicit charged dates; GET scoped requests |
| `/leave/requests/:id/review` | POST versioned approval/rejection/cancellation |
| `/period-locks` | GET/PUT administrator locks |

Real SQL tests cover transactions, concurrency, leases, scope changes, locks, idempotency, overlaps, reversals and backdated balance invariants. `npm run qa:operations` runs these tests and offers a disposable fictional browser fixture through an HTTP test proxy. It never verifies actual TLS, production cookie transport, least-privilege grants or deployment readiness. Stop it using the generated stop endpoint printed by the helper so its labelled test container is removed.

Still pending: approved shift/attendance and leave policies, state/company effective-date rules, payroll, statutory reports, live-data migration, backup/restore automation, realistic-volume/security assessment and target-server HTTPS UAT. Remaining UI waves W2–W6 stay pending.
