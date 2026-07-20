import Link from "next/link";
import { EmployeeBulkList } from "@/components/employees/employee-bulk-list";
import { PageHeader } from "@/components/layout/page-header";
import { bulkEmployeeAction } from "@/app/(dashboard)/funcionarios/actions";
import { employeesRoute, employeesRouteWithQuery, newEmployeeRoute } from "@/lib/routes";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { employeeStatusLabels, employeeStatuses, employmentTypeLabels, employmentTypes } from "@/modules/employees/domain/validation";
import { getEmployeeFormOptions, listEmployees, type EmployeeListParams } from "@/modules/employees/application/queries";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<EmployeeListParams & { sucesso?: string; erro?: string }> }) {
  const params = await searchParams;
  const [result, options, profile] = await Promise.all([listEmployees(params), getEmployeeFormOptions(), requireActiveProfile()]);
  const canManage = profile.role === "RH_ADMIN";
  const activeOptions = {
    units: options.units.filter((item) => item.active),
    departments: options.departments.filter((item) => item.active),
    positions: options.positions.filter((item) => item.active),
    tags: options.tags.filter((item) => item.active),
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
      <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Funcionários" description="Cadastros, vínculos com relógio, jornadas e histórico de apuração." />{canManage ? <Link className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" href={newEmployeeRoute}>Novo funcionário</Link> : null}</div>
      {params.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{params.sucesso}</p> : null}
      {params.erro ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{params.erro}</p> : null}
      <form className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 xl:grid-cols-4" method="get">
        <label className="grid gap-1 text-sm font-medium">Nome<input className="input" name="q" defaultValue={params.q} placeholder="Nome, matrícula ou EnNo" /></label>
        <label className="grid gap-1 text-sm font-medium">Matrícula<input className="input" name="registration" defaultValue={params.registration} /></label>
        <label className="grid gap-1 text-sm font-medium">EnNo<input className="input" name="enNo" defaultValue={params.enNo} /></label>
        <label className="grid gap-1 text-sm font-medium">Tipo de vínculo<select className="input" name="employmentType" defaultValue={params.employmentType ?? ""}><option value="">Todos</option>{employmentTypes.map((type) => <option key={type} value={type}>{employmentTypeLabels[type]}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Status<select className="input" name="status" defaultValue={params.status ?? ""}><option value="">Todos</option>{employeeStatuses.map((status) => <option key={status} value={status}>{employeeStatusLabels[status]}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Cadastro<select className="input" name="provisional" defaultValue={params.provisional ?? ""}><option value="">Todos</option><option value="true">Provisório</option><option value="false">Completo</option></select></label>
        <label className="grid gap-1 text-sm font-medium">Unidade<select className="input" name="unitId" defaultValue={params.unitId ?? ""}><option value="">Todas</option>{activeOptions.units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Setor<select className="input" name="departmentId" defaultValue={params.departmentId ?? ""}><option value="">Todos</option>{activeOptions.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Cargo<select className="input" name="positionId" defaultValue={params.positionId ?? ""}><option value="">Todos</option>{activeOptions.positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Jornada<select className="input" name="scheduleTemplateId" defaultValue={params.scheduleTemplateId ?? ""}><option value="">Todas</option>{activeOptions.schedules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">Tag<select className="input" name="tagId" defaultValue={params.tagId ?? ""}><option value="">Todas</option>{activeOptions.tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="flex items-end gap-2"><button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="submit">Filtrar</button><Link className="rounded-md border px-4 py-2 text-sm font-semibold" href={employeesRoute}>Limpar</Link></div>
      </form>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">{result.total} funcionário(s) encontrado(s) · página {result.page} de {result.totalPages}</p>
      {result.employees.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhum funcionário encontrado com estes filtros.</p> : <EmployeeBulkList action={bulkEmployeeAction} employees={result.employees} units={activeOptions.units} departments={activeOptions.departments} positions={activeOptions.positions} tags={activeOptions.tags} schedules={activeOptions.schedules} />}
      <nav aria-label="Paginação de funcionários" className="mt-5 flex items-center justify-between"><span className="text-sm text-[var(--muted-foreground)]">{result.total} registros</span><div className="flex gap-2">{result.page > 1 ? <Link className="rounded-md border px-3 py-2 text-sm" href={pageHref(result.page - 1)}>Anterior</Link> : <span className="rounded-md border px-3 py-2 text-sm text-slate-400">Anterior</span>}{result.page < result.totalPages ? <Link className="rounded-md border px-3 py-2 text-sm" href={pageHref(result.page + 1)}>Próxima</Link> : <span className="rounded-md border px-3 py-2 text-sm text-slate-400">Próxima</span>}</div></nav>
    </>
  );
}
