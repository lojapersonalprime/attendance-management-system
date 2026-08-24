import { describe, expect, it, vi } from "vitest";
import { getPlaceSearchProvider } from "@/modules/places/infrastructure/place-search-provider";
import { PhotonPlaceSearchProvider } from "@/modules/places/infrastructure/photon-place-search-provider";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/geo+json" } });
}

const goldenPhotonResponse = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    geometry: { type: "Point", coordinates: [-44.28812, -2.51234] },
    properties: {
      osm_type: "W",
      osm_id: 987654321,
      name: "Golden Shopping",
      street: "Av. dos Holandeses",
      housenumber: "200",
      city: "São Luís",
      state: "Maranhão",
      country: "Brazil",
      countrycode: "BR",
    },
  }],
};

describe("Photon place search provider", () => {
  it("pesquisa GeoJSON, normaliza dados necessários e cria identificador OSM estável", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(goldenPhotonResponse));
    const provider = new PhotonPlaceSearchProvider(new URL("https://photon.test"), request, 100, new Map());

    await expect(provider.searchPlaces({ query: " Golden Shopping São Luís ", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).resolves.toEqual([
      {
        providerPlaceId: "W:987654321",
        displayName: "Golden Shopping",
        formattedAddress: "Av. dos Holandeses, 200\nSão Luís - MA, Brasil",
        detailsQuery: "Golden Shopping São Luís",
      },
    ]);
    const [url, init] = request.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://photon.test/api/?q=Golden+Shopping+S%C3%A3o+Lu%C3%ADs&limit=5&countrycode=BR");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toMatchObject({ "Accept-Language": "pt-BR" });
  });

  it("obtém detalhes normalizados da busca recente sem persistir a resposta GeoJSON bruta", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(goldenPhotonResponse));
    const provider = new PhotonPlaceSearchProvider(new URL("https://photon.test"), request, 100, new Map());
    await provider.searchPlaces({ query: "Golden Shopping São Luís", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" });

    await expect(provider.getPlaceDetails({ placeId: "W:987654321", query: "Golden Shopping São Luís" })).resolves.toEqual({
      provider: "OPENSTREETMAP_PHOTON",
      providerPlaceId: "W:987654321",
      displayName: "Golden Shopping",
      formattedAddress: "Av. dos Holandeses, 200\nSão Luís - MA, Brasil",
      latitude: -2.51234,
      longitude: -44.28812,
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("reconfirma o identificador Photon pelo resultado normalizado antes de salvar", async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(goldenPhotonResponse));
    const provider = new PhotonPlaceSearchProvider(new URL("https://photon.test"), request, 100, new Map());
    await expect(provider.getPlaceDetails({ placeId: "W:987654321", query: "Golden Shopping São Luís" })).resolves.toMatchObject({
      provider: "OPENSTREETMAP_PHOTON",
      providerPlaceId: "W:987654321",
      latitude: -2.51234,
      longitude: -44.28812,
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it("retorna lista vazia para resposta vazia ou itens sem coordenadas e não aceita detalhes inexistentes", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ type: "FeatureCollection", features: [] }))
      .mockResolvedValueOnce(jsonResponse({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-44.2] }, properties: { osm_type: "N", osm_id: 1, name: "Sem latitude" } }] }));
    const provider = new PhotonPlaceSearchProvider(new URL("https://photon.test"), request, 100, new Map());
    await expect(provider.searchPlaces({ query: "vazio", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).resolves.toEqual([]);
    await expect(provider.searchPlaces({ query: "incompleto", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).resolves.toEqual([]);
    await expect(provider.getPlaceDetails({ placeId: "N:1", query: "incompleto" })).rejects.toMatchObject({ code: "DETAILS_UNAVAILABLE" });
  });

  it("trata indisponibilidade e timeout sem expor o erro HTTP", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unavailable = new PhotonPlaceSearchProvider(new URL("https://photon.test"), vi.fn().mockResolvedValue(jsonResponse({}, 503)), 100, new Map());
    await expect(unavailable.searchPlaces({ query: "Golden", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).rejects.toMatchObject({ code: "UNAVAILABLE" });

    const timedOutRequest = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch;
    const timedOut = new PhotonPlaceSearchProvider(new URL("https://photon.test"), timedOutRequest, 1, new Map());
    await expect(timedOut.searchPlaces({ query: "Golden", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).rejects.toMatchObject({ code: "UNAVAILABLE" });
    errorSpy.mockRestore();
  });

  it("seleciona Photon por padrão e mantém Google opcional e claramente configurável", () => {
    vi.stubEnv("PLACE_SEARCH_PROVIDER", "");
    expect(getPlaceSearchProvider()).toBeInstanceOf(PhotonPlaceSearchProvider);
    expect(getPlaceSearchProvider("photon")).toBeInstanceOf(PhotonPlaceSearchProvider);
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "server-only-key");
    expect(getPlaceSearchProvider("google").constructor.name).toBe("GooglePlacesProvider");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    expect(() => getPlaceSearchProvider("google")).toThrow(/GOOGLE_MAPS_API_KEY/);
    vi.unstubAllEnvs();
  });
});
