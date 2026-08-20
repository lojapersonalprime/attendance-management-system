import { describe, expect, it } from "vitest";
import { formatOfficialMobilePunchTime, mobilePunchApiFeedback, networkMobilePunchFeedback } from "@/modules/mobile-attendance/domain/mobile-punch-feedback";

describe("mobile punch employee feedback", () => {
  it("explica baixa precisão e solicita uma localização nova", () => {
    expect(mobilePunchApiFeedback({ code: "LOCATION_BLOCKED", locationStatus: "LOW_ACCURACY" })).toMatchObject({
      state: "LOW_ACCURACY",
      refreshLocation: true,
    });
  });

  it("explica bloqueio fora do raio sem expor coordenadas", () => {
    const feedback = mobilePunchApiFeedback({ code: "LOCATION_BLOCKED", locationStatus: "OUTSIDE_RADIUS" });
    expect(feedback).toMatchObject({ state: "OUTSIDE_RADIUS", refreshLocation: true });
    expect(feedback.description).not.toMatch(/latitude|longitude|coordenada/i);
  });

  it("traduz a proteção contra marcações próximas", () => {
    expect(mobilePunchApiFeedback({ code: "PUNCH_TOO_CLOSE" })).toMatchObject({ state: "DUPLICATE_BLOCKED" });
    expect(mobilePunchApiFeedback({ code: "MOBILE_PUNCH_DUPLICATE_BLOCKED" })).toMatchObject({ state: "DUPLICATE_BLOCKED" });
  });

  it("traduz competência fechada sem oferecer contorno", () => {
    expect(mobilePunchApiFeedback({ code: "CLOSED_PERIOD" })).toMatchObject({ state: "CALCULATION_PERIOD_CLOSED" });
  });

  it("preserva a possibilidade de confirmar com o mesmo intento após falha de rede", () => {
    expect(networkMobilePunchFeedback()).toMatchObject({ state: "NETWORK_ERROR", retrySubmittedRequest: true, refreshLocation: true });
    expect(mobilePunchApiFeedback({ code: "UNAVAILABLE" })).toMatchObject({ state: "NETWORK_ERROR", retrySubmittedRequest: true });
  });

  it("mantém uma mensagem separada para erro definitivo do servidor", () => {
    expect(mobilePunchApiFeedback({ error: "Falha inesperada." })).toMatchObject({ state: "SERVER_ERROR", description: "Falha inesperada." });
  });

  it("mostra no comprovante somente o horário oficial retornado pelo servidor", () => {
    expect(formatOfficialMobilePunchTime("2026-08-20T10:03:00.000Z")).toBe("07:03");
  });
});
