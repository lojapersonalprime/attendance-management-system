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
  return <div><p className="eyebrow text-[var(--primary)]">MEU HISTÓRICO</p><h1 className="font-display mt-2 text-5xl font-semibold leading-none text-[var(--foreground)]">Meus registros</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">As marcações são preservadas e interpretadas pela jornada vigente.</p><div className="mt-7 space-y-4">{grouped.size === 0 ? <p className="surface rounded-[1.5rem] p-5 text-sm text-[var(--muted-foreground)]">Você ainda não possui registros pelo celular.</p> : [...grouped.entries()].map(([date, records]) => { const ordered = [...records].reverse(); const calculated = getCalculatedTimeline(summariesByDate.get(date)?.calculationMemory, summariesByDate.get(date)?.recordedMinutes ?? 0).punches.filter((punch) => punch.origin === "MOBILE_PUNCH"); const labels = new Map(calculated.map((punch) => [punch.id, punchPresentation[punch.punchCode].label])); return <section className="surface rounded-[1.5rem] p-5 sm:p-6" key={date}><p className="eyebrow text-[var(--primary)]">{formatInTimeZone(new Date(`${date}T12:00:00.000Z`), "America/Fortaleza", "EEEE")}</p><h2 className="font-display numeric mt-2 text-4xl font-semibold leading-none text-[var(--foreground)]">{formatInTimeZone(new Date(`${date}T12:00:00.000Z`), "America/Fortaleza", "dd/MM")}</h2><ul className="mt-6 divide-y divide-[var(--border)]">{ordered.map((punch) => <li className="grid grid-cols-[6rem_1fr] items-center gap-4 py-4 first:pt-0" key={punch.id}><span className="font-display numeric text-4xl font-semibold leading-none text-[var(--foreground)]">{formatInTimeZone(punch.registeredAt, "America/Fortaleza", "HH:mm:ss")}</span><span className="border-l border-[var(--border)] pl-4 text-sm text-[var(--muted-foreground)]">{labels.get(punch.id) ?? "Aguardando interpretação"}</span></li>)}</ul></section>; })}</div></div>;
}
