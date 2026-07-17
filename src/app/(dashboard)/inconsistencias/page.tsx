import { PageHeader } from "@/components/layout/page-header";
import { formatInTimeZone } from "date-fns-tz";
import { getPrisma } from "@/lib/db/prisma";

export default async function InconsistenciesPage() {
  const inconsistencies = await getPrisma().inconsistency.findMany({
    where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    include: { employee: { select: { fullName: true } } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return <><PageHeader title="Inconsistências" description="Central de revisão com justificativa e histórico auditável." />{inconsistencies.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhuma inconsistência aberta.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{inconsistencies.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{item.severity}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.employee?.fullName ?? "Sem vínculo"}</td><td className="px-4 py-3">{item.date ? formatInTimeZone(item.date, "America/Fortaleza", "dd/MM/yyyy") : "—"}</td><td className="max-w-md px-4 py-3">{item.description}</td><td className="px-4 py-3">{item.status}</td></tr>)}</tbody></table></div>}</>;
}
