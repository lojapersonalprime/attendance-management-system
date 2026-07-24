export interface WeekdayScheduleDay {
  weekday: number;
  isWorkingDay: boolean;
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
