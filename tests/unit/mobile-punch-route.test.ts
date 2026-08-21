import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { MobileAttendanceError } from "@/modules/mobile-attendance/application/errors";

const testRuntime = vi.hoisted(() => ({ failure: undefined as unknown }));

vi.mock("@/modules/mobile-attendance/application/mobile-attendance-service", () => ({
  registerMobilePunch: async () => { throw testRuntime.failure; },
  mobilePunchSupportCode: (requestId: string) => `MP-${requestId.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
}));

const { POST } = await import("@/app/api/mobile-punch/route");

function requestWithId(requestId = randomUUID()) {
  return new Request("http://localhost/api/mobile-punch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });
}

describe("POST /api/mobile-punch safe failure response", () => {
  it("retorna código e referência seguros para uma recusa conhecida, sem mensagem interna", async () => {
    testRuntime.failure = new MobileAttendanceError("PIN_INVALID", "MP-AB12CD34");

    const response = await POST(requestWithId());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: "PIN_INVALID", supportCode: "MP-AB12CD34" });
    expect(body).not.toHaveProperty("error");
  });

  it("não expõe stack ou mensagem de uma falha inesperada", async () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    testRuntime.failure = new Error("PrismaClientKnownRequestError: SELECT secret_token\\n    at registerMobilePunch");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(requestWithId(requestId));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toEqual({ code: "UNAVAILABLE", supportCode: "MP-11111111" });
    expect(JSON.stringify(body)).not.toMatch(/Prisma|SELECT|secret_token|registerMobilePunch/i);
    expect(errorSpy).toHaveBeenCalledWith("[mobile-punch]", { code: "UNAVAILABLE", supportCode: "MP-11111111" });
    errorSpy.mockRestore();
  });
});
