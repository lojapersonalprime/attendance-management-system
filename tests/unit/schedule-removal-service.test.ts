import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOpenCalculationMonths: vi.fn(),
  getPrisma: vi.fn(),
  runCalculation: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/modules/audit/application/log", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/modules/calculations/application/closed-period-guard", () => ({ assertOpenCalculationMonths: mocks.assertOpenCalculationMonths }));
vi.mock("@/modules/calculations/application/calculation-run-service", () => ({ runCalculation: mocks.runCalculation }));

import { assignScheduleToEmployee, removeScheduleTemplate } from "@/modules/schedules/application/schedule-service";

const context = { userId: "rh-admin-1" };

describe("remoção operacional de modelo de horário", () => {
  const transaction = {
    employee: { findUniqueOrThrow: vi.fn() },
    scheduleTemplate: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    employeeScheduleAssignment: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    rawPunch: { deleteMany: vi.fn() },
    mobilePunch: { deleteMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOpenCalculationMonths.mockResolvedValue(undefined);
    mocks.runCalculation.mockResolvedValue({ calculationRunId: "run-1", processedDays: 2, failedDays: 0, generatedInconsistencies: 1, autoResolved: 0, status: "COMPLETED", durationMs: 1 });
    transaction.scheduleTemplate.findUniqueOrThrow.mockResolvedValue({ id: "schedule-1", name: "CLT - TI", active: true });
    transaction.scheduleTemplate.findMany.mockResolvedValue([{ id: "schedule-1", name: "CLT - TI" }]);
    transaction.scheduleTemplate.updateMany.mockResolvedValue({ count: 1 });
    transaction.employeeScheduleAssignment.findMany.mockResolvedValue([]);
    transaction.employeeScheduleAssignment.update.mockResolvedValue({ id: "assignment-1" });
    transaction.employeeScheduleAssignment.delete.mockResolvedValue({ id: "assignment-1" });
    mocks.getPrisma.mockReturnValue({ $transaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction) });
  });

  it("remove do catálogo um modelo sem funcionários sem apagar marcações", async () => {
    const result = await removeScheduleTemplate({ id: "schedule-1", context });

    expect(result.employeeIds).toEqual([]);
    expect(transaction.scheduleTemplate.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["schedule-1"] } }, data: { active: false } });
    expect(mocks.runCalculation).not.toHaveBeenCalled();
    expect(transaction.rawPunch.deleteMany).not.toHaveBeenCalled();
    expect(transaction.mobilePunch.deleteMany).not.toHaveBeenCalled();
  });

  it("encerra o vínculo de um funcionário e recalcula somente o dia operacional afetado", async () => {
    transaction.employeeScheduleAssignment.findMany.mockResolvedValue([
      { id: "assignment-1", employeeId: "employee-1", validFrom: new Date("2020-01-01T00:00:00.000Z"), _count: { dailySummaries: 3 } },
    ]);

    const result = await removeScheduleTemplate({ id: "schedule-1", context });

    expect(result.employeeIds).toEqual(["employee-1"]);
    expect(transaction.employeeScheduleAssignment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "assignment-1" }, data: expect.objectContaining({ reason: "Modelo removido do catálogo operacional." }) }));
    expect(mocks.runCalculation).toHaveBeenCalledWith(expect.objectContaining({ trigger: "SCHEDULE_CHANGE", affectedDays: [{ employeeId: "employee-1", date: expect.any(String) }] }));
  });

  it("encerra todos os vínculos atuais do modelo, sem criar substituto", async () => {
    transaction.employeeScheduleAssignment.findMany.mockResolvedValue([
      { id: "assignment-1", employeeId: "employee-1", validFrom: new Date("2020-01-01T00:00:00.000Z"), _count: { dailySummaries: 1 } },
      { id: "assignment-2", employeeId: "employee-2", validFrom: new Date("2020-01-01T00:00:00.000Z"), _count: { dailySummaries: 1 } },
    ]);

    await removeScheduleTemplate({ id: "schedule-1", context });

    expect(transaction.employeeScheduleAssignment.update).toHaveBeenCalledTimes(2);
    expect(mocks.runCalculation).toHaveBeenCalledWith(expect.objectContaining({ affectedDays: expect.arrayContaining([
      expect.objectContaining({ employeeId: "employee-1" }),
      expect.objectContaining({ employeeId: "employee-2" }),
    ]) }));
  });

  it("não muda modelo ou atribuições quando a competência atual está fechada", async () => {
    mocks.assertOpenCalculationMonths.mockRejectedValue(new Error("A competência está fechada."));

    await expect(removeScheduleTemplate({ id: "schedule-1", context })).rejects.toThrow("competência está fechada");

    expect(transaction.scheduleTemplate.updateMany).not.toHaveBeenCalled();
    expect(transaction.employeeScheduleAssignment.update).not.toHaveBeenCalled();
  });

  it("bloqueia uma nova vigência que alcance competência fechada antes de salvar", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue({ id: "employee-1", status: "ACTIVE" });
    mocks.assertOpenCalculationMonths.mockRejectedValue(new Error("A competência está fechada."));

    await expect(assignScheduleToEmployee({
      employeeId: "employee-1",
      value: { scheduleTemplateId: "schedule-2", validFrom: "2026-08-01", reason: "Troca de horário", retroactiveConfirmed: true },
      context,
    })).rejects.toThrow("competência está fechada");

    expect(transaction.scheduleTemplate.findUniqueOrThrow).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "schedule-2" } }));
  });
});
