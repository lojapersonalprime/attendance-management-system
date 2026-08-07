export interface ExistingMobilePunchIdentity {
  employeeId: string;
  employeeMobileAccessId: string;
}

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
