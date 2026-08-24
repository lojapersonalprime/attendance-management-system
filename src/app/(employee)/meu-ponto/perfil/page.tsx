import { getEmployeeMobileRecords } from "@/modules/mobile-attendance/application/mobile-attendance-service";

export default async function EmployeeProfilePage() {
  const { profile, access } = await getEmployeeMobileRecords();
  return <div><p className="eyebrow text-[var(--primary)]">MINHA CONTA</p><h1 className="font-display mt-2 text-5xl font-semibold leading-none text-[var(--foreground)]">Meu perfil</h1><section className="surface mt-7 rounded-[1.5rem] p-5 sm:p-6"><dl className="grid gap-5 text-sm"><div><dt className="eyebrow text-[var(--muted-foreground)]">NOME</dt><dd className="mt-2 font-semibold text-[var(--foreground)]">{profile.name}</dd></div><div className="border-t border-[var(--border)] pt-5"><dt className="eyebrow text-[var(--muted-foreground)]">UNIDADE AUTORIZADA</dt><dd className="mt-2 font-semibold text-[var(--foreground)]">{access.allowedUnit.name}</dd></div><div className="border-t border-[var(--border)] pt-5"><dt className="eyebrow text-[var(--muted-foreground)]">REGISTRO PELO CELULAR</dt><dd className="mt-2 font-semibold text-[var(--success)]">{access.active ? "Ativado" : "Desativado"}</dd></div></dl></section></div>;
}
