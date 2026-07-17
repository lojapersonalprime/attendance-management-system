-- Initial non-destructive MVP schema. Review the target database and run via Prisma Migrate.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "UserRole" AS ENUM ('RH_ADMIN', 'RH_ANALYST');
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'DUPLICATE');
CREATE TYPE "EmployeeStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'TERMINATED');
CREATE TYPE "PunchCode" AS ENUM ('S', 'E', 'A', 'F');
CREATE TYPE "CalendarExceptionType" AS ENUM ('DAY_OFF', 'VACATION', 'LEAVE', 'HOLIDAY', 'SCHEDULE_OVERRIDE');
CREATE TYPE "DailySummaryStatus" AS ENUM ('PROVISIONAL', 'NEEDS_REVIEW', 'REGULAR', 'CLOSED');
CREATE TYPE "InconsistencyType" AS ENUM ('UNKNOWN_EMPLOYEE', 'MISSING_SCHEDULE', 'ODD_PUNCH_COUNT', 'MISSING_ENTRY', 'MISSING_EXIT', 'MISSING_BREAK_OUT', 'MISSING_BREAK_RETURN', 'INVALID_SEQUENCE', 'POSSIBLE_DUPLICATE', 'MULTIPLE_ENTRIES', 'MULTIPLE_EXITS', 'PUNCH_ON_DAY_OFF', 'PUNCH_OUTSIDE_SCHEDULE', 'INTERVAL_TOO_SHORT', 'INTERVAL_TOO_LONG', 'EXCESS_TIME_PENDING', 'INVALID_DATETIME', 'INVALID_ROW', 'UNKNOWN_PUNCH_CODE', 'IMPORT_COUNT_MISMATCH');
CREATE TYPE "InconsistencySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "InconsistencyStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "AdjustmentType" AS ENUM ('MISSING_PUNCH', 'DUPLICATE_PUNCH', 'INVALID_PUNCH', 'MEDICAL_CERTIFICATE', 'JUSTIFIED_ABSENCE', 'UNJUSTIFIED_ABSENCE', 'EXTERNAL_WORK', 'DAY_OFF', 'VACATION', 'LEAVE', 'HOURS_CREDIT', 'HOURS_DEBIT', 'SCHEDULE_CORRECTION');
CREATE TYPE "AdjustmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "ClosingStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "authUserId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'RH_ANALYST',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Device" (
  "id" TEXT NOT NULL,
  "deviceUid" TEXT NOT NULL,
  "model" TEXT,
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportFile" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "safeFilename" TEXT NOT NULL,
  "fileHash" CHAR(64) NOT NULL,
  "storagePath" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
  "dataType" TEXT NOT NULL,
  "startPosition" INTEGER,
  "declaredLogCount" INTEGER,
  "limitPosition" INTEGER,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "acceptedRows" INTEGER NOT NULL DEFAULT 0,
  "duplicatedRows" INTEGER NOT NULL DEFAULT 0,
  "rejectedRows" INTEGER NOT NULL DEFAULT 0,
  "earliestPunchAt" TIMESTAMP(3),
  "latestPunchAt" TIMESTAMP(3),
  "importedById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportError" (
  "id" TEXT NOT NULL,
  "importFileId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawLine" TEXT,
  "errorCode" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Employee" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "registration" TEXT,
  "cpf" TEXT,
  "position" TEXT,
  "department" TEXT,
  "unit" TEXT,
  "admissionDate" DATE,
  "terminationDate" DATE,
  "status" "EmployeeStatus" NOT NULL DEFAULT 'PENDING',
  "provisional" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeDeviceLink" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "externalEmployeeNumber" TEXT NOT NULL,
  "externalEmployeeName" TEXT,
  "validFrom" DATE NOT NULL,
  "validUntil" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeDeviceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawPunch" (
  "id" TEXT NOT NULL,
  "importFileId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "employeeDeviceLinkId" TEXT,
  "externalEmployeeNumber" TEXT NOT NULL,
  "employeeNameRaw" TEXT,
  "sourceSequence" INTEGER,
  "tmNumber" TEXT,
  "gmNumber" TEXT,
  "mode" TEXT,
  "punchCode" "PunchCode" NOT NULL,
  "punchDescription" TEXT,
  "antipass" TEXT,
  "daiGong" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "originalDateTime" TEXT NOT NULL,
  "rawLine" TEXT NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RawPunch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleTemplateDay" (
  "id" TEXT NOT NULL,
  "scheduleTemplateId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "isWorkingDay" BOOLEAN NOT NULL DEFAULT false,
  "expectedEntry" VARCHAR(5),
  "expectedBreakStart" VARCHAR(5),
  "expectedBreakEnd" VARCHAR(5),
  "expectedExit" VARCHAR(5),
  "expectedMinutes" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ScheduleTemplateDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleTemplateDay_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "ScheduleTemplateDay_expected_minutes_check" CHECK ("expectedMinutes" >= 0)
);

CREATE TABLE "EmployeeScheduleAssignment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "scheduleTemplateId" TEXT NOT NULL,
  "validFrom" DATE NOT NULL,
  "validUntil" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeScheduleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeScheduleAssignment_window_check" CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom")
);

CREATE TABLE "CalendarException" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "date" DATE NOT NULL,
  "type" "CalendarExceptionType" NOT NULL,
  "expectedMinutes" INTEGER,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailySummary" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "scheduleAssignmentId" TEXT,
  "expectedMinutes" INTEGER NOT NULL DEFAULT 0,
  "rawWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
  "validWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
  "intervalMinutes" INTEGER NOT NULL DEFAULT 0,
  "positiveMinutes" INTEGER NOT NULL DEFAULT 0,
  "negativeMinutes" INTEGER NOT NULL DEFAULT 0,
  "pendingExcessMinutes" INTEGER NOT NULL DEFAULT 0,
  "status" "DailySummaryStatus" NOT NULL DEFAULT 'PROVISIONAL',
  "calculationVersion" INTEGER NOT NULL DEFAULT 1,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Inconsistency" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "dailySummaryId" TEXT,
  "importFileId" TEXT,
  "date" DATE,
  "type" "InconsistencyType" NOT NULL,
  "severity" "InconsistencySeverity" NOT NULL,
  "status" "InconsistencyStatus" NOT NULL DEFAULT 'OPEN',
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inconsistency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Adjustment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "type" "AdjustmentType" NOT NULL,
  "originalPunchId" TEXT,
  "adjustedOccurredAt" TIMESTAMP(3),
  "minutesCredited" INTEGER NOT NULL DEFAULT 0,
  "minutesDebited" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "status" "AdjustmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "oldData" JSONB,
  "newData" JSONB,
  "reason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClosingPeriod" (
  "id" TEXT NOT NULL,
  "referenceMonth" DATE NOT NULL,
  "status" "ClosingStatus" NOT NULL DEFAULT 'OPEN',
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "reopenedById" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClosingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_authUserId_key" ON "Profile"("authUserId");
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");
CREATE INDEX "Profile_active_role_idx" ON "Profile"("active", "role");
CREATE UNIQUE INDEX "Device_deviceUid_key" ON "Device"("deviceUid");
CREATE INDEX "Device_active_idx" ON "Device"("active");
CREATE UNIQUE INDEX "ImportFile_fileHash_key" ON "ImportFile"("fileHash");
CREATE INDEX "ImportFile_deviceId_createdAt_idx" ON "ImportFile"("deviceId", "createdAt");
CREATE INDEX "ImportFile_status_createdAt_idx" ON "ImportFile"("status", "createdAt");
CREATE INDEX "ImportError_importFileId_rowNumber_idx" ON "ImportError"("importFileId", "rowNumber");
CREATE UNIQUE INDEX "Employee_registration_key" ON "Employee"("registration");
CREATE UNIQUE INDEX "Employee_cpf_key" ON "Employee"("cpf");
CREATE INDEX "Employee_status_provisional_idx" ON "Employee"("status", "provisional");
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");
CREATE UNIQUE INDEX "EmployeeDeviceLink_deviceId_externalEmployeeNumber_key" ON "EmployeeDeviceLink"("deviceId", "externalEmployeeNumber");
CREATE INDEX "EmployeeDeviceLink_employeeId_validFrom_idx" ON "EmployeeDeviceLink"("employeeId", "validFrom");
CREATE UNIQUE INDEX "RawPunch_fingerprint_key" ON "RawPunch"("fingerprint");
CREATE INDEX "RawPunch_deviceId_externalEmployeeNumber_occurredAt_idx" ON "RawPunch"("deviceId", "externalEmployeeNumber", "occurredAt");
CREATE INDEX "RawPunch_employeeDeviceLinkId_occurredAt_idx" ON "RawPunch"("employeeDeviceLinkId", "occurredAt");
CREATE INDEX "RawPunch_importFileId_idx" ON "RawPunch"("importFileId");
CREATE INDEX "RawPunch_occurredAt_idx" ON "RawPunch"("occurredAt");
CREATE UNIQUE INDEX "ScheduleTemplate_name_key" ON "ScheduleTemplate"("name");
CREATE UNIQUE INDEX "ScheduleTemplateDay_scheduleTemplateId_weekday_key" ON "ScheduleTemplateDay"("scheduleTemplateId", "weekday");
CREATE INDEX "EmployeeScheduleAssignment_employeeId_validFrom_idx" ON "EmployeeScheduleAssignment"("employeeId", "validFrom");
CREATE INDEX "EmployeeScheduleAssignment_scheduleTemplateId_idx" ON "EmployeeScheduleAssignment"("scheduleTemplateId");
CREATE INDEX "CalendarException_employeeId_date_idx" ON "CalendarException"("employeeId", "date");
CREATE INDEX "CalendarException_date_type_idx" ON "CalendarException"("date", "type");
CREATE UNIQUE INDEX "DailySummary_employeeId_date_key" ON "DailySummary"("employeeId", "date");
CREATE INDEX "DailySummary_date_status_idx" ON "DailySummary"("date", "status");
CREATE INDEX "DailySummary_scheduleAssignmentId_idx" ON "DailySummary"("scheduleAssignmentId");
CREATE INDEX "Inconsistency_status_severity_createdAt_idx" ON "Inconsistency"("status", "severity", "createdAt");
CREATE INDEX "Inconsistency_employeeId_date_idx" ON "Inconsistency"("employeeId", "date");
CREATE INDEX "Inconsistency_importFileId_idx" ON "Inconsistency"("importFileId");
CREATE INDEX "Adjustment_employeeId_date_idx" ON "Adjustment"("employeeId", "date");
CREATE INDEX "Adjustment_originalPunchId_idx" ON "Adjustment"("originalPunchId");
CREATE INDEX "Adjustment_status_createdAt_idx" ON "Adjustment"("status", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE UNIQUE INDEX "ClosingPeriod_referenceMonth_key" ON "ClosingPeriod"("referenceMonth");
CREATE INDEX "ClosingPeriod_status_idx" ON "ClosingPeriod"("status");

ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_no_overlap" EXCLUDE USING gist (
  "employeeId" WITH =,
  daterange("validFrom", COALESCE("validUntil", 'infinity'::date), '[]') WITH &&
);

ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "ImportFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeDeviceLink" ADD CONSTRAINT "EmployeeDeviceLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeDeviceLink" ADD CONSTRAINT "EmployeeDeviceLink_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RawPunch" ADD CONSTRAINT "RawPunch_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "ImportFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RawPunch" ADD CONSTRAINT "RawPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RawPunch" ADD CONSTRAINT "RawPunch_employeeDeviceLinkId_fkey" FOREIGN KEY ("employeeDeviceLinkId") REFERENCES "EmployeeDeviceLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleTemplateDay" ADD CONSTRAINT "ScheduleTemplateDay_scheduleTemplateId_fkey" FOREIGN KEY ("scheduleTemplateId") REFERENCES "ScheduleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_scheduleTemplateId_fkey" FOREIGN KEY ("scheduleTemplateId") REFERENCES "ScheduleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarException" ADD CONSTRAINT "CalendarException_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalendarException" ADD CONSTRAINT "CalendarException_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_scheduleAssignmentId_fkey" FOREIGN KEY ("scheduleAssignmentId") REFERENCES "EmployeeScheduleAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inconsistency" ADD CONSTRAINT "Inconsistency_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inconsistency" ADD CONSTRAINT "Inconsistency_dailySummaryId_fkey" FOREIGN KEY ("dailySummaryId") REFERENCES "DailySummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inconsistency" ADD CONSTRAINT "Inconsistency_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "ImportFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inconsistency" ADD CONSTRAINT "Inconsistency_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_originalPunchId_fkey" FOREIGN KEY ("originalPunchId") REFERENCES "RawPunch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClosingPeriod" ADD CONSTRAINT "ClosingPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClosingPeriod" ADD CONSTRAINT "ClosingPeriod_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
