import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const BUSINESS_TIME_ZONE = "America/Fortaleza";

/** Converts a device local date-time to the UTC timestamp persisted in PostgreSQL. */
export function businessDateTimeToUtc(localDateTime: string): Date {
  return fromZonedTime(localDateTime, BUSINESS_TIME_ZONE);
}

/** Gets the business day independent of the UTC representation in the database. */
export function toBusinessDate(date: Date): string {
  return formatInTimeZone(date, BUSINESS_TIME_ZONE, "yyyy-MM-dd");
}

export function toBusinessDateTime(date: Date): string {
  return formatInTimeZone(date, BUSINESS_TIME_ZONE, "yyyy-MM-dd HH:mm:ss");
}

/** Adds calendar days to a YYYY-MM-DD business date without turning it into a UTC instant first. */
export function addBusinessDateDays(value: string, amount: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 0) + amount)).toISOString().slice(0, 10);
}

export function formatMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  if (absolute === 0) return "0h";
  if (hours === 0) return `${sign}${minutes}min`;
  return `${sign}${hours}h${minutes === 0 ? "" : minutes.toString().padStart(2, "0")}`;
}

export function formatMinutesForCsv(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const absolute = Math.abs(totalMinutes);
  return `${sign}${Math.floor(absolute / 60).toString().padStart(2, "0")}:${(absolute % 60)
    .toString()
    .padStart(2, "0")}`;
}
