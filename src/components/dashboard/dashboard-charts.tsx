"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMinutes } from "@/lib/dates/business";

interface DashboardChartsProps {
  dailyHours: Array<{ day: string; minutes: number }>;
  pendingCategories: Array<{ label: string; count: number }>;
}

function TooltipDuration({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs text-[var(--foreground)] shadow-lg"><p className="font-semibold">Dia {label}</p>{payload.map((item) => <p className="mt-1 text-[var(--muted-foreground)]" key={item.name}>{item.name}: {formatMinutes(item.value ?? 0)}</p>)}</div>;
}

function TooltipCount({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-xs text-[var(--foreground)] shadow-lg"><p className="font-semibold">{label}</p><p className="mt-1 text-[var(--muted-foreground)]">{payload[0]?.value ?? 0} pendência(s)</p></div>;
}

function ChartCard({ title, description, children, empty, summary }: { title: string; description: string; children: React.ReactNode; empty: boolean; summary: string }) {
  return <section className="surface rounded-[1.35rem] p-5"><p className="eyebrow text-[var(--primary)]">ANÁLISE</p><h2 className="font-display mt-1 text-2xl font-semibold leading-none">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>{empty ? <p className="grid min-h-64 place-items-center text-sm text-[var(--muted-foreground)]">Sem dados para o período.</p> : <div className="mt-4 h-64 text-[var(--muted-foreground)]" role="img" aria-label={summary}>{children}</div>}<details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-[var(--primary)]">Resumo textual</summary><p className="mt-2 text-[var(--muted-foreground)]">{summary}</p></details></section>;
}

export function DashboardCharts({ dailyHours, pendingCategories }: DashboardChartsProps) {
  return <div className="grid gap-5 xl:grid-cols-2">
    <ChartCard title="Horas trabalhadas por dia" description="Total registrado nas marcações já calculadas." empty={dailyHours.length === 0} summary={dailyHours.length ? `${dailyHours.length} dia(s) com horas calculadas nesta competência.` : "Não há horas calculadas nesta competência."}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyHours} margin={{ left: 8, right: 8 }}><CartesianGrid stroke="#34363c" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" label={{ value: "Dia", position: "insideBottom", offset: -2, fill: "#A1A1AA" }} tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => formatMinutes(Number(value))} tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={false} tickLine={false} width={58} /><Tooltip content={<TooltipDuration />} /><Bar dataKey="minutes" fill="#F47A20" isAnimationActive={false} name="Horas trabalhadas" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
    </ChartCard>
    <ChartCard title="Pendências por categoria" description="Agrupamento para orientar a revisão do RH." empty={pendingCategories.length === 0} summary={pendingCategories.length ? pendingCategories.map((item) => `${item.label}: ${item.count}`).join("; ") : "Não há pendências abertas nesta competência."}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={pendingCategories} layout="vertical" margin={{ left: 42, right: 12 }}><CartesianGrid stroke="#34363c" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={105} tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip content={<TooltipCount />} /><Bar dataKey="count" fill="#F59E0B" isAnimationActive={false} name="Pendências" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
    </ChartCard>
  </div>;
}
