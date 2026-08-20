export type MobileAttendanceErrorCode =
  | "MOBILE_PUNCH_DISABLED"
  | "UNAUTHORIZED"
  | "EMPLOYEE_NOT_ELIGIBLE"
  | "UNIT_MISMATCH"
  | "LOCATION_NOT_CONFIGURED"
  | "LOCATION_BLOCKED"
  | "PIN_INVALID"
  | "PIN_LOCKED"
  | "PRIVACY_NOT_ACCEPTED"
  | "REQUEST_COLLISION"
  | "PUNCH_TOO_CLOSE"
  | "CLOSED_PERIOD"
  | "RECEIPT_CONFIGURATION";

/**
 * Deliberately small, non-sensitive details that can help the employee correct
 * a rejected location. Coordinates and calculated distance remain audit-only.
 */
export interface MobileAttendanceErrorDetails {
  locationStatus?: "OUTSIDE_RADIUS" | "LOW_ACCURACY";
}

const messages: Record<MobileAttendanceErrorCode, string> = {
  MOBILE_PUNCH_DISABLED: "O registro pelo celular não está disponível neste momento.",
  UNAUTHORIZED: "Sua sessão não permite registrar ponto. Entre novamente.",
  EMPLOYEE_NOT_ELIGIBLE: "O registro pelo celular não está habilitado para este funcionário.",
  UNIT_MISMATCH: "Seu cadastro não está habilitado para registrar ponto nesta unidade.",
  LOCATION_NOT_CONFIGURED: "A localização da unidade ainda não foi configurada pelo RH.",
  LOCATION_BLOCKED: "Não foi possível confirmar sua localização para registrar o ponto.",
  PIN_INVALID: "PIN incorreto. Confira e tente novamente.",
  PIN_LOCKED: "Seu PIN está temporariamente bloqueado. Aguarde alguns minutos e tente novamente.",
  PRIVACY_NOT_ACCEPTED: "Confirme o uso da localização no momento do registro para continuar.",
  REQUEST_COLLISION: "Não foi possível registrar o ponto. Gere uma nova tentativa.",
  PUNCH_TOO_CLOSE: "Já existe uma batida muito recente. Aguarde alguns instantes antes de registrar novamente.",
  CLOSED_PERIOD: "A competência deste registro está fechada. Solicite a reabertura ao RH antes de registrar o ponto.",
  RECEIPT_CONFIGURATION: "O registro pelo celular está temporariamente indisponível.",
};

export class MobileAttendanceError extends Error {
  constructor(
    public readonly code: MobileAttendanceErrorCode,
    public readonly supportCode?: string,
    public readonly details?: MobileAttendanceErrorDetails,
  ) {
    super(messages[code]);
  }
}

export function mobileAttendanceErrorMessage(error: unknown) {
  return error instanceof MobileAttendanceError ? error.message : "Não foi possível registrar seu ponto.";
}
