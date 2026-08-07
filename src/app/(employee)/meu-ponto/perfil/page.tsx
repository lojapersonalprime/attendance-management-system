import { getEmployeeMobileRecords } from "@/modules/mobile-attendance/application/mobile-attendance-service";

export default async function EmployeeProfilePage() {
  const { profile, access } = await getEmployeeMobileRecords();
  return <div><h1 className="text-2xl font-bold">Meu perfil</h1><section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><dl className="grid gap-4 text-sm"><div><dt className="text-[var(--muted-foreground)]">Nome</dt><dd className="mt-1 font-semibold">{profile.name}</dd></div><div><dt className="text-[var(--muted-foreground)]">Unidade autorizada</dt><dd className="mt-1 font-semibold">{access.allowedUnit.name}</dd></div><div><dt className="text-[var(--muted-foreground)]">Registro pelo celular</dt><dd className="mt-1 font-semibold">{access.active ? "Ativado" : "Desativado"}</dd></div></dl></section></div>;
}
