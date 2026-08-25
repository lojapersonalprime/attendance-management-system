export interface WeekdayScheduleDay {
  weekday: number;
  isWorkingDay: boolean;
}

export interface DatedScheduleAssignment {
  validFrom: Date;
  validUntil: Date | null;
}

/**
 * Business dates are stored as YYYY-MM-DD, never as an instant. Resolving the
 * weekday in UTC prevents the server timezone from moving a Brazilian date to
 * the prior day.
 */
export function weekdayForBusinessDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0)).getUTCDay();
}

export function selectScheduleDayForBusinessDate<T extends WeekdayScheduleDay>(days: readonly T[], businessDate: string) {
  return days.find((day) => day.weekday === weekdayForBusinessDate(businessDate));
}

/** Chooses the assignment that was in force on the requested business date. */
export function selectScheduleAssignmentForBusinessDate<T extends DatedScheduleAssignment>(assignments: readonly T[], businessDate: string) {
  return [...assignments]
    .filter((assignment) => assignment.validFrom.toISOString().slice(0, 10) <= businessDate && (!assignment.validUntil || assignment.validUntil.toISOString().slice(0, 10) >= businessDate))
    .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0];
}
