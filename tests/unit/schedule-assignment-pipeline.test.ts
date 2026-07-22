import { describe, expect, it } from "vitest";

import { selectScheduleRecalculationDates } from "@/modules/schedules/domain/schedule-assignment-pipeline";

describe("pipeline de jornada e recálculo", () => {
  it("recalcula somente a interseção com cobertura de TXT confirmada", () => {
    expect(selectScheduleRecalculationDates({
      candidateDates: ["2026-03-19", "2026-07-10", "2026-07-10", "2026-07-16"],
      confirmedCoverage: [{ from: "2026-07-01", until: "2026-07-15" }],
      closedMonths: [],
    })).toEqual(["2026-07-10"]);
  });

  it("não inclui competência fechada e não inventa dias sem marcação ou resumo", () => {
    expect(selectScheduleRecalculationDates({
      candidateDates: ["2026-06-30", "2026-07-01"],
      confirmedCoverage: [{ from: "2026-06-01", until: "2026-07-31" }],
      closedMonths: ["2026-06"],
    })).toEqual(["2026-07-01"]);
  });

  it("não produz dias quando a cobertura ainda não foi confirmada", () => {
    expect(selectScheduleRecalculationDates({
      candidateDates: ["2026-07-10"],
      confirmedCoverage: [],
      closedMonths: [],
    })).toEqual([]);
  });
});
