import type { DailyCalculationEngineOutput, EngineInconsistency } from "@/modules/calculations/domain/calculation-engine";

export interface DailySummaryPersistenceContext {
  scheduleAssignmentId: string | null;
  employmentPeriodId: string | null;
  calculationPolicyId: string | null;
  calculationRunId: string;
  issues: readonly EngineInconsistency[];
  status?: DailyCalculationEngineOutput["status"];
}

/**
 * The complete derived result is written together. Keeping this mapping in one
 * place prevents an older DailySummary field from surviving a newer engine
 * calculation (for example a partial value after a complete second period).
 */
export function buildDailySummaryPersistenceData(
  calculation: DailyCalculationEngineOutput,
  context: DailySummaryPersistenceContext,
) {
  return {
    scheduleAssignmentId: context.scheduleAssignmentId,
    employmentPeriodId: context.employmentPeriodId,
    calculationPolicyId: context.calculationPolicyId,
    calculationRunId: context.calculationRunId,
    expectedMinutes: calculation.expectedMinutes,
    rawWorkedMinutes: calculation.recordedMinutes,
    validWorkedMinutes: calculation.consideredMinutes,
    intervalMinutes: calculation.breakMinutes,
    positiveMinutes: calculation.approvedPositiveMinutes,
    negativeMinutes: calculation.negativeMinutes,
    pendingExcessMinutes: calculation.pendingExcessMinutes,
    recordedMinutes: calculation.recordedMinutes,
    consideredMinutes: calculation.consideredMinutes,
    workedMinutes: calculation.workedMinutes,
    breakMinutes: calculation.breakMinutes,
    lateMinutes: calculation.lateMinutes,
    earlyDepartureMinutes: calculation.earlyDepartureMinutes,
    shortBreakMinutes: calculation.shortBreakMinutes,
    longBreakMinutes: calculation.longBreakMinutes,
    rawExcessMinutes: calculation.rawExcessMinutes,
    absenceMinutes: calculation.absenceMinutes,
    status: context.status ?? calculation.status,
    calculationEngineVersion: calculation.calculationVersion,
    calculationMemory: {
      ...calculation.memory,
      inconsistencies: context.issues.map(({ type, severity }) => ({ type, severity })),
    },
    calculatedAt: new Date(),
  };
}
