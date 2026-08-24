import type { MobileAttendanceErrorCode } from "@/modules/mobile-attendance/application/errors";

export function mobilePunchEligibility(input: {
  featureEnabled: boolean;
  accessActive: boolean;
  employeeStatus: string;
  employeeProvisional: boolean;
  employeeUnitId: string | null;
  allowedUnitId: string;
  allowedUnitActive: boolean;
}): MobileAttendanceErrorCode | null {
  if (!input.featureEnabled) return "MOBILE_PUNCH_DISABLED";
  if (!input.accessActive || input.employeeStatus !== "ACTIVE" || input.employeeProvisional) return "EMPLOYEE_NOT_ELIGIBLE";
  if (!input.allowedUnitActive || input.employeeUnitId !== input.allowedUnitId) return "UNIT_MISMATCH";
  return null;
}
