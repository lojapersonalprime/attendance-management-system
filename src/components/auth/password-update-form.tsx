"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ErrorState, SuccessState } from "@/components/ui/async-feedback";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { passwordUpdateSchema, type PasswordAuthClient, type PasswordUpdateValues, updateAuthorizedUserPassword } from "@/modules/auth/domain/password-credentials";
import { establishPasswordLinkSession, logPasswordLinkDiagnostic, logPasswordLinkFailure, passwordLinkUrlWithoutSecrets, readPasswordLinkRedirect } from "@/modules/auth/domain/password-link-session";

type AuthorizationState = "CHECKING" | "READY" | "INVALID";

export function PasswordUpdateForm() {
  const [authorization, setAuthorization] = useState<AuthorizationState>("CHECKING");
  const [showPassword, setShowPassword] = useState(false);
  const [updated, setUpdated] = useState(false);
  const form = useForm<PasswordUpdateValues>({ resolver: zodResolver(passwordUpdateSchema) });

  useEffect(() => {
    let active = true;
    const validateSession = async () => {
      try {
        const redirect = readPasswordLinkRedirect(window.location.search, window.location.hash);
        if (redirect.shouldCleanUrl) {
          window.history.replaceState(window.history.state, "", passwordLinkUrlWithoutSecrets(window.location.pathname, window.location.search, window.location.hash));
        }
        const supabase = createBrowserSupabaseClient();
        const result = await establishPasswordLinkSession(supabase, redirect);
        if (result.status === "ERROR") {
          logPasswordLinkFailure(result);
          if (active) setAuthorization("INVALID");
          return;
        }
        if (active) setAuthorization("READY");
      } catch {
        logPasswordLinkDiagnostic("INVITE_SESSION_FAILED", "none");
        if (active) setAuthorization("INVALID");
      }
    };
    void validateSession();
    return () => { active = false; };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      const supabase = createBrowserSupabaseClient();
      const result = await updateAuthorizedUserPassword(supabase as PasswordAuthClient, values.password);
      if (result.status === "PASSWORD_SESSION_REQUIRED") {
        logPasswordLinkDiagnostic("PASSWORD_SESSION_REQUIRED", "existing_session");
        setAuthorization("INVALID");
        return;
      }
      if (result.status === "FAILED") {
        form.setError("root", { message: "Não foi possível atualizar sua senha. Tente novamente ou solicite uma nova recuperação." });
        return;
      }
      setUpdated(true);
      window.setTimeout(() => window.location.assign("/dashboard"), 900);
    } catch {
      form.setError("root", { message: "Não foi possível atualizar sua senha. Tente novamente ou solicite uma nova recuperação." });
    }
  });

  if (authorization === "CHECKING") {
    return <p aria-busy="true" aria-live="polite" className="rounded-md bg-slate-50 p-3 text-sm text-slate-700" role="status">Verificando seu link de acesso…</p>;
  }

  if (authorization === "INVALID") {
    return <ErrorState title="Este link não é mais válido." description="Ele pode ter expirado, já ter sido utilizado ou não autorizar a alteração de senha."><Link className="inline-flex min-h-10 items-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100" href="/login?recuperar=1">Voltar ao login e solicitar recuperação</Link></ErrorState>;
  }

  if (updated) {
    return <SuccessState title="Senha atualizada com sucesso" description="Redirecionando para o seu acesso…" />;
  }

  return <form className="space-y-5" noValidate onSubmit={onSubmit}>
    <div>
      <label className="block text-sm font-semibold" htmlFor="new-password">Nova senha</label>
      <div className="relative mt-2">
        <input autoComplete="new-password" className="w-full rounded-md border px-3 py-2.5 pr-12" id="new-password" type={showPassword ? "text" : "password"} {...form.register("password")} />
        <button aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-600 hover:text-slate-950" onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}</button>
      </div>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">Use pelo menos 6 caracteres.</p>
      {form.formState.errors.password ? <p className="mt-1 text-sm text-red-700">{form.formState.errors.password.message}</p> : null}
    </div>
    <div>
      <label className="block text-sm font-semibold" htmlFor="confirm-password">Confirmar nova senha</label>
      <input autoComplete="new-password" className="mt-2 w-full rounded-md border px-3 py-2.5" id="confirm-password" type={showPassword ? "text" : "password"} {...form.register("confirmPassword")} />
      {form.formState.errors.confirmPassword ? <p className="mt-1 text-sm text-red-700">{form.formState.errors.confirmPassword.message}</p> : null}
    </div>
    {form.formState.errors.root ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{form.formState.errors.root.message}</p> : null}
    <Button className="w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Atualizando senha…" : "Definir senha e continuar"}</Button>
  </form>;
}
