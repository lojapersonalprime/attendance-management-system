"use client";

import { useRef, useState } from "react";
import { CheckCircle2, LocateFixed, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/ui/async-feedback";
import { geolocationFailureFeedback } from "@/modules/mobile-attendance/domain/geolocation-feedback";
import { formatOfficialMobilePunchTime, mobilePunchApiFeedback, networkMobilePunchFeedback, type MobilePunchFeedback } from "@/modules/mobile-attendance/domain/mobile-punch-feedback";

type MobilePunchUiState =
  | "IDLE"
  | "GETTING_LOCATION"
  | "READY_TO_CONFIRM"
  | "SUBMITTING"
  | "SUCCESS"
  | "LOCATION_PERMISSION_DENIED"
  | "LOCATION_UNAVAILABLE"
  | "LOCATION_TIMEOUT"
  | "LOW_ACCURACY"
  | "OUTSIDE_RADIUS"
  | "DUPLICATE_BLOCKED"
  | "CALCULATION_PERIOD_CLOSED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "PRIVACY_CONSENT_REQUIRED";

type PunchErrorFeedback = MobilePunchFeedback | ReturnType<typeof geolocationFailureFeedback> | {
  state: "PRIVACY_CONSENT_REQUIRED";
  title: string;
  description: string;
};

interface Receipt {
  registeredAt: string;
  receiptCode: string;
  locationStatus: "INSIDE_RADIUS" | "OUTSIDE_RADIUS" | "LOW_ACCURACY";
  reviewRequired: boolean;
}

interface MobilePunchResponse {
  code?: string;
  error?: string;
  supportCode?: string;
  locationStatus?: "OUTSIDE_RADIUS" | "LOW_ACCURACY";
  receipt?: Receipt;
}

function receiptLocationText(receipt: Receipt) {
  if (receipt.locationStatus === "INSIDE_RADIUS") return "Localização confirmada";
  return "Registro enviado para revisão de localização";
}

export function MobilePunchRegister({
  privacyAccepted,
  employeeName,
  unitName,
}: {
  privacyAccepted: boolean;
  employeeName: string;
  unitName: string;
}) {
  const [state, setState] = useState<MobilePunchUiState>("IDLE");
  const [feedback, setFeedback] = useState<PunchErrorFeedback>();
  const [location, setLocation] = useState<GeolocationPosition>();
  const [pin, setPin] = useState("");
  const [accepted, setAccepted] = useState(privacyAccepted);
  const [receipt, setReceipt] = useState<Receipt>();
  const [supportCode, setSupportCode] = useState<string>();
  const requestId = useRef<string | undefined>(undefined);
  const [retryPendingRequest, setRetryPendingRequest] = useState(false);

  function showFeedback(next: PunchErrorFeedback) {
    setFeedback(next);
    setState(next.state);
  }

  function requestLocation() {
    setFeedback(undefined);
    setSupportCode(undefined);
    setRetryPendingRequest(false);
    setLocation(undefined);

    if (!accepted) {
      showFeedback({
        state: "PRIVACY_CONSENT_REQUIRED",
        title: "Confirme o uso da localização.",
        description: "A localização é consultada somente no momento do registro para verificar a proximidade com a unidade.",
      });
      return;
    }
    if (!navigator.geolocation) {
      showFeedback({
        state: "LOCATION_UNAVAILABLE",
        title: "Não conseguimos determinar sua localização.",
        description: "Este navegador não oferece localização para registrar o ponto. Tente em um dispositivo compatível.",
      });
      return;
    }

    // A fresh GPS lookup is explicitly a new attempt. A network retry never
    // calls this function and therefore keeps its original UUID and position.
    requestId.current = crypto.randomUUID();
    setState("GETTING_LOCATION");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setState("READY_TO_CONFIRM");
      },
      (error) => showFeedback(geolocationFailureFeedback(error.code)),
      // Indoor use benefits from high accuracy. The timeout is long enough to
      // obtain a fresh fix without leaving the employee waiting indefinitely.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function register() {
    if (!location || pin.length !== 6) {
      showFeedback({
        state: "SERVER_ERROR",
        title: "Confirme seu PIN.",
        description: "Informe seu PIN de 6 dígitos para confirmar o registro.",
      });
      return;
    }
    const currentRequestId = requestId.current ?? crypto.randomUUID();
    requestId.current = currentRequestId;
    setState("SUBMITTING");
    setFeedback(undefined);
    setSupportCode(undefined);
    try {
      const response = await fetch("/api/mobile-punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: currentRequestId,
          pin,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracyMeters: location.coords.accuracy,
          clientObservedAt: new Date(location.timestamp).toISOString(),
          privacyAccepted: accepted,
        }),
      });
      const body = await response.json() as MobilePunchResponse;
      if (!response.ok || !body.receipt) {
        const next = mobilePunchApiFeedback(body);
        setSupportCode(body.supportCode);
        setRetryPendingRequest(Boolean(next.retrySubmittedRequest));
        showFeedback(next);
        return;
      }
      setReceipt(body.receipt);
      setState("SUCCESS");
      setPin("");
      setRetryPendingRequest(false);
    } catch {
      const next = networkMobilePunchFeedback();
      setRetryPendingRequest(true);
      showFeedback(next);
    }
  }

  function closeResult() {
    setReceipt(undefined);
    setFeedback(undefined);
    setLocation(undefined);
    setPin("");
    setState("IDLE");
  }

  if (state === "SUCCESS" && receipt) {
    return <section aria-live="polite" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm" role="status"><CheckCircle2 className="text-emerald-700" size={28} aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-emerald-950">Ponto registrado! ✓</h2><p className="mt-2 text-sm text-emerald-900">{employeeName.trim().split(/\s+/)[0]}, seu ponto foi registrado às {formatOfficialMobilePunchTime(receipt.registeredAt)}.</p><p className="mt-1 text-sm text-emerald-900">{unitName}</p><p className="mt-3 text-sm text-emerald-900">{receiptLocationText(receipt)}</p><p className="mt-4 rounded-xl bg-white/80 p-3 font-mono text-sm text-emerald-950">Código: {receipt.receiptCode}</p><div className="mt-4 flex flex-wrap gap-3"><a className="min-h-11 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-950" href="/meu-ponto/comprovantes">Ver comprovantes</a><button className="min-h-11 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white" onClick={closeResult} type="button">Fechar</button></div></section>;
  }

  const browserLocationError = state === "LOCATION_PERMISSION_DENIED" || state === "LOCATION_UNAVAILABLE" || state === "LOCATION_TIMEOUT";
  const refreshLocation = feedback && (("refreshLocation" in feedback && feedback.refreshLocation) || browserLocationError);

  return <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-[var(--primary)]"><MapPin size={21} aria-hidden="true" /></span><div><h2 className="font-bold">Registrar meu ponto</h2><p className="text-sm text-[var(--muted-foreground)]">A localização é consultada somente quando você solicitar o registro.</p></div></div>
    {!privacyAccepted ? <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><input checked={accepted} className="mt-1 size-4" onChange={(event) => setAccepted(event.target.checked)} type="checkbox" /><span>Entendo que minha localização será consultada somente no momento deste registro para verificar a proximidade com a unidade.</span></label> : null}

    {state === "IDLE" ? <button className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" onClick={requestLocation} type="button"><LocateFixed size={20} aria-hidden="true" />Registrar meu ponto</button> : null}

    {state === "GETTING_LOCATION" ? <div aria-busy="true" aria-live="polite" className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-2 font-semibold"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={19} aria-hidden="true" />Verificando sua localização…</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Aguarde um instante.</p></div> : null}

    {state === "READY_TO_CONFIRM" && location ? <div className="mt-5"><div aria-live="polite" className="rounded-2xl bg-emerald-50 p-4 text-emerald-950"><p className="font-semibold">Localização encontrada ✓</p><p className="mt-1 text-sm">Precisão aproximada: {Math.round(location.coords.accuracy)} m</p></div><label className="mt-4 grid gap-2 text-sm font-semibold">Confirme com seu PIN<input aria-label="PIN de 6 dígitos" autoComplete="one-time-code" className="input min-h-12 text-center text-xl tracking-[0.45em]" inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="••••••" value={pin} /></label><p className="mt-2 text-xs text-[var(--muted-foreground)]">O horário oficial será definido pelo sistema.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button className="min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold" onClick={requestLocation} type="button">Atualizar localização</button><button className="min-h-12 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={pin.length !== 6} onClick={() => void register()} type="button">Confirmar meu ponto</button></div></div> : null}

    {state === "SUBMITTING" ? <div aria-busy="true" aria-live="polite" className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-2 font-semibold"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={19} aria-hidden="true" />Registrando…</p><p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><ShieldCheck size={16} aria-hidden="true" />Validando sua localização e confirmando o registro.</p></div> : null}

    {feedback ? <div className="mt-5"><ErrorState description={feedback.description} title={feedback.title}>{supportCode ? <p className="text-sm">Código de suporte: {supportCode}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{retryPendingRequest && location ? <button className="min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold" onClick={() => void register()} type="button">Confirmar novamente</button> : null}{refreshLocation ? <button className="min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold" onClick={requestLocation} type="button">{state === "LOW_ACCURACY" || state === "OUTSIDE_RADIUS" || state === "NETWORK_ERROR" ? "Atualizar localização" : "Tentar novamente"}</button> : null}{!retryPendingRequest && !refreshLocation ? <button className="min-h-11 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold" onClick={closeResult} type="button">Voltar</button> : null}</div></ErrorState></div> : null}
  </section>;
}
