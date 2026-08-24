"use client";

import { useState } from "react";
import { ErrorState, SuccessState } from "@/components/ui/async-feedback";
import { Button } from "@/components/ui/button";

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

  if (success) return <SuccessState description="O RH receberá sua solicitação como uma pendência. Nenhuma marcação original foi alterada." eyebrow="SOLICITAÇÃO ENVIADA" title="Tudo certo" />;
  return <form action={submit} className="surface grid gap-5 rounded-[1.5rem] p-5 sm:p-6"><div><p className="eyebrow text-[var(--primary)]">CORREÇÃO</p><h2 className="font-display mt-2 text-4xl font-semibold leading-none text-[var(--foreground)]">Solicitar correção</h2><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Explique o que aconteceu. O RH vai analisar antes de qualquer ajuste.</p></div><label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">Data<input className="input" name="businessDate" required type="date" /></label><label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">Registro relacionado <span className="font-normal text-[var(--muted-foreground)]">(opcional)</span><select className="input" name="mobilePunchId"><option value="">Não selecionei um registro</option>{punches.map((punch) => <option key={punch.id} value={punch.id}>{punch.label}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">Problema<select className="input" name="reason" required><option value="FORGOT_PUNCH">Esqueci de registrar</option><option value="TIME_REVIEW">Horário precisa de revisão</option><option value="EXTERNAL_WORK">Trabalhei fora da unidade</option><option value="LOCATION_PROBLEM">Problema com localização</option><option value="OTHER">Outro</option></select></label><label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">Descrição<textarea className="input min-h-28 resize-y" minLength={3} name="description" required /></label>{error ? <ErrorState description={error} eyebrow="CORREÇÃO" title="Não foi possível enviar a solicitação." /> : null}<Button disabled={pending} type="submit">{pending ? "Enviando…" : "Enviar solicitação"}</Button></form>;
}
