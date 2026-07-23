import { describe, expect, it } from "vitest";

import { getCalculationPresentationState } from "@/modules/calculations/domain/calculation-presentation-state";
import { resolvePunchEmployeeId } from "@/modules/calculations/domain/clock-link-resolution";
import { selectScheduleDayForBusinessDate, weekdayForBusinessDate } from "@/modules/schedules/domain/schedule-context";
import { addBusinessDateDays, businessDateTimeToUtc, formatBusinessDate, toBusinessDate } from "@/lib/dates/business";

describe("recuperação do contexto de cálculo", () => {
  it("mantém 14/07/2026 como terça-feira, sem deslocamento de fuso", () => {
    expect(weekdayForBusinessDate("2026-07-14")).toBe(2);
    expect(selectScheduleDayForBusinessDate([
      { weekday: 1, isWorkingDay: true, key: "segunda" },
      { weekday: 2, isWorkingDay: true, key: "terça" },
    ], "2026-07-14")?.key).toBe("terça");
  });

  it.each([
    ["2026-07-08", 3, "quarta-feira"],
    ["2026-07-09", 4, "quinta-feira"],
    ["2026-07-10", 5, "sexta-feira"],
    ["2026-07-11", 6, "sábado"],
    ["2026-07-12", 0, "domingo"],
    ["2026-07-13", 1, "segunda-feira"],
    ["2026-07-14", 2, "terça-feira"],
  ])("resolve %s como %s (%s) sem conversão de timezone", (businessDate, weekday) => {
    expect(weekdayForBusinessDate(businessDate)).toBe(weekday);
  });

  it("forma o fim exclusivo do intervalo no próximo dia de negócio", () => {
    const nextDate = addBusinessDateDays("2026-07-13", 1);
    expect(nextDate).toBe("2026-07-14");
    expect(toBusinessDate(businessDateTimeToUtc(`${nextDate} 00:00:00`))).toBe("2026-07-14");
  });

  it("não desloca um campo DATE do banco ao formatá-lo para a interface", () => {
    const dateOnlyFromPostgres = new Date("2026-07-13T00:00:00.000Z");
    expect(formatBusinessDate(dateOnlyFromPostgres, "dd/MM/yyyy")).toBe("13/07/2026");
  });

  it("resolve marcação antiga pelo dispositivo, código do relógio e vigência", () => {
    const employeeId = resolvePunchEmployeeId({
      deviceId: "device", externalEmployeeNumber: "123", employeeDeviceLinkId: null, businessDate: "2026-07-14",
    }, [{
      id: "link", employeeId: "employee", deviceId: "device", externalEmployeeNumber: "123", validFrom: "2026-03-19", validUntil: "2026-07-15",
    }]);
    expect(employeeId).toBe("employee");
  });

  it("não apresenta um resumo sem contexto como 0h calculado", () => {
    expect(getCalculationPresentationState({
      calculationMemory: { legacy: true }, calculationEngineVersion: "calculation-engine-v1", scheduleAssignmentId: null,
      employmentPeriodId: "period", calculationPolicyId: "policy", inconsistencyTypes: ["MISSING_SCHEDULE"],
    })).toBe("PENDING_CONTEXT");
  });

  it("distingue dia incompleto de um cálculo regular", () => {
    expect(getCalculationPresentationState({
      calculationMemory: { calculated: true }, calculationEngineVersion: "calculation-engine-v1", scheduleAssignmentId: "schedule",
      employmentPeriodId: "period", calculationPolicyId: "policy", inconsistencyTypes: ["MISSING_EXIT", "INCOMPLETE_DAY"],
    })).toBe("INCOMPLETE");
  });
});
