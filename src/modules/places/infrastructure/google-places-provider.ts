import "server-only";

import {
  PlaceSearchError,
  type PlaceDetails,
  type PlaceSearchProvider,
  type PlaceSuggestion,
} from "@/modules/places/domain/place-search";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places/";

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
}

interface GooglePlaceDetailsResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

function configuredApiKey(value = process.env.GOOGLE_MAPS_API_KEY) {
  const apiKey = value?.trim();
  if (!apiKey) throw new PlaceSearchError("NOT_CONFIGURED");
  return apiKey;
}

function coordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function requiredText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export class GooglePlacesProvider implements PlaceSearchProvider {
  constructor(private readonly apiKey = configuredApiKey(), private readonly request: typeof fetch = fetch) {}

  async searchPlaces(input: { query: string; sessionToken: string }): Promise<PlaceSuggestion[]> {
    let response: Response;
    try {
      response = await this.request(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
        },
        body: JSON.stringify({
          input: input.query,
          sessionToken: input.sessionToken,
          languageCode: "pt-BR",
          includedRegionCodes: ["br"],
          includePureServiceAreaBusinesses: false,
        }),
      });
    } catch (error) {
      console.error("Google Places autocomplete request failed", { error });
      throw new PlaceSearchError("UNAVAILABLE");
    }
    if (!response.ok) {
      console.error("Google Places autocomplete returned an error", { status: response.status });
      throw new PlaceSearchError("UNAVAILABLE");
    }
    const body = await response.json() as GoogleAutocompleteResponse;
    return (body.suggestions ?? []).flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      const providerPlaceId = requiredText(prediction?.placeId);
      const displayName = requiredText(prediction?.structuredFormat?.mainText?.text) ?? requiredText(prediction?.text?.text);
      const formattedAddress = requiredText(prediction?.structuredFormat?.secondaryText?.text) ?? "Endereço a confirmar";
      return providerPlaceId && displayName ? [{ providerPlaceId, displayName, formattedAddress }] : [];
    });
  }

  async getPlaceDetails(input: { placeId: string; sessionToken?: string; query?: string }): Promise<PlaceDetails> {
    let response: Response;
    try {
      const url = new URL(`${PLACE_DETAILS_URL}${encodeURIComponent(input.placeId)}`);
      if (input.sessionToken) url.searchParams.set("sessionToken", input.sessionToken);
      response = await this.request(url, {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        },
      });
    } catch (error) {
      console.error("Google Places details request failed", { error });
      throw new PlaceSearchError("UNAVAILABLE");
    }
    if (!response.ok) {
      console.error("Google Places details returned an error", { status: response.status });
      throw new PlaceSearchError("DETAILS_UNAVAILABLE");
    }
    const body = await response.json() as GooglePlaceDetailsResponse;
    const providerPlaceId = requiredText(body.id);
    const displayName = requiredText(body.displayName?.text);
    const formattedAddress = requiredText(body.formattedAddress);
    const latitude = body.location?.latitude;
    const longitude = body.location?.longitude;
    if (!providerPlaceId || !displayName || !formattedAddress) throw new PlaceSearchError("DETAILS_UNAVAILABLE");
    if (!coordinate(latitude, -90, 90) || !coordinate(longitude, -180, 180)) {
      throw new PlaceSearchError("MISSING_COORDINATES");
    }
    return {
      provider: "GOOGLE_PLACES",
      providerPlaceId,
      displayName,
      formattedAddress,
      latitude,
      longitude,
    };
  }
}
