import { describe, expect, it, vi } from "vitest";
import { GooglePlacesProvider } from "@/modules/places/infrastructure/google-places-provider";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

describe("Google Places provider", () => {
  it("usa Autocomplete (New) com token de sessão e somente campos de sugestão necessários", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({
      suggestions: [{ placePrediction: { placeId: "place-1", structuredFormat: { mainText: { text: "Golden Shopping" }, secondaryText: { text: "São Luís - MA" } } } }],
    }));
    const provider = new GooglePlacesProvider("server-only-key", request);
    await expect(provider.searchPlaces({ query: "Golden", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).resolves.toEqual([
      { providerPlaceId: "place-1", displayName: "Golden Shopping", formattedAddress: "São Luís - MA" },
    ]);
    const [url, init] = request.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.body).toContain("sessionToken");
    expect(init.headers).toMatchObject({ "X-Goog-FieldMask": expect.stringContaining("placeId") });
    expect(JSON.stringify(init.headers)).not.toContain("reviews");
  });

  it("normaliza Place Details (New) com endereço e coordenadas", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({
      id: "place-1",
      displayName: { text: "Golden Shopping" },
      formattedAddress: "Av. dos Holandeses, São Luís - MA",
      location: { latitude: -2.5, longitude: -44.2 },
    }));
    const provider = new GooglePlacesProvider("server-only-key", request);
    await expect(provider.getPlaceDetails({ placeId: "place-1", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).resolves.toEqual({
      provider: "GOOGLE_PLACES", providerPlaceId: "place-1", displayName: "Golden Shopping", formattedAddress: "Av. dos Holandeses, São Luís - MA", latitude: -2.5, longitude: -44.2,
    });
    const [url, init] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://places.googleapis.com/v1/places/place-1?sessionToken=2f1e0dc0-2f0b-4da8-96f7-056aa181df10");
    expect(init.headers).toMatchObject({ "X-Goog-FieldMask": "id,displayName,formattedAddress,location" });
  });

  it("usa erro humano quando o provider falha ou o lugar não tem coordenadas", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unavailable = new GooglePlacesProvider("server-only-key", vi.fn().mockResolvedValue(jsonResponse({}, 503)));
    await expect(unavailable.searchPlaces({ query: "Golden", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    const missingCoordinates = new GooglePlacesProvider("server-only-key", vi.fn().mockResolvedValue(jsonResponse({ id: "place-1", displayName: { text: "Golden" }, formattedAddress: "São Luís" })));
    await expect(missingCoordinates.getPlaceDetails({ placeId: "place-1" })).rejects.toMatchObject({ code: "MISSING_COORDINATES" });
    errorSpy.mockRestore();
  });
});
