import { formatInTimeZone } from "date-fns-tz";
import { getEmployeeMobileRecords } from "@/modules/mobile-attendance/application/mobile-attendance-service";
import { punchPresentation } from "@/modules/attendance/domain/presentation";
import { getCalculatedTimeline } from "@/modules/attendance/domain/calculated-timeline";
import { toBusinessDate } from "@/lib/dates/business";

export default async function EmployeeRecordsPage() {
  const { punches, summaries } = await getEmployeeMobileRecords();
  const grouped = new Map<string, typeof punches>();
  for (const punch of punches) {
    const date = toBusinessDate(punch.registeredAt);
    grouped.set(date, [...(grouped.get(date) ?? []), punch]);
  }
  const summariesByDate = new Map(summaries.map((summary) => [toBusinessDate(summary.date), summary]));
  return <div><h1 className="text-2xl font-bold">Meus registros</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">As marcações são preservadas e interpretadas pela jornada vigente.</p><div className="mt-5 space-y-4">{grouped.size === 0 ? <p className="rounded-3xl border bg-white p-5 text-sm text-[var(--muted-foreground)]">Você ainda não possui registros pelo celular.</p> : [...grouped.entries()].map(([date, records]) => { const ordered = [...records].reverse(); const calculated = getCalculatedTimeline(summariesByDate.get(date)?.calculationMemory, summariesByDate.get(date)?.recordedMinutes ?? 0).punches.filter((punch) => punch.origin === "MOBILE_PUNCH"); const labels = new Map(calculated.map((punch) => [punch.id, punchPresentation[punch.punchCode].label])); return <section className="rounded-3xl border bg-white p-5 shadow-sm" key={date}><h2 className="font-bold">{formatInTimeZone(new Date(`${date}T12:00:00.000Z`), "America/Fortaleza", "EEEE, dd/MM")}</h2><ul className="mt-3 divide-y">{ordered.map((punch) => <li className="flex items-center justify-between py-3" key={punch.id}><span className="font-semibold">{formatInTimeZone(punch.registeredAt, "America/Fortaleza", "HH:mm:ss")}</span><span className="text-sm text-[var(--muted-foreground)]">{labels.get(punch.id) ?? "Aguardando interpretação"}</span></li>)}</ul></section>; })}</div></div>;
}
