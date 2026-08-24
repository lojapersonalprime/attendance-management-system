import { describe, expect, it } from "vitest";
import { calculateDailyWithEngine, type EngineCalculationPolicy } from "@/modules/calculations/domain/calculation-engine";
import { normalizeMobilePunches } from "@/modules/mobile-attendance/domain/normalization";

function mobile(id: string, time: string) {
  return { id, employeeId: "golden", occurredAt: new Date(`2026-08-07T${time}-03:00`) };
}

const policy: EngineCalculationPolicy = { id: "policy", name: "Piloto", requiresSchedule: true, calculateLateArrival: true, calculateEarlyDeparture: true, calculateAbsence: true, calculateNegativeBalance: true, calculateExcessTime: true, excessRequiresApproval: true, requiresBreak: true, shortBreakGeneratesCredit: false, longBreakGeneratesDebit: true, allowAutomaticPositiveBalance: false, attendanceOnly: false, flexibleSchedule: false, duplicateWindowMinutes: 2, entryToleranceMinutes: 10, exitToleranceMinutes: 0, breakToleranceMinutes: 0, toleranceMode: "FULL_EVENT", entryToleranceMode: "FULL_DELAY_AFTER_TOLERANCE" };
const period = { id: "period", employmentType: "EMPLOYEE" as const, calculationPolicyId: "policy", validFrom: "2026-08-01", validUntil: null };
const schedule = { id: "schedule", name: "Golden", isWorkingDay: true, expectedEntry: "10:00", expectedBreakStart: "14:00", expectedBreakEnd: "15:00", expectedExit: "19:00", expectedMinutes: 480, expectedBreakMinutes: 60, minimumBreakMinutes: 30, requiresBreak: true };

describe("mobile attendance normalization", () => {
  it("interpreta quatro batidas neutras com intervalo sem alterar a origem", () => {
    const source = [mobile("1", "09:58:00"), mobile("2", "14:02:00"), mobile("3", "15:01:00"), mobile("4", "19:03:00")];
    const original = structuredClone(source);
    const normalized = normalizeMobilePunches(source, true);
    expect(source).toEqual(original);
    expect(normalized.map((punch) => punch.punchCode)).toEqual(["S", "E", "A", "F"]);
    const result = calculateDailyWithEngine({ businessDate: "2026-08-07", employeeId: "golden", rawPunches: normalized, employmentPeriod: period, policy, schedule, hasMobilePunches: true });
    expect(result.memory.sourceRawPunchIds).toEqual([]);
    expect(result.memory.sourceMobilePunchIds).toEqual(["1", "2", "3", "4"]);
    expect(result.recordedMinutes).toBe(486);
    expect(result.breakMinutes).toBe(59);
  });

  it("interpreta jornada sem intervalo como entrada e saída", () => {
    const normalized = normalizeMobilePunches([mobile("1", "08:00:00"), mobile("2", "13:00:00")], false);
    expect(normalized.map((punch) => punch.punchCode)).toEqual(["S", "F"]);
    const result = calculateDailyWithEngine({ businessDate: "2026-08-07", employeeId: "golden", rawPunches: normalized, employmentPeriod: period, policy: { ...policy, requiresBreak: false }, schedule: { ...schedule, requiresBreak: false, expectedBreakStart: null, expectedBreakEnd: null, expectedBreakMinutes: 0, minimumBreakMinutes: null, expectedExit: "13:00", expectedMinutes: 300 }, hasMobilePunches: true });
    expect(result.recordedMinutes).toBe(300);
    expect(result.inconsistencies.map((issue) => issue.type)).not.toContain("INCOMPLETE_DAY");
  });

  it("sinaliza registros mobile extras para revisão", () => {
    const normalized = normalizeMobilePunches([mobile("1", "08:00:00"), mobile("2", "10:00:00"), mobile("3", "10:05:00"), mobile("4", "12:00:00"), mobile("5", "13:00:00"), mobile("6", "18:00:00")], true);
    const result = calculateDailyWithEngine({ businessDate: "2026-08-07", employeeId: "golden", rawPunches: normalized, employmentPeriod: period, policy, schedule, hasMobilePunches: true });
    expect(result.inconsistencies.map((issue) => issue.type)).toContain("MOBILE_PUNCHES_EXCEED_EXPECTED");
  });

  it("não trata presença mobile como cobertura de TXT para falta", () => {
    const result = calculateDailyWithEngine({ businessDate: "2026-08-07", employeeId: "golden", rawPunches: [normalizeMobilePunches([mobile("1", "08:00:00")], false)[0]!], employmentPeriod: period, policy, schedule, coverage: [], hasMobilePunches: true });
    expect(result.inconsistencies.map((issue) => issue.type)).not.toContain("IMPORT_COVERAGE_UNCONFIRMED");
  });
});
