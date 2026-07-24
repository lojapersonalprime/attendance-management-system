import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Building2, BriefcaseBusiness, Tags, UsersRound } from "lucide-react";
import { saveDirectoryAction } from "@/app/(dashboard)/configuracoes/actions";
import { DirectoryManager, type DirectoryKind } from "@/components/settings/directory-manager";
import { AsyncFeedback } from "@/components/ui/async-feedback";
import { actionErrorMessage } from "@/lib/forms/action-result";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";

const tabs: Array<{ kind: DirectoryKind; label: string; icon: typeof Building2 }> = [
  { kind: "UNIT", label: "Unidades", icon: Building2 },
  { kind: "DEPARTMENT", label: "Setores", icon: UsersRound },
  { kind: "POSITION", label: "Cargos", icon: BriefcaseBusiness },
  { kind: "TAG", label: "Tags", icon: Tags },
];

function selectedKind(value: string | undefined): DirectoryKind {
  return value === "DEPARTMENT" || value === "POSITION" || value === "TAG" ? value : "UNIT";
}

export default async function CompanyStructurePage({ searchParams }: { searchParams: Promise<{ aba?: string; sucesso?: string; erro?: string }> }) {
  const [profile, query, units, departments, positions, tags] = await Promise.all([
    requireActiveProfile(), searchParams,
    getPrisma().unit.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } }),
    getPrisma().department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } }),
    getPrisma().position.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } }),
    getPrisma().employeeTag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { assignments: true } } } }),
  ]);
  const kind = selectedKind(query.aba);
  const items = kind === "UNIT" ? units.map((item) => ({ ...item, linkedEmployees: item._count.employees })) : kind === "DEPARTMENT" ? departments.map((item) => ({ ...item, linkedEmployees: item._count.employees })) : kind === "POSITION" ? positions.map((item) => ({ ...item, linkedEmployees: item._count.employees })) : tags.map((item) => ({ ...item, linkedEmployees: item._count.assignments }));
  const error = actionErrorMessage(query.erro) ?? (query.erro ? "Não foi possível salvar a configuração. Tente novamente." : undefined);

  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]" href="/configuracoes"><ArrowLeft size={15} aria-hidden="true" />Administração</Link><h1 className="mt-3 text-2xl font-bold tracking-tight">Estrutura da empresa</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Organize os cadastros que dão contexto aos funcionários.</p></div></div>
    <nav aria-label="Categorias da estrutura" className="mb-5 flex gap-2 overflow-x-auto border-b pb-3">{tabs.map(({ kind: tabKind, label, icon: Icon }) => <Link aria-current={kind === tabKind ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${kind === tabKind ? "bg-orange-50 text-[var(--primary)]" : "text-slate-600 hover:bg-slate-100"}`} href={`/configuracoes/estrutura?aba=${tabKind}` as Route} key={tabKind}><Icon size={15} aria-hidden="true" />{label}</Link>)}</nav>
    <div className="mb-5"><AsyncFeedback error={error} status={error ? "error" : query.sucesso ? "success" : undefined} success={query.sucesso} /></div>
    <DirectoryManager action={saveDirectoryAction} canManage={profile.role === "RH_ADMIN"} entries={items} kind={kind} />
  </>;
}
