import { PageHeader } from "@/components/layout/page-header";
import { formatInTimeZone } from "date-fns-tz";
import { getPrisma } from "@/lib/db/prisma";

export default async function AuditPage() {
  const events = await getPrisma().auditLog.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return <><PageHeader title="Auditoria" description="Registro imutável de ações administrativas e justificativas." />{events.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhum evento de auditoria registrado ainda.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Entidade</th><th className="px-4 py-3">Motivo</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-b last:border-0"><td className="px-4 py-3">{formatInTimeZone(event.createdAt, "America/Fortaleza", "dd/MM/yyyy HH:mm")}</td><td className="px-4 py-3">{event.user.name}</td><td className="px-4 py-3">{event.action}</td><td className="px-4 py-3">{event.entityType}</td><td className="px-4 py-3">{event.reason ?? "—"}</td></tr>)}</tbody></table></div>}</>;
}
