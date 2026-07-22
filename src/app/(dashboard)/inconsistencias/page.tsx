import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { InconsistencySeverity, InconsistencyStatus, InconsistencyType } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { attendanceSummaryRoute } from "@/lib/routes";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { updateInconsistencyStatusAction } from "@/app/(dashboard)/inconsistencias/actions";

export default async function InconsistenciesPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; type?: string; sucesso?: string; erro?: string }> }) {
  const [profile, query] = await Promise.all([requireActiveProfile(), searchParams]);
  const status = Object.values(InconsistencyStatus).find((value) => value === query.status);
  const severity = Object.values(InconsistencySeverity).find((value) => value === query.severity);
  const type = Object.values(InconsistencyType).find((value) => value === query.type?.trim());
  const inconsistencies = await getPrisma().inconsistency.findMany({
    where: { ...(status ? { status } : {}), ...(severity ? { severity } : {}), ...(type ? { type } : {}) },
    include: { employee: { select: { fullName: true } }, dailySummary: { select: { id: true } } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const canManage = profile.role === "RH_ADMIN";
  return <><PageHeader title="Inconsistências" description="Central de revisão, resolução automática e histórico auditável." />
    {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
    {query.erro ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{query.erro}</p> : null}
    <form className="mb-5 grid gap-2 rounded-lg border bg-white p-4 md:grid-cols-4">
      <label className="grid gap-1 text-sm">Status<select className="input" name="status" defaultValue={status ?? ""}><option value="">Todos</option>{Object.values(InconsistencyStatus).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Severidade<select className="input" name="severity" defaultValue={severity ?? ""}><option value="">Todas</option>{Object.values(InconsistencySeverity).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Tipo<input className="input" name="type" defaultValue={query.type ?? ""} placeholder="Ex.: MISSING_SCHEDULE" /></label>
      <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">Aplicar filtros</button>
    </form>
    {inconsistencies.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhuma inconsistência para os filtros selecionados.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead><tbody>{inconsistencies.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{item.severity}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.employee?.fullName ?? "Sem vínculo"}</td><td className="px-4 py-3">{item.date ? formatInTimeZone(item.date, "America/Fortaleza", "dd/MM/yyyy") : "—"}</td><td className="max-w-md px-4 py-3">{item.description}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{item.dailySummary ? <Link className="mr-3 font-semibold text-[var(--primary)] underline" href={attendanceSummaryRoute(item.dailySummary.id)}>Abrir</Link> : null}{canManage && (item.status === "OPEN" || item.status === "IN_REVIEW") ? <form action={updateInconsistencyStatusAction} className="mt-2 flex min-w-72 flex-wrap gap-2"><input type="hidden" name="inconsistencyId" value={item.id} /><input className="input w-40" name="reason" placeholder="Justificativa" /><button className="rounded border px-2 py-1 text-xs" name="status" value="IN_REVIEW" type="submit">Revisar</button><button className="rounded border px-2 py-1 text-xs" name="status" value="RESOLVED" type="submit">Resolver</button><button className="rounded border px-2 py-1 text-xs" name="status" value="DISMISSED" type="submit">Dispensar</button></form> : null}</td></tr>)}</tbody></table></div>}</>;
}
