import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { InconsistencyType } from "@/generated/prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { formatMinutes } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { attendanceSummaryRoute } from "@/lib/routes";
import { updateCalculationPeriodStatusAction } from "@/app/(dashboard)/apuracao/actions";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { segmentMonthlySummaries } from "@/modules/calculations/domain/employment-periods";
import { employmentTypes } from "@/modules/employees/domain/validation";
import { getDailySummaryStatusLabel, getEmploymentTypeLabel, getInconsistencyTypeLabel } from "@/lib/presentation/labels";

const statuses = ["PROVISIONAL", "NEEDS_REVIEW", "REGULAR", "CLOSED"] as const;

function monthRange(reference: string) {
  const start = new Date(`${reference}-01T00:00:00.000Z`);
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}

function formatBusinessDateShort(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ reference?: string; employeeId?: string; employmentType?: string; calculationPolicyId?: string; scheduleTemplateId?: string; status?: string; inconsistency?: string; importFileId?: string; sucesso?: string; erro?: string }> }) {
  const [query, profile] = await Promise.all([searchParams, requireActiveProfile()]);
  const reference = /^\d{4}-(0[1-9]|1[0-2])$/.test(query.reference ?? "") ? query.reference! : formatInTimeZone(new Date(), "America/Fortaleza", "yyyy-MM");
  const { start, end } = monthRange(reference);
  const employmentType = employmentTypes.find((value) => value === query.employmentType);
  const inconsistencyType = Object.values(InconsistencyType).find((value) => value === query.inconsistency);
  const prisma = getPrisma();
  const [employees, policies, schedules, imports, closingPeriod] = await Promise.all([
    prisma.employee.findMany({ where: { status: { not: "MERGED" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.calculationPolicy.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.scheduleTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.importFile.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, originalFilename: true } }),
    prisma.closingPeriod.findUnique({ where: { referenceMonth: start }, select: { status: true } }),
  ]);
  const summaries = await prisma.dailySummary.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.calculationPolicyId ? { calculationPolicyId: query.calculationPolicyId } : {}),
      ...(query.scheduleTemplateId ? { scheduleAssignment: { scheduleTemplateId: query.scheduleTemplateId } } : {}),
      ...(statuses.includes(query.status as (typeof statuses)[number]) ? { status: query.status as (typeof statuses)[number] } : {}),
      ...(employmentType ? { employmentPeriod: { employmentType } } : {}),
      ...(inconsistencyType ? { inconsistencies: { some: { type: inconsistencyType, status: { in: ["OPEN", "IN_REVIEW", "REOPENED"] } } } } : {}),
      ...(query.importFileId ? { calculationRun: { importFileId: query.importFileId } } : {}),
    },
    include: {
      employee: { select: { fullName: true, registration: true } },
      scheduleAssignment: { include: { scheduleTemplate: { select: { name: true } } } },
      employmentPeriod: { include: { calculationPolicy: { select: { name: true } } } },
      calculationPolicy: { select: { name: true } },
      inconsistencies: { where: { status: { in: ["OPEN", "IN_REVIEW", "REOPENED"] } }, select: { id: true } },
    },
    orderBy: [{ employee: { fullName: "asc" } }, { date: "asc" }],
    take: 500,
  });
  const summariesByEmployee = new Map<string, typeof summaries>();
  for (const summary of summaries) summariesByEmployee.set(summary.employeeId, [...(summariesByEmployee.get(summary.employeeId) ?? []), summary]);
  const monthlySegments = [...summariesByEmployee.values()].flatMap((employeeSummaries) => {
    const employee = employeeSummaries[0]?.employee;
    if (!employee) return [];
    return segmentMonthlySummaries(employeeSummaries.map((summary) => ({
      businessDate: summary.date.toISOString().slice(0, 10),
      employmentPeriodId: summary.employmentPeriodId,
      employmentType: summary.employmentPeriod?.employmentType,
      calculationPolicyId: summary.calculationPolicyId,
      policyName: summary.calculationPolicy?.name ?? summary.employmentPeriod?.calculationPolicy?.name,
      expectedMinutes: summary.expectedMinutes,
      workedMinutes: summary.workedMinutes,
      lateMinutes: summary.lateMinutes,
      earlyDepartureMinutes: summary.earlyDepartureMinutes,
      pendingExcessMinutes: summary.pendingExcessMinutes,
      negativeMinutes: summary.negativeMinutes,
    }))).map((segment) => ({ employee: employee.fullName, ...segment }));
  });
  const canManage = profile.role === "RH_ADMIN";

  return <>
    <PageHeader title="Apuração" description="Dados derivados do TXT com vínculo, política, jornada, cobertura e memória versionada." />
    {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
    {query.erro ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{query.erro}</p> : null}
    {canManage ? <section className="mb-5 rounded-lg border bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Competência {reference}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{closingPeriod?.status === "CLOSED" ? "Fechada: contextos históricos exigem reabertura auditável." : "Aberta: feche apenas após revisar inconsistências críticas."}</p></div><form action={updateCalculationPeriodStatusAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="reference" value={reference} /><input type="hidden" name="operation" value={closingPeriod?.status === "CLOSED" ? "REOPEN" : "CLOSE"} /><input className="input w-64" name="reason" placeholder={closingPeriod?.status === "CLOSED" ? "Motivo da reabertura" : "Motivo do fechamento"} /><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="submit">{closingPeriod?.status === "CLOSED" ? "Reabrir competência" : "Fechar competência"}</button></form></div></section> : null}
    <form className="mb-5 grid gap-2 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="grid gap-1 text-sm">Competência<input className="input" type="month" name="reference" defaultValue={reference} /></label>
      <label className="grid gap-1 text-sm">Funcionário<select className="input" name="employeeId" defaultValue={query.employeeId ?? ""}><option value="">Todos</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Vínculo<select className="input" name="employmentType" defaultValue={query.employmentType ?? ""}><option value="">Todos</option><option value="EMPLOYEE">CLT/Funcionário</option><option value="INTERN">Estagiário</option><option value="APPRENTICE">Jovem aprendiz</option><option value="CONTRACTOR">PJ/Prestador</option><option value="OTHER">Outro</option></select></label>
      <label className="grid gap-1 text-sm">Política<select className="input" name="calculationPolicyId" defaultValue={query.calculationPolicyId ?? ""}><option value="">Todas</option>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Jornada<select className="input" name="scheduleTemplateId" defaultValue={query.scheduleTemplateId ?? ""}><option value="">Todas</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Status<select className="input" name="status" defaultValue={query.status ?? ""}><option value="">Todos</option>{statuses.map((status) => <option key={status} value={status}>{getDailySummaryStatusLabel(status)}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Inconsistência<select className="input" name="inconsistency" defaultValue={query.inconsistency ?? ""}><option value="">Todas</option>{Object.values(InconsistencyType).map((type) => <option key={type} value={type}>{getInconsistencyTypeLabel(type)}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Arquivo<select className="input" name="importFileId" defaultValue={query.importFileId ?? ""}><option value="">Todos</option>{imports.map((file) => <option key={file.id} value={file.id}>{file.originalFilename}</option>)}</select></label>
      <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white xl:col-span-4" type="submit">Aplicar filtros</button>
    </form>
    <a className="mb-5 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50" href={`/api/exports/monthly?reference=${reference}`}>Exportar competência atual em CSV</a>
    {monthlySegments.length > 0 ? <section className="mb-5 overflow-x-auto rounded-lg border bg-white"><div className="border-b px-5 py-4"><h2 className="text-lg font-semibold">Segmentação mensal por contexto histórico</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Saldos de períodos ou políticas diferentes não são combinados automaticamente.</p></div><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">Faixa</th><th className="px-4 py-3">Vínculo</th><th className="px-4 py-3">Política</th><th className="px-4 py-3">Previsto</th><th className="px-4 py-3">Trabalhado</th><th className="px-4 py-3">Atraso</th><th className="px-4 py-3">Excedente pendente</th><th className="px-4 py-3">Débito</th></tr></thead><tbody>{monthlySegments.map((segment) => <tr className="border-b last:border-0" key={`${segment.employee}|${segment.employmentPeriodId ?? "missing"}|${segment.calculationPolicyId ?? "missing"}`}><td className="px-4 py-3 font-medium">{segment.employee}</td><td className="px-4 py-3">{formatBusinessDateShort(segment.dateFrom)} a {formatBusinessDateShort(segment.dateTo)}</td><td className="px-4 py-3">{segment.employmentType ? getEmploymentTypeLabel(segment.employmentType) : "Pendente"}</td><td className="px-4 py-3">{segment.policyName ?? "Pendente"}</td><td className="px-4 py-3">{formatMinutes(segment.expectedMinutes)}</td><td className="px-4 py-3">{formatMinutes(segment.workedMinutes)}</td><td className="px-4 py-3">{formatMinutes(segment.lateMinutes)}</td><td className="px-4 py-3">{formatMinutes(segment.pendingExcessMinutes)}</td><td className="px-4 py-3">{formatMinutes(segment.negativeMinutes)}</td></tr>)}</tbody></table></section> : null}
    {summaries.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Sem apuração para exibir nesta competência.</p> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[1500px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Funcionário</th><th className="px-3 py-3">Cobertura</th><th className="px-3 py-3">Vínculo</th><th className="px-3 py-3">Política</th><th className="px-3 py-3">Jornada</th><th className="px-3 py-3">Previsto</th><th className="px-3 py-3">Trabalhado</th><th className="px-3 py-3">Atraso</th><th className="px-3 py-3">Saída ant.</th><th className="px-3 py-3">Intervalo</th><th className="px-3 py-3">Excedente</th><th className="px-3 py-3">Saldo</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{summaries.map((summary) => { const balance = summary.positiveMinutes - summary.negativeMinutes; const coverage = summary.calculationMemory && typeof summary.calculationMemory === "object" && "coverage" in summary.calculationMemory ? "registrada" : "pendente"; return <tr className="border-b last:border-0" key={summary.id}><td className="px-3 py-3"><Link className="font-semibold underline" href={attendanceSummaryRoute(summary.id)}>{formatInTimeZone(summary.date, "America/Fortaleza", "dd/MM/yyyy")}</Link></td><td className="px-3 py-3"><p className="font-medium">{summary.employee.fullName}</p><p className="text-xs text-[var(--muted-foreground)]">{summary.employee.registration ?? "Sem matrícula"}</p></td><td className="px-3 py-3">{coverage}</td><td className="px-3 py-3">{summary.employmentPeriod?.employmentType ? getEmploymentTypeLabel(summary.employmentPeriod.employmentType) : "Pendente"}</td><td className="px-3 py-3">{summary.calculationPolicy?.name ?? summary.employmentPeriod?.calculationPolicy?.name ?? "Pendente"}</td><td className="px-3 py-3">{summary.scheduleAssignment?.scheduleTemplate.name ?? "Pendente"}</td><td className="px-3 py-3">{formatMinutes(summary.expectedMinutes)}</td><td className="px-3 py-3">{formatMinutes(summary.workedMinutes)}</td><td className="px-3 py-3">{formatMinutes(summary.lateMinutes)}</td><td className="px-3 py-3">{formatMinutes(summary.earlyDepartureMinutes)}</td><td className="px-3 py-3">{formatMinutes(summary.breakMinutes)}</td><td className="px-3 py-3">{formatMinutes(summary.pendingExcessMinutes)}</td><td className="px-3 py-3">{formatMinutes(balance)}</td><td className="px-3 py-3">{getDailySummaryStatusLabel(summary.status)}{summary.inconsistencies.length ? ` · ${summary.inconsistencies.length}` : ""}</td></tr>; })}</tbody></table></div>}
  </>;
}
