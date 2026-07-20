import Link from "next/link";
import { createEmployeeAction } from "@/app/(dashboard)/funcionarios/actions";
import { EmployeeForm } from "@/components/employees/employee-form";
import { PageHeader } from "@/components/layout/page-header";
import { employeesRoute } from "@/lib/routes";
import { requireRhAdmin } from "@/modules/auth/server/session";
import { getEmployeeFormOptions } from "@/modules/employees/application/queries";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const [options, params] = await Promise.all([getEmployeeFormOptions(), searchParams, requireRhAdmin()]);
  return <><div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Novo funcionário" description="Cadastre antes de existirem marcações no relógio. Homônimos são permitidos." /><Link className="rounded-md border px-4 py-2 text-sm font-semibold" href={employeesRoute}>Voltar</Link></div>{params.erro ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{params.erro}</p> : null}<section className="rounded-lg border bg-white p-5"><EmployeeForm action={createEmployeeAction} units={options.units.filter((item) => item.active)} departments={options.departments.filter((item) => item.active)} positions={options.positions.filter((item) => item.active)} tags={options.tags.filter((item) => item.active)} /></section></>;
}
