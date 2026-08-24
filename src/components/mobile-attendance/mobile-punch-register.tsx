"use client";

import { useRef, useState } from "react";
import { CheckCircle2, LocateFixed, LoaderCircle, MapPin, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/ui/async-feedback";
import { Button } from "@/components/ui/button";
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
  | "PIN_INVALID"
  | "PIN_LOCKED"
  | "DUPLICATE_BLOCKED"
  | "CALCULATION_PERIOD_CLOSED"
  | "MOBILE_PUNCH_UNAVAILABLE"
  | "MOBILE_ACCESS_INACTIVE"
  | "AUTHORIZED_LOCATION_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "REQUEST_COLLISION"
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
  supportCode?: string;
  locationStatus?: "OUTSIDE_RADIUS" | "LOW_ACCURACY";
  receipt?: Receipt;
}

function receiptLocationText(receipt: Receipt) {
  if (receipt.locationStatus === "INSIDE_RADIUS") return "Localização confirmada";
  return "Registro enviado para revisão de localização";
}

function feedbackEyebrow(state: MobilePunchUiState) {
  if (state === "PIN_INVALID" || state === "PIN_LOCKED") return "PIN";
  if (state === "LOCATION_PERMISSION_DENIED" || state === "LOCATION_UNAVAILABLE" || state === "LOCATION_TIMEOUT" || state === "LOW_ACCURACY" || state === "OUTSIDE_RADIUS" || state === "AUTHORIZED_LOCATION_UNAVAILABLE") return "LOCALIZAÇÃO";
  return "REGISTRO";
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
        title: "Não conseguimos identificar sua localização.",
        description: "Verifique se a localização do aparelho está ativada e tente novamente.",
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
        const next = mobilePunchApiFeedback(body, { unitName });
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

  function retryPin() {
    setFeedback(undefined);
    setSupportCode(undefined);
    setRetryPendingRequest(false);
    setPin("");
    setState("READY_TO_CONFIRM");
  }

  if (state === "SUCCESS" && receipt) {
    return <section aria-live="polite" className="surface relative h-full overflow-hidden rounded-[2rem] p-6 sm:p-7" role="status"><div aria-hidden="true" className="absolute right-0 top-0 size-28 rounded-bl-full bg-[rgb(34_197_94_/_10%)]" /><div className="relative"><span className="grid size-12 place-items-center rounded-2xl bg-[rgb(34_197_94_/_14%)] text-[var(--success)]"><CheckCircle2 aria-hidden="true" size={27} /></span><p className="eyebrow mt-7 text-[var(--success)]">PONTO REGISTRADO</p><h2 className="font-display numeric mt-3 text-7xl font-semibold leading-[0.75] text-[var(--foreground)]">{formatOfficialMobilePunchTime(receipt.registeredAt)}</h2><p className="mt-6 text-sm leading-6 text-[var(--muted-foreground)]">{employeeName.trim().split(/\s+/)[0]}, seu registro foi realizado com sucesso.</p><div className="surface-elevated mt-6 rounded-2xl p-4"><p className="text-sm font-semibold text-[var(--foreground)]">{unitName}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{receiptLocationText(receipt)}</p></div><p className="numeric mt-4 text-xs text-[var(--muted-foreground)]">Comprovante: {receipt.receiptCode}</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]" href="/meu-ponto/comprovantes">Ver comprovantes</a><Button onClick={closeResult} type="button">Fechar</Button></div></div></section>;
  }

  const browserLocationError = state === "LOCATION_PERMISSION_DENIED" || state === "LOCATION_UNAVAILABLE" || state === "LOCATION_TIMEOUT";
  const refreshLocation = feedback && (("refreshLocation" in feedback && feedback.refreshLocation) || browserLocationError);

  return <section className="surface h-full rounded-[2rem] p-5 sm:p-6"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[rgb(244_122_32_/_14%)] text-[var(--primary)]"><MapPin aria-hidden="true" size={21} /></span><div><p className="eyebrow text-[var(--primary)]">REGISTRO</p><h2 className="font-display mt-2 text-4xl font-semibold leading-none text-[var(--foreground)]">Registrar meu ponto</h2><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Sua localização será consultada somente no momento em que você solicitar o registro.</p></div></div>{!privacyAccepted ? <label className="surface-elevated mt-6 flex items-start gap-3 rounded-2xl p-4 text-sm leading-6 text-[var(--muted-foreground)]"><input checked={accepted} className="mt-1 size-4 accent-[var(--primary)]" onChange={(event) => setAccepted(event.target.checked)} type="checkbox" /><span>Entendo que minha localização será consultada somente neste registro para verificar a proximidade com a unidade.</span></label> : null}{state === "IDLE" ? <Button className="mt-6 w-full" onClick={requestLocation} type="button"><LocateFixed aria-hidden="true" size={19} />Registrar meu ponto</Button> : null}{state === "GETTING_LOCATION" ? <div aria-busy="true" aria-live="polite" className="surface-elevated mt-6 rounded-2xl p-5"><p className="eyebrow text-[var(--primary)]">VERIFICANDO LOCALIZAÇÃO</p><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none text-[var(--primary)]" size={19} />Só um instante...</p></div> : null}{state === "READY_TO_CONFIRM" && location ? <div className="mt-6"><div aria-live="polite" className="rounded-2xl border border-[rgb(34_197_94_/_35%)] bg-[rgb(34_197_94_/_9%)] p-4"><p className="eyebrow text-[var(--success)]">LOCALIZAÇÃO ENCONTRADA</p><p className="mt-2 text-sm leading-6 text-[var(--foreground)]">Sua posição está pronta para a confirmação.</p></div><label className="mt-5 grid gap-2 text-sm font-semibold text-[var(--foreground)]">Confirme com seu PIN<input aria-label="PIN de 6 dígitos" autoComplete="one-time-code" className="input font-display numeric min-h-14 text-center text-3xl tracking-[0.35em]" inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="••••••" value={pin} /></label><p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">O horário oficial será definido pelo sistema.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Button onClick={requestLocation} type="button" variant="secondary">Atualizar localização</Button><Button disabled={pin.length !== 6} onClick={() => void register()} type="button">Confirmar meu ponto</Button></div></div> : null}{state === "SUBMITTING" ? <div aria-busy="true" aria-live="polite" className="surface-elevated mt-6 rounded-2xl p-5"><p className="eyebrow text-[var(--primary)]">CONFIRMANDO REGISTRO</p><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]"><LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none text-[var(--primary)]" size={19} />Registrando seu ponto...</p><p className="mt-2 flex items-center gap-2 text-xs leading-5 text-[var(--muted-foreground)]"><ShieldCheck aria-hidden="true" size={16} />Validando sua localização e confirmando o registro.</p></div> : null}{feedback ? <div className="mt-6"><ErrorState description={feedback.description} eyebrow={feedbackEyebrow(state)} title={feedback.title}>{supportCode ? <p className="numeric text-xs text-[var(--muted-foreground)]">Código para suporte: {supportCode}</p> : null}<div className="mt-5 flex flex-wrap gap-2">{retryPendingRequest && location ? <Button onClick={() => void register()} type="button" variant="secondary">{"retryLabel" in feedback && feedback.retryLabel ? feedback.retryLabel : "Confirmar novamente"}</Button> : null}{"retryPin" in feedback && feedback.retryPin ? <Button onClick={retryPin} type="button" variant="secondary">Tentar novamente</Button> : null}{refreshLocation ? <Button onClick={requestLocation} type="button" variant="secondary">{state === "LOW_ACCURACY" || state === "OUTSIDE_RADIUS" || state === "NETWORK_ERROR" ? "Atualizar localização" : "Tentar novamente"}</Button> : null}{"signInAgain" in feedback && feedback.signInAgain ? <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]" href="/login">Entrar novamente</a> : null}{!retryPendingRequest && !refreshLocation && !("retryPin" in feedback && feedback.retryPin) && !("signInAgain" in feedback && feedback.signInAgain) ? <Button onClick={closeResult} type="button" variant="secondary">Voltar</Button> : null}</div></ErrorState></div> : null}</section>;
}
