import { describe, expect, it } from "vitest";
import { findEmployeeIdentityConflicts } from "@/modules/employees/domain/identity";
import { findMergeConflicts, hasOverlappingDeviceLink } from "@/modules/employees/domain/relationships";
import { completeProvisionalEmployeeSchema, deviceLinkInputSchema, directoryEntrySchema, employeeInputSchema } from "@/modules/employees/domain/validation";

const baseEmployee = {
  fullName: "Pessoa Sintética",
  employmentType: "EMPLOYEE" as const,
  status: "ACTIVE" as const,
  tagIds: [],
};

describe("gestão de funcionários", () => {
  it("aceita os tipos estruturados de vínculo", () => {
    expect(employeeInputSchema.parse({ ...baseEmployee, employmentType: "INTERN" }).employmentType).toBe("INTERN");
    expect(employeeInputSchema.parse({ ...baseEmployee, employmentType: "APPRENTICE" }).employmentType).toBe("APPRENTICE");
    expect(employeeInputSchema.parse({ ...baseEmployee, employmentType: "CONTRACTOR" }).employmentType).toBe("CONTRACTOR");
  });

  it("normaliza CPF opcional sem expor um valor completo", () => {
    expect(employeeInputSchema.parse({ ...baseEmployee, cpf: "000.000.000-00" }).cpf).toBe("00000000000");
  });

  it("exige data de desligamento ao terminar", () => {
    expect(employeeInputSchema.safeParse({ ...baseEmployee, status: "TERMINATED" }).success).toBe(false);
  });

  it("aceita campos opcionais vazios enviados por formulários HTML", () => {
    const result = employeeInputSchema.parse({ ...baseEmployee, admissionDate: "", terminationDate: "", cpf: "" });
    expect(result.admissionDate).toBeUndefined();
    expect(result.terminationDate).toBeUndefined();
    expect(result.cpf).toBeUndefined();
  });

  it("rejeita desligamento anterior à admissão", () => {
    expect(employeeInputSchema.safeParse({ ...baseEmployee, admissionDate: "2026-07-10", terminationDate: "2026-07-09" }).success).toBe(false);
  });

  it("exige unidade e admissão ao concluir provisório", () => {
    expect(completeProvisionalEmployeeSchema.safeParse(baseEmployee).success).toBe(false);
    expect(completeProvisionalEmployeeSchema.safeParse({ ...baseEmployee, unitId: "unit-synthetic", admissionDate: "2026-07-01" }).success).toBe(true);
  });

  it("permite homônimos e detecta apenas conflito de matrícula", () => {
    const people = [{ id: "one", registration: "REG-1", cpf: null }, { id: "two", registration: null, cpf: null }];
    expect(findEmployeeIdentityConflicts({ registration: undefined, cpf: undefined }, people)).toEqual([]);
    expect(findEmployeeIdentityConflicts({ registration: "REG-1", cpf: undefined }, people)).toEqual(["REGISTRATION"]);
  });

  it("detecta conflito de CPF opcional", () => {
    expect(findEmployeeIdentityConflicts({ cpf: "00000000000" }, [{ id: "one", cpf: "00000000000" }])).toEqual(["CPF"]);
  });

  it("ignora o próprio funcionário ao editar identidade", () => {
    expect(findEmployeeIdentityConflicts({ registration: "REG-1" }, [{ id: "one", registration: "REG-1" }], "one")).toEqual([]);
  });

  it("valida janela de vínculo de relógio", () => {
    expect(deviceLinkInputSchema.safeParse({ deviceId: "device", externalEmployeeNumber: "10", validFrom: "2026-07-10", validUntil: "2026-07-09" }).success).toBe(false);
  });

  it("detecta sobreposição ativa de EnNo e permite histórico encerrado", () => {
    const existing = [{ id: "old", validFrom: "2026-01-01", validUntil: null, active: true }];
    expect(hasOverlappingDeviceLink(existing, { id: "candidate", validFrom: "2026-07-01", validUntil: null, active: true })).toBe(true);
    expect(hasOverlappingDeviceLink([{ id: "old", validFrom: "2026-01-01", validUntil: null, active: false }], { id: "candidate", validFrom: "2026-07-01", validUntil: null, active: true })).toBe(false);
  });

  it("valida cadastro estruturado de tag", () => {
    expect(directoryEntrySchema.safeParse({ name: "" }).success).toBe(false);
    expect(directoryEntrySchema.parse({ name: "Horário especial" }).name).toBe("Horário especial");
  });
});

describe("mesclagem auditável", () => {
  const primary = {
    id: "primary", registration: "REG-1", cpf: null, scheduleAssignments: [], deviceLinks: [], dailySummaryDates: ["2026-07-01"], tagIds: ["tag-a"],
  };

  it("mostra conflito de matrícula antes de mesclar", () => {
    expect(findMergeConflicts(primary, { ...primary, id: "secondary", registration: "REG-2", dailySummaryDates: [], tagIds: [] }).some((conflict) => conflict.code === "REGISTRATION_MISMATCH" && conflict.blocking)).toBe(true);
  });

  it("mostra conflito de CPF antes de mesclar", () => {
    expect(findMergeConflicts({ ...primary, cpf: "00000000000" }, { ...primary, id: "secondary", registration: null, cpf: "11111111111", dailySummaryDates: [], tagIds: [] }).some((conflict) => conflict.code === "CPF_MISMATCH")).toBe(true);
  });

  it("bloqueia jornadas sobrepostas", () => {
    const conflicts = findMergeConflicts({ ...primary, scheduleAssignments: [{ id: "a", validFrom: "2026-01-01", validUntil: null }] }, { ...primary, id: "secondary", registration: null, scheduleAssignments: [{ id: "b", validFrom: "2026-06-01", validUntil: null }], dailySummaryDates: [], tagIds: [] });
    expect(conflicts.some((conflict) => conflict.code === "SCHEDULE_OVERLAP" && conflict.blocking)).toBe(true);
  });

  it("bloqueia apurações duplicadas e avisa tags repetidas", () => {
    const conflicts = findMergeConflicts(primary, { ...primary, id: "secondary", registration: null, dailySummaryDates: ["2026-07-01"], tagIds: ["tag-a"] });
    expect(conflicts.some((conflict) => conflict.code === "DAILY_SUMMARY_DUPLICATE" && conflict.blocking)).toBe(true);
    expect(conflicts.some((conflict) => conflict.code === "DUPLICATE_TAG" && !conflict.blocking)).toBe(true);
  });
});
