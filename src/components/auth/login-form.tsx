"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { passwordRecoverySchema, requestPasswordRecovery, type PasswordAuthClient, type PasswordRecoveryValues } from "@/modules/auth/domain/password-credentials";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ initialRecovery = false }: { initialRecovery?: boolean }) {
  const [recoveringPassword, setRecoveringPassword] = useState(initialRecovery);
  const [recoveryRequested, setRecoveryRequested] = useState(false);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const recoveryForm = useForm<PasswordRecoveryValues>({ resolver: zodResolver(passwordRecoverySchema) });
  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        form.setError("root", { message: "Não foi possível entrar. Verifique seu e-mail e senha." });
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      form.setError("root", { message: "A autenticação Supabase ainda não está configurada neste ambiente." });
    }
  });

  const requestRecovery = recoveryForm.handleSubmit(async (values) => {
    recoveryForm.clearErrors("root");
    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = new URL("/auth/definir-senha", window.location.origin).toString();
      const result = await requestPasswordRecovery(supabase as PasswordAuthClient, values.email, redirectTo);
      if (result.status === "FAILED") {
        recoveryForm.setError("root", { message: "Não foi possível solicitar a recuperação agora. Tente novamente em alguns instantes." });
        return;
      }
      setRecoveryRequested(true);
    } catch {
      recoveryForm.setError("root", { message: "Não foi possível solicitar a recuperação agora. Tente novamente em alguns instantes." });
    }
  });

  if (recoveringPassword) {
    return <form className="space-y-5" noValidate onSubmit={requestRecovery}>
      <div>
        <label className="block text-sm font-semibold" htmlFor="recovery-email">E-mail</label>
        <input autoComplete="email" className="mt-2 w-full rounded-md border px-3 py-2.5" id="recovery-email" type="email" {...recoveryForm.register("email")} />
        {recoveryForm.formState.errors.email ? <p className="mt-1 text-sm text-red-700">{recoveryForm.formState.errors.email.message}</p> : null}
      </div>
      {recoveryRequested ? <p aria-live="polite" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900" role="status">Se existir uma conta vinculada a este e-mail, enviaremos as instruções de recuperação.</p> : null}
      {recoveryForm.formState.errors.root ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{recoveryForm.formState.errors.root.message}</p> : null}
      <Button className="w-full" disabled={recoveryForm.formState.isSubmitting}>{recoveryForm.formState.isSubmitting ? "Enviando…" : "Enviar instruções"}</Button>
      <button className="w-full text-sm font-semibold text-[var(--primary)] underline" onClick={() => { setRecoveringPassword(false); setRecoveryRequested(false); }} type="button">Voltar para entrar</button>
    </form>;
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div>
        <label className="block text-sm font-semibold" htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" className="mt-2 w-full rounded-md border px-3 py-2.5" {...form.register("email")} />
        {form.formState.errors.email ? <p className="mt-1 text-sm text-red-700">{form.formState.errors.email.message}</p> : null}
      </div>
      <div>
        <label className="block text-sm font-semibold" htmlFor="password">Senha</label>
        <input id="password" type="password" autoComplete="current-password" className="mt-2 w-full rounded-md border px-3 py-2.5" {...form.register("password")} />
        {form.formState.errors.password ? <p className="mt-1 text-sm text-red-700">{form.formState.errors.password.message}</p> : null}
      </div>
      {form.formState.errors.root ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{form.formState.errors.root.message}</p> : null}
      <Button className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Entrando…" : "Entrar"}</Button>
      <button className="w-full text-sm font-semibold text-[var(--primary)] underline" onClick={() => setRecoveringPassword(true)} type="button">Esqueci minha senha</button>
    </form>
  );
}
