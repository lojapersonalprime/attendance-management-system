import Link from "next/link";
import { AlertTriangle, CalendarDays, FileUp, Settings2 } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { DurationDisplay } from "@/components/ui/duration-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { employeeRoute } from "@/lib/routes";
import { formatDashboardMinutes, getDashboardData } from "@/modules/dashboard/server/get-dashboard-data";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ referencia?: string }> }) {
  const query = await searchParams;
  const dashboard = await getDashboardData(query.referencia);
  const cards = [
    ["Horas trabalhadas", formatDashboardMinutes(dashboard.workedMinutes), "Total registrado nos dias calculados", "/apuracao"],
    ["Saldo negativo", `-${formatDashboardMinutes(dashboard.negativeMinutes)}`, dashboard.negativeMinutes > 0 ? "Requer revisão antes do fechamento" : "Nenhum saldo negativo calculado", "/apuracao"],
    ["Excedentes pendentes", formatDashboardMinutes(dashboard.pendingExcessMinutes), "Aguardam aprovação conforme a política", "/apuracao"],
    ["Pendências abertas", String(dashboard.openPendingCount), `${dashboard.criticalPendingCount} crítica(s) e demais para conferência`, "/inconsistencias"],
    ["Funcionários sem jornada", String(dashboard.employeesMissingSchedule), "Configure a jornada para calcular corretamente", "/funcionarios"],
    ["Última importação", dashboard.latestImport ? dashboard.latestImport.hint : "Sem importação", dashboard.latestImport ? `${dashboard.latestImport.acceptedRows} marcação(ões) processada(s)` : "Importe o arquivo do ponto para começar", "/importacoes"],
  ] as const;
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Visão geral" description="Acompanhe as tarefas do RH na competência selecionada." /><form className="rounded-lg border bg-white p-3"><label className="grid gap-1 text-sm font-medium">Competência<input className="input" name="referencia" type="month" defaultValue={dashboard.reference} onChange={undefined} /></label><button className="mt-2 w-full rounded-md border px-3 py-2 text-sm font-semibold" type="submit">Atualizar</button></form></div>
    <p className="mb-5 text-lg font-semibold capitalize">{dashboard.referenceLabel}</p>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, hint, href]) => <StatCard key={label} label={label} value={value} hint={hint} href={href} />)}</div>
    <section className="mt-7 grid gap-3 rounded-lg border bg-white p-5 md:grid-cols-2 xl:grid-cols-4"><h2 className="md:col-span-2 xl:col-span-4 text-lg font-semibold">Ações rápidas</h2><QuickAction href="/importacoes" icon={FileUp} title="Importar arquivo do ponto" description="Enviar e analisar o TXT do relógio." /><QuickAction href="/inconsistencias" icon={AlertTriangle} title="Revisar pendências" description="Tratar dias que precisam de atenção." /><QuickAction href="/jornadas" icon={Settings2} title="Configurar jornadas" description="Criar ou revisar horários esperados." /><QuickAction href="/apuracao" icon={CalendarDays} title="Abrir apuração mensal" description="Consultar saldos e horas calculadas." /></section>
    <section className="mt-7 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]"><article className="rounded-lg border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Próximas ações recomendadas</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Priorizadas a partir da competência e das importações existentes.</p></div><StatusBadge tone={dashboard.criticalPendingCount > 0 ? "danger" : "info"}>{dashboard.criticalPendingCount > 0 ? "Atenção necessária" : "Situação acompanhada"}</StatusBadge></div><ul className="mt-4 divide-y">{dashboard.recommendations.map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={item.title}><div><p className="font-semibold">{item.title}</p><p className="text-sm text-[var(--muted-foreground)]">{item.description}</p></div><Link className="rounded-md border px-3 py-2 text-sm font-semibold" href={item.href}>Abrir</Link></li>)}</ul></article><article className="rounded-lg border bg-white p-5"><h2 className="text-lg font-semibold">Funcionários que precisam de atenção</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Até 10 pessoas com saldo negativo ou pendências críticas.</p>{dashboard.attentionEmployees.length === 0 ? <p className="mt-5 text-sm text-[var(--muted-foreground)]">Nenhum funcionário requer atenção nesta competência.</p> : <ul className="mt-4 divide-y">{dashboard.attentionEmployees.map((employee) => <li className="flex items-center justify-between gap-3 py-3" key={employee.id}><Link className="font-semibold text-[var(--primary)]" href={employeeRoute(employee.id, { aba: "apuracao" })}>{employee.name}</Link><span className="text-right text-sm"><DurationDisplay minutes={-employee.negativeMinutes} />{employee.criticalPendingCount > 0 ? <span className="block text-xs text-red-700">{employee.criticalPendingCount} crítica(s)</span> : null}</span></li>)}</ul>}</article></section>
    <section className="mt-7"><DashboardCharts dailyHours={dashboard.dailyHours} pendingCategories={dashboard.pendingCategories} balanceTrend={dashboard.balanceTrend} /></section>
  </>;
}

function QuickAction({ href, icon: Icon, title, description }: { href: "/importacoes" | "/inconsistencias" | "/jornadas" | "/apuracao"; icon: typeof FileUp; title: string; description: string }) {
  return <Link className="rounded-md border p-4 transition hover:border-orange-300 hover:bg-orange-50" href={href}><Icon size={20} aria-hidden="true" className="text-[var(--primary)]" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p></Link>;
}
