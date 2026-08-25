export interface AffectedCalculationDay {
  employeeId: string;
  date: string;
}

/**
 * A calculation is scoped to a person and one business date. Keeping this
 * normalization at each trigger boundary prevents an import with four punches
 * from requesting four equivalent daily calculations.
 */
export function uniqueAffectedCalculationDays(days: readonly AffectedCalculationDay[]) {
  return [...new Map(days.map((day) => [`${day.employeeId}|${day.date}`, day])).values()];
}
