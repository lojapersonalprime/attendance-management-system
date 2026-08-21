import { PasswordUpdateForm } from "@/components/auth/password-update-form";

export default function DefinePasswordPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
    <section className="w-full max-w-md rounded-xl border bg-white p-7 shadow-sm">
      <p className="text-lg font-bold">Personal Prime</p>
      <h1 className="mt-7 text-2xl font-bold tracking-tight">Defina sua senha</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">Crie uma senha para concluir seu acesso ou recuperar a senha da sua conta.</p>
      <div className="mt-7"><PasswordUpdateForm /></div>
    </section>
  </main>;
}
