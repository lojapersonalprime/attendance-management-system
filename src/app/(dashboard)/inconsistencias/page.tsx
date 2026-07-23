import Link from "next/link";
import { InconsistencySeverity, InconsistencyStatus, InconsistencyType } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { attendanceSummaryRoute } from "@/lib/routes";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { updateInconsistencyStatusAction } from "@/app/(dashboard)/inconsistencias/actions";
import { getInconsistencyStatusLabel, getInconsistencyTypeLabel, getSeverityLabel } from "@/lib/presentation/labels";
import { actionErrorMessage } from "@/lib/forms/action-result";
import { formatBusinessDate } from "@/lib/dates/business";
import { getAttendanceIssuePresentation } from "@/modules/inconsistencies/domain/presentation";

const actionableStatuses = ["OPEN", "IN_REVIEW", "REOPENED"] as const;

export default async function InconsistenciesPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; type?: string; sucesso?: string; erro?: string }> }) {
  const [profile, query] = await Promise.all([requireActiveProfile(), searchParams]);
  const status = Object.values(InconsistencyStatus).find((value) => value === query.status);
  const severity = Object.values(InconsistencySeverity).find((value) => value === query.severity);
  const type = Object.values(InconsistencyType).find((value) => value === query.type?.trim());
  const inconsistencies = await getPrisma().inconsistency.findMany({
    where: {
      ...(status ? { status } : { status: { in: [...actionableStatuses] } }),
      ...(severity ? { severity } : {}),
      ...(type ? { type } : {}),
    },
    include: { employee: { select: { fullName: true } }, dailySummary: { select: { id: true } } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const canManage = profile.role === "RH_ADMIN";
  const errorMessage = actionErrorMessage(query.erro);
  const openCount = inconsistencies.filter((item) => actionableStatuses.includes(item.status as (typeof actionableStatuses)[number])).length;
  return <>
    <PageHeader title="Pendências" description="Revise somente o que ainda precisa de uma decisão do RH." />
    {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
    {errorMessage ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm"><div><p className="text-2xl font-bold">{openCount}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">pendência(s) para revisar nos filtros atuais</p></div><StatusBadge tone={openCount > 0 ? "warning" : "success"}>{openCount > 0 ? "Ação necessária" : "Tudo em dia"}</StatusBadge></section>
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4"><label className="grid gap-1 text-sm font-medium">Mostrar<select className="input" name="status" defaultValue={status ?? ""}><option value="">Pendências atuais</option>{Object.values(InconsistencyStatus).map((value) => <option key={value} value={value}>{getInconsistencyStatusLabel(value)}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Gravidade<select className="input" name="severity" defaultValue={severity ?? ""}><option value="">Todas</option>{Object.values(InconsistencySeverity).map((value) => <option key={value} value={value}>{getSeverityLabel(value)}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Situação<select className="input" name="type" defaultValue={query.type ?? ""}><option value="">Todas</option>{Object.values(InconsistencyType).map((value) => <option key={value} value={value}>{getInconsistencyTypeLabel(value)}</option>)}</select></label><button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">Atualizar lista</button></form>
    {inconsistencies.length === 0 ? <p className="rounded-xl border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhuma pendência para os filtros selecionados.</p> : <section className="space-y-3">{inconsistencies.map((item) => {
      const presentation = getAttendanceIssuePresentation(item.type);
      const actionable = actionableStatuses.includes(item.status as (typeof actionableStatuses)[number]);
      const tone = item.severity === "CRITICAL" ? "danger" : item.severity === "WARNING" ? "warning" : "info" as const;
      return <article className="rounded-xl border bg-white p-4 shadow-sm" key={item.id}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="font-semibold text-slate-950">{presentation.title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.employee?.fullName ?? "Funcionário sem vínculo"} · {item.date ? formatBusinessDate(item.date, "dd/MM/yyyy") : "Data não informada"}</p><p className="mt-2 text-sm text-slate-700">{presentation.description}</p></div><StatusBadge tone={tone}>{getSeverityLabel(item.severity)} · {getInconsistencyStatusLabel(item.status)}</StatusBadge></div><div className="mt-4 flex flex-wrap items-center gap-2">{item.dailySummary ? <Link className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white" href={attendanceSummaryRoute(item.dailySummary.id)}>Revisar</Link> : null}{canManage && actionable ? <details className="relative"><summary className="cursor-pointer list-none rounded-md border px-3 py-2 text-sm font-semibold text-slate-700">Mais ações</summary><form action={updateInconsistencyStatusAction} className="absolute right-0 z-10 mt-2 grid w-80 gap-2 rounded-xl border bg-white p-3 shadow-lg"><input type="hidden" name="inconsistencyId" value={item.id} /><label className="grid gap-1 text-sm">Justificativa<input className="input" name="reason" placeholder="Obrigatória para resolver ou dispensar" /></label><div className="flex flex-wrap gap-2"><button className="rounded border px-2 py-1 text-xs font-semibold" name="status" value="IN_REVIEW" type="submit">Marcar em revisão</button><button className="rounded border px-2 py-1 text-xs font-semibold" name="status" value="RESOLVED" type="submit">Resolver</button><button className="rounded border px-2 py-1 text-xs font-semibold" name="status" value="DISMISSED" type="submit">Dispensar</button></div></form></details> : null}<details><summary className="cursor-pointer px-2 py-2 text-sm font-semibold text-[var(--primary)]">Detalhes técnicos</summary><p className="mt-2 max-w-2xl text-xs text-[var(--muted-foreground)]">Tipo interno: {item.type}. {item.description}</p></details></div></article>;
    })}</section>}
  </>;
}
