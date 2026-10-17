IF OBJECT_ID('dbo.clms_users', 'U') IS NULL
CREATE TABLE dbo.clms_users (
  user_id nvarchar(40) NOT NULL PRIMARY KEY,
  display_name nvarchar(200) NOT NULL,
  email nvarchar(254) NOT NULL DEFAULT '',
  password_hash varchar(250) NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('ADMIN','OPERATOR','AUDITOR')),
  active bit NOT NULL DEFAULT 1,
  must_change_password bit NOT NULL DEFAULT 1,
  assignments nvarchar(max) NOT NULL DEFAULT '{}' CHECK (ISJSON(assignments)=1),
  failed_logins int NOT NULL DEFAULT 0,
  locked_until datetime2 NULL,
  version int NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID('dbo.clms_sessions', 'U') IS NULL
CREATE TABLE dbo.clms_sessions (
  token_hash char(64) NOT NULL PRIMARY KEY,
  user_id nvarchar(40) NOT NULL REFERENCES dbo.clms_users(user_id),
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  last_seen datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  expires_at datetime2 NOT NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_clms_sessions_user' AND object_id=OBJECT_ID('dbo.clms_sessions'))
CREATE INDEX IX_clms_sessions_user ON dbo.clms_sessions(user_id);
IF OBJECT_ID('dbo.clms_contractors', 'U') IS NULL
CREATE TABLE dbo.clms_contractors (
  contractor_id nvarchar(80) NOT NULL PRIMARY KEY,
  contractor_name nvarchar(200) NOT NULL,
  payload nvarchar(max) NOT NULL CHECK (ISJSON(payload)=1),
  version int NOT NULL DEFAULT 1,
  modified_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID('dbo.clms_workers', 'U') IS NULL
CREATE TABLE dbo.clms_workers (
  employee_code nvarchar(80) NOT NULL PRIMARY KEY,
  display_name nvarchar(200) NOT NULL,
  contractor_id nvarchar(80) NOT NULL REFERENCES dbo.clms_contractors(contractor_id),
  department nvarchar(80) NOT NULL DEFAULT '',
  business_unit nvarchar(80) NOT NULL DEFAULT '',
  location_code nvarchar(80) NOT NULL DEFAULT '',
  payload nvarchar(max) NOT NULL CHECK (ISJSON(payload)=1),
  version int NOT NULL DEFAULT 1,
  modified_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_clms_workers_scope' AND object_id=OBJECT_ID('dbo.clms_workers'))
CREATE INDEX IX_clms_workers_scope ON dbo.clms_workers(contractor_id,department,business_unit,location_code);
IF OBJECT_ID('dbo.clms_masters', 'U') IS NULL
CREATE TABLE dbo.clms_masters (
  master_kind nvarchar(50) NOT NULL,
  record_key nvarchar(400) NOT NULL,
  payload nvarchar(max) NOT NULL CHECK (ISJSON(payload)=1),
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY (master_kind,record_key)
);
IF OBJECT_ID('dbo.clms_audit', 'U') IS NULL
CREATE TABLE dbo.clms_audit (
  event_id bigint IDENTITY NOT NULL PRIMARY KEY,
  actor nvarchar(40) NOT NULL,
  action nvarchar(80) NOT NULL,
  target nvarchar(200) NOT NULL,
  correlation_id varchar(36) NOT NULL,
  at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
