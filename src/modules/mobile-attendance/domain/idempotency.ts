export interface ExistingMobilePunchIdentity {
  employeeId: string;
  employeeMobileAccessId: string;
}

/**
 * CalculationPolicy uses two minutes by default and the calculation engine
 * already relies on that value to flag possible duplicate punches. Keep a
 * safe fallback only while RH has not configured the employee's policy yet.
 */
export const DEFAULT_MOBILE_PUNCH_DUPLICATE_WINDOW_MINUTES = 2;

export function resolveMobilePunchRequest<T extends ExistingMobilePunchIdentity>(
  existing: T | null,
  employeeId: string,
  employeeMobileAccessId: string,
) {
  if (!existing) return { kind: "CREATE" as const };
  if (existing.employeeId === employeeId && existing.employeeMobileAccessId === employeeMobileAccessId) {
    return { kind: "RETURN_EXISTING" as const, punch: existing };
  }
  return { kind: "COLLISION" as const };
}

/** Server-clock range used to prevent two different request IDs from becoming accidental punches. */
export function mobilePunchDuplicateWindowStart(registeredAt: Date, duplicateWindowMinutes: number) {
  return new Date(registeredAt.getTime() - duplicateWindowMinutes * 60_000);
}
