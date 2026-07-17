import { describe, expect, it } from "vitest";
import { createMonthlyAttendanceCsv, formatBrazilianDateOnly } from "@/modules/reports/domain/csv";

describe("exportação CSV", () => {
  it("gera UTF-8 com BOM, separador brasileiro e horas HH:mm", () => {
    const csv = createMonthlyAttendanceCsv([{
      employee: "Pessoa, Sintética",
      registration: "001",
      date: new Date("2026-06-10T00:00:00.000Z"),
      workedMinutes: 548,
      expectedMinutes: 480,
      balanceMinutes: 68,
      status: "REGULAR",
    }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Pessoa, Sintética";"001";"10/06/2026";"09:08"');
  });

  it("formata DateOnly sem deslocar pelo fuso do navegador", () => {
    expect(formatBrazilianDateOnly(new Date("2026-01-01T00:00:00.000Z"))).toBe("01/01/2026");
  });
});
