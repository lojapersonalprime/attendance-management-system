"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { establishPasswordLinkSession, logPasswordLinkDiagnostic, logPasswordLinkFailure, passwordLinkUrlWithoutSecrets, readPasswordLinkRedirect } from "@/modules/auth/domain/password-link-session";

/** Keeps previously issued invite links usable by forwarding their authenticated session to password setup. */
export default function AuthCallbackPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const finishInvite = async () => {
      try {
        const redirect = readPasswordLinkRedirect(window.location.search, window.location.hash);
        if (redirect.shouldCleanUrl) {
          window.history.replaceState(window.history.state, "", passwordLinkUrlWithoutSecrets(window.location.pathname, window.location.search, window.location.hash));
        }
        const supabase = createBrowserSupabaseClient();
        const result = await establishPasswordLinkSession(supabase, redirect);
        if (!mounted) return;
        if (result.status === "ERROR") {
          logPasswordLinkFailure(result);
          setError(true);
          return;
        }
        window.location.replace("/auth/definir-senha");
      } catch {
        logPasswordLinkDiagnostic("INVITE_SESSION_FAILED", "none");
        if (mounted) setError(true);
      }
    };
    void finishInvite();
    return () => {
      mounted = false;
    };
  }, []);

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-xl border bg-white p-7 shadow-sm"><h1 className="text-xl font-bold">Preparando seu acesso</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Estamos verificando seu convite para você definir uma senha.</p>{error ? <div className="mt-5"><p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">Este convite não é mais válido. Solicite uma recuperação de senha ou peça um novo convite ao RH.</p><Link className="mt-3 inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-sm font-semibold" href="/login?recuperar=1">Solicitar recuperação de senha</Link></div> : null}</section></main>;
}
