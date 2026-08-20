import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MobilePunch persistence contract", () => {
  it("is additive, idempotent and has no mutable update timestamp", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const model = schema.match(/model MobilePunch \{([\s\S]*?)^\}/m)?.[1] ?? "";
    expect(model).toMatch(/requestId\s+String\s+@unique\s+@db\.Uuid/);
    expect(model).toContain("receiptHash");
    expect(model).not.toContain("updatedAt");
    expect(schema).toContain("model RawPunch {");
    const placeSearchMigration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260808120000_authorized_location_place_search/migration.sql"), "utf8");
    expect(placeSearchMigration).toContain("ALTER TABLE \"AuthorizedLocation\"");
    expect(placeSearchMigration).not.toContain("RawPunch");
    expect(placeSearchMigration).not.toContain("MobilePunch");
    const mobileAccessMigration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260810150000_employee_mobile_access_authorized_location/migration.sql"), "utf8");
    expect(mobileAccessMigration).toContain("EmployeeMobileAccess");
    expect(mobileAccessMigration).not.toContain("RawPunch");
    expect(mobileAccessMigration).not.toContain("MobilePunch");
  });

  it("serializa batidas concorrentes, reutiliza o guard de competência e preserva o UUID após falha de rede", () => {
    const service = readFileSync(resolve(process.cwd(), "src/modules/mobile-attendance/application/mobile-attendance-service.ts"), "utf8");
    const register = service.slice(service.indexOf("export async function registerMobilePunch"), service.indexOf("export async function createAttendanceCorrectionRequest"));
    const client = readFileSync(resolve(process.cwd(), "src/components/mobile-attendance/mobile-punch-register.tsx"), "utf8");
    expect(register).toContain("assertOpenCalculationMonths(transaction, closedPeriodGuardInput)");
    expect(register.indexOf("assertOpenCalculationMonths(transaction, closedPeriodGuardInput)")).toBeLessThan(register.indexOf("transaction.mobilePunch.create"));
    expect(register).toContain('isolationLevel: "Serializable"');
    expect(register).toContain("pinFailedAttempts: { increment: 0 }");
    expect(register).toContain("mobilePunchDuplicateWindowStart");
    expect(register).toContain('action: "MOBILE_PUNCH_DUPLICATE_BLOCKED"');
    expect(client).toContain("retryPendingRequest");
    expect(client).toContain("Confirmar novamente");
    expect(client).toContain("const currentRequestId = requestId.current ?? crypto.randomUUID()");
    expect(client).toContain("requestId.current = currentRequestId");
    expect(client).toContain("onClick={() => void register()}");
    expect(client).toContain("requestId.current = crypto.randomUUID()");
  });

  it("devolve somente o status de bloqueio necessário para orientar a pessoa", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/mobile-punch/route.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "src/modules/mobile-attendance/application/mobile-attendance-service.ts"), "utf8");
    expect(route).toContain("locationStatus: known ? error.details?.locationStatus : undefined");
    expect(service).toContain('new MobileAttendanceError(\n      "LOCATION_BLOCKED"');
    expect(service).toContain("locationStatus === \"INSIDE_RADIUS\" ? undefined : { locationStatus }");
  });
});
