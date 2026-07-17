-- Adds non-destructive failure tracking so import retries remain auditable and idempotent.
ALTER TABLE "ImportFile"
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureStage" TEXT,
  ADD COLUMN "failureMessage" TEXT,
  ADD COLUMN "requestId" TEXT;

CREATE INDEX "ImportFile_requestId_idx" ON "ImportFile"("requestId");
