"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleLogout() {
    setIsSubmitting(true);
    setError(undefined);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("Não foi possível encerrar a sessão. Tente novamente.");
        return;
      }
      window.location.assign("/login");
    } catch {
      setError("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={compact ? "" : "px-3 pb-4"}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
        className="logout-button flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogOut size={18} aria-hidden="true" />
        {isSubmitting ? "Saindo…" : "Sair"}
      </button>
      {error ? <p className="logout-error px-3 pt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
