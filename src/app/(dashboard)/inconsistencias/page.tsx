import { InconsistencySeverity, InconsistencyStatus, InconsistencyType, type Prisma } from "@/generated/prisma/client";
import type { Route } from "next";
import { BulkIssueList } from "@/components/attendance/bulk-issue-list";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { executeBulkIssueActionAction } from "@/app/(dashboard)/inconsistencias/actions";
import { attendanceSummaryRoute } from "@/lib/routes";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { getInconsistencyStatusLabel, getInconsistencyTypeLabel, getSeverityLabel } from "@/lib/presentation/labels";
import { actionErrorMessage } from "@/lib/forms/action-result";
import { formatBusinessDate } from "@/lib/dates/business";
import { getAttendanceIssuePresentation } from "@/modules/inconsistencies/domain/presentation";

const actionableStatuses = ["OPEN", "IN_REVIEW", "REOPENED"] as const;

function dateStart(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export default async function InconsistenciesPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string; type?: string; from?: string; until?: string; employee?: string; unit?: string; department?: string; schedule?: string; sucesso?: string; erro?: string }> }) {
  const [profile, query] = await Promise.all([requireActiveProfile(), searchParams]);
  const status = Object.values(InconsistencyStatus).find((value): value is InconsistencyStatus => value === query.status);
  const severity = Object.values(InconsistencySeverity).find((value): value is InconsistencySeverity => value === query.severity);
  const type = Object.values(InconsistencyType).find((value): value is InconsistencyType => value === query.type?.trim());
  const from = dateStart(query.from);
  const until = dateStart(query.until);
  const where: Prisma.InconsistencyWhereInput = {
    ...(status ? { status } : { status: { in: [...actionableStatuses] } }),
    ...(severity ? { severity } : {}),
    ...(type ? { type } : {}),
    ...(query.employee ? { employeeId: query.employee } : {}),
    ...(from || until ? { date: { ...(from ? { gte: from } : {}), ...(until ? { lte: until } : {}) } } : {}),
    ...(query.unit || query.department ? { employee: { is: { ...(query.unit ? { unitId: query.unit } : {}), ...(query.department ? { departmentId: query.department } : {}) } } } : {}),
    ...(query.schedule ? { dailySummary: { is: { scheduleAssignment: { is: { scheduleTemplateId: query.schedule } } } } } : {}),
  };
  const prisma = getPrisma();
  const [inconsistencies, totalFiltered, employees, units, departments, schedules] = await Promise.all([
    prisma.inconsistency.findMany({
      where,
      include: { employee: { select: { fullName: true } }, dailySummary: { select: { id: true } } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.inconsistency.count({ where }),
    prisma.employee.findMany({ where: { status: { not: "MERGED" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true }, take: 500 }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.scheduleTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const canManage = profile.role === "RH_ADMIN";
  const errorMessage = actionErrorMessage(query.erro);
  const openCount = inconsistencies.filter((item) => actionableStatuses.includes(item.status as (typeof actionableStatuses)[number])).length;
  return <>
    <PageHeader title="Pendências" description="Revise somente o que ainda precisa de uma decisão do RH." />
    {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
    {errorMessage ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm"><div><p className="text-2xl font-bold">{openCount}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">pendência(s) para revisar nos filtros atuais</p></div><StatusBadge tone={openCount > 0 ? "warning" : "success"}>{openCount > 0 ? "Ação necessária" : "Tudo em dia"}</StatusBadge></section>
    <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-sm font-medium">Período inicial<input className="input" defaultValue={query.from ?? ""} name="from" type="date" /></label><label className="grid gap-1 text-sm font-medium">Período final<input className="input" defaultValue={query.until ?? ""} name="until" type="date" /></label><label className="grid gap-1 text-sm font-medium">Funcionário<select className="input" defaultValue={query.employee ?? ""} name="employee"><option value="">Todos</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Unidade<select className="input" defaultValue={query.unit ?? ""} name="unit"><option value="">Todas</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Setor<select className="input" defaultValue={query.department ?? ""} name="department"><option value="">Todos</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Modelo de horário<select className="input" defaultValue={query.schedule ?? ""} name="schedule"><option value="">Todos</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Gravidade<select className="input" defaultValue={severity ?? ""} name="severity"><option value="">Todas</option>{Object.values(InconsistencySeverity).map((value) => <option key={value} value={value}>{getSeverityLabel(value)}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Status<select className="input" defaultValue={status ?? ""} name="status"><option value="">Pendências atuais</option>{Object.values(InconsistencyStatus).map((value) => <option key={value} value={value}>{getInconsistencyStatusLabel(value)}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Tipo<select className="input" defaultValue={type ?? ""} name="type"><option value="">Todos</option>{Object.values(InconsistencyType).map((value) => <option key={value} value={value}>{getInconsistencyTypeLabel(value)}</option>)}</select></label><button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white xl:self-end" type="submit">Atualizar lista</button></form>
    {inconsistencies.length === 0 ? <p className="rounded-xl border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhuma pendência para os filtros selecionados.</p> : <BulkIssueList canManage={canManage} executeAction={executeBulkIssueActionAction} totalFiltered={totalFiltered} items={inconsistencies.map((item) => { const presentation = getAttendanceIssuePresentation(item.type); return { id: item.id, type: item.type, title: presentation.title, employee: item.employee?.fullName ?? "Funcionário sem vínculo", employeeId: item.employeeId, date: item.date ? formatBusinessDate(item.date, "dd/MM/yyyy") : "Data não informada", businessDate: item.date?.toISOString().slice(0, 10) ?? null, description: presentation.description, impact: item.severity === "CRITICAL" ? "Requer correção antes do fechamento." : item.severity === "WARNING" ? "Requer revisão do RH." : "Aviso para acompanhamento.", status: getInconsistencyStatusLabel(item.status), severity: getSeverityLabel(item.severity), reviewHref: (item.dailySummary ? attendanceSummaryRoute(item.dailySummary.id) : "/inconsistencias") as Route }; })} />}
  </>;
}
