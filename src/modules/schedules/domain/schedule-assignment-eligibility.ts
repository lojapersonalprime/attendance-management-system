import type { EmployeeStatus } from "@/generated/prisma/client";

/** Imported provisional records may receive HR context; only merged records are immutable. */
export function canReceiveScheduleAssignment(status: EmployeeStatus) {
  return status !== "MERGED";
}
