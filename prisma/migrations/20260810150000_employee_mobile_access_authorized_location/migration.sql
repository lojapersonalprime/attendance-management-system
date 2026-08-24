-- Keep existing mobile access records intact while allowing RH to complete the
-- account, PIN and authorized-location steps separately.
ALTER TABLE "EmployeeMobileAccess"
  ADD COLUMN "authorizedLocationId" TEXT,
  ADD COLUMN "pinConfiguredAt" TIMESTAMP(3);

ALTER TABLE "EmployeeMobileAccess"
  ALTER COLUMN "pinHash" DROP NOT NULL;

UPDATE "EmployeeMobileAccess"
SET "pinConfiguredAt" = "createdAt"
WHERE "pinHash" IS NOT NULL
  AND "pinConfiguredAt" IS NULL;

CREATE INDEX "EmployeeMobileAccess_authorizedLocationId_idx"
  ON "EmployeeMobileAccess"("authorizedLocationId");

ALTER TABLE "EmployeeMobileAccess"
  ADD CONSTRAINT "EmployeeMobileAccess_authorizedLocationId_fkey"
  FOREIGN KEY ("authorizedLocationId") REFERENCES "AuthorizedLocation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
