import { PageHeader } from "@/components/layout/page-header";
import { formatInTimeZone } from "date-fns-tz";
import { formatMinutes } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";

export default async function AttendancePage() {
  const reference = formatInTimeZone(new Date(), "America/Fortaleza", "yyyy-MM");
  const start = new Date(`${reference}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const summaries = await getPrisma().dailySummary.findMany({
    where: { date: { gte: start, lt: end } },
    include: { employee: { select: { fullName: true, registration: true } }, inconsistencies: { where: { status: { in: ["OPEN", "IN_REVIEW"] } }, select: { id: true } } },
    orderBy: [{ employee: { fullName: "asc" } }, { date: "asc" }],
    take: 500,
  });

  return <><PageHeader title="Apuração" description="Visão diária e mensal de trabalhado, previsto, saldo e pendências." /><a className="mb-5 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50" href={`/api/exports/monthly?reference=${reference}`}>Exportar competência atual em CSV</a>{summaries.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Sem apuração para exibir nesta competência. O recálculo ocorre para as datas afetadas pela importação.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Trabalhado</th><th className="px-4 py-3">Previsto</th><th className="px-4 py-3">Intervalo</th><th className="px-4 py-3">Saldo</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{summaries.map((summary) => { const balance = summary.pendingExcessMinutes - summary.negativeMinutes; return <tr className="border-b last:border-0" key={summary.id}><td className="px-4 py-3"><p className="font-medium">{summary.employee.fullName}</p><p className="text-xs text-[var(--muted-foreground)]">{summary.employee.registration ?? "Sem matrícula"}</p></td><td className="px-4 py-3">{formatInTimeZone(summary.date, "America/Fortaleza", "dd/MM/yyyy")}</td><td className="px-4 py-3">{formatMinutes(summary.validWorkedMinutes)}</td><td className="px-4 py-3">{formatMinutes(summary.expectedMinutes)}</td><td className="px-4 py-3">{formatMinutes(summary.intervalMinutes)}</td><td className="px-4 py-3">{formatMinutes(balance)}</td><td className="px-4 py-3">{summary.status}{summary.inconsistencies.length ? ` · ${summary.inconsistencies.length} pendência(s)` : ""}</td></tr>; })}</tbody></table></div>}</>;
}
