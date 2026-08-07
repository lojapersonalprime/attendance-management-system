import Link from "next/link";
import type { Route } from "next";
import { Building2, FileClock, Landmark, MapPin, ShieldCheck, SlidersHorizontal, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";

const sections = [
  { href: "/configuracoes/estrutura", icon: Building2, title: "Estrutura da empresa", description: "Organize unidades, setores, cargos e tags.", count: (value: Counts) => `${value.units} ${value.units === 1 ? "unidade" : "unidades"} · ${value.departments} ${value.departments === 1 ? "setor" : "setores"}` },
  { href: "/funcionarios", icon: UsersRound, title: "Pessoas e vínculos", description: "Consulte cadastros, dados profissionais e vínculos vigentes.", count: (value: Counts) => `${value.employees} ${value.employees === 1 ? "funcionário" : "funcionários"}` },
  { href: "/configuracoes/regras", icon: SlidersHorizontal, title: "Regras de cálculo", description: "Defina políticas, tolerâncias e tratamento de excedentes.", count: (value: Counts) => `${value.policies} ${value.policies === 1 ? "regra" : "regras"}${value.policies === 0 ? " · atenção necessária" : ""}` },
  { href: "/importacoes", icon: FileClock, title: "Importação e relógio", description: "Acompanhe arquivos do relógio e os equipamentos identificados.", count: (value: Counts) => `${value.devices} ${value.devices === 1 ? "relógio" : "relógios"} · ${value.imports} importações` },
  { href: "/configuracoes/locais", icon: MapPin, title: "Locais de registro", description: "Configure unidades autorizadas para o piloto de ponto pelo celular.", count: (value: Counts) => `${value.authorizedLocations} ${value.authorizedLocations === 1 ? "local configurado" : "locais configurados"}` },
  { href: "/apuracao", icon: Landmark, title: "Homologação", description: "Revise períodos, saldos e situações que precisam de validação.", count: (value: Counts) => value.openIssues > 0 ? `${value.openIssues} pendências abertas` : "Nenhuma pendência aberta" },
  { href: "/auditoria", icon: ShieldCheck, title: "Segurança e auditoria", description: "Consulte o histórico das alterações feitas pelo RH.", count: (value: Counts) => `${value.auditEvents} eventos auditados` },
] as const;

interface Counts { units: number; departments: number; employees: number; policies: number; devices: number; imports: number; authorizedLocations: number; openIssues: number; auditEvents: number; }

export default async function SettingsPage() {
  await requireActiveProfile();
  const prisma = getPrisma();
  const [units, departments, employees, policies, devices, imports, authorizedLocations, openIssues, auditEvents] = await Promise.all([
    prisma.unit.count(), prisma.department.count(), prisma.employee.count({ where: { status: { not: "MERGED" } } }), prisma.calculationPolicy.count(), prisma.device.count(), prisma.importFile.count(), prisma.authorizedLocation.count({ where: { active: true } }), prisma.inconsistency.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }), prisma.auditLog.count(),
  ]);
  const counts: Counts = { units, departments, employees, policies, devices, imports, authorizedLocations, openIssues, auditEvents };

  return <>
    <PageHeader title="Administração" description="Gerencie as configurações utilizadas nos cadastros, jornadas e cálculos do ponto." />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Seções da administração">
      {sections.map(({ href, icon: Icon, title, description, count }) => <article className="group flex min-h-56 flex-col rounded-xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md motion-reduce:transform-none" key={title}><span className="grid size-11 place-items-center rounded-xl bg-orange-50 text-[var(--primary)]"><Icon size={20} aria-hidden="true" /></span><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p><p className="mt-4 text-sm font-medium text-slate-700">{count(counts)}</p><Link className="mt-auto inline-flex w-fit items-center rounded-md border px-3 py-2 text-sm font-semibold transition group-hover:border-orange-300 group-hover:text-[var(--primary)]" href={href as Route}>Gerenciar</Link></article>)}
    </section>
  </>;
}
