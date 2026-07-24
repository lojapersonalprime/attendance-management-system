-- v0.3.0 is additive: RawPunch, ImportFile history and existing summaries are preserved.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "ImportCoverageStatus" AS ENUM ('SUGGESTED', 'CONFIRMED');
CREATE TYPE "EmploymentPeriodStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "CalculationToleranceMode" AS ENUM ('EXCESS_ONLY', 'FULL_EVENT', 'IGNORE_WITHIN_TOLERANCE');
CREATE TYPE "CalculationRunTrigger" AS ENUM ('IMPORT', 'EMPLOYMENT_PERIOD_CHANGE', 'SCHEDULE_CHANGE', 'POLICY_CHANGE', 'ADJUSTMENT', 'MANUAL_RECALCULATION', 'PERIOD_REOPENED', 'IMPORT_COVERAGE_CONFIRMED');
CREATE TYPE "CalculationRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
CREATE TYPE "HrCalculationValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_ADJUSTMENT');

ALTER TYPE "AdjustmentType" ADD VALUE 'EXCESS_APPROVAL';
ALTER TYPE "InconsistencyStatus" ADD VALUE 'AUTO_RESOLVED';
ALTER TYPE "InconsistencyStatus" ADD VALUE 'REOPENED';
ALTER TYPE "InconsistencyType" ADD VALUE 'PROVISIONAL_EMPLOYEE';
ALTER TYPE "InconsistencyType" ADD VALUE 'MISSING_EMPLOYMENT_PERIOD';
ALTER TYPE "InconsistencyType" ADD VALUE 'OVERLAPPING_EMPLOYMENT_PERIOD';
ALTER TYPE "InconsistencyType" ADD VALUE 'MISSING_CALCULATION_POLICY';
ALTER TYPE "InconsistencyType" ADD VALUE 'OVERLAPPING_SCHEDULE';
ALTER TYPE "InconsistencyType" ADD VALUE 'IMPORT_COVERAGE_UNCONFIRMED';
ALTER TYPE "InconsistencyType" ADD VALUE 'NO_PUNCHES_ON_SCHEDULED_DAY';
ALTER TYPE "InconsistencyType" ADD VALUE 'LATE_ARRIVAL';
ALTER TYPE "InconsistencyType" ADD VALUE 'EARLY_DEPARTURE';
ALTER TYPE "InconsistencyType" ADD VALUE 'INCOMPLETE_DAY';
ALTER TYPE "InconsistencyType" ADD VALUE 'ADJUSTMENT_REQUIRED';
ALTER TYPE "InconsistencyType" ADD VALUE 'CLOSED_PERIOD_CHANGE_ATTEMPT';
ALTER TYPE "InconsistencyType" ADD VALUE 'CALCULATION_FAILED';

ALTER TABLE "Adjustment"
  ADD COLUMN "adjustedPunchCode" "PunchCode",
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "ImportFile"
  ADD COLUMN "coverageConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "coverageConfirmedById" TEXT,
  ADD COLUMN "coverageFrom" DATE,
  ADD COLUMN "coverageStatus" "ImportCoverageStatus" NOT NULL DEFAULT 'SUGGESTED',
  ADD COLUMN "coverageTo" DATE,
  ADD CONSTRAINT "ImportFile_coverage_valid_range" CHECK ("coverageFrom" IS NULL OR "coverageTo" IS NULL OR "coverageTo" >= "coverageFrom");

ALTER TABLE "DailySummary"
  ADD COLUMN "absenceMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "calculationEngineVersion" TEXT NOT NULL DEFAULT 'calculation-engine-v1',
  ADD COLUMN "calculationMemory" JSONB,
  ADD COLUMN "calculationPolicyId" TEXT,
  ADD COLUMN "calculationRunId" TEXT,
  ADD COLUMN "consideredMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "earlyDepartureMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "employmentPeriodId" TEXT,
  ADD COLUMN "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "longBreakMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rawExcessMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recordedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "shortBreakMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workedMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Inconsistency"
  ADD COLUMN "autoResolvedAt" TIMESTAMP(3),
  ADD COLUMN "calculationEngineVersion" VARCHAR(64),
  ADD COLUMN "logicalKey" VARCHAR(160),
  ADD COLUMN "reconciledAt" TIMESTAMP(3),
  ADD COLUMN "reopenedAt" TIMESTAMP(3);

CREATE TABLE "CalculationPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "requiresSchedule" BOOLEAN NOT NULL DEFAULT true,
  "calculateLateArrival" BOOLEAN NOT NULL DEFAULT true,
  "calculateEarlyDeparture" BOOLEAN NOT NULL DEFAULT true,
  "calculateAbsence" BOOLEAN NOT NULL DEFAULT true,
  "calculateNegativeBalance" BOOLEAN NOT NULL DEFAULT true,
  "calculateExcessTime" BOOLEAN NOT NULL DEFAULT true,
  "excessRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "requiresBreak" BOOLEAN NOT NULL DEFAULT false,
  "shortBreakGeneratesCredit" BOOLEAN NOT NULL DEFAULT false,
  "longBreakGeneratesDebit" BOOLEAN NOT NULL DEFAULT true,
  "allowAutomaticPositiveBalance" BOOLEAN NOT NULL DEFAULT false,
  "attendanceOnly" BOOLEAN NOT NULL DEFAULT false,
  "flexibleSchedule" BOOLEAN NOT NULL DEFAULT false,
  "duplicateWindowMinutes" INTEGER NOT NULL DEFAULT 2,
  "entryToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  "exitToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  "breakToleranceMinutes" INTEGER NOT NULL DEFAULT 0,
  "toleranceMode" "CalculationToleranceMode" NOT NULL DEFAULT 'FULL_EVENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalculationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeEmploymentPeriod" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employmentType" "EmploymentType" NOT NULL,
  "calculationPolicyId" TEXT,
  "validFrom" DATE NOT NULL,
  "validUntil" DATE,
  "status" "EmploymentPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeEmploymentPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeEmploymentPeriod_valid_range" CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom")
);

CREATE TABLE "CalculationRun" (
  "id" TEXT NOT NULL,
  "trigger" "CalculationRunTrigger" NOT NULL,
  "importFileId" TEXT,
  "employeeId" TEXT,
  "dateFrom" DATE NOT NULL,
  "dateTo" DATE NOT NULL,
  "status" "CalculationRunStatus" NOT NULL DEFAULT 'PENDING',
  "totalDays" INTEGER NOT NULL DEFAULT 0,
  "processedDays" INTEGER NOT NULL DEFAULT 0,
  "failedDays" INTEGER NOT NULL DEFAULT 0,
  "calculationVersion" TEXT NOT NULL DEFAULT 'calculation-engine-v1',
  "startedById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalculationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalculationRun_valid_range" CHECK ("dateTo" >= "dateFrom")
);

CREATE TABLE "HrCalculationValidation" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "businessDate" DATE,
  "dailySummaryId" TEXT,
  "expectedCalculation" JSONB,
  "calculationSnapshot" JSONB,
  "differenceMinutes" INTEGER,
  "status" "HrCalculationValidationStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "validatedById" TEXT,
  "validatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrCalculationValidation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalculationPolicy_name_key" ON "CalculationPolicy"("name");
CREATE INDEX "CalculationPolicy_active_name_idx" ON "CalculationPolicy"("active", "name");
CREATE INDEX "EmployeeEmploymentPeriod_employeeId_validFrom_idx" ON "EmployeeEmploymentPeriod"("employeeId", "validFrom");
CREATE INDEX "EmployeeEmploymentPeriod_calculationPolicyId_idx" ON "EmployeeEmploymentPeriod"("calculationPolicyId");
CREATE INDEX "CalculationRun_status_createdAt_idx" ON "CalculationRun"("status", "createdAt");
CREATE INDEX "CalculationRun_employeeId_dateFrom_dateTo_idx" ON "CalculationRun"("employeeId", "dateFrom", "dateTo");
CREATE INDEX "CalculationRun_importFileId_idx" ON "CalculationRun"("importFileId");
CREATE INDEX "HrCalculationValidation_status_businessDate_idx" ON "HrCalculationValidation"("status", "businessDate");
CREATE INDEX "HrCalculationValidation_employeeId_businessDate_idx" ON "HrCalculationValidation"("employeeId", "businessDate");
CREATE INDEX "DailySummary_employmentPeriodId_idx" ON "DailySummary"("employmentPeriodId");
CREATE INDEX "DailySummary_calculationPolicyId_idx" ON "DailySummary"("calculationPolicyId");
CREATE INDEX "DailySummary_calculationRunId_idx" ON "DailySummary"("calculationRunId");
CREATE INDEX "ImportFile_coverageStatus_coverageFrom_coverageTo_idx" ON "ImportFile"("coverageStatus", "coverageFrom", "coverageTo");
CREATE INDEX "Inconsistency_logicalKey_idx" ON "Inconsistency"("logicalKey");

ALTER TABLE "EmployeeEmploymentPeriod"
  ADD CONSTRAINT "EmployeeEmploymentPeriod_active_window_excl"
  EXCLUDE USING GIST (
    "employeeId" WITH =,
    daterange("validFrom", "validUntil", '[]') WITH &&
  ) WHERE ("status" <> 'CANCELLED');

ALTER TABLE "ImportFile" ADD CONSTRAINT "ImportFile_coverageConfirmedById_fkey" FOREIGN KEY ("coverageConfirmedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEmploymentPeriod" ADD CONSTRAINT "EmployeeEmploymentPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEmploymentPeriod" ADD CONSTRAINT "EmployeeEmploymentPeriod_calculationPolicyId_fkey" FOREIGN KEY ("calculationPolicyId") REFERENCES "CalculationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEmploymentPeriod" ADD CONSTRAINT "EmployeeEmploymentPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_employmentPeriodId_fkey" FOREIGN KEY ("employmentPeriodId") REFERENCES "EmployeeEmploymentPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_calculationPolicyId_fkey" FOREIGN KEY ("calculationPolicyId") REFERENCES "CalculationPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_calculationRunId_fkey" FOREIGN KEY ("calculationRunId") REFERENCES "CalculationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalculationRun" ADD CONSTRAINT "CalculationRun_importFileId_fkey" FOREIGN KEY ("importFileId") REFERENCES "ImportFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalculationRun" ADD CONSTRAINT "CalculationRun_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CalculationRun" ADD CONSTRAINT "CalculationRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCalculationValidation" ADD CONSTRAINT "HrCalculationValidation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCalculationValidation" ADD CONSTRAINT "HrCalculationValidation_dailySummaryId_fkey" FOREIGN KEY ("dailySummaryId") REFERENCES "DailySummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HrCalculationValidation" ADD CONSTRAINT "HrCalculationValidation_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
