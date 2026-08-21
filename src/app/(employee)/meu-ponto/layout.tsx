import { LogoutButton } from "@/components/auth/logout-button";
import { EmployeeNavigation } from "@/components/mobile-attendance/employee-navigation";
import { requireEmployeeMobileAccess } from "@/modules/auth/server/session";

export const dynamic = "force-dynamic";

export default async function EmployeePortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireEmployeeMobileAccess();
  return <div className="prime-theme min-h-screen pb-24"><header className="border-b border-[var(--border)] bg-[rgb(11_11_13_/_88%)] px-4 py-3 backdrop-blur md:px-6"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div className="flex items-center gap-3"><span aria-hidden="true" className="brand-mark size-9 text-base">PP</span><div><p className="font-display text-lg font-semibold leading-none text-[var(--foreground)]">Personal Prime</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Meu ponto</p></div></div><div className="hidden lg:block"><EmployeeNavigation placement="desktop" /></div><LogoutButton compact /></div></header><main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main><div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[rgb(11_11_13_/_94%)] px-2 py-2 backdrop-blur lg:hidden"><div className="mx-auto max-w-xl"><EmployeeNavigation placement="mobile" /></div></div><span className="sr-only">Sessão de {profile.name}</span></div>;
}
