-- An explicit entry-only mode avoids applying a legal interpretation to exit
-- or break tolerances. Existing policies retain the historical FULL_EVENT
-- behavior until RH changes the policy deliberately.
CREATE TYPE "EntryToleranceMode" AS ENUM ('FULL_DELAY_AFTER_TOLERANCE', 'EXCESS_ONLY_AFTER_TOLERANCE');

ALTER TABLE "CalculationPolicy"
  ADD COLUMN "entryToleranceMode" "EntryToleranceMode" NOT NULL DEFAULT 'FULL_DELAY_AFTER_TOLERANCE';
