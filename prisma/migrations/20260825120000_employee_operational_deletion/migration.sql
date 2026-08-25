-- Employee deletion preserves the immutable RawPunch source and its technical
-- device/EnNo linkage. The link is detached from the deleted employee instead
-- of rewriting or deleting the raw attendance record.
ALTER TABLE "EmployeeDeviceLink"
  ALTER COLUMN "employeeId" DROP NOT NULL;

ALTER TABLE "EmployeeDeviceLink"
  DROP CONSTRAINT "EmployeeDeviceLink_employeeId_fkey";

ALTER TABLE "EmployeeDeviceLink"
  ADD CONSTRAINT "EmployeeDeviceLink_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
