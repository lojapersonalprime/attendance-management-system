"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
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
    </form>
  );
}
