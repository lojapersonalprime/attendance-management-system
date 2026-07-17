import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, CalendarClock, FileUp, LayoutDashboard, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface NavigationLink {
  href: Route;
  label: string;
  icon: LucideIcon;
}

const links: readonly NavigationLink[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/importacoes", label: "Importações", icon: FileUp },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/jornadas", label: "Jornadas", icon: CalendarClock },
  { href: "/apuracao", label: "Apuração", icon: CalendarClock },
  { href: "/inconsistencias", label: "Inconsistências", icon: AlertTriangle },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  user?: {
    name: string;
    role: "RH_ADMIN" | "RH_ANALYST";
  };
}

const roleLabels = {
  RH_ADMIN: "Administrador RH",
  RH_ANALYST: "Analista RH",
} as const;

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r bg-white lg:flex">
      <div className="border-b px-6 py-6">
        <p className="text-lg font-bold tracking-tight">Personal Prime</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Gestão de ponto · RH</p>
      </div>
      <nav className="space-y-1 p-3" aria-label="Navegação principal">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-[var(--primary)]">
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      {user ? (
        <div className="mt-auto border-t pt-3">
          <div className="px-6 pb-3">
            <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{roleLabels[user.role]}</p>
          </div>
          <LogoutButton />
        </div>
      ) : null}
    </aside>
  );
}
