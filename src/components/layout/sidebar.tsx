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

function NavigationItem({ link, pathname }: { link: NavigationLink; pathname: string }) {
  const { href, label, icon: Icon } = link;
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  return <Link href={href} aria-current={active ? "page" : undefined} className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${active ? "bg-[rgb(244_122_32_/_12%)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"}`}>
    <span className={`absolute -left-3 h-5 w-0.5 rounded-full bg-[var(--primary)] transition-[opacity,transform] duration-200 ease-out ${active ? "scale-y-100 opacity-100" : "scale-y-75 opacity-0"}`} aria-hidden="true" />
    <Icon size={17} strokeWidth={active ? 2.25 : 1.8} aria-hidden="true" />{label}
  </Link>;
}

function NavigationGroups({ pathname }: { pathname: string }) {
  return <>
    <div className="space-y-1">
      <p className="eyebrow px-3 pb-1 text-[var(--muted-foreground)]">OPERAÇÃO</p>
      {mainLinks.map((link) => <NavigationItem key={link.href} link={link} pathname={pathname} />)}
    </div>
    <details className="group mt-5 border-t border-[var(--border)] pt-4" open={adminLinks.some((link) => pathname.startsWith(link.href))}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-xs font-semibold tracking-[0.08em] text-[var(--muted-foreground)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]">ADMINISTRAÇÃO<ChevronDown className="transition group-open:rotate-180" size={16} aria-hidden="true" /></summary>
      <div className="mt-1 space-y-1">{adminLinks.map((link) => <NavigationItem key={link.href} link={link} pathname={pathname} />)}</div>
    </details>
  </>;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  return <>
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] lg:flex">
      <div className="border-b border-[var(--border)] px-6 py-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] font-display text-2xl font-bold leading-none text-[var(--primary-foreground)]">PP</span><div><p className="font-display text-2xl font-semibold leading-none tracking-tight text-[var(--foreground)]">Personal Prime</p><p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">Gestão de ponto</p></div></div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegação principal"><NavigationGroups pathname={pathname} /></nav>
      {user ? <div className="border-t border-[var(--border)] p-4"><div className="mb-3 rounded-xl bg-[var(--surface)] px-3 py-2.5"><p className="truncate text-sm font-semibold text-[var(--foreground)]">{user.name}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{roleLabels[user.role]}</p></div><LogoutButton compact /></div> : null}
    </aside>
    <details className="group relative z-30 border-b border-[var(--border)] bg-[var(--sidebar)] lg:hidden">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between px-5"><span className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-[var(--primary)] font-display text-xl font-bold text-[var(--primary-foreground)]">PP</span><span><span className="font-display block text-xl font-semibold leading-none text-[var(--foreground)]">Personal Prime</span><span className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">Gestão de ponto</span></span></span><span className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]">Menu <ChevronDown className="transition group-open:rotate-180" size={16} aria-hidden="true" /></span></summary>
      <nav className="border-t border-[var(--border)] p-3" aria-label="Navegação principal móvel"><NavigationGroups pathname={pathname} /></nav>
      {user ? <div className="border-t border-[var(--border)] p-3"><p className="px-3 text-sm font-semibold text-[var(--foreground)]">{user.name}</p><div className="mt-2"><LogoutButton compact /></div></div> : null}
    </details>
  </>;
}
