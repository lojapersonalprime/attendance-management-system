import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import {
  completeProvisionalEmployeeSchema,
  employeeInputSchema,
  employeeStatusChangeSchema,
  type CompleteProvisionalEmployeeInput,
  type EmployeeInput,
} from "@/modules/employees/domain/validation";

function dateOnly(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

function employeeAuditSnapshot(employee: {
  id: string;
  fullName: string;
  clockNameRaw: string | null;
  registration: string | null;
  cpf: string | null;
  employmentType: string;
  status: string;
  positionId: string | null;
  departmentId: string | null;
  unitId: string | null;
  admissionDate: Date | null;
  terminationDate: Date | null;
  provisional: boolean;
  notes: string | null;
  mergedIntoId: string | null;
}) {
  return {
    id: employee.id,
    fullName: employee.fullName,
    clockNameRaw: employee.clockNameRaw,
    registration: employee.registration,
    cpf: employee.cpf,
    employmentType: employee.employmentType,
    status: employee.status,
    positionId: employee.positionId,
    departmentId: employee.departmentId,
    unitId: employee.unitId,
    admissionDate: employee.admissionDate,
    terminationDate: employee.terminationDate,
    provisional: employee.provisional,
    notes: employee.notes,
    mergedIntoId: employee.mergedIntoId,
  };
}

async function assertIdentityAvailable(transaction: Prisma.TransactionClient, input: EmployeeInput, employeeId?: string) {
  if (input.registration) {
    const existing = await transaction.employee.findUnique({ where: { registration: input.registration }, select: { id: true } });
    if (existing && existing.id !== employeeId) throw new Error("Já existe um funcionário com esta matrícula.");
  }
  if (input.cpf) {
    const existing = await transaction.employee.findUnique({ where: { cpf: input.cpf }, select: { id: true } });
    if (existing && existing.id !== employeeId) throw new Error("Já existe um funcionário com este CPF.");
  }
}

async function assertReferenceIsActive(
  transaction: Prisma.TransactionClient,
  type: "unit" | "department" | "position",
  id: string | undefined,
  existingId?: string | null,
) {
  if (!id || id === existingId) return;
  const entity = type === "unit"
    ? await transaction.unit.findUnique({ where: { id }, select: { active: true } })
    : type === "department"
      ? await transaction.department.findUnique({ where: { id }, select: { active: true } })
      : await transaction.position.findUnique({ where: { id }, select: { active: true } });
  if (!entity) throw new Error("A referência selecionada não existe.");
  if (!entity.active) throw new Error("Não é possível fazer nova associação com um cadastro inativo.");
}

async function assertTagIdsAreActive(transaction: Prisma.TransactionClient, tagIds: readonly string[]) {
  if (tagIds.length === 0) return;
  const tags = await transaction.employeeTag.findMany({ where: { id: { in: [...new Set(tagIds)] }, active: true }, select: { id: true } });
  if (tags.length !== new Set(tagIds).size) throw new Error("Uma ou mais tags não existem ou estão inativas.");
}

function employeeData(input: EmployeeInput): Prisma.EmployeeUncheckedCreateInput {
  return {
    fullName: input.fullName,
    clockNameRaw: input.clockNameRaw ?? null,
    registration: input.registration ?? null,
    cpf: input.cpf ?? null,
    employmentType: input.employmentType,
    status: input.status,
    positionId: input.positionId ?? null,
    departmentId: input.departmentId ?? null,
    unitId: input.unitId ?? null,
    admissionDate: dateOnly(input.admissionDate),
    terminationDate: dateOnly(input.terminationDate),
    notes: input.notes ?? null,
  };
}

export async function createManualEmployee(input: unknown, context: AuditContext) {
  const parsed = employeeInputSchema.parse(input);
  if (!parsed.admissionDate) throw new Error("Informe a data de admissão para criar o funcionário.");
  if (!parsed.unitId) throw new Error("Informe a unidade para criar o funcionário.");
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    await assertIdentityAvailable(transaction, parsed);
    await assertReferenceIsActive(transaction, "unit", parsed.unitId);
    await assertReferenceIsActive(transaction, "department", parsed.departmentId);
    await assertReferenceIsActive(transaction, "position", parsed.positionId);
    await assertTagIdsAreActive(transaction, parsed.tagIds);
    const employee = await transaction.employee.create({ data: { ...employeeData(parsed), provisional: false } });
    if (parsed.tagIds.length > 0) {
      await transaction.employeeTagAssignment.createMany({ data: [...new Set(parsed.tagIds)].map((employeeTagId) => ({ employeeId: employee.id, employeeTagId })), skipDuplicates: true });
    }
    await writeAuditLog(transaction, context, { action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: employee.id, newData: employeeAuditSnapshot(employee) });
    return employee;
  });
}

export async function updateEmployee(employeeId: string, input: unknown, context: AuditContext) {
  const parsed = employeeInputSchema.parse(input);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.employee.findUniqueOrThrow({ where: { id: employeeId } });
    if (previous.status === "MERGED") throw new Error("Cadastros mesclados não podem ser editados.");
    await assertIdentityAvailable(transaction, parsed, employeeId);
    await assertReferenceIsActive(transaction, "unit", parsed.unitId, previous.unitId);
    await assertReferenceIsActive(transaction, "department", parsed.departmentId, previous.departmentId);
    await assertReferenceIsActive(transaction, "position", parsed.positionId, previous.positionId);
    await assertTagIdsAreActive(transaction, parsed.tagIds);
    const employee = await transaction.employee.update({
      where: { id: employeeId },
      data: {
        ...employeeData(parsed),
        provisional: previous.provisional,
      },
    });
    const currentTagIds = (await transaction.employeeTagAssignment.findMany({ where: { employeeId }, select: { employeeTagId: true } })).map((assignment) => assignment.employeeTagId);
    const requestedTagIds = [...new Set(parsed.tagIds)];
    const removedTagIds = currentTagIds.filter((tagId) => !requestedTagIds.includes(tagId));
    const addedTagIds = requestedTagIds.filter((tagId) => !currentTagIds.includes(tagId));
    if (removedTagIds.length > 0) await transaction.employeeTagAssignment.deleteMany({ where: { employeeId, employeeTagId: { in: removedTagIds } } });
    if (addedTagIds.length > 0) await transaction.employeeTagAssignment.createMany({ data: addedTagIds.map((employeeTagId) => ({ employeeId, employeeTagId })), skipDuplicates: true });
    await writeAuditLog(transaction, context, {
      action: "EMPLOYEE_UPDATED",
      entityType: "Employee",
      entityId: employee.id,
      oldData: employeeAuditSnapshot(previous),
      newData: { ...employeeAuditSnapshot(employee), addedTagIds, removedTagIds },
    });
    return employee;
  });
}

export async function completeProvisionalEmployee(employeeId: string, input: unknown, context: AuditContext) {
  const parsed: CompleteProvisionalEmployeeInput = completeProvisionalEmployeeSchema.parse(input);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { deviceLinks: { orderBy: { validFrom: "asc" }, take: 1 } } });
    if (previous.status === "MERGED") throw new Error("Cadastros mesclados não podem ser completados.");
    await assertIdentityAvailable(transaction, parsed, employeeId);
    await assertReferenceIsActive(transaction, "unit", parsed.unitId, previous.unitId);
    await assertReferenceIsActive(transaction, "department", parsed.departmentId, previous.departmentId);
    await assertReferenceIsActive(transaction, "position", parsed.positionId, previous.positionId);
    await assertTagIdsAreActive(transaction, parsed.tagIds);
    const employee = await transaction.employee.update({
      where: { id: employeeId },
      data: {
        ...employeeData(parsed),
        clockNameRaw: previous.clockNameRaw ?? previous.deviceLinks[0]?.externalEmployeeName ?? null,
        provisional: false,
      },
    });
    if (parsed.tagIds.length > 0) await transaction.employeeTagAssignment.createMany({ data: [...new Set(parsed.tagIds)].map((employeeTagId) => ({ employeeId, employeeTagId })), skipDuplicates: true });
    await writeAuditLog(transaction, context, {
      action: "EMPLOYEE_PROVISIONAL_COMPLETED",
      entityType: "Employee",
      entityId: employee.id,
      oldData: employeeAuditSnapshot(previous),
      newData: employeeAuditSnapshot(employee),
    });
    return employee;
  });
}

export async function setEmployeeStatus(input: { employeeId: string; status: unknown; terminationDate?: unknown; reason: unknown; context: AuditContext }) {
  const parsed = employeeStatusChangeSchema.parse({
    status: input.status,
    terminationDate: input.terminationDate,
    reason: input.reason,
  });
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.employee.findUniqueOrThrow({ where: { id: input.employeeId } });
    if (previous.status === "MERGED") throw new Error("Cadastros mesclados não podem receber alteração de status.");
    const employee = await transaction.employee.update({
      where: { id: input.employeeId },
      data: { status: parsed.status, terminationDate: parsed.status === "TERMINATED" ? dateOnly(parsed.terminationDate) : previous.terminationDate },
    });
    await writeAuditLog(transaction, input.context, { action: "EMPLOYEE_STATUS_CHANGED", entityType: "Employee", entityId: employee.id, oldData: employeeAuditSnapshot(previous), newData: employeeAuditSnapshot(employee), reason: parsed.reason });
    return employee;
  });
}

export async function assertEmployeeCanReceiveChanges(employeeId: string) {
  const employee = await getPrisma().employee.findUniqueOrThrow({ where: { id: employeeId }, select: { status: true } });
  if (employee.status === "MERGED") throw new Error("Cadastros mesclados mantêm histórico, mas não recebem novas alterações.");
  return employee;
}
