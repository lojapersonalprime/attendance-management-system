import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/modules/audit/application/log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { setEmployeeStatus } from "@/modules/employees/application/employee-service";

type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";

function employee(status: EmployeeStatus, terminationDate: Date | null = null) {
  return {
    id: "employee-1",
    fullName: "João Silva",
    clockNameRaw: null,
    registration: "123",
    cpf: null,
    employmentType: "EMPLOYEE",
    status,
    positionId: null,
    departmentId: null,
    unitId: "unit-1",
    admissionDate: new Date("2024-01-01T00:00:00.000Z"),
    terminationDate,
    provisional: false,
    notes: null,
    mergedIntoId: null,
  };
}

describe("serviço de status de funcionário", () => {
  const transaction = {
    employee: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  };
  const context = { userId: "rh-admin-1" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrisma.mockReturnValue({ $transaction: async (callback: (value: typeof transaction) => unknown) => callback(transaction) });
  });

  it("persiste a transição de ATIVO para INATIVO", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee("ACTIVE"));
    transaction.employee.update.mockResolvedValue(employee("INACTIVE"));

    await expect(setEmployeeStatus({ employeeId: "employee-1", status: "INACTIVE", reason: "Afastamento operacional", context })).resolves.toMatchObject({ status: "INACTIVE" });

    expect(transaction.employee.update).toHaveBeenCalledWith({ where: { id: "employee-1" }, data: { status: "INACTIVE", terminationDate: null } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(transaction, context, expect.objectContaining({ action: "EMPLOYEE_STATUS_CHANGED", newData: expect.objectContaining({ status: "INACTIVE" }) }));
  });

  it("persiste a transição de ATIVO para DESLIGADO com data de desligamento", async () => {
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee("ACTIVE"));
    transaction.employee.update.mockResolvedValue(employee("TERMINATED", new Date("2026-08-24T00:00:00.000Z")));

    await expect(setEmployeeStatus({ employeeId: "employee-1", status: "TERMINATED", terminationDate: "2026-08-24", reason: "Desligamento confirmado", context })).resolves.toMatchObject({ status: "TERMINATED" });

    expect(transaction.employee.update).toHaveBeenCalledWith({
      where: { id: "employee-1" },
      data: { status: "TERMINATED", terminationDate: new Date("2026-08-24T00:00:00.000Z") },
    });
  });

  it("permite reativar um cadastro INATIVO", async () => {
    const terminationDate = new Date("2026-08-01T00:00:00.000Z");
    transaction.employee.findUniqueOrThrow.mockResolvedValue(employee("INACTIVE", terminationDate));
    transaction.employee.update.mockResolvedValue(employee("ACTIVE", terminationDate));

    await expect(setEmployeeStatus({ employeeId: "employee-1", status: "ACTIVE", reason: "Retorno às atividades", context })).resolves.toMatchObject({ status: "ACTIVE" });

    expect(transaction.employee.update).toHaveBeenCalledWith({ where: { id: "employee-1" }, data: { status: "ACTIVE", terminationDate } });
  });
});
