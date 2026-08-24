-- Pilot mobile attendance is additive. RawPunch and imported TXT history are untouched.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EMPLOYEE';
ALTER TYPE "CalculationRunTrigger" ADD VALUE IF NOT EXISTS 'MOBILE_PUNCH';
ALTER TYPE "InconsistencyType" ADD VALUE IF NOT EXISTS 'MOBILE_PUNCH_OUTSIDE_AUTHORIZED_AREA';
ALTER TYPE "InconsistencyType" ADD VALUE IF NOT EXISTS 'MOBILE_PUNCH_LOW_ACCURACY';
ALTER TYPE "InconsistencyType" ADD VALUE IF NOT EXISTS 'MOBILE_PUNCHES_EXCEED_EXPECTED';
ALTER TYPE "InconsistencyType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CORRECTION_REQUEST';

CREATE TYPE "MobilePunchLocationStatus" AS ENUM ('INSIDE_RADIUS', 'OUTSIDE_RADIUS', 'LOW_ACCURACY');
CREATE TYPE "MobilePunchSource" AS ENUM ('MOBILE_BROWSER');
CREATE TYPE "MobilePunchLocationPolicy" AS ENUM ('ALLOW_AND_REVIEW', 'BLOCK');
CREATE TYPE "AttendanceCorrectionReason" AS ENUM ('FORGOT_PUNCH', 'TIME_REVIEW', 'EXTERNAL_WORK', 'LOCATION_PROBLEM', 'OTHER');
CREATE TYPE "AttendanceCorrectionRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "Adjustment" ADD COLUMN "originalMobilePunchId" TEXT;

CREATE TABLE "AuthorizedLocation" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radiusMeters" INTEGER NOT NULL,
  "maxAccuracyMeters" INTEGER NOT NULL,
  "exceptionPolicy" "MobilePunchLocationPolicy" NOT NULL DEFAULT 'ALLOW_AND_REVIEW',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorizedLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthorizedLocation_coordinates_valid" CHECK ("latitude" >= -90 AND "latitude" <= 90 AND "longitude" >= -180 AND "longitude" <= 180),
  CONSTRAINT "AuthorizedLocation_radius_valid" CHECK ("radiusMeters" > 0 AND "maxAccuracyMeters" > 0)
);

CREATE TABLE "EmployeeMobileAccess" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "allowedUnitId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "pinHash" VARCHAR(255) NOT NULL,
  "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  "pinLockedUntil" TIMESTAMP(3),
  "privacyAcceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeMobileAccess_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeMobileAccess_pin_attempts_valid" CHECK ("pinFailedAttempts" >= 0)
);

CREATE TABLE "MobilePunch" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeMobileAccessId" TEXT NOT NULL,
  "registeredById" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "authorizedLocationId" TEXT,
  "registeredAt" TIMESTAMP(3) NOT NULL,
  "clientObservedAt" TIMESTAMP(3),
  "source" "MobilePunchSource" NOT NULL DEFAULT 'MOBILE_BROWSER',
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "accuracyMeters" DOUBLE PRECISION NOT NULL,
  "distanceFromLocationMeters" DOUBLE PRECISION,
  "locationStatus" "MobilePunchLocationStatus" NOT NULL,
  "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "requestId" UUID NOT NULL,
  "receiptCode" VARCHAR(32) NOT NULL,
  "receiptHash" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobilePunch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobilePunch_coordinates_valid" CHECK ("latitude" >= -90 AND "latitude" <= 90 AND "longitude" >= -180 AND "longitude" <= 180),
  CONSTRAINT "MobilePunch_accuracy_valid" CHECK ("accuracyMeters" >= 0),
  CONSTRAINT "MobilePunch_distance_valid" CHECK ("distanceFromLocationMeters" IS NULL OR "distanceFromLocationMeters" >= 0)
);

CREATE TABLE "AttendanceCorrectionRequest" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "mobilePunchId" TEXT,
  "requestedById" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "reason" "AttendanceCorrectionReason" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "AttendanceCorrectionRequestStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthorizedLocation_unitId_name_key" ON "AuthorizedLocation"("unitId", "name");
CREATE INDEX "AuthorizedLocation_unitId_active_idx" ON "AuthorizedLocation"("unitId", "active");
CREATE UNIQUE INDEX "EmployeeMobileAccess_profileId_key" ON "EmployeeMobileAccess"("profileId");
CREATE UNIQUE INDEX "EmployeeMobileAccess_employeeId_key" ON "EmployeeMobileAccess"("employeeId");
CREATE INDEX "EmployeeMobileAccess_allowedUnitId_active_idx" ON "EmployeeMobileAccess"("allowedUnitId", "active");
CREATE UNIQUE INDEX "MobilePunch_requestId_key" ON "MobilePunch"("requestId");
CREATE UNIQUE INDEX "MobilePunch_receiptCode_key" ON "MobilePunch"("receiptCode");
CREATE INDEX "MobilePunch_employeeId_registeredAt_idx" ON "MobilePunch"("employeeId", "registeredAt");
CREATE INDEX "MobilePunch_unitId_registeredAt_idx" ON "MobilePunch"("unitId", "registeredAt");
CREATE INDEX "MobilePunch_authorizedLocationId_registeredAt_idx" ON "MobilePunch"("authorizedLocationId", "registeredAt");
CREATE INDEX "AttendanceCorrectionRequest_employeeId_businessDate_idx" ON "AttendanceCorrectionRequest"("employeeId", "businessDate");
CREATE INDEX "AttendanceCorrectionRequest_status_createdAt_idx" ON "AttendanceCorrectionRequest"("status", "createdAt");
CREATE INDEX "Adjustment_originalMobilePunchId_idx" ON "Adjustment"("originalMobilePunchId");

ALTER TABLE "AuthorizedLocation" ADD CONSTRAINT "AuthorizedLocation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeMobileAccess" ADD CONSTRAINT "EmployeeMobileAccess_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeMobileAccess" ADD CONSTRAINT "EmployeeMobileAccess_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeMobileAccess" ADD CONSTRAINT "EmployeeMobileAccess_allowedUnitId_fkey" FOREIGN KEY ("allowedUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobilePunch" ADD CONSTRAINT "MobilePunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobilePunch" ADD CONSTRAINT "MobilePunch_employeeMobileAccessId_fkey" FOREIGN KEY ("employeeMobileAccessId") REFERENCES "EmployeeMobileAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobilePunch" ADD CONSTRAINT "MobilePunch_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobilePunch" ADD CONSTRAINT "MobilePunch_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MobilePunch" ADD CONSTRAINT "MobilePunch_authorizedLocationId_fkey" FOREIGN KEY ("authorizedLocationId") REFERENCES "AuthorizedLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_originalMobilePunchId_fkey" FOREIGN KEY ("originalMobilePunchId") REFERENCES "MobilePunch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_mobilePunchId_fkey" FOREIGN KEY ("mobilePunchId") REFERENCES "MobilePunch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
