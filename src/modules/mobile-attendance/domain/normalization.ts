import type { EnginePunchCode } from "@/modules/calculations/domain/calculation-engine";

export interface NeutralMobilePunch {
  id: string;
  employeeId: string;
  occurredAt: Date;
}

export interface NormalizedPunch {
  id: string;
  employeeId: string;
  occurredAt: Date;
  source: "RAW_PUNCH" | "MOBILE_PUNCH";
  originalType: "IMPORTED_CODE" | "NEUTRAL";
  punchCode: EnginePunchCode;
  sequence: number;
}

export function expectedPunchCount(requiresBreak: boolean) {
  return requiresBreak ? 4 : 2;
}

/**
 * A mobile record remains neutral in persistence. Codes are a deterministic
 * calculation view based on chronological order and the effective schedule.
 */
export function normalizeMobilePunches(punches: readonly NeutralMobilePunch[], requiresBreak: boolean): NormalizedPunch[] {
  const codes: readonly EnginePunchCode[] = requiresBreak ? ["S", "E", "A", "F"] : ["S", "F"];
  return [...punches]
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id))
    .map((punch, index) => ({
      id: punch.id,
      employeeId: punch.employeeId,
      occurredAt: punch.occurredAt,
      source: "MOBILE_PUNCH" as const,
      originalType: "NEUTRAL" as const,
      punchCode: codes[index % codes.length]!,
      sequence: index + 1,
    }));
}
