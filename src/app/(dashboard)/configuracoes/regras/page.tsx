import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { ensureCalculationPoliciesAction, saveCalculationPolicyAction } from "@/app/(dashboard)/configuracoes/actions";
import { CalculationPolicyEditor, type CalculationPolicyEditorValue } from "@/components/settings/calculation-policy-editor";
import { AsyncFeedback, LoadingButton } from "@/components/ui/async-feedback";
import { actionErrorMessage } from "@/lib/forms/action-result";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";

function entryModeText(mode: CalculationPolicyEditorValue["entryToleranceMode"]) {
  return mode === "FULL_DELAY_AFTER_TOLERANCE" ? "Quando ultrapassar a tolerância, considerar todo o atraso." : "Quando ultrapassar a tolerância, considerar somente os minutos excedentes.";
}

export default async function CalculationRulesPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const [profile, query, policies] = await Promise.all([requireActiveProfile(), searchParams, getPrisma().calculationPolicy.findMany({ orderBy: { name: "asc" } })]);
  const canManage = profile.role === "RH_ADMIN";
  const error = actionErrorMessage(query.erro) ?? (query.erro ? "Não foi possível salvar a regra. Tente novamente." : undefined);
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]" href="/configuracoes"><ArrowLeft size={15} aria-hidden="true" />Administração</Link><h1 className="mt-3 text-2xl font-bold tracking-tight">Regras de cálculo</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Defina como tolerâncias, saídas e excedentes são considerados na apuração.</p></div>{canManage && policies.length === 0 ? <form action={ensureCalculationPoliciesAction}><LoadingButton className="bg-[var(--primary)]" loadingLabel="Preparando regras…"><Plus size={16} aria-hidden="true" />Disponibilizar regras iniciais</LoadingButton></form> : null}</div>
    <div className="my-5"><AsyncFeedback error={error} status={error ? "error" : query.sucesso ? "success" : undefined} success={query.sucesso} /></div>
    {policies.length === 0 ? <section className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-white p-6 text-center"><div><h2 className="font-semibold">Nenhuma política cadastrada</h2><p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">Crie ou disponibilize uma regra antes de vincular funcionários a uma política de cálculo.</p>{canManage ? <form action={ensureCalculationPoliciesAction} className="mt-4"><LoadingButton loadingLabel="Preparando regras…">Disponibilizar regras iniciais</LoadingButton></form> : null}</div></section> : <div className="grid gap-4 lg:grid-cols-2">{policies.map((policy) => <article className="rounded-xl border bg-white p-5 shadow-sm" key={policy.id}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{policy.name}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{policy.description || "Regra usada na apuração do ponto."}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${policy.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{policy.active ? "Ativa" : "Inativa"}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Tolerância de entrada</dt><dd className="mt-1 font-medium">{policy.entryToleranceMinutes > 0 ? `${policy.entryToleranceMinutes} minutos` : "Não informada"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Tolerância de saída</dt><dd className="mt-1 font-medium">{policy.exitToleranceMinutes > 0 ? `${policy.exitToleranceMinutes} minutos` : "Não informada"}</dd></div></dl><p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{entryModeText(policy.entryToleranceMode)}</p><div className="mt-5">{canManage ? <CalculationPolicyEditor action={saveCalculationPolicyAction} policy={policy} /> : null}</div></article>)}</div>}
  </>;
}
