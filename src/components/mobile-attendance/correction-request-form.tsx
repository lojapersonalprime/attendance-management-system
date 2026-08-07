"use client";

import { useState } from "react";
import { ErrorState, SuccessState } from "@/components/ui/async-feedback";

export function CorrectionRequestForm({ punches }: { punches: Array<{ id: string; label: string }> }) {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/mobile-punch/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDate: formData.get("businessDate"),
          mobilePunchId: formData.get("mobilePunchId") || undefined,
          reason: formData.get("reason"),
          description: formData.get("description"),
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setError(body.error || "Não foi possível enviar sua solicitação.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Não foi possível enviar sua solicitação. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  if (success) return <SuccessState description="O RH receberá sua solicitação como uma pendência. Nenhuma marcação original foi alterada." title="Solicitação enviada" />;
  return <form action={submit} className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm"><div><h2 className="text-xl font-bold">Solicitar correção</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Explique o que aconteceu. O RH vai analisar antes de qualquer ajuste.</p></div><label className="grid gap-1 text-sm font-semibold">Data<input className="input" name="businessDate" required type="date" /></label><label className="grid gap-1 text-sm font-semibold">Registro relacionado <span className="font-normal text-[var(--muted-foreground)]">(opcional)</span><select className="input" name="mobilePunchId"><option value="">Não selecionei um registro</option>{punches.map((punch) => <option key={punch.id} value={punch.id}>{punch.label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Problema<select className="input" name="reason" required><option value="FORGOT_PUNCH">Esqueci de registrar</option><option value="TIME_REVIEW">Horário precisa de revisão</option><option value="EXTERNAL_WORK">Trabalhei fora da unidade</option><option value="LOCATION_PROBLEM">Problema com localização</option><option value="OTHER">Outro</option></select></label><label className="grid gap-1 text-sm font-semibold">Descrição<textarea className="input min-h-28" minLength={3} name="description" required /></label>{error ? <ErrorState description={error} title="Não foi possível enviar a solicitação." /> : null}<button className="rounded-2xl bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Enviando…" : "ENVIAR SOLICITAÇÃO"}</button></form>;
}
