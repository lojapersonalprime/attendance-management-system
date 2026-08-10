"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Receives Supabase's invite fragment, persists the session, then enters the fixed employee portal. */
export default function AuthCallbackPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabaseClient();
    const finishInvite = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError || !data.session) {
        setError(true);
        return;
      }
      window.location.replace("/meu-ponto");
    };
    void finishInvite();
    return () => {
      mounted = false;
    };
  }, []);

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><section className="w-full max-w-md rounded-xl border bg-white p-7 shadow-sm"><h1 className="text-xl font-bold">Preparando seu acesso</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Estamos concluindo a entrada no ponto pelo celular.</p>{error ? <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-800">Não foi possível concluir este convite. Solicite um novo convite ao RH.</p> : null}</section></main>;
}
