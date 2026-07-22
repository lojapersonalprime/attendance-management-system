export interface CoverageWindow {
  from: string;
  until: string;
}

function within(value: string, from: string, until: string) {
  return value >= from && value <= until;
}

/** Keeps schedule-triggered runs inside confirmed TXT coverage and open months. */
export function selectScheduleRecalculationDates(input: {
  candidateDates: readonly string[];
  confirmedCoverage: readonly CoverageWindow[];
  closedMonths: readonly string[];
}) {
  const closedMonths = new Set(input.closedMonths);
  return [...new Set(input.candidateDates)]
    .filter((date) => input.confirmedCoverage.some((coverage) => within(date, coverage.from, coverage.until)))
    .filter((date) => !closedMonths.has(date.slice(0, 7)))
    .sort();
}
