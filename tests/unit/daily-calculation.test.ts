import { describe, expect, it } from "vitest";
import { calculateDailySummary, detectPossibleDuplicates, durationInWholeMinutes, recalculatePeriod, validateSequence } from "@/modules/calculations/domain/daily-calculation";

function punch(id: string, code: "S" | "E" | "A" | "F", clock: string) {
  return { id, punchCode: code, occurredAt: new Date(`2026-06-10T${clock}-03:00`) };
}

const regularPunches = [punch("1", "S", "08:00:25"), punch("2", "E", "12:00:25"), punch("3", "A", "13:00:00"), punch("4", "F", "17:10:00")];

describe("cálculo diário", () => {
  it("calcula S-E-A-F com minutos inteiros e excedente pendente", () => {
    const result = calculateDailySummary({ punches: regularPunches, schedule: { isWorkingDay: true, expectedMinutes: 480, expectedBreakMinutes: 60 } });
    expect(result.rawWorkedMinutes).toBe(490);
    expect(result.intervalMinutes).toBe(59);
    expect(result.pendingExcessMinutes).toBe(10);
    expect(result.positiveMinutes).toBe(0);
    expect(result.inconsistencies.some((issue) => issue.type === "EXCESS_TIME_PENDING")).toBe(true);
  });

  it("trunca duração para minutos completos", () => {
    expect(durationInWholeMinutes(new Date("2026-06-10T08:00:20-03:00"), new Date("2026-06-10T08:01:19-03:00"))).toBe(0);
  });

  it.each([
    [[punch("1", "S", "08:00:00")], "ODD_PUNCH_COUNT"],
    [[punch("1", "S", "08:00:00"), punch("2", "E", "12:00:00"), punch("3", "A", "13:00:00")], "ODD_PUNCH_COUNT"],
    [[...regularPunches, punch("5", "S", "18:00:00")], "ODD_PUNCH_COUNT"],
  ] as const)("marca quantidade incompleta como %s", (punches, issue) => {
    expect(validateSequence(punches).some((entry) => entry.type === issue)).toBe(true);
  });

  it("sinaliza sequência anormal", () => {
    const issues = validateSequence([punch("1", "S", "08:00:00"), punch("2", "A", "12:00:00"), punch("3", "E", "13:00:00"), punch("4", "F", "17:00:00")]);
    expect(issues.some((issue) => issue.type === "INVALID_SEQUENCE")).toBe(true);
  });

  it("sinaliza possível duplicidade sem removê-la", () => {
    const punches = [punch("1", "S", "08:00:00"), punch("2", "S", "08:01:30")];
    expect(detectPossibleDuplicates(punches)).toHaveLength(1);
    expect(punches).toHaveLength(2);
  });

  it("não inventa jornada e mantém dia para revisão", () => {
    const result = calculateDailySummary({ punches: regularPunches });
    expect(result.expectedMinutes).toBe(0);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.inconsistencies.some((issue) => issue.type === "MISSING_SCHEDULE")).toBe(true);
  });

  it("aplica ajuste sem modificar RawPunch e recalcula o resumo", () => {
    const original = structuredClone(regularPunches);
    const result = calculateDailySummary({
      punches: regularPunches,
      schedule: { isWorkingDay: true, expectedMinutes: 480 },
      adjustments: [{ id: "adjustment", minutesCredited: 15, minutesDebited: 0, status: "ACTIVE" }],
    });
    expect(regularPunches).toEqual(original);
    expect(result.validWorkedMinutes).toBe(505);
  });

  it("recalcula um período por chave de funcionário e data", () => {
    const result = recalculatePeriod([{ key: "employee-1|2026-06-10", punches: regularPunches, schedule: { isWorkingDay: true, expectedMinutes: 480 } }]);
    expect(result.get("employee-1|2026-06-10")?.rawWorkedMinutes).toBe(490);
  });
});
