import { PageHeader } from "@/components/layout/page-header";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

const employeeStatuses = ["PENDING", "ACTIVE", "INACTIVE", "TERMINATED"] as const;

function isEmployeeStatus(value: string): value is (typeof employeeStatuses)[number] {
  return employeeStatuses.includes(value as (typeof employeeStatuses)[number]);
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; provisional?: string }> }) {
  const params = await searchParams;
  const filters: Prisma.EmployeeWhereInput[] = [];
  const query = params.q?.trim();
  if (query) {
    filters.push({
      OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { registration: { contains: query, mode: "insensitive" } },
        { deviceLinks: { some: { externalEmployeeNumber: { contains: query } } } },
      ],
    });
  }
  if (params.status && isEmployeeStatus(params.status)) filters.push({ status: params.status });
  if (params.provisional === "true") filters.push({ provisional: true });
  if (params.provisional === "false") filters.push({ provisional: false });

  const employees = await getPrisma().employee.findMany({
    where: filters.length > 0 ? { AND: filters } : undefined,
    include: {
      deviceLinks: { select: { externalEmployeeNumber: true, device: { select: { name: true } } } },
      scheduleAssignments: { orderBy: { validFrom: "desc" }, take: 1, include: { scheduleTemplate: { select: { name: true } } } },
    },
    orderBy: { fullName: "asc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Funcionários" description="Cadastros identificados pelo EnNo, incluindo pendências de complementação." />
      <form className="mb-5 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_170px_170px_auto]" method="get">
        <input className="rounded-md border px-3 py-2 text-sm" name="q" defaultValue={params.q} placeholder="Buscar por nome, matrícula ou EnNo" />
        <select className="rounded-md border px-3 py-2 text-sm" name="status" defaultValue={params.status ?? ""}><option value="">Todos os status</option>{employeeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <select className="rounded-md border px-3 py-2 text-sm" name="provisional" defaultValue={params.provisional ?? ""}><option value="">Todos os cadastros</option><option value="true">Provisórios</option><option value="false">Completados</option></select>
        <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" type="submit">Filtrar</button>
      </form>
      {employees.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhum funcionário encontrado. A primeira importação criará cadastros provisórios por EnNo.</p> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Funcionário</th><th className="px-4 py-3">EnNo / dispositivo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Jornada atual</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} className="border-b last:border-0"><td className="px-4 py-3"><p className="font-medium">{employee.fullName}</p><p className="text-xs text-[var(--muted-foreground)]">{employee.provisional ? "Cadastro pendente" : employee.registration ?? "Sem matrícula"}</p></td><td className="px-4 py-3">{employee.deviceLinks.map((link) => <p key={`${link.device.name}-${link.externalEmployeeNumber}`}>{link.externalEmployeeNumber} · {link.device.name}</p>)}</td><td className="px-4 py-3">{employee.status}</td><td className="px-4 py-3">{employee.scheduleAssignments[0]?.scheduleTemplate.name ?? "Sem jornada cadastrada"}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}
