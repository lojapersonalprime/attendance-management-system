import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  removeScheduleTemplate: vi.fn(),
  requireAuditContext: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/audit/server/request-context", () => ({ requireAuditContext: mocks.requireAuditContext }));
vi.mock("@/modules/schedules/application/schedule-service", () => ({
  duplicateScheduleTemplate: vi.fn(),
  removeScheduleTemplate: mocks.removeScheduleTemplate,
  saveScheduleTemplate: vi.fn(),
  setScheduleTemplateActive: vi.fn(),
}));

import { removeScheduleAction } from "@/app/(dashboard)/jornadas/actions";

function removalForm() {
  const formData = new FormData();
  formData.set("id", "schedule-1");
  return formData;
}

describe("ação de exclusão de modelo de horário", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite que RH_ADMIN exclua e revalida cada funcionário afetado", async () => {
    const context = { userId: "rh-admin-1" };
    mocks.requireAuditContext.mockResolvedValue(context);
    mocks.removeScheduleTemplate.mockResolvedValue({ employeeIds: ["employee-1", "employee-2"] });

    await removeScheduleAction(removalForm());

    expect(mocks.removeScheduleTemplate).toHaveBeenCalledWith({ id: "schedule-1", context });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/jornadas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/funcionarios");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/funcionarios/employee-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/funcionarios/employee-2");
  });

  it.each(["RH_ANALYST", "EMPLOYEE"])("bloqueia %s no servidor antes de excluir", async () => {
    mocks.requireAuditContext.mockRejectedValue(new Error("Esta ação exige permissão de administrador de RH."));

    await removeScheduleAction(removalForm());

    expect(mocks.removeScheduleTemplate).not.toHaveBeenCalled();
  });
});
