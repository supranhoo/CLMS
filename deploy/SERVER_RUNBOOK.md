# SQL server core: deployment and verification

Status: first database-backed release, not a full payroll/attendance replacement. Use a separate staging installation first. Never point these new migrations at the installed application's database.

## Implemented scope

- Explicit SQL adapter for staging/production, with no demo-data fallback.
- Versioned/checksummed SQL migrations, schema verification and dedicated-database enforcement.
- One-time command-line administrator bootstrap, forced initial password replacement, administrator-created accounts, audited temporary-password resets, account disablement and final-administrator protection.
- Salted asynchronous scrypt password hashes; only hashed random session tokens in SQL. Secure HttpOnly SameSite cookies, origin/host validation, CSRF tokens, configurable idle and absolute expiry, durable login lockout and bounded in-process login throttling.
- SQL worker/contractor records, core entity/department/reference masters, optimistic versions, transactional audit and server-side read/write/scope enforcement.
- Server-specific core record/account screens; runtime environment labelling; demo login is hidden outside demo mode. Legacy routes remain present, but unsupported SQL operations return explicit 501 responses.

Not implemented here: original-backend adapter, original SQL schema compatibility, migration of live records, complete worker details/onboarding approvals, payroll/rule execution, attendance/leave engines, background jobs, statutory forms, SSO/MFA, external recovery delivery, backup automation, or a full production security/load assessment. Existing synthetic workflows remain in demo mode only.

The SQL payload column preserves additional recovered form fields alongside typed identifiers, names and scope columns. This is a transitional core schema, not a claim that the original application schema was recovered. Worker/contractor lists support scoped server-side search and paging (default 200, maximum 500 per API request; the UI uses 100). Full exports remain explicitly unavailable rather than exporting only one page. Full input-field validation and realistic-volume testing must precede a large-data rollout.

## 1. Provision a separate database

Use a supported SQL Server with TCP access from the application container and a dedicated empty CLMS database at compatibility level 130 or newer (OPENJSON is used for scope filters). Back up any existing target before migrations. Use separate runtime and migration identities. System databases are rejected.

Runtime permissions: SELECT/INSERT/UPDATE on the required `dbo.clms_*` application tables; DELETE on sessions and editable master rows. Grant INSERT/SELECT on `clms_audit` but no UPDATE/DELETE. Grant SELECT on `clms_migrations`, not schema changes. Migration identity requires appropriate DDL permissions. Bootstrap/account management uses application write permissions; the runtime login must not be `sa` or `db_owner`.

Production enforces database encryption and trusted certificates. Self-signed SQL certificates can be explicitly accepted only in staging with `CLMS_SQL_TRUST_CERTIFICATE=true`. This switch is rejected in production.

## 2. Prepare configuration and secrets

Copy `deploy/server.env.example` to a restricted `.env.server` outside source control and set `PUBLIC_ORIGIN` to the exact HTTPS origin, including a non-standard port if used. No path, credentials or trailing slash. Set a DNS name resolving to the intended server and arrange TLS termination before enabling browser access.

Create a restricted connection-string secret file through your server's secret-management procedure. Its contents use the SQL driver's connection-string format:

```text
Server=YOUR_SQL_HOST,1433;Database=YOUR_NEW_CLMS_DATABASE;User Id=YOUR_ACCOUNT;Password=YOUR_SECRET;Encrypt=true;TrustServerCertificate=false
```

Do not use the former `sqlserver://` placeholder; it was not the driver's connection-string format. Protect special characters according to node-mssql connection-string syntax. SQL host names, passwords and certificates must come from your server administrator, not the installed CLMS configuration.

For Docker Compose, supply these non-secret host environment variables:

```text
CLMS_SERVER_ENV_FILE=/secure/clms/server.env
CLMS_SQL_SECRET_FILE=/secure/clms/runtime-connection.secret
CLMS_HTTP_BIND=127.0.0.1
CLMS_HTTP_PORT=8080
```

Secret files are mounted read-only at `/run/secrets/clms_sql`. They must be readable by the API container's non-root node user (UID 1000) while remaining restricted on the host. Compose file secrets are bind-mounted files, not a secret vault. Do not assume the mount changes host permissions. Rotate credentials and recreate the service after rotation. `.dockerignore` excludes local environment/secret files from image contexts.

## 3. Build, migrate and bootstrap

Commands below run from the repository on the Docker Engine host. On Windows-hosted Linux containers, run Compose inside the provisioned Linux VM. The Windows host itself still needs its firewall, DNS, VM and service-restart configuration.

For staging, use `docker compose -p clms-staging -f compose.production.yml -f compose.staging.yml` in place of the production Compose prefix below, with a separate staging database, connection secret, environment file, HTTPS origin and host port. Never reuse the production project, database or secret files for staging.

```sh
docker compose -f compose.production.yml build
```

Temporarily set `CLMS_SQL_SECRET_FILE` to the migration connection-string file, then run:

```sh
docker compose -f compose.production.yml run --rm --no-deps api node scripts/database.mjs migrate
```

Restore the runtime connection-string file and verify the schema:

```sh
docker compose -f compose.production.yml run --rm --no-deps api node scripts/database.mjs verify
```

Create the first administrator with a restricted temporary password file (12–128 characters with letters and numbers). Choose a one-time UTC expiry within the next hour, and pass the following values using your deployment environment. Values shown below are placeholders, not working credentials:

```sh
docker compose -f compose.production.yml run --rm --no-deps \
  -v /secure/clms/bootstrap-password.secret:/run/secrets/bootstrap_password:ro \
  -e CLMS_BOOTSTRAP_USER=YOUR_ADMIN_ID \
  -e CLMS_BOOTSTRAP_NAME='YOUR_ADMIN_NAME' \
  -e CLMS_BOOTSTRAP_EXPIRES_AT=YOUR_FUTURE_UTC_TIMESTAMP \
  -e CLMS_BOOTSTRAP_PASSWORD_FILE=/run/secrets/bootstrap_password \
  api node scripts/database.mjs bootstrap
```

Bootstrap runs only while the accounts table is empty, checked under a transaction lock. The password file's trailing line ending is removed; its password is not logged. Remove the bootstrap secret from the host's active deployment inputs after successful use through your secret-management procedure. First sign-in requires a password change, which revokes that session; sign in again afterwards. Create a second authorised administrator before relying on account recovery. There is no public reset-token outbox in server mode.

The migration/bootstrap command logs a redacted failure summary; detailed database diagnosis belongs with the DBA. Avoid printing environment variables or secret contents while troubleshooting.

## 4. Start behind HTTPS

```sh
docker compose -f compose.production.yml up -d
docker compose -f compose.production.yml ps
```

The web container's HTTP listener is an internal reverse-proxy backend, not the final user-facing origin. Terminate TLS at an approved proxy (for example IIS on Windows or a proxy in the Linux VM) and forward the original Host and Origin. Proxy `/api` and the frontend through the same hostname. The API validates Host against `PUBLIC_ORIGIN` and all writes against its exact Origin; it never trusts caller-provided forwarded headers for authorization.

The default web port binds to loopback on the Docker host. If a Windows proxy outside the Linux VM must reach it, explicitly bind to the VM's private interface and restrict access to that proxy with firewall rules. Do not publish SQL or the API container port. TLS/certificate provisioning is an actual deployment input and is not automatically provided by this Compose file.

`/api/health/live` checks the API process; `/api/health/ready` checks SQL access. These endpoints return only an `ok` status. The API image health check uses readiness. Inspect container status; never use the Vite development server as a production web server. Pin tested image digests in the release process before production promotion.

## 5. Configure records and access

Use the SQL dashboard menus for server accounts, contractors, workers and available masters. Start with entities, departments, business units and locations, then contractors and workers. Operators need explicit read/write modules; auditors cannot write even if a write selection is mistakenly saved. Master changes require an administrator.

Contractor scopes match contractor IDs. Worker scope requires all four dimensions to match: contractor, department, business unit and location. Empty lists grant no access; they never mean all records. Admins have full core access. Account changes revoke all that account's sessions. Record/account versions prevent stale saves; reload after a conflict. Missing-contractor worker writes fail atomically.

Administrator temporary-password reset revokes sessions, clears lockout and requires the recipient to choose a new password. Share temporary credentials only through your approved channel. Self-service email/SMS recovery and MFA remain pending.

## 6. Verification commands

```text
npm ci
npm test
npm run check
npm run build
npm run test:sql
npm run test:containers
```

`npm test` exercises demo regressions and production HTTP/security behavior through a test repository. The SQL test is skipped when no dedicated test connection is supplied. `npm run test:sql` separately starts an official SQL Server 2022 Developer container on an ephemeral loopback port, creates a new `clms_test_<hex>` database with generated credentials, runs actual SQL migrations and repository tests, and removes only its labelled disposable container. It requires Docker and an image download; it does not use `.env.server`, parent credentials, or a live database. The temporary test database is deleted with that container. Test SQL uses a self-signed certificate in staging only.

Before `npm run test:containers`, build local verification images with `docker build -f Dockerfile.api -t clms-api:verification .` and `docker build -f Dockerfile.web -t clms-web:verification .`. That command adds the API and web images to the disposable SQL test network and checks actual startup/readiness, private proxy routing, unauthenticated API denial, deep links, CSP and source-map blocking. It removes its labelled test containers and network afterwards. It does not publish a release or replace final HTTPS/browser UAT.

Verify HTTPS sign-in, forced password change, logout, core saves/reload, scope denials and administrator recovery in staging. Reboot services to check persistence. Database tests alone do not prove browser/TLS configuration, full payroll functionality, original-backend compatibility or production acceptance.

## 7. Before operational use

Complete full domain validation, realistic-volume and penetration testing, SQL/file backup automation, actual restore and rollback rehearsal, permission review, admin training and staging user acceptance. Enable subsequent attendance/leave/payroll modules only after their persistence, policies, expected-result tests and approvals are delivered. Keep the existing accepted operational process in use for those pending modules.

Driver reference: [node-mssql documentation](https://tediousjs.github.io/node-mssql/) covers parameterized requests, connection strings and single-connection transactions used by this adapter.
