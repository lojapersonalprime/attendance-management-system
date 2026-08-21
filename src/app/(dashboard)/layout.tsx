import { Sidebar } from "@/components/layout/sidebar";
import { ActionFeedbackUrlCleaner } from "@/components/ui/action-feedback-url-cleaner";
import { getOptionalServerEnv } from "@/lib/env/server";
import { requireRhStaff } from "@/modules/auth/server/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!getOptionalServerEnv()) {
    return (
      <div className="prime-theme rh-theme admin-canvas min-h-screen lg:flex">
        <Sidebar />
        <main className="grid min-w-0 flex-1 place-items-center p-5 lg:p-8">
          <section className="surface w-full max-w-xl rounded-[1.5rem] p-7">
            <p className="eyebrow text-[var(--primary)]">AMBIENTE</p>
            <h1 className="font-display mt-2 text-4xl font-semibold leading-none">Configuração do Supabase pendente</h1>
            <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">A interface administrativa está disponível, mas autenticação, banco de dados, importação e relatórios permanecem bloqueados até configurar as variáveis de ambiente.</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Preencha <code className="rounded bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[var(--foreground)]">.env.local</code> conforme a documentação e não inclua credenciais no código.</p>
          </section>
        </main>
      </div>
    );
  }
  const profile = await requireRhStaff();
  return (
    <div className="prime-theme rh-theme admin-canvas min-h-screen lg:flex">
      <Sidebar user={{ name: profile.name, role: profile.role }} />
      <main className="min-w-0 flex-1">
        <ActionFeedbackUrlCleaner />
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[rgb(11_11_13_/_88%)] px-5 py-3.5 backdrop-blur lg:px-8">
          <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-[var(--primary)]">OPERAÇÕES</p>
              <p className="font-display mt-0.5 text-xl font-semibold leading-none text-[var(--foreground)]">Apuração de ponto</p>
            </div>
            <p className="hidden text-right text-xs text-[var(--muted-foreground)] sm:block">Dados atualizados pela importação do relógio</p>
          </div>
        </header>
        <div className="mx-auto max-w-[100rem] p-5 pb-10 lg:p-8 lg:pb-12">{children}</div>
      </main>
    </div>
  );
}
