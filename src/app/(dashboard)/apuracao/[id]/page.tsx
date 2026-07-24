import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { AdjustmentForm } from "@/components/attendance/adjustment-form";
import { AttendanceTimeline } from "@/components/attendance/attendance-timeline";
import { PageHeader } from "@/components/layout/page-header";
import { DetailsDisclosure } from "@/components/ui/details-disclosure";
import { DurationDisplay } from "@/components/ui/duration-display";
import { StatusBadge } from "@/components/ui/status-badge";
import { businessDateTimeToUtc, formatBusinessDate, formatMinutes } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { actionErrorMessage } from "@/lib/forms/action-result";
import { attendanceRoute } from "@/lib/routes";
import { createAdjustmentAction, cancelAdjustmentAction } from "@/app/(dashboard)/apuracao/actions";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { getAdjustmentStatusLabel, getAdjustmentTypeLabel, getEmploymentTypeLabel, getInconsistencyStatusLabel, getSeverityLabel } from "@/lib/presentation/labels";
import { getCalculationPresentationLabel, getCalculationPresentationState } from "@/modules/calculations/domain/calculation-presentation-state";
import { isActionableInconsistencyStatus } from "@/modules/inconsistencies/domain/status";
import { getAttendanceIssuePresentation } from "@/modules/inconsistencies/domain/presentation";
import { getCalculatedTimeline } from "@/modules/attendance/domain/calculated-timeline";

function dateKey(value: Date) { return value.toISOString().slice(0, 10); }

export default async function AttendanceSummaryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireActiveProfile()]);
  const prisma = getPrisma();
  const summary = await prisma.dailySummary.findUnique({ where: { id }, include: { employee: { select: { id: true, fullName: true } }, scheduleAssignment: { include: { scheduleTemplate: { select: { name: true } } } }, employmentPeriod: { include: { calculationPolicy: { select: { name: true } } } }, calculationPolicy: { select: { name: true } }, calculationRun: { select: { status: true } }, inconsistencies: { orderBy: { createdAt: "desc" } } } });
  if (!summary) notFound();
  const businessDate = dateKey(summary.date);
  const nextDate = new Date(summary.date);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const [punches, adjustments] = await Promise.all([
    prisma.rawPunch.findMany({ where: { employeeDeviceLink: { employeeId: summary.employeeId }, occurredAt: { gte: businessDateTimeToUtc(`${businessDate} 00:00:00`), lt: businessDateTimeToUtc(`${dateKey(nextDate)} 00:00:00`) } }, include: { importFile: { select: { originalFilename: true, coverageStatus: true } } }, orderBy: { occurredAt: "asc" } }),
    prisma.adjustment.findMany({ where: { employeeId: summary.employeeId, date: summary.date }, orderBy: { createdAt: "desc" } }),
  ]);
  const canManage = profile.role === "RH_ADMIN";
  const errorMessage = actionErrorMessage(query.erro);
  if (query.erro) query.erro = errorMessage ?? "Não foi possível concluir esta ação. Tente novamente.";
  const balance = summary.positiveMinutes - summary.negativeMinutes;
  const calculatedTimeline = getCalculatedTimeline(summary.calculationMemory, summary.recordedMinutes);
  const hasMemory = Boolean(summary.calculationMemory && typeof summary.calculationMemory === "object");
  const actionableInconsistencies = summary.inconsistencies.filter((issue) => isActionableInconsistencyStatus(issue.status));
  const resolvedInconsistencies = summary.inconsistencies.filter((issue) => !isActionableInconsistencyStatus(issue.status));
  const incompleteIssueTypes = new Set(["ODD_PUNCH_COUNT", "MISSING_ENTRY", "MISSING_EXIT", "MISSING_BREAK_OUT", "MISSING_BREAK_RETURN", "INVALID_SEQUENCE", "INCOMPLETE_DAY"]);
  const incompleteIssues = actionableInconsistencies.filter((issue) => incompleteIssueTypes.has(issue.type));
  const primaryIncompleteIssue = incompleteIssues.find((issue) => issue.type === "INCOMPLETE_DAY") ?? incompleteIssues[0];
  const groupedActionableInconsistencies = [
    ...actionableInconsistencies.filter((issue) => !incompleteIssueTypes.has(issue.type)),
    ...(primaryIncompleteIssue ? [primaryIncompleteIssue] : []),
  ];
  const presentationState = getCalculationPresentationState({ calculationMemory: summary.calculationMemory, calculationEngineVersion: summary.calculationEngineVersion, scheduleAssignmentId: summary.scheduleAssignmentId, employmentPeriodId: summary.employmentPeriodId, calculationPolicyId: summary.calculationPolicyId, dailySummaryStatus: summary.status, calculationRunStatus: summary.calculationRun?.status, inconsistencyTypes: actionableInconsistencies.map((issue) => issue.type) });
  const calculationWaitingReason = !summary.scheduleAssignment ? "a jornada ainda não foi configurada" : !summary.employmentPeriod ? "o vínculo de trabalho ainda não foi configurado" : !summary.calculationPolicy ? "a regra de cálculo ainda não foi configurada" : summary.calculationRun?.status === "FAILED" ? "o último processamento falhou" : actionableInconsistencies.length > 0 ? "existem pendências para revisão" : "o processamento ainda não foi realizado";
  const showsCalculatedDurations = presentationState === "REGULAR" || presentationState === "REVIEW_REQUIRED";
  const showsExpectedDuration = showsCalculatedDurations || presentationState === "INCOMPLETE";
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title={formatBusinessDate(summary.date, "dd/MM/yyyy")} description={summary.employee.fullName} /><Link className="rounded-md border px-4 py-2 text-sm font-semibold" href={attendanceRoute}>Voltar ao Registro do ponto</Link></div>
    {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}{errorMessage ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}
    <section className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-6"><Metric label="Tempo registrado" value={formatMinutes(summary.recordedMinutes)} /><Metric label="Considerado para o saldo" value={showsCalculatedDurations ? formatMinutes(summary.consideredMinutes) : getCalculationPresentationLabel(presentationState)} /><Metric label="Horas previstas" value={showsExpectedDuration ? formatMinutes(summary.expectedMinutes) : getCalculationPresentationLabel(presentationState)} /><Metric label="Saldo" value={showsCalculatedDurations ? <DurationDisplay minutes={balance} sign /> : "Indisponível"} tone={showsCalculatedDurations ? balance < 0 ? "danger" : balance > 0 ? "success" : "neutral" : "warning"} /><Metric label="Pendências" value={groupedActionableInconsistencies.length > 0 ? `${groupedActionableInconsistencies.length} para revisar` : "Nenhuma"} tone={groupedActionableInconsistencies.length > 0 ? "warning" : "success"} /><Metric label="Status" value={getCalculationPresentationLabel(presentationState)} /></section>
    <section className="mt-5 grid gap-5 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-[0.8fr_1.2fr]"><div><h2 className="text-lg font-semibold">Linha do tempo usada no cálculo</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Somente marcações e ajustes que sustentam este DailySummary.</p><div className="mt-5"><AttendanceTimeline punches={calculatedTimeline.punches} technical={false} waitingForRecalculation={calculatedTimeline.state === "WAITING_FOR_RECALCULATION"} /></div>{calculatedTimeline.punches.some((punch) => punch.origin === "MANUAL_ADJUSTMENT") ? <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-950">Tempo calculado com ajuste do RH.</p> : null}</div><div className="grid content-start gap-3 text-sm sm:grid-cols-2"><Info label="Jornada prevista" value={summary.scheduleAssignment?.scheduleTemplate.name ?? "Aguardando configuração"} /><Info label="Tolerância aplicada" value={formatMinutes(toleranceApplied(summary.calculationMemory))} /><Info label="Primeiro período" value={workPeriod(summary.calculationMemory, 0)} /><Info label="Segundo período" value={workPeriod(summary.calculationMemory, 1)} /><Info label="Intervalo" value={summary.breakMinutes > 0 ? formatMinutes(summary.breakMinutes) : "Não se aplica"} /><Info label="Atraso" value={formatMinutes(summary.lateMinutes)} /><Info label="Saída antecipada" value={formatMinutes(summary.earlyDepartureMinutes)} /><Info label="Excedente pendente" value={formatMinutes(summary.pendingExcessMinutes)} /><Info label="Saldo calculado" value={showsCalculatedDurations ? <DurationDisplay minutes={balance} sign /> : "Indisponível"} /></div></section>
    <section className="mt-5 rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Pendências para revisar</h2>{groupedActionableInconsistencies.length === 0 ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Nenhuma pendência acionável para este dia.</p> : <ul className="mt-3 divide-y">{groupedActionableInconsistencies.map((issue) => { const presentation = getAttendanceIssuePresentation(issue.type); return <li className="flex flex-wrap items-start justify-between gap-3 py-3" key={issue.id}><div><p className="font-semibold">{presentation.title}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{presentation.description}</p>{issue.id === primaryIncompleteIssue?.id && incompleteIssues.length > 1 ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">Há outros detalhes relacionados a esta mesma ausência de batida.</p> : null}</div><StatusBadge tone={issue.severity === "CRITICAL" ? "danger" : issue.severity === "WARNING" ? "warning" : "info"}>{getSeverityLabel(issue.severity)} · {getInconsistencyStatusLabel(issue.status)}</StatusBadge></li>; })}</ul>}{resolvedInconsistencies.length > 0 ? <DetailsDisclosure title={`Histórico resolvido (${resolvedInconsistencies.length})`}><ul className="divide-y">{resolvedInconsistencies.map((issue) => <li className="flex flex-wrap items-start justify-between gap-3 py-3" key={issue.id}><span>{getAttendanceIssuePresentation(issue.type).title}</span><span className="text-sm text-[var(--muted-foreground)]">{getInconsistencyStatusLabel(issue.status)}</span></li>)}</ul></DetailsDisclosure> : null}</section>
    <section className="mt-5 rounded-lg border bg-white p-5"><h2 className="text-lg font-semibold">Ajustes</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">As marcações do relógio são preservadas; todo tratamento é registrado e auditável.</p>{adjustments.length > 0 ? <ul className="mt-4 divide-y">{adjustments.map((adjustment) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={adjustment.id}><span><strong>{getAdjustmentTypeLabel(adjustment.type)}</strong> · {getAdjustmentStatusLabel(adjustment.status)}<span className="block text-sm text-[var(--muted-foreground)]">{adjustment.reason}</span></span>{canManage && adjustment.status === "ACTIVE" ? <form action={cancelAdjustmentAction} className="flex gap-2"><input type="hidden" name="summaryId" value={summary.id} /><input type="hidden" name="adjustmentId" value={adjustment.id} /><input className="input w-48" name="reason" placeholder="Motivo do cancelamento" required minLength={3} /><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="submit">Cancelar</button></form> : null}</li>)}</ul> : <p className="mt-3 text-sm text-[var(--muted-foreground)]">Nenhum ajuste aplicado.</p>}{canManage ? <DetailsDisclosure title="Corrigir ou justificar este dia"><AdjustmentForm action={createAdjustmentAction} summaryId={summary.id} employeeId={summary.employeeId} date={businessDate} punches={punches.map((punch) => ({ id: punch.id, label: `${formatInTimeZone(punch.occurredAt, "America/Fortaleza", "HH:mm:ss")} · ${punch.punchCode}` }))} /></DetailsDisclosure> : null}</section>
    <section className="mt-5 rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Como este resultado foi calculado?</h2>{hasMemory && (showsCalculatedDurations || presentationState === "INCOMPLETE") ? <><div className="mt-3 grid gap-3 text-sm md:grid-cols-2"><Info label="Vínculo" value={summary.employmentPeriod?.employmentType ? getEmploymentTypeLabel(summary.employmentPeriod.employmentType) : "Não informado"} /><Info label="Política" value={summary.calculationPolicy?.name ?? summary.employmentPeriod?.calculationPolicy?.name ?? "Não informada"} /><Info label="Regra de arredondamento" value="Soma os segundos e arredonda uma única vez para cima" /><Info label="Saldo" value={showsCalculatedDurations ? `${balance > 0 ? "+" : ""}${formatMinutes(balance)}` : "Indisponível até concluir as marcações"} /></div><DetailsDisclosure title="Detalhes técnicos"><p className="mb-2 text-sm">Versão do motor: {summary.calculationEngineVersion}</p><pre className="overflow-x-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(summary.calculationMemory, null, 2)}</pre></DetailsDisclosure></> : <p className="mt-3 text-sm text-[var(--muted-foreground)]">Este dia ainda não tem resultado definitivo porque {calculationWaitingReason}.</p>}</section>
  </>;
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" | "warning" | "danger" | "neutral" }) { return <div><dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt><dd className="mt-2 text-lg font-semibold">{tone ? <StatusBadge tone={tone}>{value}</StatusBadge> : value}</dd></div>; }
function Info({ label, value }: { label: string; value: React.ReactNode }) { return <div><dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }

function workPeriod(memory: unknown, index: number) {
  if (!memory || typeof memory !== "object" || !("periods" in memory) || !Array.isArray(memory.periods)) return "—";
  const periods = memory.periods.filter((period): period is { kind: string; seconds: number } => Boolean(period) && typeof period === "object" && "kind" in period && period.kind === "WORK" && "seconds" in period && typeof period.seconds === "number");
  const seconds = periods[index]?.seconds;
  return typeof seconds === "number" ? formatMinutes(Math.ceil(seconds / 60)) : "—";
}

function toleranceApplied(memory: unknown) {
  if (!memory || typeof memory !== "object" || !("minutes" in memory) || !memory.minutes || typeof memory.minutes !== "object") return 0;
  const value = (memory.minutes as Record<string, unknown>).toleranceAppliedMinutes;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
