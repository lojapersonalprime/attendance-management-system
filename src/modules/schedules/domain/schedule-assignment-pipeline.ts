export interface CoverageWindow {
  from: string;
  until: string;
}

function within(value: string, from: string, until: string) {
  return value >= from && value <= until;
}

function nextDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 0) + 1)).toISOString().slice(0, 10);
}

/**
 * Enumerates only the bounded requested intersection with confirmed coverage.
 * This lets a newly completed HR context calculate confirmed absence days even
 * when no prior summary or punch existed for that employee.
 */
export function selectConfirmedCoverageDates(input: {
  validFrom: string;
  validUntil: string;
  confirmedCoverage: readonly CoverageWindow[];
}) {
  const dates = new Set<string>();
  for (const coverage of input.confirmedCoverage) {
    const from = coverage.from > input.validFrom ? coverage.from : input.validFrom;
    const until = coverage.until < input.validUntil ? coverage.until : input.validUntil;
    for (let date = from; date <= until; date = nextDate(date)) dates.add(date);
  }
  return [...dates].sort();
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
