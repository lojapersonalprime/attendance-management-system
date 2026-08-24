import "server-only";

import {
  PlaceSearchError,
  type PlaceDetails,
  type PlaceSearchProvider,
  type PlaceSuggestion,
} from "@/modules/places/domain/place-search";

export const DEFAULT_PHOTON_BASE_URL = "https://photon.komoot.io";
export const PHOTON_TIMEOUT_MS = 5_000;
export const PHOTON_CACHE_TTL_MS = 60_000;
export const PHOTON_CACHE_MAX_ENTRIES = 100;

interface PhotonFeature {
  type?: unknown;
  geometry?: {
    type?: unknown;
    coordinates?: unknown;
  };
  properties?: {
    osm_type?: unknown;
    osm_id?: unknown;
    name?: unknown;
    street?: unknown;
    housenumber?: unknown;
    city?: unknown;
    locality?: unknown;
    district?: unknown;
    state?: unknown;
    country?: unknown;
    countrycode?: unknown;
  };
}

interface PhotonResponse {
  features?: unknown;
}

interface CachedSearch {
  expiresAt: number;
  places: PlaceDetails[];
}

type SearchCache = Map<string, CachedSearch>;

const sharedSearchCache: SearchCache = new Map();

const brazilianStates: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM", "bahia": "BA", "ceara": "CE", "distrito federal": "DF", "espirito santo": "ES", "goias": "GO", "maranhao": "MA", "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", "para": "PA", "paraiba": "PB", "parana": "PR", "pernambuco": "PE", "piaui": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR", "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE", "tocantins": "TO",
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function coordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function osmId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0) return value;
  return undefined;
}

function osmType(value: unknown) {
  const normalized = text(value)?.toUpperCase();
  return normalized && /^[NWRP]$/.test(normalized) ? normalized : undefined;
}

function firstText(...values: unknown[]) {
  return values.map(text).find(Boolean);
}

function stateLabel(state: string | undefined, countryCode: string | undefined) {
  if (!state) return undefined;
  if (countryCode?.toUpperCase() !== "BR") return state;
  return brazilianStates[state.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()] ?? state;
}

function countryLabel(country: string | undefined, countryCode: string | undefined) {
  return countryCode?.toUpperCase() === "BR" || country?.toLowerCase() === "brazil" ? "Brasil" : country;
}

function formatAddress(input: { street?: string; houseNumber?: string; city?: string; state?: string; country?: string; countryCode?: string }) {
  const street = [input.street, input.houseNumber].filter(Boolean).join(", ");
  const state = stateLabel(input.state, input.countryCode);
  const country = countryLabel(input.country, input.countryCode);
  const cityState = [input.city, state].filter(Boolean).join(" - ");
  const regional = [cityState, country].filter(Boolean).join(", ");
  return [street, regional].filter(Boolean).join("\n") || "Endereço a confirmar";
}

export function photonProviderPlaceId(feature: PhotonFeature) {
  const type = osmType(feature.properties?.osm_type);
  const id = osmId(feature.properties?.osm_id);
  return type && id ? `${type}:${id}` : undefined;
}

export function normalizePhotonFeature(feature: PhotonFeature): PlaceDetails | undefined {
  if (feature.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) return undefined;
  const [longitude, latitude] = feature.geometry.coordinates;
  const providerPlaceId = photonProviderPlaceId(feature);
  const properties = feature.properties;
  const city = firstText(properties?.city, properties?.locality, properties?.district);
  const displayName = firstText(properties?.name, properties?.street, city);
  if (!providerPlaceId || !displayName || !coordinate(latitude, -90, 90) || !coordinate(longitude, -180, 180)) return undefined;
  return {
    provider: "OPENSTREETMAP_PHOTON",
    providerPlaceId,
    displayName,
    formattedAddress: formatAddress({
      street: text(properties?.street),
      houseNumber: text(properties?.housenumber),
      city,
      state: text(properties?.state),
      country: text(properties?.country),
      countryCode: text(properties?.countrycode),
    }),
    latitude,
    longitude,
  };
}

function normalizedQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function cacheRecentSearch(cache: SearchCache, key: string, places: PlaceDetails[]) {
  const now = Date.now();
  for (const [cachedKey, cached] of cache) {
    if (cached.expiresAt <= now) cache.delete(cachedKey);
  }
  if (!cache.has(key) && cache.size >= PHOTON_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { places, expiresAt: now + PHOTON_CACHE_TTL_MS });
}

function configuredBaseUrl(value = process.env.PHOTON_BASE_URL) {
  try {
    const url = new URL(value?.trim() || DEFAULT_PHOTON_BASE_URL);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported protocol");
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return url;
  } catch {
    throw new PlaceSearchError("NOT_CONFIGURED");
  }
}

export class PhotonPlaceSearchProvider implements PlaceSearchProvider {
  constructor(
    private readonly baseUrl = configuredBaseUrl(),
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = PHOTON_TIMEOUT_MS,
    private readonly cache: SearchCache = sharedSearchCache,
  ) {}

  private async loadPlaces(query: string) {
    const normalized = normalizedQuery(query);
    const cacheKey = normalized.toLocaleLowerCase("pt-BR");
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.places;
    if (cached) this.cache.delete(cacheKey);

    const url = new URL("api/", this.baseUrl);
    url.searchParams.set("q", normalized);
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycode", "BR");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.request(url, { headers: { Accept: "application/geo+json, application/json", "Accept-Language": "pt-BR" }, signal: controller.signal });
    } catch (error) {
      console.error("Photon place search request failed", { error });
      throw new PlaceSearchError("UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.error("Photon place search returned an error", { status: response.status });
      throw new PlaceSearchError("UNAVAILABLE");
    }
    let body: PhotonResponse;
    try {
      body = await response.json() as PhotonResponse;
    } catch (error) {
      console.error("Photon place search returned invalid JSON", { error });
      throw new PlaceSearchError("UNAVAILABLE");
    }
    const places = Array.isArray(body.features)
      ? body.features.flatMap((feature) => normalizePhotonFeature(feature as PhotonFeature) ?? [])
      : [];
    cacheRecentSearch(this.cache, cacheKey, places);
    return places;
  }

  async searchPlaces(input: { query: string; sessionToken: string }): Promise<PlaceSuggestion[]> {
    const query = normalizedQuery(input.query);
    const places = await this.loadPlaces(query);
    return places.map(({ providerPlaceId, displayName, formattedAddress }) => ({ providerPlaceId, displayName, formattedAddress, detailsQuery: query }));
  }

  async getPlaceDetails(input: { placeId: string; sessionToken?: string; query?: string }): Promise<PlaceDetails> {
    if (!input.query?.trim()) throw new PlaceSearchError("DETAILS_UNAVAILABLE");
    const place = (await this.loadPlaces(input.query)).find((candidate) => candidate.providerPlaceId === input.placeId);
    if (!place) throw new PlaceSearchError("DETAILS_UNAVAILABLE");
    return place;
  }
}
