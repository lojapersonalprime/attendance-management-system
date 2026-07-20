import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { directoryEntrySchema } from "@/modules/employees/domain/validation";

export type DirectoryKind = "UNIT" | "DEPARTMENT" | "POSITION" | "TAG";

const directoryLabels: Record<DirectoryKind, string> = {
  UNIT: "Unidade",
  DEPARTMENT: "Setor",
  POSITION: "Cargo",
  TAG: "Tag",
};

export async function saveDirectoryEntry(input: {
  kind: DirectoryKind;
  id?: string;
  name: string;
  description?: string;
  context: AuditContext;
}) {
  const parsed = directoryEntrySchema.parse({ name: input.name, description: input.description });
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const data = { name: parsed.name, description: parsed.description ?? null };
    const isNew = !input.id;
    switch (input.kind) {
      case "UNIT": {
        const previous = input.id ? await transaction.unit.findUniqueOrThrow({ where: { id: input.id } }) : undefined;
        const entity = input.id ? await transaction.unit.update({ where: { id: input.id }, data }) : await transaction.unit.create({ data });
        await writeAuditLog(transaction, input.context, { action: isNew ? "UNIT_CREATED" : "UNIT_UPDATED", entityType: "Unit", entityId: entity.id, oldData: previous, newData: entity });
        return entity;
      }
      case "DEPARTMENT": {
        const previous = input.id ? await transaction.department.findUniqueOrThrow({ where: { id: input.id } }) : undefined;
        const entity = input.id ? await transaction.department.update({ where: { id: input.id }, data }) : await transaction.department.create({ data });
        await writeAuditLog(transaction, input.context, { action: isNew ? "DEPARTMENT_CREATED" : "DEPARTMENT_UPDATED", entityType: "Department", entityId: entity.id, oldData: previous, newData: entity });
        return entity;
      }
      case "POSITION": {
        const previous = input.id ? await transaction.position.findUniqueOrThrow({ where: { id: input.id } }) : undefined;
        const entity = input.id ? await transaction.position.update({ where: { id: input.id }, data }) : await transaction.position.create({ data });
        await writeAuditLog(transaction, input.context, { action: isNew ? "POSITION_CREATED" : "POSITION_UPDATED", entityType: "Position", entityId: entity.id, oldData: previous, newData: entity });
        return entity;
      }
      case "TAG": {
        const previous = input.id ? await transaction.employeeTag.findUniqueOrThrow({ where: { id: input.id } }) : undefined;
        const entity = input.id ? await transaction.employeeTag.update({ where: { id: input.id }, data }) : await transaction.employeeTag.create({ data });
        await writeAuditLog(transaction, input.context, { action: isNew ? "EMPLOYEE_TAG_CREATED" : "EMPLOYEE_TAG_UPDATED", entityType: "EmployeeTag", entityId: entity.id, oldData: previous, newData: entity });
        return entity;
      }
    }
  });
}

export async function setDirectoryEntryActive(input: { kind: DirectoryKind; id: string; active: boolean; reason?: string; context: AuditContext }) {
  if (!input.active && !input.reason?.trim()) throw new Error(`Informe o motivo para inativar ${directoryLabels[input.kind].toLowerCase()}.`);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    switch (input.kind) {
      case "UNIT": {
        const previous = await transaction.unit.findUniqueOrThrow({ where: { id: input.id } });
        const entity = await transaction.unit.update({ where: { id: input.id }, data: { active: input.active } });
        await writeAuditLog(transaction, input.context, { action: input.active ? "UNIT_ACTIVATED" : "UNIT_DEACTIVATED", entityType: "Unit", entityId: entity.id, oldData: previous, newData: entity, reason: input.reason });
        return entity;
      }
      case "DEPARTMENT": {
        const previous = await transaction.department.findUniqueOrThrow({ where: { id: input.id } });
        const entity = await transaction.department.update({ where: { id: input.id }, data: { active: input.active } });
        await writeAuditLog(transaction, input.context, { action: input.active ? "DEPARTMENT_ACTIVATED" : "DEPARTMENT_DEACTIVATED", entityType: "Department", entityId: entity.id, oldData: previous, newData: entity, reason: input.reason });
        return entity;
      }
      case "POSITION": {
        const previous = await transaction.position.findUniqueOrThrow({ where: { id: input.id } });
        const entity = await transaction.position.update({ where: { id: input.id }, data: { active: input.active } });
        await writeAuditLog(transaction, input.context, { action: input.active ? "POSITION_ACTIVATED" : "POSITION_DEACTIVATED", entityType: "Position", entityId: entity.id, oldData: previous, newData: entity, reason: input.reason });
        return entity;
      }
      case "TAG": {
        const previous = await transaction.employeeTag.findUniqueOrThrow({ where: { id: input.id } });
        const entity = await transaction.employeeTag.update({ where: { id: input.id }, data: { active: input.active } });
        await writeAuditLog(transaction, input.context, { action: input.active ? "EMPLOYEE_TAG_ACTIVATED" : "EMPLOYEE_TAG_DEACTIVATED", entityType: "EmployeeTag", entityId: entity.id, oldData: previous, newData: entity, reason: input.reason });
        return entity;
      }
    }
  });
}

export async function setEmployeeTag(input: { employeeId: string; tagId: string; assigned: boolean; reason?: string; context: AuditContext }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { id: true, status: true } });
    if (employee.status === "MERGED") throw new Error("Cadastros mesclados não podem receber novas tags.");
    const tag = await transaction.employeeTag.findUniqueOrThrow({ where: { id: input.tagId } });
    if (input.assigned && !tag.active) throw new Error("Reative a tag antes de vinculá-la a um funcionário.");
    if (input.assigned) {
      const assignment = await transaction.employeeTagAssignment.upsert({
        where: { employeeId_employeeTagId: { employeeId: input.employeeId, employeeTagId: input.tagId } },
        create: { employeeId: input.employeeId, employeeTagId: input.tagId },
        update: {},
      });
      await writeAuditLog(transaction, input.context, { action: "EMPLOYEE_TAG_ASSIGNED", entityType: "EmployeeTagAssignment", entityId: assignment.id, newData: { employeeId: input.employeeId, tagId: input.tagId }, reason: input.reason });
      return assignment;
    }
    const assignment = await transaction.employeeTagAssignment.findUnique({ where: { employeeId_employeeTagId: { employeeId: input.employeeId, employeeTagId: input.tagId } } });
    if (!assignment) return null;
    await transaction.employeeTagAssignment.delete({ where: { id: assignment.id } });
    await writeAuditLog(transaction, input.context, { action: "EMPLOYEE_TAG_REMOVED", entityType: "EmployeeTagAssignment", entityId: assignment.id, oldData: { employeeId: input.employeeId, tagId: input.tagId }, reason: input.reason });
    return assignment;
  });
}
