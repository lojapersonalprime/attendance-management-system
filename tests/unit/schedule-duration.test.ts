import { describe, expect, it } from "vitest";
import { formatMinutes } from "@/lib/dates/business";
import { calculateScheduleDayDuration } from "@/modules/schedules/domain/duration";

describe("duração derivada da jornada", () => {
  it("calcula 08–12 / 13–18 como 9h e intervalo de 1h", () => {
    const result = calculateScheduleDayDuration({ isWorkingDay: true, requiresBreak: true, expectedEntry: "08:00", expectedBreakStart: "12:00", expectedBreakEnd: "13:00", expectedExit: "18:00" });
    expect(result).toMatchObject({ expectedMinutes: 540, expectedBreakMinutes: 60, formattedExpectedDuration: "9h", formattedBreakDuration: "1h", validationResult: { valid: true } });
  });

  it("ignora minutos esperados enviados pelo navegador e deriva o total dos horários", () => {
    const payload = { isWorkingDay: true, requiresBreak: true, expectedEntry: "08:00", expectedBreakStart: "12:00", expectedBreakEnd: "13:00", expectedExit: "18:00", expectedMinutes: 1, expectedBreakMinutes: 1 };
    const result = calculateScheduleDayDuration(payload);
    expect(result.expectedMinutes).toBe(540);
    expect(result.expectedBreakMinutes).toBe(60);
  });

  it("calcula jornada sem intervalo", () => {
    expect(calculateScheduleDayDuration({ isWorkingDay: true, requiresBreak: false, expectedEntry: "08:00", expectedExit: "14:00" }).expectedMinutes).toBe(360);
  });

  it("projeta cinco dias de 08:00–13:00 sem intervalo como 25h semanais", () => {
    const dailyMinutes = calculateScheduleDayDuration({ isWorkingDay: true, requiresBreak: false, expectedEntry: "08:00", expectedExit: "13:00" }).expectedMinutes;
    const workingDays = 5;
    expect(dailyMinutes).toBe(300);
    expect(workingDays).toBe(5);
    expect(dailyMinutes * workingDays).toBe(1_500);
    expect(formatMinutes(dailyMinutes * workingDays)).toBe("25h");
  });

  it("mantém folga sem horas", () => {
    expect(calculateScheduleDayDuration({ isWorkingDay: false, requiresBreak: false }).expectedMinutes).toBe(0);
  });

  it("rejeita sequência de intervalo inválida", () => {
    expect(calculateScheduleDayDuration({ isWorkingDay: true, requiresBreak: true, expectedEntry: "08:00", expectedBreakStart: "12:00", expectedBreakEnd: "12:00", expectedExit: "18:00" }).validationResult.valid).toBe(false);
  });

  it("formata durações para RH", () => {
    expect([formatMinutes(0), formatMinutes(30), formatMinutes(60), formatMinutes(90), formatMinutes(540)]).toEqual(["0h", "30min", "1h", "1h30", "9h"]);
  });
});
