export type MobilePunchFeedbackState =
  | "LOW_ACCURACY"
  | "OUTSIDE_RADIUS"
  | "DUPLICATE_BLOCKED"
  | "CALCULATION_PERIOD_CLOSED"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export interface MobilePunchFeedback {
  state: MobilePunchFeedbackState;
  title: string;
  description: string;
  retrySubmittedRequest?: boolean;
  refreshLocation?: boolean;
}

interface MobilePunchApiFailure {
  code?: string;
  error?: string;
  locationStatus?: "OUTSIDE_RADIUS" | "LOW_ACCURACY";
}

export function networkMobilePunchFeedback(): MobilePunchFeedback {
  return {
    state: "NETWORK_ERROR",
    title: "Não foi possível confirmar se o ponto foi registrado.",
    description: "Você pode confirmar novamente com segurança.",
    retrySubmittedRequest: true,
    refreshLocation: true,
  };
}

/** Formats only the persisted server timestamp returned in the receipt. */
export function formatOfficialMobilePunchTime(registeredAt: string) {
  return formatInTimeZone(new Date(registeredAt), BUSINESS_TIME_ZONE, "HH:mm");
}

export function mobilePunchApiFeedback(failure: MobilePunchApiFailure): MobilePunchFeedback {
  if ((failure.code === "LOCATION_BLOCKED" || failure.code === "LOW_ACCURACY") && failure.locationStatus === "LOW_ACCURACY") {
    return {
      state: "LOW_ACCURACY",
      title: "Não conseguimos confirmar sua localização com precisão suficiente.",
      description: "Atualize sua localização e tente novamente.",
      refreshLocation: true,
    };
  }
  if ((failure.code === "LOCATION_BLOCKED" || failure.code === "OUTSIDE_RADIUS") && failure.locationStatus === "OUTSIDE_RADIUS") {
    return {
      state: "OUTSIDE_RADIUS",
      title: "Você está fora da área autorizada para registrar o ponto.",
      description: "O ponto deve ser registrado próximo à unidade configurada.",
      refreshLocation: true,
    };
  }
  if (failure.code === "PUNCH_TOO_CLOSE" || failure.code === "MOBILE_PUNCH_DUPLICATE_BLOCKED") {
    return {
      state: "DUPLICATE_BLOCKED",
      title: "Você já registrou um ponto há poucos minutos.",
      description: "Aguarde antes de registrar uma nova marcação.",
    };
  }
  if (failure.code === "CLOSED_PERIOD" || failure.code === "CALCULATION_PERIOD_CLOSED") {
    return {
      state: "CALCULATION_PERIOD_CLOSED",
      title: "Não é possível registrar ponto neste período.",
      description: "A competência já foi encerrada. Procure o RH caso precise solicitar uma correção.",
    };
  }
  if (failure.code === "UNAVAILABLE") return networkMobilePunchFeedback();
  return {
    state: "SERVER_ERROR",
    title: "Não foi possível registrar seu ponto.",
    description: failure.error || "Tente novamente em alguns instantes.",
  };
}
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE } from "@/lib/dates/business";
