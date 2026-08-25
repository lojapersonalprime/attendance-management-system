import { describe, expect, it } from "vitest";
import { uniqueAffectedCalculationDays } from "@/modules/calculations/domain/affected-calculation-days";

describe("dias afetados de cálculo", () => {
  it("agrupa quatro batidas do mesmo funcionário e data em um único cálculo", () => {
    expect(uniqueAffectedCalculationDays([
      { employeeId: "bruna", date: "2026-08-24" },
      { employeeId: "bruna", date: "2026-08-24" },
      { employeeId: "bruna", date: "2026-08-24" },
      { employeeId: "bruna", date: "2026-08-24" },
      { employeeId: "bruna", date: "2026-08-25" },
      { employeeId: "outra-pessoa", date: "2026-08-24" },
    ])).toEqual([
      { employeeId: "bruna", date: "2026-08-24" },
      { employeeId: "bruna", date: "2026-08-25" },
      { employeeId: "outra-pessoa", date: "2026-08-24" },
    ]);
  });
});
