import type { PlaceDetails } from "@/modules/places/domain/place-search";

export interface AuthorizedLocationSelectionInput {
  placeProvider?: PlaceDetails["provider"];
  providerPlaceId?: string;
  formattedAddress?: string;
  latitude: number;
  longitude: number;
}

export function requiresProviderResolution(input: AuthorizedLocationSelectionInput) {
  if ((input.placeProvider && !input.providerPlaceId) || (!input.placeProvider && input.providerPlaceId)) {
    throw new Error("Pesquise e selecione um local válido ou use uma das outras formas de localização.");
  }
  return Boolean(input.placeProvider && input.providerPlaceId);
}

/** Provider data replaces browser coordinates before AuthorizedLocation persists. */
export function resolveAuthorizedLocationSelection(input: AuthorizedLocationSelectionInput, providerDetails?: PlaceDetails) {
  if (requiresProviderResolution(input) && !providerDetails) throw new Error("Não conseguimos obter os detalhes deste endereço.");
  return {
    placeProvider: providerDetails?.provider ?? null,
    providerPlaceId: providerDetails?.providerPlaceId ?? null,
    formattedAddress: providerDetails?.formattedAddress ?? input.formattedAddress ?? null,
    latitude: providerDetails?.latitude ?? input.latitude,
    longitude: providerDetails?.longitude ?? input.longitude,
  };
}
