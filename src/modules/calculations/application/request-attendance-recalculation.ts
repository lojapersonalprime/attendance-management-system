import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { getCalculationReadiness, type CalculationReadiness } from "@/modules/calculations/application/calculation-readiness";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";

export type AttendanceRecalculationTrigger =
  | "IMPORT"
  | "SCHEDULE_CHANGE"
  | "EMPLOYMENT_PERIOD_CHANGE"
  | "POLICY_CHANGE"
  | "CLOCK_LINK_CHANGE"
  | "COVERAGE_CONFIRMED"
  | "ADJUSTMENT"
  | "MANUAL_RECALCULATION"
  | "PERIOD_REOPENED";

type PersistedTrigger = "IMPORT" | "SCHEDULE_CHANGE" | "EMPLOYMENT_PERIOD_CHANGE" | "POLICY_CHANGE" | "ADJUSTMENT" | "MANUAL_RECALCULATION" | "PERIOD_REOPENED" | "IMPORT_COVERAGE_CONFIRMED";

function persistedTrigger(trigger: AttendanceRecalculationTrigger): PersistedTrigger {
  if (trigger === "CLOCK_LINK_CHANGE") return "SCHEDULE_CHANGE";
  if (trigger === "COVERAGE_CONFIRMED") return "IMPORT_COVERAGE_CONFIRMED";
  return trigger;
}

export interface AttendanceRecalculationRequest {
  trigger: AttendanceRecalculationTrigger;
  employeeId?: string;
  importFileId?: string;
  dateFrom: string;
  dateTo: string;
  actorId?: string;
  reason: string;
}

export interface AttendanceRecalculationResult {
  calculationRunId: string | null;
  status: "NOT_REQUESTED" | "COMPLETED" | "PARTIAL" | "FAILED";
  totalDays: number;
  processedDays: number;
  failedDays: number;
  generatedInconsistencies: number;
  autoResolved: number;
  blockers: CalculationReadiness["blockers"];
  readiness: CalculationReadiness;
}

/**
 * Single bounded entry point for context changes. It never broadens a request
 * beyond the employee, requested dates, confirmed TXT coverage and open
 * competency discovered by getCalculationReadiness.
 */
export async function requestAttendanceRecalculation(input: AttendanceRecalculationRequest): Promise<AttendanceRecalculationResult> {
  if (!input.employeeId) {
    throw new Error("Informe o funcionário para solicitar o recálculo de apuração.");
  }
  const readiness = await getCalculationReadiness({ employeeId: input.employeeId, validFrom: input.dateFrom, validUntil: input.dateTo });
  if (readiness.recalculableDates.length === 0) {
    const prisma = getPrisma();
    const now = new Date();
    const calculationRun = await prisma.calculationRun.create({
      data: {
        trigger: persistedTrigger(input.trigger),
        importFileId: input.importFileId,
        employeeId: input.employeeId,
        dateFrom: new Date(`${input.dateFrom}T00:00:00.000Z`),
        dateTo: new Date(`${input.dateTo}T00:00:00.000Z`),
        status: "FAILED",
        totalDays: 0,
        processedDays: 0,
        failedDays: 0,
        startedById: input.actorId,
        startedAt: now,
        finishedAt: now,
        errorCode: "NO_ELIGIBLE_DAYS",
      },
    });
    if (input.actorId) {
      await prisma.auditLog.create({
        data: {
          userId: input.actorId,
          action: "CALCULATION_RUN_FAILED",
          entityType: "CalculationRun",
          entityId: calculationRun.id,
          newData: { trigger: input.trigger, dateFrom: input.dateFrom, dateTo: input.dateTo, blockers: readiness.blockers.map((item) => item.code) },
          reason: input.reason,
        },
      });
    }
    return { calculationRunId: calculationRun.id, status: "FAILED", totalDays: 0, processedDays: 0, failedDays: 0, generatedInconsistencies: 0, autoResolved: 0, blockers: readiness.blockers, readiness };
  }
  const calculation = await runCalculation({
    trigger: persistedTrigger(input.trigger),
    employeeId: input.employeeId,
    importFileId: input.importFileId,
    startedById: input.actorId,
    affectedDays: readiness.recalculableDates.map((date) => ({ employeeId: input.employeeId!, date })),
  });
  return {
    calculationRunId: calculation.calculationRunId,
    status: calculation.status,
    totalDays: readiness.recalculableDates.length,
    processedDays: calculation.processedDays,
    failedDays: calculation.failedDays,
    generatedInconsistencies: calculation.generatedInconsistencies,
    autoResolved: calculation.autoResolved,
    blockers: readiness.blockers,
    readiness,
  };
}
