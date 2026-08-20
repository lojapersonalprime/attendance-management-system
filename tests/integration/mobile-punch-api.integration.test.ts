import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPin } from "@/modules/mobile-attendance/domain/pin";
import { toBusinessDate } from "@/lib/dates/business";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isolated = process.env.TEST_DATABASE_ISOLATED === "true" && Boolean(testDatabaseUrl);
const suite = isolated ? describe : describe.skip;
const suffix = randomUUID();
const testRuntime = vi.hoisted(() => ({
  prisma: undefined as PrismaClient | undefined,
  authUserId: "",
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => testRuntime.prisma }));
vi.mock("@/modules/auth/server/session", () => ({ getAuthenticatedUser: async () => ({ id: testRuntime.authUserId }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/modules/mobile-attendance/domain/feature-flag", () => ({
  isMobilePunchEnabled: () => true,
  requireMobilePunchReceiptSecret: () => "e2e-isolated-mobile-punch-receipt-secret",
}));
vi.mock("@/modules/calculations/application/calculation-run-service", () => ({
  runCalculation: async () => ({ processedDays: 0 }),
}));

const { POST } = await import("@/app/api/mobile-punch/route");
const prisma = testDatabaseUrl ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) }) : undefined;
const ids = {
  unit: `it-mobile-unit-${suffix}`,
  location: `it-mobile-location-${suffix}`,
  profiles: [] as string[],
  employees: [] as string[],
  accesses: [] as string[],
};

async function createEmployeeScenario() {
  if (!prisma) throw new Error("Banco de teste indisponível.");
  const id = randomUUID();
  const profileId = `it-mobile-profile-${id}`;
  const employeeId = `it-mobile-employee-${id}`;
  const accessId = `it-mobile-access-${id}`;
  const authUserId = `it-mobile-auth-${id}`;
  await prisma.profile.create({ data: { id: profileId, authUserId, name: "Colaboradora de teste", email: `mobile-${id}@example.test`, role: "EMPLOYEE", active: true } });
  await prisma.employee.create({ data: { id: employeeId, fullName: "Colaboradora de teste", employmentType: "EMPLOYEE", status: "ACTIVE", provisional: false, unitId: ids.unit } });
  await prisma.employeeMobileAccess.create({
    data: {
      id: accessId,
      profileId,
      employeeId,
      allowedUnitId: ids.unit,
      authorizedLocationId: ids.location,
      active: true,
      pinHash: await hashPin("123456"),
      pinConfiguredAt: new Date(),
      privacyAcceptedAt: new Date(),
    },
  });
  ids.profiles.push(profileId);
  ids.employees.push(employeeId);
  ids.accesses.push(accessId);
  testRuntime.authUserId = authUserId;
  return { employeeId };
}

function mobilePunchRequest(input: { requestId?: string; latitude?: number; longitude?: number; accuracyMeters?: number } = {}) {
  return new Request("http://localhost/api/mobile-punch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: input.requestId ?? randomUUID(),
      pin: "123456",
      latitude: input.latitude ?? -3.7319,
      longitude: input.longitude ?? -38.5267,
      accuracyMeters: input.accuracyMeters ?? 15,
      clientObservedAt: new Date().toISOString(),
      privacyAccepted: true,
    }),
  });
}

suite("integração isolada do POST /api/mobile-punch", () => {
  beforeAll(async () => {
    if (!prisma) return;
    testRuntime.prisma = prisma;
    await prisma.unit.create({ data: { id: ids.unit, name: `Unidade mobile sintética ${suffix}` } });
    await prisma.authorizedLocation.create({
      data: {
        id: ids.location,
        unitId: ids.unit,
        name: `Local mobile sintético ${suffix}`,
        latitude: -3.7319,
        longitude: -38.5267,
        radiusMeters: 150,
        maxAccuracyMeters: 100,
        exceptionPolicy: "BLOCK",
        active: true,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.mobilePunch.deleteMany({ where: { employeeId: { in: ids.employees } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids.profiles } } });
    await prisma.employeeMobileAccess.deleteMany({ where: { id: { in: ids.accesses } } });
    await prisma.employee.deleteMany({ where: { id: { in: ids.employees } } });
    await prisma.profile.deleteMany({ where: { id: { in: ids.profiles } } });
    await prisma.authorizedLocation.deleteMany({ where: { id: ids.location } });
    await prisma.unit.deleteMany({ where: { id: ids.unit } });
    await prisma.$disconnect();
  });

  it("POST válido e repetição do mesmo UUID persistem exatamente uma MobilePunch", async () => {
    if (!prisma) return;
    const { employeeId } = await createEmployeeScenario();
    const requestId = randomUUID();
    const first = await POST(mobilePunchRequest({ requestId }));
    const repeated = await POST(mobilePunchRequest({ requestId }));
    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect((await repeated.json()) as { duplicate: boolean }).toMatchObject({ duplicate: true });
    expect(await prisma.mobilePunch.count({ where: { employeeId } })).toBe(1);
  });

  it("dois UUIDs na janela de duplicidade bloqueiam a segunda marcação", async () => {
    if (!prisma) return;
    const { employeeId } = await createEmployeeScenario();
    expect((await POST(mobilePunchRequest())).status).toBe(200);
    const second = await POST(mobilePunchRequest());
    expect(second.status).toBe(400);
    expect((await second.json()) as { code: string }).toMatchObject({ code: "PUNCH_TOO_CLOSE" });
    expect(await prisma.mobilePunch.count({ where: { employeeId } })).toBe(1);
  });

  it("OUTSIDE_RADIUS com BLOCK não cria MobilePunch", async () => {
    if (!prisma) return;
    const { employeeId } = await createEmployeeScenario();
    const response = await POST(mobilePunchRequest({ latitude: -3.7019, longitude: -38.5267 }));
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string; locationStatus: string }).toMatchObject({ code: "LOCATION_BLOCKED", locationStatus: "OUTSIDE_RADIUS" });
    expect(await prisma.mobilePunch.count({ where: { employeeId } })).toBe(0);
  });

  it("LOW_ACCURACY com BLOCK não cria MobilePunch", async () => {
    if (!prisma) return;
    const { employeeId } = await createEmployeeScenario();
    const response = await POST(mobilePunchRequest({ accuracyMeters: 101 }));
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string; locationStatus: string }).toMatchObject({ code: "LOCATION_BLOCKED", locationStatus: "LOW_ACCURACY" });
    expect(await prisma.mobilePunch.count({ where: { employeeId } })).toBe(0);
  });

  it("competência fechada não cria MobilePunch", async () => {
    if (!prisma) return;
    const { employeeId } = await createEmployeeScenario();
    const referenceMonth = new Date(`${toBusinessDate(new Date()).slice(0, 7)}-01T00:00:00.000Z`);
    await prisma.closingPeriod.create({ data: { referenceMonth, status: "CLOSED" } });
    try {
      const response = await POST(mobilePunchRequest());
      expect(response.status).toBe(400);
      expect((await response.json()) as { code: string }).toMatchObject({ code: "CLOSED_PERIOD" });
      expect(await prisma.mobilePunch.count({ where: { employeeId } })).toBe(0);
    } finally {
      await prisma.closingPeriod.delete({ where: { referenceMonth } });
    }
  });
});
