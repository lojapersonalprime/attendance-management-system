import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { authorizedLocationSchema } from "@/modules/mobile-attendance/application/validation";
import { resolveAuthorizedLocationSelection } from "@/modules/mobile-attendance/domain/authorized-location";
import { createDebouncedPlaceSearch, PLACE_SEARCH_DEBOUNCE_MS, shouldSearchPlaces } from "@/modules/places/domain/place-search";
import { placeDetailsInputSchema, placeSearchInputSchema } from "@/modules/places/application/place-search-service";
import { haversineDistanceMeters } from "@/modules/mobile-attendance/domain/geolocation";

describe("authorized location place search", () => {
  it("aceita id vazio na criação: esta era a causa da validação genérica", () => {
    const parsed = authorizedLocationSchema.parse({ id: "", placeProvider: "", providerPlaceId: "", formattedAddress: "", unitId: "golden", name: "Golden", latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 50, exceptionPolicy: "ALLOW_AND_REVIEW", active: true });
    expect(parsed.id).toBeUndefined();
    expect(parsed.placeProvider).toBeUndefined();
  });

  it("faz debounce da pesquisa e só busca termos úteis", () => {
    vi.useFakeTimers();
    const search = vi.fn();
    const debounced = createDebouncedPlaceSearch(search);
    debounced.schedule("Gol");
    debounced.schedule("Golden");
    vi.advanceTimersByTime(PLACE_SEARCH_DEBOUNCE_MS - 1);
    expect(search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith("Golden");
    expect(shouldSearchPlaces("Go")).toBe(false);
    expect(shouldSearchPlaces("Gol")).toBe(true);
    vi.useRealTimers();
  });

  it("persiste os detalhes resolvidos pelo provider, não as coordenadas enviadas pelo navegador", () => {
    const resolved = resolveAuthorizedLocationSelection({ placeProvider: "GOOGLE_PLACES", providerPlaceId: "place-1", formattedAddress: "alterado no browser", latitude: 0, longitude: 0 }, {
      provider: "GOOGLE_PLACES", providerPlaceId: "place-1", displayName: "Golden Shopping", formattedAddress: "Endereço confirmado", latitude: -2.5, longitude: -44.2,
    });
    expect(resolved).toEqual({ placeProvider: "GOOGLE_PLACES", providerPlaceId: "place-1", formattedAddress: "Endereço confirmado", latitude: -2.5, longitude: -44.2 });

    const photon = resolveAuthorizedLocationSelection({ placeProvider: "OPENSTREETMAP_PHOTON", providerPlaceId: "W:987654321", formattedAddress: "alterado no browser", latitude: 0, longitude: 0 }, {
      provider: "OPENSTREETMAP_PHOTON", providerPlaceId: "W:987654321", displayName: "Golden Shopping", formattedAddress: "São Luís - MA, Brasil", latitude: -2.5, longitude: -44.2,
    });
    expect(photon).toEqual({ placeProvider: "OPENSTREETMAP_PHOTON", providerPlaceId: "W:987654321", formattedAddress: "São Luís - MA, Brasil", latitude: -2.5, longitude: -44.2 });
  });

  it("mantém fallback manual/GPS e continua validando coordenadas no schema", () => {
    expect(resolveAuthorizedLocationSelection({ latitude: 0, longitude: 0, formattedAddress: "Manual" })).toEqual({ placeProvider: null, providerPlaceId: null, formattedAddress: "Manual", latitude: 0, longitude: 0 });
    expect(() => authorizedLocationSchema.parse({ unitId: "golden", name: "Golden", latitude: 91, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 50, exceptionPolicy: "ALLOW_AND_REVIEW", active: true })).toThrow();
    const formSource = readFileSync(resolve(process.cwd(), "src/components/mobile-attendance/authorized-location-form.tsx"), "utf8");
    expect(formSource).toContain("Usar minha localização atual");
    expect(formSource).toContain("Informar coordenadas manualmente");
    expect(formSource).toContain("Tentar novamente");
    expect(formSource).toContain("Dados de localização ©");
  });

  it("valida busca e detalhes também no servidor", () => {
    expect(() => placeSearchInputSchema.parse({ query: "Go", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" })).toThrow();
    expect(() => placeDetailsInputSchema.parse({ placeId: "place id inválido" })).toThrow();
    expect(placeSearchInputSchema.parse({ query: "Golden", sessionToken: "2f1e0dc0-2f0b-4da8-96f7-056aa181df10" }).query).toBe("Golden");
  });

  it("não altera Haversine, RawPunch/MobilePunch nem liga providers externos ao fluxo de MobilePunch", async () => {
    expect(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111_195, -2);
    const source = readFileSync(resolve(process.cwd(), "src/modules/mobile-attendance/application/mobile-attendance-service.ts"), "utf8");
    const registerMobilePunchSource = source.slice(source.indexOf("export async function registerMobilePunch"), source.indexOf("export async function createAttendanceCorrectionRequest"));
    expect(registerMobilePunchSource).not.toContain("getPlaceSearchProvider");
    expect(registerMobilePunchSource).not.toMatch(/Photon|Google|place-search/i);
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toContain("model RawPunch {");
    expect(schema).toContain("model MobilePunch {");
  });
});
