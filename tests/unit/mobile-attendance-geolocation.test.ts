import { describe, expect, it } from "vitest";
import { evaluateLocation, haversineDistanceMeters } from "@/modules/mobile-attendance/domain/geolocation";
import { geolocationFailureFeedback, geolocationFailureMessage } from "@/modules/mobile-attendance/domain/geolocation-feedback";

const authorizedLocation = {
  latitude: 0,
  longitude: 0,
  radiusMeters: 150,
  maxAccuracyMeters: 50,
  exceptionPolicy: "ALLOW_AND_REVIEW" as const,
};

describe("mobile attendance geolocation", () => {
  it("calcula distância com Haversine", () => {
    expect(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111_195, -2);
  });

  it("aceita ponto dentro do raio", () => {
    const result = evaluateLocation({ latitude: 0, longitude: 0.0005, accuracyMeters: 15, authorizedLocation });
    expect(result.status).toBe("INSIDE_RADIUS");
    expect(result.reviewRequired).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it("permite e sinaliza ponto fora do raio no piloto", () => {
    const result = evaluateLocation({ latitude: 0, longitude: 0.01, accuracyMeters: 10, authorizedLocation });
    expect(result.status).toBe("OUTSIDE_RADIUS");
    expect(result.reviewRequired).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("prioriza baixa precisão e respeita política de bloqueio", () => {
    const result = evaluateLocation({ latitude: 0, longitude: 0, accuracyMeters: 51, authorizedLocation: { ...authorizedLocation, exceptionPolicy: "BLOCK" } });
    expect(result.status).toBe("LOW_ACCURACY");
    expect(result.blocked).toBe(true);
  });

  it("bloqueia localização fora do raio quando a política do local é BLOCK", () => {
    const result = evaluateLocation({ latitude: 0, longitude: 0.01, accuracyMeters: 10, authorizedLocation: { ...authorizedLocation, exceptionPolicy: "BLOCK" } });
    expect(result.status).toBe("OUTSIDE_RADIUS");
    expect(result.blocked).toBe(true);
  });

  it("apresenta orientação humana para permissão negada, indisponibilidade e timeout", () => {
    expect(geolocationFailureFeedback(1)).toMatchObject({ state: "LOCATION_PERMISSION_DENIED", title: "Localização não permitida." });
    expect(geolocationFailureFeedback(2)).toMatchObject({ state: "LOCATION_UNAVAILABLE", title: "Não conseguimos identificar sua localização." });
    expect(geolocationFailureFeedback(3)).toMatchObject({ state: "LOCATION_TIMEOUT", title: "Sua localização demorou mais que o esperado." });
    expect(geolocationFailureMessage(1)).toMatch(/permita o acesso à localização/i);
  });
});
