import { describe, expect, it } from "vitest";
import { excludeClosedMonths, requiresRetroactiveConfirmation } from "@/modules/calculations/domain/recalculation-window";
import { scheduleAssignmentInputSchema, scheduleDaySchema, scheduleTemplateInputSchema } from "@/modules/employees/domain/validation";

function workDay(weekday: number, overrides: Record<string, unknown> = {}) {
  return { weekday, isWorkingDay: true, expectedEntry: "08:00", expectedBreakStart: "12:00", expectedBreakEnd: "13:00", expectedExit: "17:00", expectedMinutes: 480, expectedBreakMinutes: 60, minimumBreakMinutes: 30, entryToleranceMinutes: 5, exitToleranceMinutes: 5, requiresBreak: true, excessRequiresApproval: true, ...overrides };
}

function dayOff(weekday: number) {
  return { weekday, isWorkingDay: false, expectedMinutes: 0, expectedBreakMinutes: 0, entryToleranceMinutes: 0, exitToleranceMinutes: 0, requiresBreak: false, excessRequiresApproval: true };
}

describe("modelos de jornada", () => {
  it("aceita jornada trabalhada com intervalo coerente", () => {
    expect(scheduleDaySchema.safeParse(workDay(1)).success).toBe(true);
  });

  it("aceita jornada sem intervalo", () => {
    expect(scheduleDaySchema.safeParse(workDay(6, { expectedBreakStart: undefined, expectedBreakEnd: undefined, expectedExit: "16:00", expectedMinutes: 480, expectedBreakMinutes: 0, minimumBreakMinutes: undefined, requiresBreak: false })).success).toBe(true);
  });

  it("aceita valores vazios do formulário para horários opcionais", () => {
    expect(scheduleDaySchema.safeParse(workDay(6, { expectedBreakStart: "", expectedBreakEnd: "", expectedExit: "16:00", expectedMinutes: 480, expectedBreakMinutes: 0, minimumBreakMinutes: undefined, requiresBreak: false })).success).toBe(true);
  });

  it("rejeita saída anterior à entrada", () => {
    expect(scheduleDaySchema.safeParse(workDay(1, { expectedExit: "07:00" })).success).toBe(false);
  });

  it("rejeita retorno anterior à saída do intervalo", () => {
    expect(scheduleDaySchema.safeParse(workDay(1, { expectedBreakEnd: "11:30" })).success).toBe(false);
  });

  it("rejeita minutos de intervalo incoerentes", () => {
    expect(scheduleDaySchema.safeParse(workDay(1, { expectedBreakMinutes: 30 })).success).toBe(false);
  });

  it("rejeita minutos de intervalo quando não há intervalo configurado", () => {
    expect(scheduleDaySchema.safeParse(workDay(6, { expectedBreakStart: "", expectedBreakEnd: "", expectedExit: "16:00", expectedMinutes: 480, expectedBreakMinutes: 15, minimumBreakMinutes: undefined, requiresBreak: false })).success).toBe(false);
  });

  it("rejeita horário em dia não trabalhado", () => {
    expect(scheduleDaySchema.safeParse({ ...dayOff(0), expectedEntry: "08:00" }).success).toBe(false);
  });

  it("rejeita tolerância residual em dia não trabalhado", () => {
    expect(scheduleDaySchema.safeParse({ ...dayOff(0), entryToleranceMinutes: 5 }).success).toBe(false);
  });

  it("exige os sete dias da semana", () => {
    const days = [dayOff(0), workDay(1), workDay(2), workDay(3), workDay(4), workDay(5), dayOff(6)];
    expect(scheduleTemplateInputSchema.safeParse({ name: "Jornada sintética", days }).success).toBe(true);
    expect(scheduleTemplateInputSchema.safeParse({ name: "Jornada sintética", days: days.slice(0, 6) }).success).toBe(false);
  });

  it("valida a vigência de atribuição", () => {
    expect(scheduleAssignmentInputSchema.safeParse({ scheduleTemplateId: "schedule", validFrom: "2026-07-10", validUntil: "2026-07-09", reason: "Teste" }).success).toBe(false);
    expect(scheduleAssignmentInputSchema.safeParse({ scheduleTemplateId: "schedule", validFrom: "2026-07-10", reason: "Atribuição inicial" }).success).toBe(true);
  });
});

describe("recálculo controlado", () => {
  it("exige confirmação para atribuição retroativa", () => {
    expect(requiresRetroactiveConfirmation("2026-06-30", "2026-07-17")).toBe(true);
    expect(requiresRetroactiveConfirmation("2026-07-17", "2026-07-17")).toBe(false);
  });

  it("ignora competências fechadas e mantém os outros dias idempotentes", () => {
    expect(excludeClosedMonths(["2026-06-30", "2026-07-01", "2026-07-01"], ["2026-06-01"])).toEqual(["2026-07-01"]);
  });
});
