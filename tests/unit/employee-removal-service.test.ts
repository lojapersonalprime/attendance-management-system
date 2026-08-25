import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/modules/audit/application/log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { removeEmployee } from "@/modules/employees/application/employee-service";

function employee(overrides: Partial<{ status: string; mobileAccess: { id: string; profileId: string } | null; mergedEmployees: number }> = {}) {
  return {
    id: "employee-1",
    fullName: "João Silva",
    status: overrides.status ?? "ACTIVE",
    mobileAccess: overrides.mobileAccess ?? null,
    _count: { mergedEmployees: overrides.mergedEmployees ?? 0 },
  };
}

describe("serviço de exclusão operacional de funcionário", () => {
  const transaction = {
    employee: { findUniqueOrThrow: vi.fn(), delete: vi.fn() },
    rawPunch: { count: vi.fn() },
    attendanceCorrectionRequest: { deleteMany: vi.fn() },
    adjustment: { deleteMany: vi.fn() },
    mobilePunch: { deleteMany: vi.fn() },
    employeeMobileAccess: { deleteMany: vi.fn() },
    hrCalculationValidation: { deleteMany: vi.fn() },
    inconsistency: { deleteMany: vi.fn() },
    dailySummary: { deleteMany: vi.fn() },
    calendarException: { deleteMany: vi.fn() },
    employeeTagAssignment: { deleteMany: vi.fn() },
    employeeScheduleAssignment: { deleteMany: vi.fn() },
    employeeEmploymentPeriod: { deleteMany: vi.fn() },
    calculationRun: { deleteMany: vi.fn() },
    employeeDeviceLink: { updateMany: vi.fn() },
  };
  const context = { userId: "rh-admin-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.rawPunch.count.mockResolvedValue(4);
    for (const group of Object.values(transaction)) {
      for (const method of Object.values(group)) {
        if ("mockResolvedValue" in method && method !== transaction.rawPunch.count) method.mockResolvedValue({ count: 1 });
      }
    }
    mocks.getPrisma.mockReturnValue({ $transaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction) });
  });

  it.each(["ACTIVE", "INACTIVE", "TERMINATED", "PENDING"])("exclui cadastro %s e seus dados operacionais", async (status) => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee({ status }));

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "João Silva" }, context)).resolves.toEqual({ mode: "DELETE", mobileAccessRemoved: false });

    expect(transaction.dailySummary.deleteMany).toHaveBeenCalledWith({ where: { employeeId: "employee-1" } });
    expect(transaction.inconsistency.deleteMany).toHaveBeenCalled();
    expect(transaction.employeeScheduleAssignment.deleteMany).toHaveBeenCalledWith({ where: { employeeId: "employee-1" } });
    expect(transaction.employeeEmploymentPeriod.deleteMany).toHaveBeenCalledWith({ where: { employeeId: "employee-1" } });
    expect(transaction.employeeDeviceLink.updateMany).toHaveBeenCalledWith({ where: { employeeId: "employee-1" }, data: { employeeId: null, active: false } });
    expect(transaction.employee.delete).toHaveBeenCalledWith({ where: { id: "employee-1" } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(transaction, context, expect.objectContaining({ action: "EMPLOYEE_DELETED", newData: expect.objectContaining({ rawPunchesPreserved: 4 }) }));
  });

  it("remove o acesso e as batidas mobile, sem tocar na conta de autenticação", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee({ mobileAccess: { id: "access-1", profileId: "profile-1" } }));

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "João Silva" }, context)).resolves.toEqual({ mode: "DELETE", mobileAccessRemoved: true });

    expect(transaction.attendanceCorrectionRequest.deleteMany).toHaveBeenCalled();
    expect(transaction.mobilePunch.deleteMany).toHaveBeenCalledWith({ where: { employeeId: "employee-1" } });
    expect(transaction.employeeMobileAccess.deleteMany).toHaveBeenCalledWith({ where: { employeeId: "employee-1" } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(transaction, context, expect.objectContaining({ action: "EMPLOYEE_MOBILE_ACCESS_REVOKED", newData: expect.objectContaining({ supabaseAuthAccountPreserved: true }) }));
  });

  it("não altera nada quando o nome de confirmação está incorreto", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee());

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "Outro nome" }, context)).rejects.toThrow("Digite o nome completo");

    expect(transaction.dailySummary.deleteMany).not.toHaveBeenCalled();
    expect(transaction.employee.delete).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("preserva cadastros ligados a uma mesclagem", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee({ mergedEmployees: 1 }));

    await expect(removeEmployee({ employeeId: "employee-1", confirmationName: "João Silva" }, context)).rejects.toThrow("mesclados");

    expect(transaction.employee.delete).not.toHaveBeenCalled();
  });
});
