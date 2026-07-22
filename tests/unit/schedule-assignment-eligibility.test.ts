import { describe, expect, it } from "vitest";

import { canReceiveScheduleAssignment } from "@/modules/schedules/domain/schedule-assignment-eligibility";

describe("elegibilidade para atribuição de jornada", () => {
  it("permite jornada em cadastros provisórios importados do relógio", () => {
    expect(canReceiveScheduleAssignment("PENDING")).toBe(true);
    expect(canReceiveScheduleAssignment("ACTIVE")).toBe(true);
  });

  it("mantém somente cadastros mesclados imutáveis", () => {
    expect(canReceiveScheduleAssignment("MERGED")).toBe(false);
  });
});
