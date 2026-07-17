import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
      <section className="w-full max-w-md rounded-xl border bg-white p-7 shadow-sm">
        <p className="text-lg font-bold">Personal Prime</p>
        <h1 className="mt-7 text-2xl font-bold tracking-tight">Acesso do RH</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Entre com seu usuário individual para acessar a gestão de ponto.</p>
        <div className="mt-7"><LoginForm /></div>
      </section>
    </main>
  );
}
