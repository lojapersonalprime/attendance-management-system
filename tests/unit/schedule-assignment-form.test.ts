import { describe, expect, it } from "vitest";

import { normalizeScheduleAssignmentDate, parseScheduleAssignmentFormData } from "@/modules/schedules/application/schedule-assignment-form";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("FormData de atribuição de jornada", () => {
  it("normaliza datas pt-BR sem usar o parser implícito do Date", () => {
    expect(normalizeScheduleAssignmentDate("19/03/2026", "data de início", true)).toBe("2026-03-19");
    expect(normalizeScheduleAssignmentDate("15/07/2026", "data final")).toBe("2026-07-15");
  });

  it("aceita os valores enviados por um formulário de navegador", () => {
    const input = parseScheduleAssignmentFormData(formData({
      employeeId: "employee",
      scheduleTemplateId: "schedule",
      validFrom: "2026-03-19",
      validUntil: "2026-07-15",
      reason: "Atribuição inicial",
      confirmRetroactive: "on",
      recalculateAffectedDays: "on",
      recalculateUntil: "2026-07-15",
    }));

    expect(input).toMatchObject({
      employeeId: "employee",
      assignment: { scheduleTemplateId: "schedule", validFrom: "2026-03-19", validUntil: "2026-07-15", retroactiveConfirmed: true },
      recalculateAffectedDays: true,
      recalculateUntil: "2026-07-15",
    });
  });

  it("mantém campos opcionais vazios como undefined e checkbox ausente como falso", () => {
    const input = parseScheduleAssignmentFormData(formData({
      employeeId: "employee",
      scheduleTemplateId: "schedule",
      validFrom: "19/03/2026",
      validUntil: "",
      recalculateUntil: "",
      reason: "Atribuição inicial",
    }));

    expect(input.assignment.validUntil).toBeUndefined();
    expect(input.recalculateUntil).toBeUndefined();
    expect(input.assignment.retroactiveConfirmed).toBe(false);
    expect(input.recalculateAffectedDays).toBe(false);
  });

  it("aceita os nomes antigos durante a transição do formulário", () => {
    const input = parseScheduleAssignmentFormData(formData({
      employeeId: "employee",
      scheduleTemplateId: "schedule",
      validFrom: "2026-03-19",
      reason: "Atribuição inicial",
      retroactiveConfirmed: "on",
      recalculate: "on",
    }));

    expect(input.assignment.retroactiveConfirmed).toBe(true);
    expect(input.recalculateAffectedDays).toBe(true);
  });

  it("rejeita data inválida, fim anterior e data inicial ausente", () => {
    expect(() => normalizeScheduleAssignmentDate("31/02/2026", "data de início", true)).toThrow("data de início válida");
    expect(() => parseScheduleAssignmentFormData(formData({ employeeId: "employee", scheduleTemplateId: "schedule", validFrom: "", reason: "Atribuição inicial" }))).toThrow("data de início");
    expect(() => parseScheduleAssignmentFormData(formData({ employeeId: "employee", scheduleTemplateId: "schedule", validFrom: "2026-07-15", validUntil: "2026-03-19", reason: "Atribuição inicial" }))).toThrow("data final");
  });
});
