"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { ClipboardCheck, FileCheck2, House, UserRound, Wrench, type LucideIcon } from "lucide-react";

interface NavigationItem {
  href: Route;
  label: string;
  icon: LucideIcon;
}

const navigation: readonly NavigationItem[] = [
  { href: "/meu-ponto", label: "Início", icon: House },
  { href: "/meu-ponto/registros", label: "Registros", icon: ClipboardCheck },
  { href: "/meu-ponto/comprovantes", label: "Comprovantes", icon: FileCheck2 },
  { href: "/meu-ponto/correcoes", label: "Correções", icon: Wrench },
  { href: "/meu-ponto/perfil", label: "Perfil", icon: UserRound },
] as const;

function isCurrentPath(pathname: string, href: Route) {
  return href === "/meu-ponto" ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;
}

export function EmployeeNavigation({ placement }: { placement: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (placement === "desktop") {
    return <nav aria-label="Navegação do meu ponto" className="flex items-center gap-1">{navigation.map(({ href, label, icon: Icon }) => {
      const active = isCurrentPath(pathname, href);
      return <Link aria-current={active ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-[rgb(244_122_32_/_14%)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"}`} href={href} key={href}><Icon aria-hidden="true" size={16} />{label}</Link>;
    })}</nav>;
  }

  return <nav aria-label="Navegação do meu ponto" className="grid grid-cols-5 gap-1">{navigation.map(({ href, label, icon: Icon }) => {
    const active = isCurrentPath(pathname, href);
    return <Link aria-current={active ? "page" : undefined} className={`grid min-h-14 place-items-center rounded-xl px-1 py-1 text-center text-[0.65rem] font-semibold leading-tight transition ${active ? "bg-[rgb(244_122_32_/_14%)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"}`} href={href} key={href}><Icon aria-hidden="true" size={18} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span></Link>;
  })}</nav>;
}
