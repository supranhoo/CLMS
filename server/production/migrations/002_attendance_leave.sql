CREATE TABLE dbo.clms_period_locks (
  module varchar(20) NOT NULL CHECK(module IN ('attendance','leave')),
  contractor_id nvarchar(80) NOT NULL REFERENCES dbo.clms_contractors(contractor_id),
  period date NOT NULL CHECK(DAY(period)=1),
  locked bit NOT NULL,
  reason nvarchar(500) NOT NULL,
  version int NOT NULL DEFAULT 1,
  PRIMARY KEY(module,contractor_id,period)
);
CREATE TABLE dbo.clms_punch_batches (
  batch_id varchar(80) NOT NULL PRIMARY KEY,
  payload_hash char(64) NOT NULL,
  submitted_by nvarchar(40) NOT NULL REFERENCES dbo.clms_users(user_id),
  row_count int NOT NULL,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE TABLE dbo.clms_punches (
  employee_code nvarchar(80) NOT NULL REFERENCES dbo.clms_workers(employee_code),
  business_date date NOT NULL,
  punched_at datetimeoffset(0) NOT NULL,
  batch_id varchar(80) NOT NULL REFERENCES dbo.clms_punch_batches(batch_id),
  PRIMARY KEY(employee_code,business_date,punched_at),
  CONSTRAINT UQ_clms_punch_instant UNIQUE(employee_code,punched_at)
);
CREATE TABLE dbo.clms_attendance_jobs (
  job_id varchar(36) NOT NULL PRIMARY KEY,
  submitted_by nvarchar(40) NOT NULL REFERENCES dbo.clms_users(user_id),
  from_date date NOT NULL,
  to_date date NOT NULL,
  employee_codes nvarchar(max) NOT NULL CHECK(ISJSON(employee_codes)=1),
  status varchar(20) NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','COMPLETE','FAILED')),
  lease_token varchar(36) NULL,
  lease_until datetime2 NULL,
  attempts int NOT NULL DEFAULT 0,
  error_code varchar(40) NULL,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  completed_at datetime2 NULL
);
CREATE INDEX IX_clms_jobs_claim ON dbo.clms_attendance_jobs(status,lease_until,created_at);
CREATE TABLE dbo.clms_attendance_daily (
  employee_code nvarchar(80) NOT NULL REFERENCES dbo.clms_workers(employee_code),
  business_date date NOT NULL,
  first_punch datetimeoffset(0) NOT NULL,
  last_punch datetimeoffset(0) NOT NULL,
  punch_count int NOT NULL,
  elapsed_seconds int NULL,
  job_id varchar(36) NOT NULL REFERENCES dbo.clms_attendance_jobs(job_id),
  PRIMARY KEY(employee_code,business_date)
);
CREATE TABLE dbo.clms_attendance_adjustments (
  adjustment_id varchar(36) NOT NULL PRIMARY KEY,
  employee_code nvarchar(80) NOT NULL REFERENCES dbo.clms_workers(employee_code),
  business_date date NOT NULL,
  mark varchar(10) NOT NULL CHECK(mark IN ('P','AB','WO','HLD','OD')),
  first_punch datetimeoffset(0) NULL,
  last_punch datetimeoffset(0) NULL,
  reason nvarchar(500) NOT NULL,
  submitted_by nvarchar(40) NOT NULL REFERENCES dbo.clms_users(user_id),
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by nvarchar(40) NULL,
  review_reason nvarchar(500) NULL,
  version int NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE UNIQUE INDEX UX_clms_pending_adjustment ON dbo.clms_attendance_adjustments(employee_code,business_date) WHERE status='PENDING';
CREATE TABLE dbo.clms_attendance_marks (
  employee_code nvarchar(80) NOT NULL REFERENCES dbo.clms_workers(employee_code),
  business_date date NOT NULL,
  adjustment_id varchar(36) NOT NULL REFERENCES dbo.clms_attendance_adjustments(adjustment_id),
  PRIMARY KEY(employee_code,business_date)
);
CREATE TABLE dbo.clms_leave_types (
  leave_code varchar(20) NOT NULL PRIMARY KEY,
  leave_name nvarchar(100) NOT NULL,
  active bit NOT NULL DEFAULT 1,
  allow_negative bit NOT NULL DEFAULT 0,
  unit_step decimal(3,2) NOT NULL DEFAULT 0.50 CHECK(unit_step IN (0.25,0.50,1.00)),
  version int NOT NULL DEFAULT 1
);
-- Editable input categories only. No entitlement, accrual or statutory rate is seeded.
INSERT dbo.clms_leave_types(leave_code,leave_name) VALUES('CL','Casual leave'),('EL','Earned leave'),('SL','Sick leave');
CREATE TABLE dbo.clms_leave_requests (
  request_id varchar(36) NOT NULL PRIMARY KEY,
  employee_code nvarchar(80) NOT NULL REFERENCES dbo.clms_workers(employee_code),
  leave_code varchar(20) NOT NULL REFERENCES dbo.clms_leave_types(leave_code),
  charged_days nvarchar(max) NOT NULL CHECK(ISJSON(charged_days)=1),
  reason nvarchar(500) NOT NULL,
  submitted_by nvarchar(40) NOT NULL REFERENCES dbo.clms_users(user_id),
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by nvarchar(40) NULL,
  review_reason nvarchar(500) NULL,
  version int NOT NULL DEFAULT 1,
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_clms_leave_worker ON dbo.clms_leave_requests(employee_code,status);
CREATE TABLE dbo.clms_leave_ledger (
  entry_id bigint IDENTITY NOT NULL PRIMARY KEY,
  employee_code nvarchar(80) NOT NULL REFERENCES dbo.clms_workers(employee_code),
  leave_code varchar(20) NOT NULL REFERENCES dbo.clms_leave_types(leave_code),
  business_date date NOT NULL,
  units decimal(9,2) NOT NULL CHECK(units<>0),
  source_type varchar(20) NOT NULL CHECK(source_type IN ('CREDIT','LEAVE','REVERSAL')),
  source_id varchar(80) NOT NULL,
  reason nvarchar(500) NOT NULL,
  created_by nvarchar(40) NOT NULL REFERENCES dbo.clms_users(user_id),
  created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UNIQUE(source_type,source_id,business_date)
);
CREATE INDEX IX_clms_leave_balance ON dbo.clms_leave_ledger(employee_code,leave_code,business_date) INCLUDE(units);
