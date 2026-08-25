import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createManualEmployee: vi.fn(),
  completeProvisionalEmployee: vi.fn(),
  removeEmployee: vi.fn(),
  setEmployeeStatus: vi.fn(),
  updateEmployee: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuditContext: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/audit/server/request-context", () => ({ requireAuditContext: mocks.requireAuditContext }));
vi.mock("@/modules/employees/application/employee-service", () => ({
  completeProvisionalEmployee: mocks.completeProvisionalEmployee,
  createManualEmployee: mocks.createManualEmployee,
  removeEmployee: mocks.removeEmployee,
  setEmployeeStatus: mocks.setEmployeeStatus,
  updateEmployee: mocks.updateEmployee,
}));

import { changeEmployeeStatusAction, removeEmployeeAction } from "@/app/(dashboard)/funcionarios/actions";

function removalForm() {
  const formData = new FormData();
  formData.set("employeeId", "employee-1");
  formData.set("confirmationName", "João Silva");
  return formData;
}

function statusForm(status: "INACTIVE" | "TERMINATED", terminationDate?: string) {
  const formData = new FormData();
  formData.set("employeeId", "employee-1");
  formData.set("status", status);
  formData.set("reason", "Atualização de status");
  if (terminationDate) formData.set("terminationDate", terminationDate);
  return formData;
}

describe("ação de remoção de funcionário", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite que RH_ADMIN execute a exclusão elegível", async () => {
    const context = { userId: "rh-admin-1" };
    mocks.requireAuditContext.mockResolvedValue(context);
    mocks.removeEmployee.mockResolvedValue({ mode: "DELETE" });

    await removeEmployeeAction(removalForm());

    expect(mocks.removeEmployee).toHaveBeenCalledWith({ employeeId: "employee-1", confirmationName: "João Silva" }, context);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/funcionarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/apuracao");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inconsistencias");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/visao-hoje");
  });

  it.each(["RH_ANALYST", "EMPLOYEE"])("bloqueia %s no servidor antes de alterar o cadastro", async () => {
    mocks.requireAuditContext.mockRejectedValue(new Error("Esta ação exige permissão de administrador de RH."));

    await removeEmployeeAction(removalForm());

    expect(mocks.removeEmployee).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalled();
  });

  it.each([
    ["INACTIVE", undefined],
    ["TERMINATED", "2026-08-24"],
  ] as const)("salva o status %s e invalida a listagem e o cadastro", async (status, terminationDate) => {
    const context = { userId: "rh-admin-1" };
    mocks.requireAuditContext.mockResolvedValue(context);
    mocks.setEmployeeStatus.mockResolvedValue({ id: "employee-1", status });

    await changeEmployeeStatusAction(statusForm(status, terminationDate));

    expect(mocks.setEmployeeStatus).toHaveBeenCalledWith(expect.objectContaining({ employeeId: "employee-1", status, terminationDate, context }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/funcionarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/funcionarios/employee-1");
  });
});
