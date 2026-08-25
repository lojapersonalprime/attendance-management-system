import { describe, expect, it } from "vitest";
import { logicalScheduleName, selectCurrentLogicalTemplates } from "@/modules/schedules/domain/logical-template";

describe("catálogo lógico de modelos de horário", () => {
  it("oculta sufixos de versões preservadas no histórico", () => {
    expect(logicalScheduleName("CLT - teste/TI — versão 2026-08-24")).toBe("CLT - teste/TI");
    expect(logicalScheduleName("CLT - teste/TI — histórico 2026-08-24 abc123")).toBe("CLT - teste/TI");
  });

  it("mantém somente a revisão mais recente de cada modelo no catálogo", () => {
    const selected = selectCurrentLogicalTemplates([
      { id: "base", name: "CLT - teste/TI", createdAt: new Date("2026-07-22T00:00:00.000Z") },
      { id: "revision", name: "CLT - teste/TI — versão 2026-08-24", createdAt: new Date("2026-08-24T00:00:00.000Z") },
      { id: "other", name: "Administrativo", createdAt: new Date("2026-07-22T00:00:00.000Z") },
    ]);
    expect(selected.map((template) => template.id)).toEqual(["revision", "other"]);
  });
});
