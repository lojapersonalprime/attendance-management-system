import { describe, expect, it } from "vitest";
import { mobilePunchEligibility } from "@/modules/mobile-attendance/domain/eligibility";
import { serverRegisteredAt } from "@/modules/mobile-attendance/domain/clock";
import { resolveMobilePunchRequest } from "@/modules/mobile-attendance/domain/idempotency";
import { hashPin, MAX_PIN_ATTEMPTS, nextPinFailureState, PIN_LOCK_MINUTES, verifyPin } from "@/modules/mobile-attendance/domain/pin";

describe("mobile attendance security", () => {
  it("guarda PIN com hash e valida sem expor o valor", async () => {
    const hash = await hashPin("123456");
    expect(hash).not.toContain("123456");
    await expect(verifyPin("123456", hash)).resolves.toBe(true);
    await expect(verifyPin("654321", hash)).resolves.toBe(false);
  });

  it("bloqueia depois de tentativas excessivas", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const result = nextPinFailureState(MAX_PIN_ATTEMPTS - 1, now);
    expect(result.pinFailedAttempts).toBe(MAX_PIN_ATTEMPTS);
    expect(result.pinLockedUntil?.getTime()).toBe(now.getTime() + PIN_LOCK_MINUTES * 60_000);
  });

  it("é idempotente apenas para o mesmo funcionário e acesso", () => {
    const existing = { employeeId: "employee-a", employeeMobileAccessId: "access-a", id: "punch" };
    expect(resolveMobilePunchRequest(existing, "employee-a", "access-a")).toMatchObject({ kind: "RETURN_EXISTING", punch: existing });
    expect(resolveMobilePunchRequest(existing, "employee-b", "access-b")).toEqual({ kind: "COLLISION" });
    expect(resolveMobilePunchRequest(null, "employee-a", "access-a")).toEqual({ kind: "CREATE" });
  });

  it("recusa feature desativada, funcionário desativado e unidade divergente", () => {
    const base = { featureEnabled: true, accessActive: true, employeeStatus: "ACTIVE", employeeProvisional: false, employeeUnitId: "golden", allowedUnitId: "golden", allowedUnitActive: true };
    expect(mobilePunchEligibility({ ...base, featureEnabled: false })).toBe("MOBILE_PUNCH_DISABLED");
    expect(mobilePunchEligibility({ ...base, employeeStatus: "INACTIVE" })).toBe("EMPLOYEE_NOT_ELIGIBLE");
    expect(mobilePunchEligibility({ ...base, employeeUnitId: "matriz" })).toBe("UNIT_MISMATCH");
    expect(mobilePunchEligibility(base)).toBeNull();
  });

  it("usa exclusivamente o horário do servidor como horário oficial", () => {
    const serverNow = new Date("2026-08-07T12:58:43.000Z");
    const official = serverRegisteredAt(serverNow);
    expect(official).toEqual(serverNow);
    expect(official).not.toBe(serverNow);
  });
});
