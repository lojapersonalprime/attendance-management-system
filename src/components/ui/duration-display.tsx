import { formatMinutes } from "@/lib/dates/business";

export function DurationDisplay({ minutes, sign = false }: { minutes: number; sign?: boolean }) {
  const prefix = sign && minutes > 0 ? "+" : "";
  return <span>{prefix}{formatMinutes(minutes)}</span>;
}
