"use client";

import { useRef, useState } from "react";
import { CheckCircle2, LocateFixed, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/ui/async-feedback";
import { geolocationFailureMessage } from "@/modules/mobile-attendance/domain/geolocation-feedback";

type Phase = "idle" | "locating" | "pin" | "registering" | "success" | "error";

interface Receipt {
  registeredAt: string;
  receiptCode: string;
  locationStatus: "INSIDE_RADIUS" | "OUTSIDE_RADIUS" | "LOW_ACCURACY";
  reviewRequired: boolean;
}

function geolocationMessage(error: GeolocationPositionError) {
  return geolocationFailureMessage(error.code);
}

function receiptLocationText(receipt: Receipt) {
  if (receipt.locationStatus === "INSIDE_RADIUS") return "Localização confirmada";
  if (receipt.locationStatus === "LOW_ACCURACY") return "Registrado para revisão de localização";
  return "Registrado para revisão de localização";
}

export function MobilePunchRegister({ privacyAccepted }: { privacyAccepted: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string>();
  const [location, setLocation] = useState<GeolocationPosition>();
  const [pin, setPin] = useState("");
  const [accepted, setAccepted] = useState(privacyAccepted);
  const [receipt, setReceipt] = useState<Receipt>();
  const [supportCode, setSupportCode] = useState<string>();
  const requestId = useRef<string | undefined>(undefined);

  function requestLocation() {
    setMessage(undefined);
    setSupportCode(undefined);
    requestId.current = crypto.randomUUID();
    if (!accepted) {
      setPhase("error");
      setMessage("Confirme o uso da localização no momento do registro para continuar.");
      return;
    }
    if (!navigator.geolocation) {
      setPhase("error");
      setMessage("Seu navegador não oferece localização para registrar o ponto.");
      return;
    }
    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setPhase("pin");
      },
      (error) => {
        setPhase("error");
        setMessage(geolocationMessage(error));
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function register() {
    if (!location || pin.length !== 6) {
      setMessage("Informe seu PIN de 6 dígitos para confirmar o registro.");
      return;
    }
    setPhase("registering");
    setMessage(undefined);
    try {
      const response = await fetch("/api/mobile-punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current ?? crypto.randomUUID(),
          pin,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracyMeters: location.coords.accuracy,
          clientObservedAt: new Date(location.timestamp).toISOString(),
          privacyAccepted: accepted,
        }),
      });
      const body = await response.json() as { error?: string; supportCode?: string; receipt?: Receipt };
      if (!response.ok || !body.receipt) {
        setPhase("error");
        setMessage(body.error || "Não foi possível registrar seu ponto. Seu ponto não foi salvo.");
        setSupportCode(body.supportCode);
        return;
      }
      setReceipt(body.receipt);
      setPhase("success");
      setPin("");
    } catch {
      setPhase("error");
      setMessage("Não foi possível registrar seu ponto. Seu ponto não foi salvo.");
    }
  }

  if (phase === "success" && receipt) {
    return <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm" role="status"><CheckCircle2 className="text-emerald-700" size={28} aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-emerald-950">Ponto registrado com sucesso</h2><p className="mt-2 text-sm text-emerald-900">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Fortaleza" }).format(new Date(receipt.registeredAt))}</p><p className="mt-1 text-sm text-emerald-900">{receiptLocationText(receipt)}</p><p className="mt-4 rounded-xl bg-white/80 p-3 font-mono text-sm text-emerald-950">Código: {receipt.receiptCode}</p><div className="mt-4 flex gap-3"><a className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950" href="/meu-ponto/comprovantes">Ver comprovantes</a><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => { setReceipt(undefined); setPhase("idle"); }} type="button">Fechar</button></div></section>;
  }

  return <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-[var(--primary)]"><MapPin size={21} aria-hidden="true" /></span><div><h2 className="font-bold">Registrar ponto</h2><p className="text-sm text-[var(--muted-foreground)]">Sua localização é usada somente agora, para validar a batida próxima à unidade.</p></div></div>
    {!privacyAccepted ? <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><input checked={accepted} className="mt-1" onChange={(event) => setAccepted(event.target.checked)} type="checkbox" /><span>Entendo que minha localização será consultada somente no momento deste registro para verificar a proximidade com a unidade.</span></label> : null}
    {phase === "pin" ? <div className="mt-5"><label className="grid gap-2 text-sm font-semibold">Confirme com seu PIN<input autoComplete="one-time-code" className="input text-center text-xl tracking-[0.45em]" inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="••••••" value={pin} /></label><p className="mt-2 text-xs text-[var(--muted-foreground)]">Localização obtida. O horário oficial será definido pelo sistema.</p><div className="mt-4 flex gap-3"><button className="rounded-xl border px-4 py-3 text-sm font-semibold" onClick={requestLocation} type="button">Tentar novamente</button><button className="flex-1 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={pin.length !== 6} onClick={register} type="button">CONFIRMAR PONTO</button></div></div> : <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={phase === "locating" || phase === "registering"} onClick={requestLocation} type="button">{phase === "locating" || phase === "registering" ? <><LoaderCircle className="animate-spin motion-reduce:animate-none" size={20} aria-hidden="true" />{phase === "locating" ? "Obtendo sua localização…" : "Registrando ponto…"}</> : <><LocateFixed size={20} aria-hidden="true" />REGISTRAR PONTO</>}</button>}
    {phase === "registering" ? <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-slate-600"><ShieldCheck size={16} aria-hidden="true" />Validando local e confirmando seu registro…</p> : null}
    {phase === "error" && message ? <div className="mt-5"><ErrorState description={message} title="Não foi possível registrar seu ponto.">{supportCode ? <p className="text-sm">Código de suporte: {supportCode}</p> : null}<button className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold" onClick={requestLocation} type="button">Tentar novamente</button></ErrorState></div> : null}
  </section>;
}
