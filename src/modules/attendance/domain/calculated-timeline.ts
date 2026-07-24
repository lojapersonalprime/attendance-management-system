import type { ImportedPunchCode } from "@/modules/attendance/domain/presentation";

export interface CalculatedTimelinePunch {
  id: string;
  occurredAt: Date;
  punchCode: ImportedPunchCode;
  origin: "RAW_PUNCH" | "MANUAL_ADJUSTMENT";
  adjustmentId?: string;
  reason?: string;
}

export interface CalculatedTimeline {
  state: "AVAILABLE" | "WAITING_FOR_RECALCULATION" | "EMPTY";
  punches: CalculatedTimelinePunch[];
}

const importedPunchCodes = new Set<ImportedPunchCode>(["S", "E", "A", "F"]);

/**
 * DailySummary calculation memory is the immutable trace of the exact punches
 * used by the engine. Reading it here keeps the UI from mixing a date-only
 * UTC value with a Fortaleza instant or showing punches from another run.
 */
export function getCalculatedTimeline(memory: unknown, recordedMinutes: number): CalculatedTimeline {
  if (!memory || typeof memory !== "object" || !("consideredPunches" in memory) || !Array.isArray(memory.consideredPunches)) {
    return { state: recordedMinutes > 0 ? "WAITING_FOR_RECALCULATION" : "EMPTY", punches: [] };
  }
  const punches = memory.consideredPunches.flatMap((value): CalculatedTimelinePunch[] => {
    if (!value || typeof value !== "object") return [];
    const candidate = value as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : null;
    const occurredAt = typeof candidate.occurredAt === "string" ? new Date(candidate.occurredAt) : null;
    const punchCode = typeof candidate.punchCode === "string" && importedPunchCodes.has(candidate.punchCode as ImportedPunchCode)
      ? candidate.punchCode as ImportedPunchCode
      : null;
    const origin = candidate.origin === "MANUAL_ADJUSTMENT" ? "MANUAL_ADJUSTMENT" : candidate.origin === "RAW_PUNCH" ? "RAW_PUNCH" : null;
    if (!id || !occurredAt || Number.isNaN(occurredAt.getTime()) || !punchCode || !origin) return [];
    return [{
      id,
      occurredAt,
      punchCode,
      origin,
      adjustmentId: typeof candidate.adjustmentId === "string" ? candidate.adjustmentId : undefined,
      reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
    }];
  });
  return { state: punches.length > 0 ? "AVAILABLE" : recordedMinutes > 0 ? "WAITING_FOR_RECALCULATION" : "EMPTY", punches };
}
