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

import { removeEmployeeAction } from "@/app/(dashboard)/funcionarios/actions";

function removalForm() {
  const formData = new FormData();
  formData.set("employeeId", "employee-1");
  formData.set("confirmationName", "João Silva");
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
  });

  it("bloqueia RH sem permissão no servidor antes de alterar o cadastro", async () => {
    mocks.requireAuditContext.mockRejectedValue(new Error("Esta ação exige permissão de administrador de RH."));

    await removeEmployeeAction(removalForm());

    expect(mocks.removeEmployee).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalled();
  });
});
