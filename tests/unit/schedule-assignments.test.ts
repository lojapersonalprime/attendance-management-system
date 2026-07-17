import { describe, expect, it } from "vitest";
import { hasOverlappingScheduleAssignment, selectScheduleAssignment } from "@/modules/schedules/domain/assignments";

describe("vigência de jornadas", () => {
  const assignments = [
    { id: "old", validFrom: "2026-01-01", validUntil: "2026-06-30" },
    { id: "new", validFrom: "2026-07-01", validUntil: null },
  ];

  it("seleciona a jornada válida na data", () => {
    expect(selectScheduleAssignment(assignments, "2026-06-10")?.id).toBe("old");
    expect(selectScheduleAssignment(assignments, "2026-07-10")?.id).toBe("new");
  });

  it("detecta sobreposição antes de persistir", () => {
    expect(hasOverlappingScheduleAssignment(assignments, { id: "candidate", validFrom: "2026-06-15", validUntil: "2026-07-10" })).toBe(true);
  });

  it("aceita uma janela sem sobreposição", () => {
    expect(hasOverlappingScheduleAssignment(assignments, { id: "candidate", validFrom: "2025-01-01", validUntil: "2025-12-31" })).toBe(false);
  });
});
