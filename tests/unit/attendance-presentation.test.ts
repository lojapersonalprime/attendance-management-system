import { describe, expect, it } from "vitest";

import { getLastImportedAttendanceState, punchPresentation } from "@/modules/attendance/domain/presentation";

describe("apresentação humana das marcações importadas", () => {
  it("traduz S, E, A e F sem alterar o código original", () => {
    expect(punchPresentation.S.label).toBe("Entrada");
    expect(punchPresentation.E.label).toBe("Saída para almoço");
    expect(punchPresentation.A.label).toBe("Retorno do almoço");
    expect(punchPresentation.F.label).toBe("Saída final");
  });

  it("deriva a situação pela última marcação do arquivo, não por tempo real", () => {
    const state = getLastImportedAttendanceState([
      { occurredAt: new Date("2026-07-15T11:00:00.000Z"), punchCode: "S" as const },
      { occurredAt: new Date("2026-07-15T16:06:00.000Z"), punchCode: "A" as const },
    ]);
    expect(state.label).toBe("Jornada em andamento");
    expect(state.description).toBe("Retorno do almoço");
  });

  it("identifica uma jornada encerrada pela saída final", () => {
    expect(getLastImportedAttendanceState([{ occurredAt: new Date("2026-07-15T21:00:00.000Z"), punchCode: "F" }]).label).toBe("Jornada encerrada");
  });
});
