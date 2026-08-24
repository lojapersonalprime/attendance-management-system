import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/modules/audit/application/log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { removeEmployee } from "@/modules/employees/application/employee-service";

const countKeys = [
  "deviceLinks", "scheduleAssignments", "tagAssignments", "calendarExceptions", "dailySummaries", "inconsistencies", "adjustments", "employmentPeriods", "calculationRuns", "hrCalculationValidations", "mobilePunches", "attendanceCorrectionRequests", "mergedEmployees",
] as const;

function employee(overrides: Partial<{ status: string; mobileAccess: { id: string; profileId: string; active: boolean } | null; relatedRecords: number }> = {}) {
  const counts = Object.fromEntries(countKeys.map((key) => [key, 0]));
  if (overrides.relatedRecords) counts.dailySummaries = overrides.relatedRecords;
  return {
    id: "employee-1",
    fullName: "João Silva",
    status: overrides.status ?? "ACTIVE",
    mobileAccess: overrides.mobileAccess ?? null,
    _count: counts,
  };
}

describe("serviço de remoção de funcionário", () => {
  const transaction = {
    employee: { findUniqueOrThrow: vi.fn(), delete: vi.fn(), update: vi.fn() },
    employeeMobileAccess: { update: vi.fn() },
  };
  const context = { userId: "rh-admin-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrisma.mockReturnValue({ $transaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction) });
  });

  it.each(["ACTIVE", "INACTIVE", "TERMINATED"])("exclui definitivamente um cadastro %s elegível e deixa trilha de auditoria", async (status) => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee({ status }));

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "João Silva" }, context)).resolves.toEqual({ mode: "DELETE" });

    expect(transaction.employee.delete).toHaveBeenCalledWith({ where: { id: "employee-1" } });
    expect(transaction.employee.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(transaction, context, expect.objectContaining({ action: "EMPLOYEE_DELETED", entityType: "Employee" }));
  });

  it("preserva registros, arquiva o cadastro e bloqueia o acesso mobile", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee({ relatedRecords: 2, mobileAccess: { id: "access-1", profileId: "profile-1", active: true } }));
    transaction.employee.update.mockResolvedValue({ id: "employee-1", fullName: "João Silva", status: "INACTIVE" });

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "João Silva" }, context)).resolves.toEqual({ mode: "ARCHIVE", mobileAccessDeactivated: true });

    expect(transaction.employee.delete).not.toHaveBeenCalled();
    expect(transaction.employee.update).toHaveBeenCalledWith({ where: { id: "employee-1" }, data: { status: "INACTIVE" } });
    expect(transaction.employeeMobileAccess.update).toHaveBeenCalledWith({ where: { id: "access-1" }, data: { active: false } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(transaction, context, expect.objectContaining({ action: "EMPLOYEE_ARCHIVED", newData: expect.objectContaining({ historyPreserved: true, supabaseAuthAccountPreserved: true }) }));
  });

  it("não altera nada quando a confirmação não corresponde ao nome", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee());

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "Outro nome" }, context)).rejects.toThrow("Digite o nome completo");

    expect(transaction.employee.delete).not.toHaveBeenCalled();
    expect(transaction.employee.update).not.toHaveBeenCalled();
    expect(transaction.employeeMobileAccess.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
