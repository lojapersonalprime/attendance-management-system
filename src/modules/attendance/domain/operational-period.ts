/**
 * First business date covered by the operational RH MVP.  This is deliberately
 * a business-date string (rather than an instant) so every caller compares it
 * in America/Fortaleza through `toBusinessDate` first.
 */
export const ATTENDANCE_OPERATION_START_DATE = "2026-07-01" as const;

export function isOperationalBusinessDate(businessDate: string) {
  return businessDate >= ATTENDANCE_OPERATION_START_DATE;
}

export function operationalDateFrom(businessDate: string) {
  return businessDate < ATTENDANCE_OPERATION_START_DATE
    ? ATTENDANCE_OPERATION_START_DATE
    : businessDate;
}

export function operationalDateRange(from: string, until: string) {
  const validFrom = operationalDateFrom(from);
  return validFrom > until ? null : { validFrom, validUntil: until };
}
