import { describe, expect, it } from "vitest";
import { calculateDailyWithEngine, type EngineCalculationPolicy } from "@/modules/calculations/domain/calculation-engine";
import { buildDailySummaryPersistenceData } from "@/modules/calculations/domain/daily-summary-persistence";

const policy: EngineCalculationPolicy = {
  id: "policy",
  name: "Política de teste",
  requiresSchedule: true,
  calculateLateArrival: true,
  calculateEarlyDeparture: true,
  calculateAbsence: true,
  calculateNegativeBalance: true,
  calculateExcessTime: true,
  excessRequiresApproval: true,
  requiresBreak: true,
  shortBreakGeneratesCredit: false,
  longBreakGeneratesDebit: true,
  allowAutomaticPositiveBalance: false,
  attendanceOnly: false,
  flexibleSchedule: false,
  duplicateWindowMinutes: 2,
  entryToleranceMinutes: 0,
  exitToleranceMinutes: 0,
  breakToleranceMinutes: 0,
  toleranceMode: "FULL_EVENT",
};

describe("persistência do DailySummary", () => {
  it("substitui todos os campos derivados quando quatro batidas completam um dia antes parcial", () => {
    const calculation = calculateDailyWithEngine({
      businessDate: "2026-07-09",
      employeeId: "employee",
      rawPunches: [
        { id: "s", punchCode: "S", occurredAt: new Date("2026-07-09T07:59:29-03:00"), importFileId: "import" },
        { id: "e", punchCode: "E", occurredAt: new Date("2026-07-09T12:10:57-03:00"), importFileId: "import" },
        { id: "a", punchCode: "A", occurredAt: new Date("2026-07-09T13:12:30-03:00"), importFileId: "import" },
        { id: "f", punchCode: "F", occurredAt: new Date("2026-07-09T18:03:39-03:00"), importFileId: "import" },
      ],
      employmentPeriod: { id: "period", employmentType: "EMPLOYEE", validFrom: "2026-07-01", calculationPolicyId: policy.id },
      policy,
      schedule: { id: "schedule", assignmentId: "assignment", name: "Jornada", isWorkingDay: true, expectedEntry: "08:00", expectedBreakStart: "12:00", expectedBreakEnd: "13:00", expectedExit: "18:00", expectedMinutes: 540, expectedBreakMinutes: 60, minimumBreakMinutes: 30, requiresBreak: true },
      coverage: [{ importFileId: "import", coverageFrom: "2026-07-01", coverageTo: "2026-07-31", status: "CONFIRMED" }],
    });

    const summary = buildDailySummaryPersistenceData(calculation, {
      scheduleAssignmentId: "assignment",
      employmentPeriodId: "period",
      calculationPolicyId: policy.id,
      calculationRunId: "run",
      issues: calculation.inconsistencies,
    });

    expect(summary).toMatchObject({
      expectedMinutes: 540,
      rawWorkedMinutes: 543,
      validWorkedMinutes: 543,
      recordedMinutes: 543,
      consideredMinutes: 543,
      workedMinutes: 543,
      intervalMinutes: 62,
      breakMinutes: 62,
      pendingExcessMinutes: 3,
      calculationEngineVersion: "calculation-engine-v1",
      calculationRunId: "run",
      status: "NEEDS_REVIEW",
    });
    expect(summary.calculationMemory.inconsistencies).not.toContainEqual({ type: "INCOMPLETE_DAY", severity: "CRITICAL" });
  });
});
