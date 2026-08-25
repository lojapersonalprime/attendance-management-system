import Link from "next/link";
import { EmployeeBulkList } from "@/components/employees/employee-bulk-list";
import { PageHeader } from "@/components/layout/page-header";
import { bulkEmployeeAction } from "@/app/(dashboard)/funcionarios/actions";
import { employeesRoute, employeesRouteWithQuery, newEmployeeRoute } from "@/lib/routes";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { employeeStatusLabels, employeeStatuses, employmentTypeLabels, employmentTypes } from "@/modules/employees/domain/validation";
import { getEmployeeFormOptions, listEmployees, type EmployeeListParams } from "@/modules/employees/application/queries";
import { actionErrorMessage } from "@/lib/forms/action-result";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<EmployeeListParams & { sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const [result, options, profile] = await Promise.all([listEmployees(params), getEmployeeFormOptions(), requireActiveProfile()]);
  const canManage = profile.role === "RH_ADMIN";
  const errorMessage = actionErrorMessage(params.erro);
  const activeOptions = {
    units: options.units.filter((item) => item.active),
    departments: options.departments.filter((item) => item.active),
    positions: options.positions.filter((item) => item.active),
    schedules: options.schedules.filter((item) => item.active),
  };
  const pageHref = (page: number) => {
    const query: Record<string, string> = { page: String(page) };
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value !== "" && key !== "page") query[key] = value;
    }
    return employeesRouteWithQuery(query);
  };
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader eyebrow="CADASTROS" title="Funcionários" description="Cadastros, modelos de horário e acompanhamento do ponto." />{canManage ? <Link className="inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]" href={newEmployeeRoute}>Novo funcionário</Link> : null}</div>
      {params.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.sucesso}</p> : null}
      {errorMessage ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}
      <form className="admin-filter-panel mb-5 rounded-[1.5rem] p-4 lg:p-5" method="get"><div className="mb-4 flex items-center justify-between gap-3"><p className="eyebrow text-[var(--primary)]">ENCONTRE RAPIDAMENTE</p><p className="text-xs text-[var(--muted-foreground)]">Filtros úteis para a operação</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="grid gap-1 text-sm font-medium xl:col-span-2">Buscar por nome<input className="input" name="q" defaultValue={params.q} placeholder="Nome do funcionário" /></label><label className="grid gap-1 text-sm font-medium">Status<select className="input" name="status" defaultValue={params.status ?? ""}><option value="">Todos</option>{employeeStatuses.map((status) => <option key={status} value={status}>{employeeStatusLabels[status]}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Unidade<select className="input" name="unitId" defaultValue={params.unitId ?? ""}><option value="">Todas</option>{activeOptions.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Modelo de horário<select className="input" name="scheduleTemplateId" defaultValue={params.scheduleTemplateId ?? ""}><option value="">Todos</option>{activeOptions.schedules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">Mais filtros</summary><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-1 text-sm font-medium">Tipo de vínculo<select className="input" name="employmentType" defaultValue={params.employmentType ?? ""}><option value="">Todos</option>{employmentTypes.map((type) => <option key={type} value={type}>{employmentTypeLabels[type]}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Setor<select className="input" name="departmentId" defaultValue={params.departmentId ?? ""}><option value="">Todos</option>{activeOptions.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Cargo<select className="input" name="positionId" defaultValue={params.positionId ?? ""}><option value="">Todos</option>{activeOptions.positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Cadastro<select className="input" name="provisional" defaultValue={params.provisional ?? ""}><option value="">Todos</option><option value="true">Provisório</option><option value="false">Completo</option></select></label></div></details><div className="mt-4 flex flex-wrap gap-2"><button className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)]" type="submit">Filtrar</button><Link className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]" href={employeesRoute}>Limpar</Link></div></form>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">{result.total} funcionário(s) encontrado(s) · página {result.page} de {result.totalPages}</p>
      {result.employees.length === 0 ? <p className="surface rounded-[1.5rem] p-6 text-sm text-[var(--muted-foreground)]">Nenhum funcionário encontrado com estes filtros.</p> : <EmployeeBulkList action={bulkEmployeeAction} employees={result.employees} units={activeOptions.units} departments={activeOptions.departments} positions={activeOptions.positions} schedules={activeOptions.schedules} />}
      <nav aria-label="Paginação de funcionários" className="mt-5 flex items-center justify-between"><span className="text-sm text-[var(--muted-foreground)]">{result.total} registros</span><div className="flex gap-2">{result.page > 1 ? <Link className="rounded-md border px-3 py-2 text-sm" href={pageHref(result.page - 1)}>Anterior</Link> : <span className="rounded-md border px-3 py-2 text-sm text-slate-400">Anterior</span>}{result.page < result.totalPages ? <Link className="rounded-md border px-3 py-2 text-sm" href={pageHref(result.page + 1)}>Próxima</Link> : <span className="rounded-md border px-3 py-2 text-sm text-slate-400">Próxima</span>}</div></nav>
    </>
  );
}
