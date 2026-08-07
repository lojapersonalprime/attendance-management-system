import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { employmentTypes, employeeStatuses } from "@/modules/employees/domain/validation";
import { actionableInconsistencyStatuses } from "@/modules/inconsistencies/domain/status";

const pageSize = 25;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function asPage(value?: string) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function enumValue<T extends readonly string[]>(values: T, value?: string): T[number] | undefined {
  return value && values.includes(value) ? value as T[number] : undefined;
}

export interface EmployeeListParams {
  q?: string;
  registration?: string;
  enNo?: string;
  employmentType?: string;
  status?: string;
  provisional?: string;
  unitId?: string;
  departmentId?: string;
  positionId?: string;
  scheduleTemplateId?: string;
  tagId?: string;
  page?: string;
}

export async function listEmployees(params: EmployeeListParams) {
  const today = dateOnly(toBusinessDate(new Date()));
  const filters: Prisma.EmployeeWhereInput[] = [{ status: { not: "MERGED" } }];
  const q = params.q?.trim();
  if (q) filters.push({ OR: [{ fullName: { contains: q, mode: "insensitive" } }, { registration: { contains: q, mode: "insensitive" } }, { deviceLinks: { some: { externalEmployeeNumber: { contains: q } } } }] });
  if (params.registration?.trim()) filters.push({ registration: { contains: params.registration.trim(), mode: "insensitive" } });
  if (params.enNo?.trim()) filters.push({ deviceLinks: { some: { externalEmployeeNumber: { contains: params.enNo.trim() } } } });
  const employmentType = enumValue(employmentTypes, params.employmentType);
  if (employmentType) filters.push({ employmentType });
  const status = enumValue(employeeStatuses, params.status);
  if (status) filters.push({ status });
  if (params.provisional === "true") filters.push({ provisional: true });
  if (params.provisional === "false") filters.push({ provisional: false });
  if (params.unitId) filters.push({ unitId: params.unitId });
  if (params.departmentId) filters.push({ departmentId: params.departmentId });
  if (params.positionId) filters.push({ positionId: params.positionId });
  if (params.scheduleTemplateId) filters.push({ scheduleAssignments: { some: { scheduleTemplateId: params.scheduleTemplateId, validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }] } } });
  if (params.tagId) filters.push({ tagAssignments: { some: { employeeTagId: params.tagId } } });
  const where = { AND: filters } satisfies Prisma.EmployeeWhereInput;
  const page = asPage(params.page);
  const prisma = getPrisma();
  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: [{ provisional: "desc" }, { fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        unit: { select: { name: true } },
        department: { select: { name: true } },
        position: { select: { name: true } },
        tagAssignments: { include: { employeeTag: { select: { name: true } } } },
        deviceLinks: { orderBy: { validFrom: "desc" }, select: { externalEmployeeNumber: true, active: true, rawPunches: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } } } },
        scheduleAssignments: { where: { validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }] }, orderBy: { validFrom: "desc" }, take: 1, include: { scheduleTemplate: { select: { name: true } } } },
      },
    }),
  ]);
  return { employees, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getEmployeeFormOptions() {
  const prisma = getPrisma();
  const [units, departments, positions, tags, schedules, devices, calculationPolicies] = await Promise.all([
    prisma.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.position.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.employeeTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.scheduleTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.device.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
    prisma.calculationPolicy.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
  ]);
  return { units, departments, positions, tags, schedules, devices, calculationPolicies };
}

export async function getEmployeeDetail(id: string) {
  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      unit: true,
      mobileAccess: { include: { profile: { select: { authUserId: true, email: true, name: true } }, allowedUnit: { select: { id: true, name: true } } } },
      department: true,
      position: true,
      mergedInto: { select: { id: true, fullName: true } },
      deviceLinks: { orderBy: { validFrom: "desc" }, include: { device: { select: { name: true, deviceUid: true } } } },
      tagAssignments: { include: { employeeTag: true }, orderBy: { createdAt: "desc" } },
      scheduleAssignments: { orderBy: { validFrom: "desc" }, include: { scheduleTemplate: { include: { days: { orderBy: { weekday: "asc" } } } }, createdBy: { select: { name: true } } } },
      employmentPeriods: { orderBy: { validFrom: "desc" }, include: { calculationPolicy: { select: { id: true, name: true, active: true } }, createdBy: { select: { name: true } } } },
      dailySummaries: { orderBy: { date: "desc" }, take: 90, include: { calculationRun: { select: { status: true } }, inconsistencies: { where: { status: { in: [...actionableInconsistencyStatuses] } }, select: { id: true, type: true, severity: true } } } },
      inconsistencies: { orderBy: { createdAt: "desc" }, take: 100, where: { status: { in: [...actionableInconsistencyStatuses] } } },
    },
  });
  if (!employee) return null;
  const [punches, auditLogs] = await Promise.all([
    prisma.rawPunch.findMany({ where: { employeeDeviceLink: { employeeId: id } }, orderBy: { occurredAt: "desc" }, take: 400, select: { id: true, occurredAt: true, punchCode: true, externalEmployeeNumber: true, employeeNameRaw: true, importFile: { select: { id: true, safeFilename: true, finishedAt: true, createdAt: true } } } }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Employee", entityId: id },
          { entityType: "EmployeeDeviceLink", entityId: { in: employee.deviceLinks.map((link) => link.id) } },
          { entityType: "EmployeeScheduleAssignment", entityId: { in: employee.scheduleAssignments.map((assignment) => assignment.id) } },
          { entityType: "EmployeeEmploymentPeriod", entityId: { in: employee.employmentPeriods.map((period) => period.id) } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true } } },
    }),
  ]);
  return { employee, punches, auditLogs };
}

export async function getEmployeeMergeCandidates(excludeId: string) {
  return getPrisma().employee.findMany({
    where: { id: { not: excludeId }, status: { not: "MERGED" } },
    orderBy: [{ provisional: "desc" }, { fullName: "asc" }],
    take: 100,
    select: { id: true, fullName: true, registration: true, provisional: true },
  });
}
