export const PLACE_SEARCH_DEBOUNCE_MS = 350;

export type PlaceProviderName = "GOOGLE_PLACES";

export interface PlaceSuggestion {
  providerPlaceId: string;
  displayName: string;
  formattedAddress: string;
}

export interface PlaceDetails extends PlaceSuggestion {
  provider: PlaceProviderName;
  latitude: number;
  longitude: number;
}

export interface PlaceSearchProvider {
  searchPlaces(input: { query: string; sessionToken: string }): Promise<PlaceSuggestion[]>;
  getPlaceDetails(input: { placeId: string; sessionToken?: string }): Promise<PlaceDetails>;
}

export type PlaceSearchErrorCode = "NOT_CONFIGURED" | "UNAVAILABLE" | "DETAILS_UNAVAILABLE" | "MISSING_COORDINATES";

const messages: Record<PlaceSearchErrorCode, string> = {
  NOT_CONFIGURED: "O serviço de locais ainda não foi configurado.",
  UNAVAILABLE: "Não foi possível acessar o serviço de locais.",
  DETAILS_UNAVAILABLE: "Não conseguimos obter os detalhes deste endereço.",
  MISSING_COORDINATES: "O local foi encontrado, mas não possui coordenadas válidas.",
};

export class PlaceSearchError extends Error {
  constructor(public readonly code: PlaceSearchErrorCode) {
    super(messages[code]);
  }
}

export function placeSearchErrorMessage(error: unknown) {
  return error instanceof PlaceSearchError ? error.message : messages.UNAVAILABLE;
}

export function shouldSearchPlaces(query: string) {
  return query.trim().length >= 3;
}

/** Debounces browser requests so typing never maps one request to each key stroke. */
export function createDebouncedPlaceSearch(callback: (query: string) => void, delay = PLACE_SEARCH_DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule(query: string) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callback(query), delay);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
