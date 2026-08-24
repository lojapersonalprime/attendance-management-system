export type BrowserLocationFailureState =
  | "LOCATION_PERMISSION_DENIED"
  | "LOCATION_UNAVAILABLE"
  | "LOCATION_TIMEOUT";

export interface BrowserLocationFeedback {
  state: BrowserLocationFailureState;
  title: string;
  description: string;
}

export function geolocationFailureFeedback(code: number): BrowserLocationFeedback {
  if (code === 1) {
    return {
      state: "LOCATION_PERMISSION_DENIED",
      title: "Localização não permitida.",
      description: "Precisamos acessar sua localização para registrar o ponto. Permita o acesso à localização nas configurações do navegador e tente novamente.",
    };
  }
  if (code === 2) {
    return {
      state: "LOCATION_UNAVAILABLE",
      title: "Não conseguimos identificar sua localização.",
      description: "Verifique se a localização do aparelho está ativada e tente novamente.",
    };
  }
  return {
    state: "LOCATION_TIMEOUT",
    title: "Sua localização demorou mais que o esperado.",
    description: "Tente novamente em alguns segundos.",
  };
}

/** Kept for existing consumers that only need the concise instruction. */
export function geolocationFailureMessage(code: number) {
  return geolocationFailureFeedback(code).description;
}
