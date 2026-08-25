import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeRemovalAction } from "@/components/employees/employee-removal-action";
import { EmployeeMobileAccessCard, EmployeeRecalculationForm, EmploymentPolicyForm, ScheduleAssignmentForm } from "@/components/employees/employee-operation-forms";
import { RetryScheduleCalculationButton } from "@/components/employees/retry-schedule-calculation-button";
import { AttendanceTimeline } from "@/components/attendance/attendance-timeline";
import { DailyIssueResolutionDialog } from "@/components/attendance/daily-issue-resolution-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { employeeIssueRoute, employeeRoute, employeesRoute } from "@/lib/routes";
import { assignScheduleAction, completeProvisionalEmployeeAction, createEmploymentPeriodAction, createOrLinkEmployeeMobileAccountAction, recalculateEmployeeAction, removeEmployeeAction, resolveEmployeeDailyIssueAction, setEmployeeMobileAccessActiveAction, setEmployeeMobileAccessPinAction, setEmployeeMobileAuthorizedLocationAction, updateEmployeeAction } from "@/app/(dashboard)/funcionarios/actions";
import { getEmployeeDetail, getEmployeeFormOptions } from "@/modules/employees/application/queries";
import { getEmployeeRemovalPreview } from "@/modules/employees/application/employee-service";
import { employeeStatusLabels, employmentTypeLabels } from "@/modules/employees/domain/validation";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { formatBusinessDate, formatMinutes } from "@/lib/dates/business";
import { getAuditActionLabel, getSeverityLabel } from "@/lib/presentation/labels";
import { actionErrorMessage } from "@/lib/forms/action-result";
import { getLastImportedAttendanceState } from "@/modules/attendance/domain/presentation";
import { getCalculatedTimeline } from "@/modules/attendance/domain/calculated-timeline";
import { getCalculationPresentationLabel, getCalculationPresentationState } from "@/modules/calculations/domain/calculation-presentation-state";
import { getAttendanceIssuePresentation } from "@/modules/inconsistencies/domain/presentation";
import { getSchedulePresentation } from "@/modules/schedules/domain/presentation";

const tabs = [
  ["resumo", "Resumo"],
  ["funcionario", "Dados do funcionário"],
  ["horario", "Modelo de horário"],
  ["registro", "Registro do ponto"],
  ["pendencias", "Pendências"],
  ["historico", "Histórico"],
] as const;

type Tab = (typeof tabs)[number][0];

const legacyTabs: Record<string, Tab> = {
  dados: "resumo",
  profissional: "funcionario",
  vinculo: "horario",
  jornada: "horario",
  inconsistencias: "pendencias",
  auditoria: "historico",
  apuracao: "registro",
  contrato: "horario",
};

type EmployeeDetail = NonNullable<Awaited<ReturnType<typeof getEmployeeDetail>>>;
type EmployeeRecord = EmployeeDetail["employee"];

function formatDate(value: Date | null | undefined, withTime = false) {
  return value ? withTime ? formatInTimeZone(value, "America/Fortaleza", "dd/MM/yyyy HH:mm") : formatBusinessDate(value, "dd/MM/yyyy") : "—";
}

export default async function EmployeeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; pendencia?: string; sucesso?: string; erro?: string }> }) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireActiveProfile()]);
  const [detail, options] = await Promise.all([getEmployeeDetail(id), getEmployeeFormOptions()]);
  if (!detail) notFound();

  const employee = detail.employee;
  const requestedTab = legacyTabs[query.aba ?? ""] ?? query.aba;
  const tab: Tab = tabs.find(([value]) => value === requestedTab)?.[0] ?? "resumo";
  const canManage = profile.role === "RH_ADMIN";
  const removalPreview = canManage && employee.status !== "MERGED" ? await getEmployeeRemovalPreview(employee.id) : null;
  const currentSchedule = employee.scheduleAssignments.find((assignment) => assignment.validFrom <= new Date() && (!assignment.validUntil || assignment.validUntil >= new Date()));
  const currentEmployment = employee.employmentPeriods.find((period) => period.validFrom <= new Date() && (!period.validUntil || period.validUntil >= new Date()));
  const currentSchedulePresentation = currentSchedule ? getSchedulePresentation(currentSchedule.scheduleTemplate) : null;
  const lastImportedState = getLastImportedAttendanceState(detail.punches);
  const lastImportAt = detail.punches[0]?.importFile.finishedAt ?? detail.punches[0]?.importFile.createdAt ?? null;
  const activeOptions = {
    units: options.units.filter((item) => item.active || item.id === employee.unitId),
    departments: options.departments.filter((item) => item.active || item.id === employee.departmentId),
    positions: options.positions.filter((item) => item.active || item.id === employee.positionId),
    schedules: options.schedules.filter((item) => item.active),
    calculationPolicies: options.calculationPolicies.filter((item) => item.active),
    authorizedLocations: options.authorizedLocations.filter((item) => item.active && item.unitId === employee.unitId),
  };
  const error = query.erro ? actionErrorMessage(query.erro) ?? "Não foi possível concluir esta ação. Tente novamente." : null;
  const pendingHref = employeeRoute(id, { aba: "pendencias" });

  return <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageHeader eyebrow="CADASTRO DO COLABORADOR" title={employee.fullName} description={`${employee.provisional ? "Cadastro provisório" : "Cadastro completo"} · ${employmentTypeLabels[employee.employmentType]} · ${employeeStatusLabels[employee.status]}`} />
      <div className="flex items-center gap-2">
        {removalPreview && removalPreview.mode !== "PRESERVE_ONLY" ? <EmployeeRemovalAction action={removeEmployeeAction} employeeId={employee.id} fullName={employee.fullName} /> : null}
        <Link className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]" href={employeesRoute}>Voltar à listagem</Link>
      </div>
    </div>
    {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
    {error ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}
    {employee.provisional ? <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Este cadastro veio da importação e ainda precisa ser completado. As marcações originais permanecem preservadas.</p> : null}
    {employee.status === "MERGED" ? <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">Cadastro mesclado em {employee.mergedInto ? <Link className="font-semibold underline" href={employeeRoute(employee.mergedInto.id)}>{employee.mergedInto.fullName}</Link> : "outro cadastro"}. O histórico está preservado e não aceita novas alterações.</p> : null}

    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-3" role="tablist" aria-label="Seções do funcionário">
      {tabs.map(([value, label]) => <Link key={value} role="tab" aria-selected={tab === value} className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === value ? "bg-[rgb(244_122_32_/_12%)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"}`} href={employeeRoute(id, { aba: value })}>{label}</Link>)}
    </nav>

    {tab === "resumo" ? <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={currentSchedule ? "Horas trabalhadas" : "Horas registradas"} value={employee.dailySummaries[0] ? formatMinutes(currentSchedule ? employee.dailySummaries[0].workedMinutes : employee.dailySummaries[0].recordedMinutes) : "—"} tone="green" />
        <Metric label="Saldo" value={currentSchedule && employee.dailySummaries[0] ? `${employee.dailySummaries[0].positiveMinutes - employee.dailySummaries[0].negativeMinutes >= 0 ? "+" : ""}${formatMinutes(employee.dailySummaries[0].positiveMinutes - employee.dailySummaries[0].negativeMinutes)}` : "Não apurado"} tone="blue" />
        <Metric label="Modelo de horário" value={currentSchedule?.scheduleTemplate.name ?? "Sem modelo de horário"} tone="blue" href={employeeRoute(id, { aba: "horario" })} />
        <Metric label="Pendências" value={String(employee.inconsistencies.length)} tone="yellow" href={pendingHref} />
        <Metric label="Última batida" value={lastImportedState.punch ? formatInTimeZone(lastImportedState.punch.occurredAt, "America/Fortaleza", "HH:mm") : "—"} tone="blue" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="surface rounded-[1.5rem] p-5 lg:p-6">
          <p className="eyebrow text-[var(--primary)]">INFORMAÇÕES BÁSICAS</p>
          <h2 className="font-display mb-5 mt-1 text-3xl font-semibold leading-none">{employee.fullName}</h2>
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <Data label="Tipo de vínculo" value={employmentTypeLabels[employee.employmentType]} />
            <Data label="Status" value={employeeStatusLabels[employee.status]} />
            <Data label="Unidade" value={employee.unit?.name ?? employee.legacyUnit ?? "—"} />
            <Data label="Setor" value={employee.department?.name ?? employee.legacyDepartment ?? "—"} />
            <Data label="Cargo" value={employee.position?.name ?? employee.legacyPosition ?? "—"} />
            <Data label="Admissão" value={formatDate(employee.admissionDate)} />
          </dl>
        </article>
        <aside className="space-y-5">
          <article className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">SITUAÇÃO MAIS RECENTE</p>
            <h2 className="mt-1 font-semibold">{lastImportedState.label}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{lastImportedState.description}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Data label="Última marcação" value={lastImportedState.punch ? formatDate(lastImportedState.punch.occurredAt, true) : "—"} />
              <Data label="Arquivo processado" value={lastImportAt ? formatDate(lastImportAt, true) : "—"} />
              <Data label="Modelo vigente" value={currentSchedule?.scheduleTemplate.name ?? "Sem modelo de horário"} />
              <Data label="Pendências abertas" value={String(employee.inconsistencies.length)} />
            </dl>
          </article>
          <nav aria-label="Ações rápidas" className="grid gap-2 rounded-xl border bg-white p-4 text-sm font-semibold">
            <Link className="rounded-lg px-3 py-2 text-[var(--primary)] hover:bg-orange-50" href={employeeRoute(id, { aba: "funcionario" })}>Ver dados do funcionário</Link>
            <Link className="rounded-lg px-3 py-2 text-[var(--primary)] hover:bg-orange-50" href={employeeRoute(id, { aba: "horario" })}>{currentSchedule ? "Alterar modelo de horário" : "Atribuir modelo de horário"}</Link>
            <Link className="rounded-lg px-3 py-2 text-[var(--primary)] hover:bg-orange-50" href={employeeRoute(id, { aba: "registro" })}>Ver registro do ponto</Link>
            {employee.inconsistencies.length > 0 ? <Link className="rounded-lg px-3 py-2 text-[var(--primary)] hover:bg-orange-50" href={pendingHref}>Ver {employee.inconsistencies.length} pendência(s)</Link> : null}
          </nav>
        </aside>
      </div>
    </section> : null}

    {tab === "funcionario" ? <section className="space-y-5">
      <article className="surface rounded-[1.5rem] p-5 lg:p-6">
        <p className="eyebrow text-[var(--primary)]">DADOS DO FUNCIONÁRIO</p>
        <h2 className="font-display mb-5 mt-1 text-3xl font-semibold leading-none">Informações do RH</h2>
        {canManage && employee.status !== "MERGED" ? <EmployeeForm action={employee.provisional ? completeProvisionalEmployeeAction : updateEmployeeAction} employeeId={employee.id} completion={employee.provisional} employee={{ fullName: employee.fullName, employmentType: employee.employmentType, status: employee.status, positionId: employee.positionId, departmentId: employee.departmentId, unitId: employee.unitId, admissionDate: employee.admissionDate?.toISOString().slice(0, 10), terminationDate: employee.terminationDate?.toISOString().slice(0, 10), notes: employee.notes }} units={activeOptions.units} departments={activeOptions.departments} positions={activeOptions.positions} /> : <dl className="grid gap-4 text-sm md:grid-cols-2"><Data label="Nome" value={employee.fullName} /><Data label="Tipo de vínculo" value={employmentTypeLabels[employee.employmentType]} /><Data label="Status" value={employeeStatusLabels[employee.status]} /><Data label="Unidade" value={employee.unit?.name ?? employee.legacyUnit ?? "—"} /><Data label="Setor" value={employee.department?.name ?? employee.legacyDepartment ?? "—"} /><Data label="Cargo" value={employee.position?.name ?? employee.legacyPosition ?? "—"} /><Data label="Data de admissão" value={formatDate(employee.admissionDate)} /><Data label="Data de desligamento" value={formatDate(employee.terminationDate)} /><Data label="Observação" value={employee.notes ?? "—"} /></dl>}
      </article>
      <details className="rounded-xl border bg-white p-5 shadow-sm" open={Boolean(employee.mobileAccess)}>
        <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">PONTO PELO CELULAR</p><h2 className="mt-1 text-lg font-semibold">Acesso mobile</h2><p className="mt-1 text-sm font-normal text-[var(--muted-foreground)]">Conta, PIN, unidade e local autorizados para registrar pelo celular.</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${employee.mobileAccess?.active ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{employee.mobileAccess?.active ? "Ativo" : employee.mobileAccess ? "Em configuração" : "Não utilizado"}</span></div></summary>
        <div className="mt-5">{employee.status === "MERGED" ? <p className="text-sm text-[var(--muted-foreground)]">Cadastros mesclados preservam o histórico e não recebem acesso mobile.</p> : <EmployeeMobileAccessCard accountAction={createOrLinkEmployeeMobileAccountAction} access={employee.mobileAccess} activationAction={setEmployeeMobileAccessActiveAction} canManage={canManage} employeeId={employee.id} employeeIsEligible={employee.status === "ACTIVE" && !employee.provisional && Boolean(employee.unit?.active)} locationAction={setEmployeeMobileAuthorizedLocationAction} locations={activeOptions.authorizedLocations} pinAction={setEmployeeMobileAccessPinAction} unitName={employee.unit?.name ?? undefined} />}</div>
      </details>
    </section> : null}

    {tab === "horario" ? <EmployeeScheduleSection employee={employee} activeSchedules={activeOptions.schedules} activePolicies={activeOptions.calculationPolicies} canManage={canManage} currentEmployment={currentEmployment} currentSchedule={currentSchedule} currentPresentation={currentSchedulePresentation} /> : null}
    {tab === "registro" ? <EmployeeCalculationSection employee={employee} canManage={canManage} /> : null}
    {tab === "pendencias" ? <section className="space-y-3">{employee.inconsistencies.map((issue) => {
      const presentation = getAttendanceIssuePresentation(issue.type);
      const focused = query.pendencia === issue.id;
      return <article className={`scroll-mt-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm ${focused ? "border-orange-400 ring-2 ring-orange-100" : ""}`} id={`pendencia-${issue.id}`} key={issue.id} tabIndex={-1}><div><p className="font-semibold">{presentation.title}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{presentation.description}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">{formatDate(issue.date)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${issue.severity === "CRITICAL" ? "bg-red-100 text-red-900" : issue.severity === "WARNING" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"}`}>{getSeverityLabel(issue.severity)} · Aberta</span></article>;
    })}{employee.inconsistencies.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-[var(--muted-foreground)]">Nenhuma pendência aberta.</p> : null}</section> : null}
    {tab === "historico" ? <section className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Motivo</th></tr></thead><tbody>{detail.auditLogs.map((event) => <tr className="border-b last:border-0" key={event.id}><td className="px-4 py-3">{formatDate(event.createdAt, true)}</td><td className="px-4 py-3">{event.user.name}</td><td className="px-4 py-3">{getAuditActionLabel(event.action)}</td><td className="px-4 py-3">{event.reason ?? "—"}</td></tr>)}</tbody></table>{detail.auditLogs.length === 0 ? <p className="p-5 text-sm text-[var(--muted-foreground)]">Nenhuma ação auditada para este cadastro.</p> : null}</section> : null}
  </>;
}

function EmployeeScheduleSection({ employee, activeSchedules, activePolicies, canManage, currentEmployment, currentSchedule, currentPresentation }: {
  employee: EmployeeRecord;
  activeSchedules: Array<{ id: string; name: string; active: boolean }>;
  activePolicies: Array<{ id: string; name: string; active: boolean }>;
  canManage: boolean;
  currentEmployment: EmployeeRecord["employmentPeriods"][number] | undefined;
  currentSchedule: EmployeeRecord["scheduleAssignments"][number] | undefined;
  currentPresentation: ReturnType<typeof getSchedulePresentation> | null;
}) {
  const canChange = canManage && employee.status !== "MERGED";
  return <section className="space-y-5">
    <article className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">MODELO DE HORÁRIO</p><h2 className="mt-1 text-lg font-semibold">{currentSchedule?.scheduleTemplate.name ?? "Sem modelo de horário"}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{currentSchedule ? "O modelo vigente organiza o horário previsto e preserva o histórico por vigência." : "A atribuição de um modelo permitirá apurar o horário previsto sem inventar jornadas."}</p><dl className="mt-5 grid gap-4 text-sm md:grid-cols-3"><Data label="Modelo atual" value={currentSchedule?.scheduleTemplate.name ?? "Sem modelo de horário"} /><Data label="Vigência" value={currentSchedule ? `${formatDate(currentSchedule.validFrom)} até ${formatDate(currentSchedule.validUntil)}` : "—"} /><Data label="Carga semanal" value={currentPresentation?.status === "fixed" ? formatMinutes(currentPresentation.weeklyMinutes) : currentPresentation?.detail ?? "—"} /></dl></article>
    {canChange ? <details className="rounded-xl border bg-white p-5 shadow-sm" open={!currentSchedule}><summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">{currentSchedule ? "Alterar modelo de horário" : "Atribuir modelo de horário"}</summary><div className="mt-5"><ScheduleAssignmentForm action={assignScheduleAction} currentScheduleName={currentSchedule?.scheduleTemplate.name} employeeId={employee.id} schedules={activeSchedules} /></div></details> : null}
    {canChange && currentSchedule ? <RetryScheduleCalculationButton employeeId={employee.id} validFrom={currentSchedule.validFrom} validUntil={currentSchedule.validUntil} /> : null}
    <details className="rounded-xl border bg-white p-5 shadow-sm"><summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">Histórico de modelos</summary>{employee.scheduleAssignments.length === 0 ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Nenhum modelo de horário atribuído.</p> : <ul className="mt-4 divide-y">{employee.scheduleAssignments.map((assignment) => { const presentation = getSchedulePresentation(assignment.scheduleTemplate); return <li className="py-3 text-sm" key={assignment.id}><p className="font-semibold">{assignment.scheduleTemplate.name}</p><p className="text-[var(--muted-foreground)]">{presentation.title} · {presentation.detail}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatDate(assignment.validFrom)} até {formatDate(assignment.validUntil)} · {assignment.reason ?? "Sem motivo histórico"}</p></li>; })}</ul>}</details>
    {!currentEmployment && canChange ? <details className="rounded-xl border border-amber-200 bg-amber-50 p-5"><summary className="cursor-pointer text-sm font-semibold text-amber-950">Configuração avançada da apuração</summary><div className="mt-4"><p className="text-sm text-amber-950">Falta a regra vigente que o motor usa internamente para calcular este período. Ela é definida pela administração em Regras de cálculo e só precisa ser informada neste caso.</p><div className="mt-4"><EmploymentPolicyForm action={createEmploymentPeriodAction} employeeId={employee.id} employmentType={employee.employmentType} policies={activePolicies} /></div></div></details> : null}
  </section>;
}

function EmployeeCalculationSection({ employee, canManage }: { employee: EmployeeRecord; canManage: boolean }) {
  const latest = employee.dailySummaries[0];
  const latestWithoutSchedule = latest?.scheduleAssignmentId === null;
  return <section className="space-y-5">
    <article className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">APURAÇÃO</p><h2 className="mt-1 text-lg font-semibold">Horas e marcações da competência</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Calculado pelas marcações originais e pelo modelo vigente em cada data.</p></div><p className="text-xs text-[var(--muted-foreground)]">Os dados não são atualizados em tempo real.</p></div>{latestWithoutSchedule ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Sem modelo de horário. Atribua um modelo para recalcular a apuração; as marcações registradas continuam preservadas.</p> : null}{latest ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Horas previstas" value={latestWithoutSchedule ? "Sem modelo" : formatMinutes(latest.expectedMinutes)} tone="blue" /><Metric label={latestWithoutSchedule ? "Horas registradas" : "Horas trabalhadas"} value={formatMinutes(latestWithoutSchedule ? latest.recordedMinutes : latest.validWorkedMinutes)} tone="green" /><Metric label="Saldo" value={latestWithoutSchedule ? "Não apurado" : formatMinutes(latest.positiveMinutes - latest.negativeMinutes)} tone="red" /><Metric label="Pendências" value={String(latest.inconsistencies.length)} tone="yellow" href={employeeRoute(employee.id, { aba: "pendencias" })} /></div> : null}</article>
    <article className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Registro do dia</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Abra uma data para ver entrada, intervalo, retorno e saída final.</p><div className="mt-4 divide-y">{employee.dailySummaries.map((summary) => {
      const timeline = getCalculatedTimeline(summary.calculationMemory, summary.recordedMinutes);
      const punches = timeline.punches;
      const state = getCalculationPresentationState({ calculationMemory: summary.calculationMemory, calculationEngineVersion: summary.calculationEngineVersion, scheduleAssignmentId: summary.scheduleAssignmentId, employmentPeriodId: summary.employmentPeriodId, calculationPolicyId: summary.calculationPolicyId, dailySummaryStatus: summary.status, calculationRunStatus: summary.calculationRun?.status, inconsistencyTypes: summary.inconsistencies.map((issue) => issue.type) });
      const withoutSchedule = summary.scheduleAssignmentId === null;
      const incomplete = state === "INCOMPLETE";
      const completed = !withoutSchedule && (state === "REGULAR" || state === "REVIEW_REQUIRED");
      const balance = summary.positiveMinutes - summary.negativeMinutes;
      const statusLabel = withoutSchedule ? "Sem modelo de horário" : state === "REVIEW_REQUIRED" && summary.pendingExcessMinutes > 0 ? "Revisar excedente" : getCalculationPresentationLabel(state);
      const toleranceAppliedMinutes = getToleranceAppliedMinutes(summary.calculationMemory);
      const toleranceNarrative = getToleranceNarrative(summary.calculationMemory);
      const primaryIssue = summary.inconsistencies[0];
      const statusClass = withoutSchedule || incomplete ? "text-amber-700" : state === "REVIEW_REQUIRED" ? "text-orange-700" : "text-emerald-700";
      return <details className="group py-3" key={summary.id}><summary className="cursor-pointer list-none"><div className="grid gap-2 sm:grid-cols-[1.2fr_repeat(5,0.8fr)] sm:items-center"><p className="font-semibold">{formatDate(summary.date)}</p><p className="text-sm"><span className="block text-xs text-[var(--muted-foreground)]">Registrado</span>{formatMinutes(summary.recordedMinutes)}</p><p className="text-sm"><span className="block text-xs text-[var(--muted-foreground)]">Considerado</span>{withoutSchedule ? "Não apurado" : completed ? formatMinutes(summary.consideredMinutes) : incomplete ? `Parcial: ${formatMinutes(summary.recordedMinutes)}` : getCalculationPresentationLabel(state)}</p><p className="text-sm"><span className="block text-xs text-[var(--muted-foreground)]">Previsto</span>{withoutSchedule ? "Sem modelo" : formatMinutes(summary.expectedMinutes)}</p><p className="text-sm"><span className="block text-xs text-[var(--muted-foreground)]">Saldo</span>{completed ? balance < 0 ? `-${formatMinutes(Math.abs(balance))}` : summary.pendingExcessMinutes > 0 ? `+${formatMinutes(summary.pendingExcessMinutes)} pendente` : `+${formatMinutes(balance)}` : "Indisponível"}</p>{primaryIssue && !withoutSchedule ? <Link className={`text-sm font-semibold underline decoration-dotted underline-offset-4 ${statusClass}`} href={employeeIssueRoute(employee.id, primaryIssue.id)}>{statusLabel}</Link> : <p className={`text-sm font-semibold ${statusClass}`}>{statusLabel}</p>}</div></summary><div className="mt-4 grid gap-5 rounded-xl bg-slate-50 p-4 lg:grid-cols-[0.75fr_1.25fr]"><div><p className="text-sm font-semibold">Marcações do dia</p><div className="mt-4"><AttendanceTimeline punches={punches} technical={false} waitingForRecalculation={timeline.state === "WAITING_FOR_RECALCULATION"} /></div>{punches.some((punch) => punch.origin === "MANUAL_ADJUSTMENT") ? <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-950">Tempo calculado com ajuste do RH.</p> : null}</div><div className="grid content-start gap-3 text-sm sm:grid-cols-2"><Data label="Tempo registrado" value={formatMinutes(summary.recordedMinutes)} /><Data label="Considerado para o saldo" value={withoutSchedule ? "Não apurado" : formatMinutes(summary.consideredMinutes)} /><Data label="Tolerância aplicada" value={withoutSchedule ? "Não apurada" : formatMinutes(toleranceAppliedMinutes)} /><Data label="Resultado da tolerância" value={withoutSchedule ? "Não se aplica" : toleranceNarrative} /><Data label="Horas previstas" value={withoutSchedule ? "Sem modelo de horário" : formatMinutes(summary.expectedMinutes)} /><Data label="Intervalo" value={summary.breakMinutes > 0 ? formatMinutes(summary.breakMinutes) : "Não se aplica"} /><Data label="Excedente pendente" value={withoutSchedule ? "Não apurado" : formatMinutes(summary.pendingExcessMinutes)} /><Data label="Atraso" value={withoutSchedule ? "Não apurado" : formatMinutes(summary.lateMinutes)} /><Data label="Saída antecipada" value={withoutSchedule ? "Não apurada" : formatMinutes(summary.earlyDepartureMinutes)} />{canManage && primaryIssue && !withoutSchedule ? <div className="sm:col-span-2"><DailyIssueResolutionDialog action={resolveEmployeeDailyIssueAction} summaryId={summary.id} employeeId={employee.id} inconsistencyId={primaryIssue.id} issueTypes={summary.inconsistencies.map((issue) => issue.type)} rawPunches={punches.filter((punch) => punch.origin === "RAW_PUNCH").map((punch) => ({ id: punch.id, label: `${formatInTimeZone(punch.occurredAt, "America/Fortaleza", "HH:mm:ss")} · ${punch.punchCode}` }))} /></div> : null}{withoutSchedule ? <p className="rounded-lg bg-amber-50 p-3 text-amber-950 sm:col-span-2">Sem modelo de horário. As marcações permanecem disponíveis; atribua um modelo para recalcular a comparação.</p> : incomplete ? <p className="rounded-lg bg-amber-50 p-3 text-amber-950 sm:col-span-2">Dia incompleto. O período já comprovado foi mantido; adicione a marcação ausente ou registre uma justificativa antes de definir o saldo.</p> : null}</div></div></details>;
    })}</div></article>
    {canManage ? <EmployeeRecalculationForm action={recalculateEmployeeAction} employeeId={employee.id} /> : null}
  </section>;
}

function Data({ label, value }: { label: string; value: string }) {
  return <div><dt className="eyebrow text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 text-[var(--foreground)]">{value}</dd></div>;
}

function Metric({ label, value, tone, href }: { label: string; value: string; tone: "blue" | "green" | "red" | "yellow"; href?: Route }) {
  const tones = { blue: "text-sky-950", green: "text-emerald-950", red: "text-red-950", yellow: "text-amber-950" };
  const content = <><p className="eyebrow text-[var(--muted-foreground)]">{label}</p><p className={`numeric font-display mt-3 truncate text-3xl font-semibold leading-none ${tones[tone]}`}>{value}</p></>;
  return href ? <Link className="surface block rounded-[1.25rem] p-4 transition hover:-translate-y-0.5 hover:ring-1 hover:ring-orange-300" href={href}>{content}</Link> : <div className="surface rounded-[1.25rem] p-4">{content}</div>;
}

function getToleranceAppliedMinutes(memory: unknown) {
  if (!memory || typeof memory !== "object" || !("minutes" in memory) || !memory.minutes || typeof memory.minutes !== "object") return 0;
  const value = (memory.minutes as Record<string, unknown>).toleranceAppliedMinutes;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getToleranceNarrative(memory: unknown) {
  if (!memory || typeof memory !== "object" || !("toleranceApplication" in memory) || !memory.toleranceApplication || typeof memory.toleranceApplication !== "object") return "Não se aplica";
  const application = memory.toleranceApplication as Record<string, unknown>;
  const expected = typeof application.expectedEntry === "string" ? application.expectedEntry : null;
  const recorded = typeof application.recordedEntry === "string" ? application.recordedEntry.slice(0, 5) : null;
  const minutes = typeof application.entryToleranceMinutes === "number" ? application.entryToleranceMinutes : null;
  if (application.result === "ENTRY_WITHIN_TOLERANCE" && expected && recorded && minutes !== null) return `Entrada ${recorded}; dentro da tolerância de ${minutes}min para ${expected}.`;
  if (application.result === "ENTRY_AFTER_TOLERANCE") return "Entrada após a tolerância; atraso aplicado pela regra.";
  if (application.result === "ENTRY_ON_TIME") return "Entrada no horário previsto.";
  return "Não se aplica";
}
