import Link from "next/link";
import type { Route } from "next";
import { ClipboardCheck, FileCheck2, House, UserRound, Wrench } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireEmployeeMobileAccess } from "@/modules/auth/server/session";

export const dynamic = "force-dynamic";

const navigation = [
  { href: "/meu-ponto" as Route, label: "Início", icon: House },
  { href: "/meu-ponto/registros" as Route, label: "Registros", icon: ClipboardCheck },
  { href: "/meu-ponto/comprovantes" as Route, label: "Comprovantes", icon: FileCheck2 },
  { href: "/meu-ponto/correcoes" as Route, label: "Correções", icon: Wrench },
  { href: "/meu-ponto/perfil" as Route, label: "Perfil", icon: UserRound },
] as const;

export default async function EmployeePortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireEmployeeMobileAccess();
  return <div className="min-h-screen bg-[var(--background)] pb-24"><header className="border-b bg-white px-5 py-4"><div className="mx-auto flex max-w-xl items-center justify-between"><div><p className="font-bold tracking-tight">Personal Prime</p><p className="text-xs text-[var(--muted-foreground)]">Meu ponto</p></div><LogoutButton /></div></header><main className="mx-auto max-w-xl p-4 sm:p-6">{children}</main><nav aria-label="Navegação do meu ponto" className="fixed inset-x-0 bottom-0 border-t bg-white/95 px-2 py-2 backdrop-blur"><div className="mx-auto grid max-w-xl grid-cols-5 gap-1">{navigation.map(({ href, label, icon: Icon }) => <Link className="grid min-h-14 place-items-center rounded-xl text-center text-[10px] font-semibold text-slate-600 hover:bg-orange-50 hover:text-[var(--primary)]" href={href} key={href}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}</div></nav><span className="sr-only">Sessão de {profile.name}</span></div>;
}
