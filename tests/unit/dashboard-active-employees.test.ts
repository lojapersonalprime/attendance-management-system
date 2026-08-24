import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPrisma: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));

import { getDashboardData } from "@/modules/dashboard/server/get-dashboard-data";

describe("indicador de última importação no dashboard", () => {
  const prisma = {
    importFile: { findFirst: vi.fn(), count: vi.fn() },
    dailySummary: { findMany: vi.fn() },
    inconsistency: { findMany: vi.fn() },
    employee: { findMany: vi.fn() },
    rawPunch: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrisma.mockReturnValue(prisma);
    prisma.importFile.findFirst.mockResolvedValue(null);
    prisma.importFile.count.mockResolvedValue(0);
    prisma.dailySummary.findMany.mockResolvedValue([]);
    prisma.inconsistency.findMany.mockResolvedValue([]);
    prisma.employee.findMany.mockResolvedValue([]);
  });

  it("considera somente funcionários ativos no contador operacional", async () => {
    await getDashboardData("2026-08");

    expect(prisma.employee.findMany).toHaveBeenCalledWith({ where: { status: "ACTIVE" }, select: { id: true, fullName: true } });
  });
});
