-- v0.2.0: additive employee-management and schedule-history structures.
-- Existing imports, devices, RawPunch rows, summaries, inconsistencies and audit logs are preserved.

CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'OTHER');

ALTER TYPE "EmployeeStatus" ADD VALUE 'ON_LEAVE';
ALTER TYPE "EmployeeStatus" ADD VALUE 'VACATION';
ALTER TYPE "EmployeeStatus" ADD VALUE 'MERGED';

CREATE TABLE "Unit" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Position" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeTag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeTagAssignment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeTagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeTagAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Employee"
  ADD COLUMN "clockNameRaw" TEXT,
  ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'EMPLOYEE',
  ADD COLUMN "positionId" TEXT,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "unitId" TEXT,
  ADD COLUMN "mergedIntoId" TEXT;

ALTER TABLE "EmployeeDeviceLink"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ScheduleTemplateDay"
  ADD COLUMN "expectedBreakMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minimumBreakMinutes" INTEGER,
  ADD COLUMN "entryToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "exitToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "requiresBreak" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "excessRequiresApproval" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "EmployeeScheduleAssignment"
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- The former unique index prevented a number from being reused after its historical link ended.
-- Replacing only that index preserves every link and adds a period-aware guard for active links.
DROP INDEX "EmployeeDeviceLink_deviceId_externalEmployeeNumber_key";

CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");
CREATE INDEX "Unit_active_name_idx" ON "Unit"("active", "name");
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE INDEX "Department_active_name_idx" ON "Department"("active", "name");
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");
CREATE INDEX "Position_active_name_idx" ON "Position"("active", "name");
CREATE UNIQUE INDEX "EmployeeTag_name_key" ON "EmployeeTag"("name");
CREATE INDEX "EmployeeTag_active_name_idx" ON "EmployeeTag"("active", "name");
CREATE UNIQUE INDEX "EmployeeTagAssignment_employeeId_employeeTagId_key" ON "EmployeeTagAssignment"("employeeId", "employeeTagId");
CREATE INDEX "EmployeeTagAssignment_employeeTagId_idx" ON "EmployeeTagAssignment"("employeeTagId");
CREATE INDEX "Employee_unitId_idx" ON "Employee"("unitId");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");
CREATE INDEX "Employee_mergedIntoId_idx" ON "Employee"("mergedIntoId");
CREATE INDEX "EmployeeDeviceLink_deviceId_externalEmployeeNumber_active_idx" ON "EmployeeDeviceLink"("deviceId", "externalEmployeeNumber", "active");

ALTER TABLE "ScheduleTemplateDay"
  ADD CONSTRAINT "ScheduleTemplateDay_expectedBreakMinutes_check" CHECK ("expectedBreakMinutes" >= 0),
  ADD CONSTRAINT "ScheduleTemplateDay_minimumBreakMinutes_check" CHECK ("minimumBreakMinutes" IS NULL OR "minimumBreakMinutes" >= 0),
  ADD CONSTRAINT "ScheduleTemplateDay_entryToleranceMinutes_check" CHECK ("entryToleranceMinutes" >= 0),
  ADD CONSTRAINT "ScheduleTemplateDay_exitToleranceMinutes_check" CHECK ("exitToleranceMinutes" >= 0);

ALTER TABLE "EmployeeDeviceLink" ADD CONSTRAINT "EmployeeDeviceLink_active_window_no_overlap" EXCLUDE USING gist (
  "deviceId" WITH =,
  "externalEmployeeNumber" WITH =,
  daterange("validFrom", COALESCE("validUntil", 'infinity'::date), '[]') WITH &&
) WHERE ("active");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeTagAssignment" ADD CONSTRAINT "EmployeeTagAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeTagAssignment" ADD CONSTRAINT "EmployeeTagAssignment_employeeTagId_fkey" FOREIGN KEY ("employeeTagId") REFERENCES "EmployeeTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeScheduleAssignment" ADD CONSTRAINT "EmployeeScheduleAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
