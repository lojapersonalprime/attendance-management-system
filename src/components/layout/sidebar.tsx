"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { AlertTriangle, CalendarClock, ChevronDown, FileUp, LayoutDashboard, MapPinned, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface NavigationLink { href: Route; label: string; icon: LucideIcon; }

const mainLinks: readonly NavigationLink[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/importacoes", label: "Importar ponto", icon: FileUp },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/jornadas", label: "Modelos de horário", icon: CalendarClock },
  { href: "/apuracao", label: "Registro do ponto", icon: CalendarClock },
  { href: "/visao-hoje" as Route, label: "Unidade hoje", icon: MapPinned },
  { href: "/inconsistencias", label: "Pendências", icon: AlertTriangle },
];

const adminLinks: readonly NavigationLink[] = [
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/configuracoes", label: "Administração", icon: Settings },
];

interface SidebarProps { user?: { name: string; role: "RH_ADMIN" | "RH_ANALYST" | "EMPLOYEE"; }; }
const roleLabels = { RH_ADMIN: "Administrador RH", RH_ANALYST: "Analista RH", EMPLOYEE: "Funcionário" } as const;

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const LinkItem = ({ href, label, icon: Icon }: NavigationLink) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
    return <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${active ? "bg-orange-50 text-[var(--primary)]" : "text-slate-700 hover:bg-orange-50 hover:text-[var(--primary)]"}`}><Icon size={18} aria-hidden="true" />{label}</Link>;
  };
  return <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r bg-white lg:flex"><div className="border-b px-6 py-6"><p className="text-lg font-bold tracking-tight">Personal Prime</p><p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Gestão de ponto · RH</p></div><nav className="space-y-1 p-3" aria-label="Navegação principal">{mainLinks.map((link) => <LinkItem key={link.href} {...link} />)}<details className="group mt-3 border-t pt-3" open={adminLinks.some((link) => pathname.startsWith(link.href))}><summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Administração<ChevronDown className="transition group-open:rotate-180" size={16} aria-hidden="true" /></summary><div className="mt-1 space-y-1">{adminLinks.map((link) => <LinkItem key={link.href} {...link} />)}</div></details></nav>{user ? <div className="mt-auto border-t pt-3"><div className="px-6 pb-3"><p className="truncate text-sm font-semibold text-slate-800">{user.name}</p><p className="text-xs text-[var(--muted-foreground)]">{roleLabels[user.role]}</p></div><LogoutButton /></div> : null}</aside>;
}
