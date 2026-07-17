import { Sidebar } from "@/components/layout/sidebar";
import { getOptionalServerEnv } from "@/lib/env/server";
import { requireActiveProfile } from "@/modules/auth/server/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!getOptionalServerEnv()) {
    return (
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <main className="grid min-w-0 flex-1 place-items-center p-5 lg:p-8">
          <section className="w-full max-w-xl rounded-lg border border-orange-200 bg-orange-50 p-6">
            <h1 className="text-xl font-bold text-orange-950">Configuração do Supabase pendente</h1>
            <p className="mt-2 text-sm text-orange-900">A interface administrativa está disponível, mas autenticação, banco de dados, importação e relatórios permanecem bloqueados até configurar as variáveis de ambiente.</p>
            <p className="mt-3 text-sm text-orange-900">Preencha <code className="rounded bg-orange-100 px-1 py-0.5">.env.local</code> conforme a documentação e não inclua credenciais no código.</p>
          </section>
        </main>
      </div>
    );
  }
  const profile = await requireActiveProfile();
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={{ name: profile.name, role: profile.role }} />
      <main className="min-w-0 flex-1">
        <header className="border-b bg-white px-5 py-4 lg:px-8">
          <p className="text-sm text-[var(--muted-foreground)]">Dados atualizados por importação manual</p>
        </header>
        <div className="mx-auto max-w-7xl p-5 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
