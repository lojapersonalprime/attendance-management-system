-- Distinguishes an intentional flexible/presence-only model from an incomplete
-- fixed model without changing any imported clock data.
CREATE TYPE "ScheduleTemplateType" AS ENUM ('FIXED', 'FLEXIBLE', 'ATTENDANCE_ONLY');

ALTER TABLE "ScheduleTemplate"
ADD COLUMN "modelType" "ScheduleTemplateType" NOT NULL DEFAULT 'FIXED';

-- The existing PJ flexible template has no fixed working days by design.
-- Keep other legacy zero-day templates as FIXED so the UI can flag them as incomplete.
UPDATE "ScheduleTemplate"
SET "modelType" = 'FLEXIBLE'
WHERE lower("name") LIKE '%flex%'
  AND NOT EXISTS (
    SELECT 1
    FROM "ScheduleTemplateDay"
    WHERE "ScheduleTemplateDay"."scheduleTemplateId" = "ScheduleTemplate"."id"
      AND "ScheduleTemplateDay"."isWorkingDay" = true
  );
