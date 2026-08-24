import { describe, expect, it } from "vitest";
import { formatOfficialMobilePunchTime, mobilePunchApiFeedback, networkMobilePunchFeedback } from "@/modules/mobile-attendance/domain/mobile-punch-feedback";

const employeeContext = { unitName: "Golden Shopping" };

describe("mobile punch employee feedback", () => {
  it("explica baixa precisão e solicita uma localização nova", () => {
    expect(mobilePunchApiFeedback({ code: "LOCATION_BLOCKED", locationStatus: "LOW_ACCURACY" }, employeeContext)).toMatchObject({
      state: "LOW_ACCURACY",
      title: "Não conseguimos confirmar sua localização com precisão suficiente.",
      description: "Aguarde alguns segundos ou vá para uma área com melhor sinal e tente novamente.",
      refreshLocation: true,
    });
  });

  it("explica bloqueio fora do raio sem expor coordenadas", () => {
    const feedback = mobilePunchApiFeedback({ code: "LOCATION_BLOCKED", locationStatus: "OUTSIDE_RADIUS" }, employeeContext);
    expect(feedback).toMatchObject({ state: "OUTSIDE_RADIUS", refreshLocation: true });
    expect(feedback.description).toContain("unidade Golden Shopping");
    expect(feedback.description).not.toMatch(/latitude|longitude|coordenada/i);
  });

  it("traduz PIN incorreto e bloqueado sem expor tentativas internas", () => {
    expect(mobilePunchApiFeedback({ code: "PIN_INVALID" }, employeeContext)).toMatchObject({
      state: "PIN_INVALID",
      title: "PIN incorreto.",
      description: "Confira os 6 dígitos e tente novamente.",
      retryPin: true,
    });
    expect(mobilePunchApiFeedback({ code: "PIN_LOCKED" }, employeeContext)).toMatchObject({
      state: "PIN_LOCKED",
      title: "O PIN foi bloqueado temporariamente.",
    });
  });

  it("traduz a proteção contra marcações próximas", () => {
    expect(mobilePunchApiFeedback({ code: "PUNCH_TOO_CLOSE" }, employeeContext)).toMatchObject({ state: "DUPLICATE_BLOCKED", title: "Você já registrou um ponto há poucos minutos." });
    expect(mobilePunchApiFeedback({ code: "MOBILE_PUNCH_DUPLICATE_BLOCKED" }, employeeContext)).toMatchObject({ state: "DUPLICATE_BLOCKED" });
  });

  it("traduz competência fechada sem oferecer contorno", () => {
    expect(mobilePunchApiFeedback({ code: "CLOSED_PERIOD" }, employeeContext)).toMatchObject({ state: "CALCULATION_PERIOD_CLOSED" });
  });

  it("explica indisponibilidade temporária, acesso inativo e local não configurado", () => {
    expect(mobilePunchApiFeedback({ code: "MOBILE_PUNCH_DISABLED" }, employeeContext)).toMatchObject({
      state: "MOBILE_PUNCH_UNAVAILABLE",
      title: "Registro de ponto pelo celular indisponível.",
    });
    expect(mobilePunchApiFeedback({ code: "EMPLOYEE_NOT_ELIGIBLE" }, employeeContext)).toMatchObject({
      state: "MOBILE_ACCESS_INACTIVE",
      title: "Seu acesso ao ponto pelo celular está desativado.",
    });
    expect(mobilePunchApiFeedback({ code: "LOCATION_NOT_CONFIGURED" }, employeeContext)).toMatchObject({
      state: "AUTHORIZED_LOCATION_UNAVAILABLE",
      title: "O local autorizado para o seu ponto não está disponível.",
    });
  });

  it("preserva a possibilidade de confirmar com o mesmo intento após falha de rede", () => {
    expect(networkMobilePunchFeedback()).toMatchObject({ state: "NETWORK_ERROR", retrySubmittedRequest: true });
    expect(networkMobilePunchFeedback().refreshLocation).toBeUndefined();
  });

  it("usa fallback sem expor mensagem ou stack interno do backend", () => {
    const feedback = mobilePunchApiFeedback({ code: "UNAVAILABLE", error: "PrismaClientKnownRequestError: SELECT secret_token\\n    at registerMobilePunch" }, employeeContext);
    expect(feedback).toMatchObject({
      state: "SERVER_ERROR",
      title: "Não foi possível registrar seu ponto agora.",
      retrySubmittedRequest: true,
    });
    expect(`${feedback.title} ${feedback.description}`).not.toMatch(/Prisma|SELECT|secret_token|registerMobilePunch/i);
  });

  it("mostra no comprovante somente o horário oficial retornado pelo servidor", () => {
    expect(formatOfficialMobilePunchTime("2026-08-20T10:03:00.000Z")).toBe("07:03");
  });
});
