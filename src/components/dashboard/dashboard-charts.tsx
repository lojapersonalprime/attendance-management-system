"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMinutes } from "@/lib/dates/business";

interface DashboardChartsProps {
  dailyHours: Array<{ day: string; minutes: number }>;
  pendingCategories: Array<{ label: string; count: number }>;
  balanceTrend: Array<{ day: string; negativeMinutes: number; pendingExcessMinutes: number }>;
}

function TooltipDuration({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border bg-white p-3 text-xs shadow-sm"><p className="font-semibold">Dia {label}</p>{payload.map((item) => <p key={item.name}>{item.name}: {formatMinutes(item.value ?? 0)}</p>)}</div>;
}

function TooltipCount({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border bg-white p-3 text-xs shadow-sm"><p className="font-semibold">{label}</p><p>{payload[0]?.value ?? 0} pendência(s)</p></div>;
}

function ChartCard({ title, description, children, empty, summary }: { title: string; description: string; children: React.ReactNode; empty: boolean; summary: string }) {
  return <section className="rounded-lg border bg-white p-5"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>{empty ? <p className="grid min-h-64 place-items-center text-sm text-[var(--muted-foreground)]">Sem dados para o período.</p> : <div className="mt-4 h-64" role="img" aria-label={summary}>{children}</div>}<details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-[var(--primary)]">Resumo textual</summary><p className="mt-2 text-[var(--muted-foreground)]">{summary}</p></details></section>;
}

export function DashboardCharts({ dailyHours, pendingCategories, balanceTrend }: DashboardChartsProps) {
  return <div className="grid gap-5 xl:grid-cols-2">
    <ChartCard title="Horas trabalhadas por dia" description="Total registrado nas marcações já calculadas." empty={dailyHours.length === 0} summary={dailyHours.length ? `${dailyHours.length} dia(s) com horas calculadas nesta competência.` : "Não há horas calculadas nesta competência."}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyHours} margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" label={{ value: "Dia", position: "insideBottom", offset: -2 }} /><YAxis tickFormatter={(value) => formatMinutes(Number(value))} width={58} /><Tooltip content={<TooltipDuration />} /><Bar dataKey="minutes" name="Horas trabalhadas" fill="#e86f16" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
    </ChartCard>
    <ChartCard title="Pendências por categoria" description="Agrupamento para orientar a revisão do RH." empty={pendingCategories.length === 0} summary={pendingCategories.length ? pendingCategories.map((item) => `${item.label}: ${item.count}`).join("; ") : "Não há pendências abertas nesta competência."}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={pendingCategories} layout="vertical" margin={{ left: 42, right: 12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="label" width={105} tick={{ fontSize: 12 }} /><Tooltip content={<TooltipCount />} /><Bar dataKey="count" name="Pendências" fill="#d97706" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
    </ChartCard>
    <ChartCard title="Evolução do saldo" description="Débitos e excedentes pendentes acumulados por dia." empty={balanceTrend.length === 0} summary={balanceTrend.length ? "A linha vermelha representa saldo negativo e a linha amarela, excedentes pendentes." : "Não há saldo calculado nesta competência."}>
      <ResponsiveContainer width="100%" height="100%"><LineChart data={balanceTrend} margin={{ left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis tickFormatter={(value) => formatMinutes(Number(value))} width={58} /><Tooltip content={<TooltipDuration />} /><Legend /><Line type="monotone" dataKey="negativeMinutes" name="Saldo negativo" stroke="#dc2626" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="pendingExcessMinutes" name="Excedente pendente" stroke="#ca8a04" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
    </ChartCard>
  </div>;
}
