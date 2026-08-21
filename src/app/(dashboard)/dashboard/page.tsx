import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, FileUp, Settings2, UsersRound, WalletCards } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { DurationDisplay } from "@/components/ui/duration-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { employeeRoute } from "@/lib/routes";
import { formatDashboardMinutes, getDashboardData } from "@/modules/dashboard/server/get-dashboard-data";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE } from "@/lib/dates/business";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ referencia?: string }> }) {
  const query = await searchParams;
  const dashboard = await getDashboardData(query.referencia);
  const cards = [
    { label: "Horas registradas", value: formatDashboardMinutes(dashboard.workedMinutes), hint: "Tempo encontrado nas marcações da competência.", href: "/apuracao" as const, icon: Clock3, tone: "primary" as const },
    { label: "Pendências para revisar", value: String(dashboard.openPendingCount), hint: dashboard.criticalPendingCount > 0 ? `${dashboard.criticalPendingCount} exigem atenção antes do fechamento.` : "Nenhuma pendência crítica nesta competência.", href: "/inconsistencias" as const, icon: AlertTriangle, tone: dashboard.criticalPendingCount > 0 ? "danger" as const : "warning" as const },
    { label: "Com apuração disponível", value: String(dashboard.employeesWithAvailableCalculation), hint: "Funcionários com resultado para o RH conferir.", href: "/apuracao" as const, icon: CheckCircle2, tone: "success" as const },
    { label: "Saldo a regularizar", value: `-${formatDashboardMinutes(dashboard.negativeMinutes)}`, hint: dashboard.negativeMinutes > 0 ? "Confira antes do fechamento da competência." : "Nenhum saldo negativo calculado.", href: "/apuracao" as const, icon: WalletCards, tone: "danger" as const },
  ];

  return <>
    <section className="surface-highlight relative overflow-hidden rounded-[2rem] px-6 py-7 lg:px-9 lg:py-9">
      <div className="absolute -right-16 -top-24 size-64 rounded-full border border-[rgb(244_122_32_/_18%)]" aria-hidden="true" />
      <div className="relative flex flex-wrap items-start justify-between gap-7">
        <div className="max-w-2xl">
          <p className="eyebrow text-[var(--primary)]">CENTRAL DE APURAÇÃO</p>
          <h1 className="font-display mt-3 max-w-xl text-5xl font-semibold leading-[0.88] tracking-tight text-[var(--foreground)] sm:text-6xl">Tudo o que precisa de atenção em um só lugar.</h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">Acompanhe as horas calculadas a partir do arquivo do relógio, trate pendências e mantenha os modelos de horário em dia.</p>
        </div>
        <form className="surface-elevated w-full rounded-[1.35rem] p-4 sm:w-[17rem]">
          <label className="eyebrow grid gap-2 text-[var(--muted-foreground)]">COMPETÊNCIA<input className="input numeric h-11 w-full normal-case tracking-normal" name="referencia" type="month" defaultValue={dashboard.reference} /></label>
          <Button className="mt-3 w-full" type="submit">Ver competência</Button>
        </form>
      </div>
      <div className="relative mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border)] pt-4 text-sm"><span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 font-semibold capitalize text-[var(--foreground)]">{dashboard.referenceLabel}</span><span className="text-[var(--muted-foreground)]">{dashboard.latestImport ? `Último arquivo processado: ${dashboard.latestImport.hint}` : "Nenhum arquivo processado ainda"}</span></div>
    </section>

    <section className="motion-enter motion-delay-1 -mt-1 grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <StatCard {...card} key={card.label} />)}
    </section>

    <section className="surface motion-enter motion-delay-2 mt-7 rounded-[1.5rem] p-3 sm:p-4">
      <div className="px-2 pb-3 sm:px-3"><p className="eyebrow text-[var(--primary)]">ATALHO OPERACIONAL</p><h2 className="font-display mt-1 text-2xl font-semibold leading-none">Ações rápidas</h2></div>
      <div className="grid divide-y divide-[var(--border)] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <QuickAction href="/importacoes" icon={FileUp} title="Importar arquivo" description="Enviar o TXT do relógio" />
        <QuickAction href="/funcionarios" icon={UsersRound} title="Completar contexto" description={`${dashboard.employeesMissingSchedule} pessoa(s) sem modelo de horário`} />
        <QuickAction href="/jornadas" icon={Settings2} title="Modelos de horário" description="Criar ou ajustar horários" />
      </div>
    </section>

    <section className="motion-enter motion-delay-3 mt-7 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <article className="surface rounded-[1.5rem] p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="eyebrow text-[var(--primary)]">PRIORIDADE</p><h2 className="font-display mt-1 text-3xl font-semibold leading-none">Próximo passo para o RH</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Ações priorizadas para manter a competência avançando.</p></div>
          <StatusBadge tone={dashboard.criticalPendingCount > 0 ? "danger" : "info"}>{dashboard.criticalPendingCount > 0 ? "Atenção necessária" : "Em acompanhamento"}</StatusBadge>
        </div>
        <ul className="mt-3 divide-y">
          {dashboard.recommendations.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={item.title}><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.description}</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]" href={item.href}>Abrir <ArrowUpRight size={15} aria-hidden="true" /></Link></li>)}
        </ul>
      </article>
      <article className="surface rounded-[1.5rem] p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow text-[var(--primary)]">ACOMPANHAMENTO</p><h2 className="font-display mt-1 text-3xl font-semibold leading-none">Pessoas que precisam de atenção</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Saldo negativo ou pendência crítica.</p></div><span className="grid size-10 place-items-center rounded-xl bg-[rgb(244_122_32_/_12%)] text-[var(--primary)]"><CalendarDays size={19} aria-hidden="true" /></span></div>
        {dashboard.attentionEmployees.length === 0 ? <p className="mt-8 text-sm text-[var(--muted-foreground)]">Nenhuma pessoa requer atenção neste período.</p> : <ul className="mt-3 divide-y">{dashboard.attentionEmployees.map((employee) => <li className="flex items-center justify-between gap-3 py-3" key={employee.id}><Link className="font-semibold text-slate-900 hover:text-[var(--primary)]" href={employeeRoute(employee.id, { aba: "registro" })}>{employee.name}</Link><span className="text-right text-sm"><DurationDisplay minutes={-employee.negativeMinutes} />{employee.criticalPendingCount > 0 ? <span className="mt-0.5 block text-xs text-red-700">{employee.criticalPendingCount} crítica(s)</span> : null}</span></li>)}</ul>}
      </article>
    </section>

    {dashboard.latestImportSituation ? <section className="surface motion-enter motion-delay-4 mt-7 rounded-[1.5rem] p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-[var(--primary)]">ÚLTIMA IMPORTAÇÃO</p><h2 className="font-display mt-1 text-3xl font-semibold leading-none">Situação na última data importada</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Baseado no último arquivo importado; não representa uma situação em tempo real.</p></div><StatusBadge tone="info">Arquivo importado{dashboard.latestImportSituation.importedAt ? ` em ${formatInTimeZone(dashboard.latestImportSituation.importedAt, BUSINESS_TIME_ZONE, "dd/MM/yyyy 'às' HH:mm")}` : ""}</StatusBadge></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SituationMetric label="Jornadas encerradas" value={dashboard.latestImportSituation.ended} /><SituationMetric label="Marcações incompletas" value={dashboard.latestImportSituation.incomplete} tone="warning" /><SituationMetric label="Em intervalo" value={dashboard.latestImportSituation.onBreak} tone="primary" /><SituationMetric label="Sem registro" value={dashboard.latestImportSituation.withoutRecord} /></div>
      {dashboard.latestImportSituation.employees.length > 0 ? <ul className="mt-5 divide-y border-t">{dashboard.latestImportSituation.employees.map((employee) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={employee.id}><Link className="font-semibold hover:text-[var(--primary)]" href={employeeRoute(employee.id, { aba: "registro" })}>{employee.name}</Link><div className="text-right text-sm"><p>{formatInTimeZone(employee.occurredAt, BUSINESS_TIME_ZONE, "HH:mm")} · {employee.description}</p><p className={`mt-0.5 text-xs ${employee.needsAction ? "text-amber-700" : "text-emerald-700"}`}>{employee.state}{employee.needsAction ? " · confira o registro" : ""}</p></div></li>)}</ul> : null}
    </section> : null}

    <section className="motion-enter motion-delay-4 mt-7"><DashboardCharts dailyHours={dashboard.dailyHours} pendingCategories={dashboard.pendingCategories} /></section>
  </>;
}

function SituationMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "primary" }) {
  const color = tone === "warning" ? "text-[var(--warning)]" : tone === "primary" ? "text-[var(--primary)]" : "text-[var(--foreground)]";
  return <div className="surface-elevated rounded-xl p-4"><p className={`motion-number numeric font-display text-4xl font-semibold leading-none ${color}`}>{value}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">{label}</p></div>;
}

function QuickAction({ href, icon: Icon, title, description }: { href: "/importacoes" | "/funcionarios" | "/jornadas"; icon: typeof FileUp; title: string; description: string }) {
  return <Link className="group flex min-h-24 items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-[background-color,border-color,transform] duration-[220ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[rgb(244_122_32_/_34%)] hover:bg-[var(--surface-elevated)] sm:px-4" href={href}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[rgb(244_122_32_/_12%)] text-[var(--primary)]"><Icon size={19} aria-hidden="true" /></span><span><span className="block font-semibold text-[var(--foreground)]">{title}</span><span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">{description}</span></span><ArrowUpRight className="ml-auto text-[var(--muted-foreground)] transition group-hover:text-[var(--primary)]" size={17} aria-hidden="true" /></Link>;
}
