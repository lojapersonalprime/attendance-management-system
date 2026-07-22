import { PageHeader } from "@/components/layout/page-header";
import { formatInTimeZone } from "date-fns-tz";
import { getPrisma } from "@/lib/db/prisma";
import { getAuditActionLabel, getEntityTypeLabel } from "@/lib/presentation/labels";

function dateFromQuery(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const result = new Date(`${value}T00:00:00.000Z`);
  if (endOfDay) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

const dataLabels: Record<string, string> = {
  active: "Status", name: "Nome", status: "Status", reason: "Motivo", field: "Campo alterado",
  employeeCount: "Quantidade de funcionários", succeeded: "Concluídos", failed: "Com pendência",
  validFrom: "Início da vigência", validUntil: "Fim da vigência", scheduleName: "Jornada",
  coverageFrom: "Início da cobertura", coverageTo: "Fim da cobertura", calculationVersion: "Versão do cálculo",
};

function summaryValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (value && typeof value === "object") return "Registrado";
  return "Não informado";
}

function formatAuditData(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return ["Não informado"];
  const rows = Object.entries(data)
    .filter(([key]) => !key.toLowerCase().endsWith("id"))
    .slice(0, 6)
    .map(([key, value]) => `${dataLabels[key] ?? key}: ${summaryValue(value)}`);
  return rows.length > 0 ? rows : ["Dados registrados com segurança"];
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; userId?: string; action?: string; entity?: string }> }) {
  const query = await searchParams;
  const from = dateFromQuery(query.from);
  const to = dateFromQuery(query.to, true);
  const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
  const where = {
    ...(createdAt ? { createdAt } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.entity ? { entityType: query.entity } : {}),
  };
  const prisma = getPrisma();
  const [events, users, actions, entities] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.profile.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return <>
    <PageHeader title="Auditoria" description="Registro imutável de ações administrativas e justificativas." />
    <form className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1 text-sm">De<input className="input" name="from" type="date" defaultValue={query.from} /></label>
      <label className="grid gap-1 text-sm">Até<input className="input" name="to" type="date" defaultValue={query.to} /></label>
      <label className="grid gap-1 text-sm">Usuário<select className="input" name="userId" defaultValue={query.userId ?? ""}><option value="">Todos</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Ação<select className="input" name="action" defaultValue={query.action ?? ""}><option value="">Todas</option>{actions.map((item) => <option key={item.action} value={item.action}>{getAuditActionLabel(item.action)}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Item alterado<select className="input" name="entity" defaultValue={query.entity ?? ""}><option value="">Todos</option>{entities.map((item) => <option key={item.entityType} value={item.entityType}>{getEntityTypeLabel(item.entityType)}</option>)}</select></label>
      <div className="flex items-end"><button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">Aplicar filtros</button></div>
    </form>
    {events.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhum evento de auditoria encontrado para estes filtros.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[960px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Data e hora</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Item alterado</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Detalhes</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-b last:border-0"><td className="px-4 py-3">{formatInTimeZone(event.createdAt, "America/Fortaleza", "dd/MM/yyyy 'às' HH:mm")}</td><td className="px-4 py-3">{event.user.name}</td><td className="px-4 py-3">{getAuditActionLabel(event.action)}</td><td className="px-4 py-3">{getEntityTypeLabel(event.entityType)}</td><td className="px-4 py-3">{event.reason ?? "Motivo não informado"}</td><td className="px-4 py-3"><details><summary className="cursor-pointer text-[var(--primary)]">Ver detalhes</summary><div className="mt-2 grid gap-2 text-xs"><div><strong>Informação anterior</strong><ul className="mt-1 list-disc pl-4">{formatAuditData(event.oldData).map((line) => <li key={line}>{line}</li>)}</ul></div><div><strong>Informação nova</strong><ul className="mt-1 list-disc pl-4">{formatAuditData(event.newData).map((line) => <li key={line}>{line}</li>)}</ul></div><div className="text-[var(--muted-foreground)]">Código técnico: {event.action}</div></div></details></td></tr>)}</tbody></table></div>}
  </>;
}
