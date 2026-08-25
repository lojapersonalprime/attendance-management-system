import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignScheduleToEmployee: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuditContext: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/audit/server/request-context", () => ({ requireAuditContext: mocks.requireAuditContext }));
vi.mock("@/modules/schedules/application/schedule-service", () => ({
  assignScheduleToEmployee: mocks.assignScheduleToEmployee,
  duplicateScheduleTemplate: vi.fn(),
  removeScheduleTemplate: vi.fn(),
  retryScheduleAssignmentCalculation: vi.fn(),
  saveScheduleTemplate: vi.fn(),
  setScheduleTemplateActive: vi.fn(),
}));

import { assignScheduleAction } from "@/app/(dashboard)/funcionarios/actions";

describe("atribuição de modelo com recálculo automático", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sempre solicita o recálculo após salvar a vigência", async () => {
    const formData = new FormData();
    formData.set("employeeId", "employee-1");
    formData.set("scheduleTemplateId", "schedule-2");
    formData.set("validFrom", "2026-08-25");
    formData.set("reason", "Novo modelo");
    mocks.requireAuditContext.mockResolvedValue({ userId: "rh-admin-1" });
    mocks.assignScheduleToEmployee.mockResolvedValue({ calculation: { status: "COMPLETED", processedDays: 1, failedDays: 0 } });

    await assignScheduleAction(formData);

    expect(mocks.assignScheduleToEmployee).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: "employee-1",
      recalculateAffectedDays: true,
      value: expect.objectContaining({ scheduleTemplateId: "schedule-2", validFrom: "2026-08-25" }),
    }));
  });
});
