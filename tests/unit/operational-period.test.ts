import { describe, expect, it } from "vitest";
import { ATTENDANCE_OPERATION_START_DATE, isOperationalBusinessDate, operationalDateRange } from "@/modules/attendance/domain/operational-period";
import { isHistoricalImportError, selectOperationalPunches } from "@/modules/imports/domain/operational-punches";

describe("período operacional da apuração", () => {
  it("centraliza o início em 01/07/2026", () => {
    expect(ATTENDANCE_OPERATION_START_DATE).toBe("2026-07-01");
    expect(isOperationalBusinessDate("2026-06-30")).toBe(false);
    expect(isOperationalBusinessDate("2026-07-01")).toBe(true);
  });

  it("descarta marcações antigas antes da deduplicação e mantém somente uma por fingerprint", () => {
    const selected = selectOperationalPunches([
      { occurredAt: new Date("2026-06-30T15:00:00.000Z"), fingerprint: "before" },
      { occurredAt: new Date("2026-07-01T11:00:00.000Z"), fingerprint: "first" },
      { occurredAt: new Date("2026-07-01T11:00:00.000Z"), fingerprint: "first" },
      { occurredAt: new Date("2026-07-02T11:00:00.000Z"), fingerprint: "second" },
    ]);
    expect(selected.ignoredBeforeOperation).toBe(1);
    expect(selected.duplicatedInFile).toBe(1);
    expect(selected.operationalRows).toBe(3);
    expect(selected.punches.map((punch) => punch.fingerprint)).toEqual(["first", "second"]);
  });

  it("corta a confirmação de cobertura no período operacional", () => {
    expect(operationalDateRange("2026-03-19", "2026-08-24")).toEqual({ validFrom: "2026-07-01", validUntil: "2026-08-24" });
    expect(operationalDateRange("2026-03-19", "2026-06-30")).toBeNull();
    expect(isHistoricalImportError({ rawLine: "1\t2026-06-10 08:00:00" })).toBe(true);
    expect(isHistoricalImportError({ rawLine: "1\t2026-07-10 08:00:00" })).toBe(false);
  });
});
