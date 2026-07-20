import "server-only";

import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { recalculateEmployeePeriod } from "@/modules/calculations/application/controlled-recalculation";
import { setEmployeeTag } from "@/modules/employees/application/directory-service";
import { setEmployeeStatus } from "@/modules/employees/application/employee-service";
import { assignScheduleToEmployee } from "@/modules/schedules/application/schedule-service";
import { employmentTypeSchema, manageableEmployeeStatusSchema } from "@/modules/employees/domain/validation";

export const bulkEmployeeActions = ["EMPLOYMENT_TYPE", "UNIT", "DEPARTMENT", "POSITION", "ADD_TAG", "REMOVE_TAG", "SCHEDULE", "STATUS", "RECALCULATE"] as const;
export type BulkEmployeeAction = (typeof bulkEmployeeActions)[number];

export interface BulkEmployeeInput {
  employeeIds: string[];
  action: unknown;
  value?: string;
  terminationDate?: string;
  reason?: string;
  schedule?: unknown;
  period?: { validFrom: string; validUntil: string };
}

function requiresReason(action: BulkEmployeeAction) {
  return action === "SCHEDULE" || action === "STATUS" || action === "RECALCULATE" || action === "REMOVE_TAG";
}

function parseBulkEmployeeAction(value: unknown): BulkEmployeeAction {
  if (typeof value === "string") {
    for (const action of bulkEmployeeActions) {
      if (action === value) return action;
    }
  }
  throw new Error("Ação em lote inválida.");
}

async function assertReferenceActive(action: "UNIT" | "DEPARTMENT" | "POSITION", id: string) {
  const prisma = getPrisma();
  const entity = action === "UNIT"
    ? await prisma.unit.findUnique({ where: { id }, select: { active: true } })
    : action === "DEPARTMENT"
      ? await prisma.department.findUnique({ where: { id }, select: { active: true } })
      : await prisma.position.findUnique({ where: { id }, select: { active: true } });
  if (!entity?.active) throw new Error("A referência escolhida não existe ou está inativa.");
}

async function updateEmployeeField(input: { employeeId: string; field: "employmentType" | "unitId" | "departmentId" | "positionId"; value: string; action: string; context: AuditContext; reason?: string }) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { id: true, status: true, employmentType: true, unitId: true, departmentId: true, positionId: true } });
    if (previous.status === "MERGED") throw new Error("Cadastro mesclado não pode receber alteração em lote.");
    const employee = await transaction.employee.update({ where: { id: input.employeeId }, data: { [input.field]: input.value } });
    await writeAuditLog(transaction, input.context, { action: input.action, entityType: "Employee", entityId: employee.id, oldData: previous, newData: { field: input.field, value: input.value }, reason: input.reason });
  });
}

/** Processes employees independently: one conflict is reported without undoing valid selected records. */
export async function executeBulkEmployeeAction(input: BulkEmployeeInput, context: AuditContext) {
  const action = parseBulkEmployeeAction(input.action);
  const employeeIds = [...new Set(input.employeeIds.filter(Boolean))];
  if (employeeIds.length === 0) throw new Error("Selecione ao menos um funcionário.");
  if (employeeIds.length > 100) throw new Error("A ação em lote aceita no máximo 100 funcionários por vez.");
  if (requiresReason(action) && !input.reason?.trim()) throw new Error("Informe o motivo desta ação em lote.");
  if (["EMPLOYMENT_TYPE", "UNIT", "DEPARTMENT", "POSITION", "ADD_TAG", "REMOVE_TAG", "STATUS"].includes(action) && !input.value) {
    throw new Error("Informe o valor a aplicar na ação em lote.");
  }
  if (action === "EMPLOYMENT_TYPE") employmentTypeSchema.parse(input.value);
  if (action === "STATUS") manageableEmployeeStatusSchema.parse(input.value);
  if (action === "UNIT") await assertReferenceActive("UNIT", input.value ?? "");
  if (action === "DEPARTMENT") await assertReferenceActive("DEPARTMENT", input.value ?? "");
  if (action === "POSITION") await assertReferenceActive("POSITION", input.value ?? "");

  const actionId = randomUUID();
  const prisma = getPrisma();
  await prisma.$transaction((transaction) => writeAuditLog(transaction, context, { action: "BULK_EMPLOYEE_ACTION_REQUESTED", entityType: "EmployeeBulkAction", entityId: actionId, newData: { action, employeeCount: employeeIds.length }, reason: input.reason }));
  const succeeded: string[] = [];
  const failures: Array<{ employeeId: string; message: string }> = [];
  for (const employeeId of employeeIds) {
    try {
      switch (action) {
        case "EMPLOYMENT_TYPE":
          await updateEmployeeField({ employeeId, field: "employmentType", value: input.value ?? "EMPLOYEE", action: "EMPLOYEE_EMPLOYMENT_TYPE_CHANGED", context, reason: input.reason });
          break;
        case "UNIT":
          await updateEmployeeField({ employeeId, field: "unitId", value: input.value ?? "", action: "EMPLOYEE_UNIT_CHANGED", context, reason: input.reason });
          break;
        case "DEPARTMENT":
          await updateEmployeeField({ employeeId, field: "departmentId", value: input.value ?? "", action: "EMPLOYEE_DEPARTMENT_CHANGED", context, reason: input.reason });
          break;
        case "POSITION":
          await updateEmployeeField({ employeeId, field: "positionId", value: input.value ?? "", action: "EMPLOYEE_POSITION_CHANGED", context, reason: input.reason });
          break;
        case "ADD_TAG":
          await setEmployeeTag({ employeeId, tagId: input.value ?? "", assigned: true, reason: input.reason, context });
          break;
        case "REMOVE_TAG":
          await setEmployeeTag({ employeeId, tagId: input.value ?? "", assigned: false, reason: input.reason, context });
          break;
        case "STATUS":
          await setEmployeeStatus({ employeeId, status: input.value, terminationDate: input.terminationDate, reason: input.reason ?? "Ação em lote", context });
          break;
        case "SCHEDULE":
          await assignScheduleToEmployee({ employeeId, value: input.schedule, context });
          break;
        case "RECALCULATE":
          if (!input.period) throw new Error("Informe o período a recalcular.");
          await recalculateEmployeePeriod({ employeeId, validFrom: input.period.validFrom, validUntil: input.period.validUntil, reason: input.reason ?? "Ação em lote", context });
          break;
      }
      succeeded.push(employeeId);
    } catch (error) {
      failures.push({ employeeId, message: error instanceof Error ? error.message : "Falha não identificada." });
    }
  }
  await prisma.$transaction((transaction) => writeAuditLog(transaction, context, { action: "BULK_EMPLOYEE_ACTION_COMPLETED", entityType: "EmployeeBulkAction", entityId: actionId, newData: { action, succeeded: succeeded.length, failed: failures.length, failedEmployeeIds: failures.map((failure) => failure.employeeId) }, reason: input.reason }));
  return { actionId, succeeded, failures };
}
