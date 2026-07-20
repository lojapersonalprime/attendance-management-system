import "server-only";

import { subDays } from "date-fns";
import { getPrisma } from "@/lib/db/prisma";
import { toBusinessDate } from "@/lib/dates/business";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { requiresRetroactiveConfirmation } from "@/modules/calculations/domain/recalculation-window";
import { hasOverlappingScheduleAssignment } from "@/modules/schedules/domain/assignments";
import {
  scheduleAssignmentInputSchema,
  scheduleTemplateInputSchema,
  type ScheduleAssignmentInput,
  type ScheduleTemplateInput,
} from "@/modules/employees/domain/validation";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function scheduleDaysData(days: ScheduleTemplateInput["days"]) {
  return days.map((day) => ({
    weekday: day.weekday,
    isWorkingDay: day.isWorkingDay,
    expectedEntry: day.expectedEntry ?? null,
    expectedBreakStart: day.expectedBreakStart ?? null,
    expectedBreakEnd: day.expectedBreakEnd ?? null,
    expectedExit: day.expectedExit ?? null,
    expectedMinutes: day.expectedMinutes,
    expectedBreakMinutes: day.expectedBreakMinutes,
    minimumBreakMinutes: day.minimumBreakMinutes ?? null,
    entryToleranceMinutes: day.entryToleranceMinutes,
    exitToleranceMinutes: day.exitToleranceMinutes,
    requiresBreak: day.requiresBreak,
    excessRequiresApproval: day.excessRequiresApproval,
  }));
}

function versionName(name: string) {
  return `${name.slice(0, 95)} — versão ${new Date().toISOString().slice(0, 10)}`;
}

export async function saveScheduleTemplate(input: { id?: string; value: unknown; createVersion?: boolean; context: AuditContext }) {
  const parsed = scheduleTemplateInputSchema.parse(input.value);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    if (!input.id) {
      const template = await transaction.scheduleTemplate.create({ data: { name: parsed.name, description: parsed.description ?? null, active: parsed.active, days: { createMany: { data: scheduleDaysData(parsed.days) } } }, include: { days: true } });
      await writeAuditLog(transaction, input.context, { action: "SCHEDULE_TEMPLATE_CREATED", entityType: "ScheduleTemplate", entityId: template.id, newData: { id: template.id, name: template.name, active: template.active, days: template.days } });
      return template;
    }
    const previous = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: input.id }, include: { days: true, _count: { select: { assignments: true } } } });
    if (previous._count.assignments > 0) {
      if (!input.createVersion) throw new Error("Esta jornada possui histórico. Crie uma nova versão para não alterar o passado.");
      const name = parsed.name === previous.name ? versionName(parsed.name) : parsed.name;
      const template = await transaction.scheduleTemplate.create({ data: { name, description: parsed.description ?? null, active: parsed.active, days: { createMany: { data: scheduleDaysData(parsed.days) } } }, include: { days: true } });
      await writeAuditLog(transaction, input.context, { action: "SCHEDULE_TEMPLATE_VERSION_CREATED", entityType: "ScheduleTemplate", entityId: template.id, oldData: { sourceTemplateId: previous.id, sourceName: previous.name }, newData: { id: template.id, name: template.name, active: template.active, days: template.days } });
      return template;
    }
    await transaction.scheduleTemplateDay.deleteMany({ where: { scheduleTemplateId: input.id } });
    const template = await transaction.scheduleTemplate.update({
      where: { id: input.id },
      data: { name: parsed.name, description: parsed.description ?? null, active: parsed.active, days: { createMany: { data: scheduleDaysData(parsed.days) } } },
      include: { days: true },
    });
    await writeAuditLog(transaction, input.context, { action: "SCHEDULE_TEMPLATE_UPDATED", entityType: "ScheduleTemplate", entityId: template.id, oldData: { id: previous.id, name: previous.name, active: previous.active, days: previous.days }, newData: { id: template.id, name: template.name, active: template.active, days: template.days } });
    return template;
  });
}

export async function duplicateScheduleTemplate(id: string, context: AuditContext) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const source = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id }, include: { days: { orderBy: { weekday: "asc" } } } });
    const template = await transaction.scheduleTemplate.create({
      data: {
        name: `${source.name.slice(0, 108)} (cópia)`,
        description: source.description,
        active: source.active,
        days: { createMany: { data: source.days.map((day) => ({ weekday: day.weekday, isWorkingDay: day.isWorkingDay, expectedEntry: day.expectedEntry, expectedBreakStart: day.expectedBreakStart, expectedBreakEnd: day.expectedBreakEnd, expectedExit: day.expectedExit, expectedMinutes: day.expectedMinutes, expectedBreakMinutes: day.expectedBreakMinutes, minimumBreakMinutes: day.minimumBreakMinutes, entryToleranceMinutes: day.entryToleranceMinutes, exitToleranceMinutes: day.exitToleranceMinutes, requiresBreak: day.requiresBreak, excessRequiresApproval: day.excessRequiresApproval })) } },
      },
      include: { days: true },
    });
    await writeAuditLog(transaction, context, { action: "SCHEDULE_TEMPLATE_DUPLICATED", entityType: "ScheduleTemplate", entityId: template.id, oldData: { sourceTemplateId: source.id, sourceName: source.name }, newData: { id: template.id, name: template.name } });
    return template;
  });
}

export async function setScheduleTemplateActive(input: { id: string; active: boolean; reason?: string; context: AuditContext }) {
  if (!input.active && !input.reason?.trim()) throw new Error("Informe o motivo para inativar a jornada.");
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: input.id } });
    const template = await transaction.scheduleTemplate.update({ where: { id: input.id }, data: { active: input.active } });
    await writeAuditLog(transaction, input.context, { action: input.active ? "SCHEDULE_TEMPLATE_ACTIVATED" : "SCHEDULE_TEMPLATE_DEACTIVATED", entityType: "ScheduleTemplate", entityId: template.id, oldData: { id: previous.id, active: previous.active }, newData: { id: template.id, active: template.active }, reason: input.reason });
    return template;
  });
}

export async function assignScheduleToEmployee(input: { employeeId: string; value: unknown; context: AuditContext }) {
  const parsed: ScheduleAssignmentInput = scheduleAssignmentInputSchema.parse(input.value);
  if (requiresRetroactiveConfirmation(parsed.validFrom, toBusinessDate(new Date())) && !parsed.retroactiveConfirmed) {
    throw new Error("Confirme a atribuição retroativa antes de aplicá-la.");
  }
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { id: true, status: true } });
    if (employee.status === "MERGED") throw new Error("Cadastros mesclados não podem receber nova jornada.");
    const template = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: parsed.scheduleTemplateId }, select: { id: true, name: true, active: true } });
    if (!template.active) throw new Error("Reative a jornada antes de atribuí-la.");
    const assignments = await transaction.employeeScheduleAssignment.findMany({ where: { employeeId: input.employeeId }, orderBy: { validFrom: "asc" } });
    const candidate = { id: "candidate", validFrom: parsed.validFrom, validUntil: parsed.validUntil };
    const overlapping = assignments.filter((assignment) => hasOverlappingScheduleAssignment(
      [{ id: assignment.id, validFrom: assignment.validFrom.toISOString().slice(0, 10), validUntil: toDateKey(assignment.validUntil) }],
      candidate,
    ));
    if (overlapping.length > 0 && !parsed.closePrevious) throw new Error("Existe jornada com vigência sobreposta. Encerre a jornada anterior explicitamente.");
    const unclosable = overlapping.filter((assignment) => assignment.validFrom.toISOString().slice(0, 10) > parsed.validFrom);
    if (unclosable.length > 0) throw new Error("A nova vigência conflita com uma jornada futura. Escolha um fim anterior ou ajuste a jornada futura separadamente.");
    const ended = [] as Array<{ id: string; validUntil: Date | null }>;
    if (overlapping.length > 0) {
      const endDate = subDays(dateOnly(parsed.validFrom), 1);
      for (const assignment of overlapping) {
        const updated = await transaction.employeeScheduleAssignment.update({ where: { id: assignment.id }, data: { validUntil: endDate } });
        ended.push({ id: updated.id, validUntil: updated.validUntil });
      }
    }
    const assignment = await transaction.employeeScheduleAssignment.create({
      data: { employeeId: input.employeeId, scheduleTemplateId: parsed.scheduleTemplateId, validFrom: dateOnly(parsed.validFrom), validUntil: parsed.validUntil ? dateOnly(parsed.validUntil) : null, reason: parsed.reason, createdById: input.context.userId },
      include: { scheduleTemplate: { select: { name: true } } },
    });
    await writeAuditLog(transaction, input.context, {
      action: "EMPLOYEE_SCHEDULE_ASSIGNED",
      entityType: "EmployeeScheduleAssignment",
      entityId: assignment.id,
      oldData: { endedAssignments: ended },
      newData: { employeeId: assignment.employeeId, scheduleTemplateId: assignment.scheduleTemplateId, scheduleName: assignment.scheduleTemplate.name, validFrom: assignment.validFrom, validUntil: assignment.validUntil },
      reason: parsed.reason,
    });
    return assignment;
  });
}
