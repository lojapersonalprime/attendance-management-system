import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, FileUp, Settings2, UsersRound, WalletCards } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { DurationDisplay } from "@/components/ui/duration-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { employeeRoute } from "@/lib/routes";
import { formatDashboardMinutes, getDashboardData } from "@/modules/dashboard/server/get-dashboard-data";

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
    <section className="overflow-hidden rounded-2xl bg-slate-950 px-6 py-7 text-white shadow-lg lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Central de apuração do RH</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Tudo o que precisa de atenção em um só lugar.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Acompanhe as horas calculadas a partir do arquivo do relógio, trate pendências e mantenha os modelos de horário em dia.</p>
        </div>
        <form className="w-full rounded-xl bg-white/10 p-3 backdrop-blur sm:w-auto">
          <label className="grid gap-1 text-sm font-medium text-slate-200">Competência<input className="rounded-md border border-white/20 bg-white px-3 py-2 text-sm text-slate-950" name="referencia" type="month" defaultValue={dashboard.reference} /></label>
          <button className="mt-2 w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950" type="submit">Ver competência</button>
        </form>
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-3 text-sm"><span className="rounded-full bg-white/10 px-3 py-1.5 font-semibold capitalize">{dashboard.referenceLabel}</span><span className="text-slate-300">{dashboard.latestImport ? `Último arquivo processado: ${dashboard.latestImport.hint}` : "Nenhum arquivo processado ainda"}</span></div>
    </section>

    <section className="-mt-1 grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <StatCard key={card.label} {...card} />)}
    </section>

    <section className="mt-7 grid gap-4 lg:grid-cols-3">
      <QuickAction href="/importacoes" icon={FileUp} title="Importar arquivo" description="Enviar o TXT do relógio" />
      <QuickAction href="/funcionarios" icon={UsersRound} title="Completar contexto" description={`${dashboard.employeesMissingSchedule} pessoa(s) sem modelo de horário`} />
      <QuickAction href="/jornadas" icon={Settings2} title="Modelos de horário" description="Criar ou ajustar horários" />
    </section>

    <section className="mt-7 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Próximo passo para o RH</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Ações priorizadas para manter a competência avançando.</p></div>
          <StatusBadge tone={dashboard.criticalPendingCount > 0 ? "danger" : "info"}>{dashboard.criticalPendingCount > 0 ? "Atenção necessária" : "Em acompanhamento"}</StatusBadge>
        </div>
        <ul className="mt-3 divide-y">
          {dashboard.recommendations.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={item.title}><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.description}</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]" href={item.href}>Abrir <ArrowUpRight size={15} aria-hidden="true" /></Link></li>)}
        </ul>
      </article>
      <article className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Pessoas que precisam de atenção</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Saldo negativo ou pendência crítica.</p></div><CalendarDays className="text-[var(--primary)]" size={20} aria-hidden="true" /></div>
        {dashboard.attentionEmployees.length === 0 ? <p className="mt-8 text-sm text-[var(--muted-foreground)]">Nenhuma pessoa requer atenção nesta competência.</p> : <ul className="mt-3 divide-y">{dashboard.attentionEmployees.map((employee) => <li className="flex items-center justify-between gap-3 py-3" key={employee.id}><Link className="font-semibold text-slate-900 hover:text-[var(--primary)]" href={employeeRoute(employee.id, { aba: "apuracao" })}>{employee.name}</Link><span className="text-right text-sm"><DurationDisplay minutes={-employee.negativeMinutes} />{employee.criticalPendingCount > 0 ? <span className="mt-0.5 block text-xs text-red-700">{employee.criticalPendingCount} crítica(s)</span> : null}</span></li>)}</ul>}
      </article>
    </section>

    <section className="mt-7"><DashboardCharts dailyHours={dashboard.dailyHours} pendingCategories={dashboard.pendingCategories} balanceTrend={dashboard.balanceTrend} /></section>
  </>;
}

function QuickAction({ href, icon: Icon, title, description }: { href: "/importacoes" | "/funcionarios" | "/jornadas"; icon: typeof FileUp; title: string; description: string }) {
  return <Link className="group flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md" href={href}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-[var(--primary)]"><Icon size={20} aria-hidden="true" /></span><span><span className="block font-semibold">{title}</span><span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">{description}</span></span><ArrowUpRight className="ml-auto text-slate-400 transition group-hover:text-[var(--primary)]" size={17} aria-hidden="true" /></Link>;
}
