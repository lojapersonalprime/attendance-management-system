import "server-only";

import { PlaceSearchError, type PlaceProviderName, type PlaceSearchProvider } from "@/modules/places/domain/place-search";
import { GooglePlacesProvider } from "@/modules/places/infrastructure/google-places-provider";
import { PhotonPlaceSearchProvider } from "@/modules/places/infrastructure/photon-place-search-provider";

export type PlaceSearchProviderSetting = "photon" | "google";

function configuredProvider(value = process.env.PLACE_SEARCH_PROVIDER): PlaceSearchProviderSetting {
  const provider = value?.trim().toLowerCase() || "photon";
  if (provider === "photon" || provider === "google") return provider;
  throw new PlaceSearchError("NOT_CONFIGURED");
}

export function getPlaceSearchProvider(value = process.env.PLACE_SEARCH_PROVIDER): PlaceSearchProvider {
  return configuredProvider(value) === "google" ? new GooglePlacesProvider() : new PhotonPlaceSearchProvider();
}

/** Existing selected places keep their own provider when RH updates them later. */
export function getPlaceSearchProviderForPlace(provider: PlaceProviderName): PlaceSearchProvider {
  return provider === "GOOGLE_PLACES" ? new GooglePlacesProvider() : new PhotonPlaceSearchProvider();
}
