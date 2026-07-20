import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isolated = process.env.TEST_DATABASE_ISOLATED === "true" && Boolean(testDatabaseUrl);
const suite = isolated ? describe : describe.skip;
const suffix = randomUUID();
const ids = {
  unit: `it-unit-${suffix}`,
  department: `it-department-${suffix}`,
  position: `it-position-${suffix}`,
  tag: `it-tag-${suffix}`,
  employee: `it-employee-${suffix}`,
  schedule: `it-schedule-${suffix}`,
  device: `it-device-${suffix}`,
  link: `it-link-${suffix}`,
};
const prisma = testDatabaseUrl ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) }) : undefined;

suite("integração isolada de gestão de funcionários", () => {
  beforeAll(async () => {
    if (!prisma) return;
    await prisma.unit.create({ data: { id: ids.unit, name: `Unidade sintética ${suffix}` } });
    await prisma.department.create({ data: { id: ids.department, name: `Setor sintético ${suffix}` } });
    await prisma.position.create({ data: { id: ids.position, name: `Cargo sintético ${suffix}` } });
    await prisma.employeeTag.create({ data: { id: ids.tag, name: `Tag sintética ${suffix}` } });
    await prisma.employee.create({ data: { id: ids.employee, fullName: "Pessoa de teste sintética", employmentType: "EMPLOYEE", status: "ACTIVE", provisional: false, admissionDate: new Date("2026-07-01T00:00:00.000Z"), unitId: ids.unit, departmentId: ids.department, positionId: ids.position } });
    await prisma.employeeTagAssignment.create({ data: { employeeId: ids.employee, employeeTagId: ids.tag } });
    await prisma.scheduleTemplate.create({
      data: {
        id: ids.schedule,
        name: `Jornada sintética ${suffix}`,
        days: { createMany: { data: Array.from({ length: 7 }, (_, weekday) => ({ weekday, isWorkingDay: weekday > 0 && weekday < 6, expectedEntry: weekday > 0 && weekday < 6 ? "08:00" : null, expectedBreakStart: weekday > 0 && weekday < 6 ? "12:00" : null, expectedBreakEnd: weekday > 0 && weekday < 6 ? "13:00" : null, expectedExit: weekday > 0 && weekday < 6 ? "17:00" : null, expectedMinutes: weekday > 0 && weekday < 6 ? 480 : 0, expectedBreakMinutes: weekday > 0 && weekday < 6 ? 60 : 0, minimumBreakMinutes: weekday > 0 && weekday < 6 ? 30 : null, entryToleranceMinutes: 0, exitToleranceMinutes: 0, requiresBreak: weekday > 0 && weekday < 6, excessRequiresApproval: true })) } },
      },
    });
    await prisma.employeeScheduleAssignment.create({ data: { employeeId: ids.employee, scheduleTemplateId: ids.schedule, validFrom: new Date("2026-07-01T00:00:00.000Z"), reason: "Teste de integração isolado" } });
    await prisma.device.create({ data: { id: ids.device, deviceUid: `device-${suffix}`, name: "Dispositivo sintético" } });
    await prisma.employeeDeviceLink.create({ data: { id: ids.link, employeeId: ids.employee, deviceId: ids.device, externalEmployeeNumber: `en-${suffix}`, validFrom: new Date("2026-07-01T00:00:00.000Z"), active: true } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.employeeDeviceLink.deleteMany({ where: { id: ids.link } });
    await prisma.employeeScheduleAssignment.deleteMany({ where: { employeeId: ids.employee } });
    await prisma.employeeTagAssignment.deleteMany({ where: { employeeId: ids.employee } });
    await prisma.employee.deleteMany({ where: { id: ids.employee } });
    await prisma.scheduleTemplateDay.deleteMany({ where: { scheduleTemplateId: ids.schedule } });
    await prisma.scheduleTemplate.deleteMany({ where: { id: ids.schedule } });
    await prisma.device.deleteMany({ where: { id: ids.device } });
    await prisma.employeeTag.deleteMany({ where: { id: ids.tag } });
    await prisma.position.deleteMany({ where: { id: ids.position } });
    await prisma.department.deleteMany({ where: { id: ids.department } });
    await prisma.unit.deleteMany({ where: { id: ids.unit } });
    await prisma.$disconnect();
  });

  it("persiste CRUD estruturado, tag, vínculo, jornada e consulta paginada", async () => {
    if (!prisma) return;
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: ids.employee }, include: { unit: true, department: true, position: true, tagAssignments: true, deviceLinks: true, scheduleAssignments: true } });
    expect(employee.unit?.id).toBe(ids.unit);
    expect(employee.department?.id).toBe(ids.department);
    expect(employee.position?.id).toBe(ids.position);
    expect(employee.tagAssignments).toHaveLength(1);
    expect(employee.deviceLinks).toHaveLength(1);
    expect(employee.scheduleAssignments).toHaveLength(1);
    expect(await prisma.employee.findMany({ where: { unitId: ids.unit }, take: 25, skip: 0 })).toHaveLength(1);
  });
});
