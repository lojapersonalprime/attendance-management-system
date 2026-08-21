import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE } from "@/lib/dates/business";

export type MobilePunchFeedbackState =
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
  | "PRIVACY_CONSENT_REQUIRED"
  | "REQUEST_COLLISION"
  | "NETWORK_ERROR"
  | "SERVER_ERROR";

export interface MobilePunchFeedback {
  state: MobilePunchFeedbackState;
  title: string;
  description: string;
  retrySubmittedRequest?: boolean;
  retryLabel?: string;
  retryPin?: boolean;
  refreshLocation?: boolean;
  signInAgain?: boolean;
}

interface MobilePunchApiFailure {
  code?: string;
  // Kept only to make the mapper defensive when an intermediary adds a
  // message. It is intentionally never rendered.
  error?: unknown;
  locationStatus?: "OUTSIDE_RADIUS" | "LOW_ACCURACY";
}

export function networkMobilePunchFeedback(): MobilePunchFeedback {
  return {
    state: "NETWORK_ERROR",
    title: "Não foi possível confirmar se o ponto foi registrado.",
    description: "Você pode confirmar novamente com segurança.",
    retrySubmittedRequest: true,
  };
}

/** Formats only the persisted server timestamp returned in the receipt. */
export function formatOfficialMobilePunchTime(registeredAt: string) {
  return formatInTimeZone(new Date(registeredAt), BUSINESS_TIME_ZONE, "HH:mm");
}

function unexpectedServerFeedback(): MobilePunchFeedback {
  return {
    state: "SERVER_ERROR",
    title: "Não foi possível registrar seu ponto agora.",
    description: "Tente novamente. Se o problema continuar, informe o código abaixo ao RH.",
    retrySubmittedRequest: true,
    retryLabel: "Tentar novamente",
  };
}

export function mobilePunchApiFeedback(failure: MobilePunchApiFailure, input: { unitName: string }): MobilePunchFeedback {
  if ((failure.code === "LOCATION_BLOCKED" || failure.code === "LOW_ACCURACY") && failure.locationStatus === "LOW_ACCURACY") {
    return {
      state: "LOW_ACCURACY",
      title: "Não conseguimos confirmar sua localização com precisão suficiente.",
      description: "Aguarde alguns segundos ou vá para uma área com melhor sinal e tente novamente.",
      refreshLocation: true,
    };
  }
  if ((failure.code === "LOCATION_BLOCKED" || failure.code === "OUTSIDE_RADIUS") && failure.locationStatus === "OUTSIDE_RADIUS") {
    return {
      state: "OUTSIDE_RADIUS",
      title: "Você está fora da área permitida para registrar o ponto.",
      description: `Para registrar, esteja próximo à unidade ${input.unitName} e atualize sua localização.`,
      refreshLocation: true,
    };
  }
  if (failure.code === "LOCATION_BLOCKED") {
    return {
      state: "AUTHORIZED_LOCATION_UNAVAILABLE",
      title: "Não conseguimos confirmar sua localização.",
      description: "Atualize sua localização e tente novamente.",
      refreshLocation: true,
    };
  }
  if (failure.code === "PIN_INVALID") {
    return {
      state: "PIN_INVALID",
      title: "PIN incorreto.",
      description: "Confira os 6 dígitos e tente novamente.",
      retryPin: true,
    };
  }
  if (failure.code === "PIN_LOCKED") {
    return {
      state: "PIN_LOCKED",
      title: "O PIN foi bloqueado temporariamente.",
      description: "Aguarde um pouco antes de tentar novamente ou procure o RH.",
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
  if (failure.code === "MOBILE_PUNCH_DISABLED" || failure.code === "RECEIPT_CONFIGURATION") {
    return {
      state: "MOBILE_PUNCH_UNAVAILABLE",
      title: "Registro de ponto pelo celular indisponível.",
      description: "O registro de ponto pelo celular está temporariamente indisponível. Tente novamente mais tarde ou procure o RH.",
    };
  }
  if (failure.code === "EMPLOYEE_NOT_ELIGIBLE") {
    return {
      state: "MOBILE_ACCESS_INACTIVE",
      title: "Seu acesso ao ponto pelo celular está desativado.",
      description: "Procure o RH para verificar seu acesso.",
    };
  }
  if (failure.code === "LOCATION_NOT_CONFIGURED" || failure.code === "UNIT_MISMATCH") {
    return {
      state: "AUTHORIZED_LOCATION_UNAVAILABLE",
      title: "O local autorizado para o seu ponto não está disponível.",
      description: "Procure o RH para verificar a configuração da sua unidade.",
    };
  }
  if (failure.code === "UNAUTHORIZED") {
    return {
      state: "SESSION_EXPIRED",
      title: "Sua sessão expirou.",
      description: "Entre novamente para registrar seu ponto.",
      signInAgain: true,
    };
  }
  if (failure.code === "PRIVACY_NOT_ACCEPTED") {
    return {
      state: "PRIVACY_CONSENT_REQUIRED",
      title: "Confirme o uso da localização.",
      description: "Confirme o uso da localização no momento do registro para continuar.",
      refreshLocation: true,
    };
  }
  if (failure.code === "REQUEST_COLLISION") {
    return {
      state: "REQUEST_COLLISION",
      title: "Não foi possível preparar uma nova marcação.",
      description: "Atualize sua localização e tente novamente.",
      refreshLocation: true,
    };
  }
  return unexpectedServerFeedback();
}
