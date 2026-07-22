import "server-only";

import { subDays } from "date-fns";
import { getPrisma } from "@/lib/db/prisma";
import { toBusinessDate } from "@/lib/dates/business";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { requiresRetroactiveConfirmation } from "@/modules/calculations/domain/recalculation-window";
import { getCalculationReadiness, type CalculationReadiness } from "@/modules/calculations/application/calculation-readiness";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";
import { hasOverlappingScheduleAssignment } from "@/modules/schedules/domain/assignments";
import { canReceiveScheduleAssignment } from "@/modules/schedules/domain/schedule-assignment-eligibility";
import { calculateScheduleDayDuration } from "@/modules/schedules/domain/duration";
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
  return days.map((day) => {
    const duration = calculateScheduleDayDuration(day);
    if (!duration.validationResult.valid) throw new Error(duration.validationResult.message);
    return {
    weekday: day.weekday,
    isWorkingDay: day.isWorkingDay,
    expectedEntry: day.expectedEntry ?? null,
    expectedBreakStart: day.expectedBreakStart ?? null,
    expectedBreakEnd: day.expectedBreakEnd ?? null,
    expectedExit: day.expectedExit ?? null,
    expectedMinutes: duration.expectedMinutes,
    expectedBreakMinutes: duration.expectedBreakMinutes,
    minimumBreakMinutes: day.minimumBreakMinutes ?? null,
    entryToleranceMinutes: day.entryToleranceMinutes,
    exitToleranceMinutes: day.exitToleranceMinutes,
    requiresBreak: day.requiresBreak,
    excessRequiresApproval: day.excessRequiresApproval,
    };
  });
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

export interface ScheduleAssignmentCalculation {
  calculationRunId: string | null;
  processedDays: number;
  failedDays: number;
  status: "NOT_REQUESTED" | "COMPLETED" | "PARTIAL" | "FAILED";
}

function calculationRange(parsed: ScheduleAssignmentInput, recalculateUntil?: string) {
  const today = toBusinessDate(new Date());
  const assignmentUntil = parsed.validUntil && parsed.validUntil < today ? parsed.validUntil : today;
  const requestedUntil = recalculateUntil && recalculateUntil < assignmentUntil ? recalculateUntil : assignmentUntil;
  return { validFrom: parsed.validFrom, validUntil: requestedUntil };
}

export async function assignScheduleToEmployee(input: {
  employeeId: string;
  value: unknown;
  context: AuditContext;
  recalculateAffectedDays?: boolean;
  recalculateUntil?: string;
}) {
  const parsed: ScheduleAssignmentInput = scheduleAssignmentInputSchema.parse(input.value);
  if (requiresRetroactiveConfirmation(parsed.validFrom, toBusinessDate(new Date())) && !parsed.retroactiveConfirmed) {
    throw new Error("Confirme a atribuição retroativa antes de aplicá-la.");
  }
  const prisma = getPrisma();
  // This transaction is intentionally limited to HR context and audit data.
  // A calculation failure must never roll back a valid schedule assignment.
  const assignment = await prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { id: true, status: true } });
    if (!canReceiveScheduleAssignment(employee.status)) throw new Error("Cadastros mesclados não podem receber nova jornada.");
    const template = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: parsed.scheduleTemplateId }, select: { id: true, name: true, active: true } });
    if (!template.active) throw new Error("Reative a jornada antes de atribuí-la.");
    const assignments = await transaction.employeeScheduleAssignment.findMany({ where: { employeeId: input.employeeId }, orderBy: { validFrom: "asc" } });
    const candidate = { id: "candidate", validFrom: parsed.validFrom, validUntil: parsed.validUntil };
    const overlapping = assignments.filter((assignment) => hasOverlappingScheduleAssignment(
      [{ id: assignment.id, validFrom: assignment.validFrom.toISOString().slice(0, 10), validUntil: toDateKey(assignment.validUntil) }],
      candidate,
    ));
    if (overlapping.length > 0 && !parsed.closePrevious) {
      const conflicting = overlapping[0]!;
      const from = conflicting.validFrom.toISOString().slice(0, 10);
      const until = toDateKey(conflicting.validUntil) ?? "sem data final";
      throw new Error(`Já existe uma jornada atribuída nesse período (${from} até ${until}). Encerre a jornada anterior ou escolha outra vigência.`);
    }
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
  const range = calculationRange(parsed, input.recalculateUntil);
  const readiness = await getCalculationReadiness({ employeeId: input.employeeId, ...range });
  let calculation: ScheduleAssignmentCalculation = { calculationRunId: null, processedDays: 0, failedDays: 0, status: "NOT_REQUESTED" };
  if (input.recalculateAffectedDays !== false && readiness.recalculableDates.length > 0) {
    try {
      const result = await runCalculation({
        trigger: "SCHEDULE_CHANGE",
        employeeId: input.employeeId,
        startedById: input.context.userId,
        affectedDays: readiness.recalculableDates.map((date) => ({ employeeId: input.employeeId, date })),
      });
      calculation = { calculationRunId: result.calculationRunId, processedDays: result.processedDays, failedDays: result.failedDays, status: result.status };
    } catch (error) {
      calculation = { calculationRunId: null, processedDays: 0, failedDays: readiness.recalculableDates.length, status: "FAILED" };
      await prisma.auditLog.create({
        data: {
          userId: input.context.userId,
          action: "CALCULATION_RUN_FAILED",
          entityType: "EmployeeScheduleAssignment",
          entityId: assignment.id,
          newData: { trigger: "SCHEDULE_CHANGE", validFrom: range.validFrom, validUntil: range.validUntil, error: error instanceof Error ? error.message : "Erro desconhecido" },
          reason: "A jornada foi atribuída, mas não foi possível iniciar o recálculo.",
        },
      });
    }
  }
  return { ...assignment, calculation, readiness: readiness as CalculationReadiness };
}

/** Runs the same bounded preparation again without touching the saved schedule. */
export async function retryScheduleAssignmentCalculation(input: { employeeId: string; validFrom: string; validUntil?: string; context: AuditContext }) {
  const validUntil = input.validUntil && input.validUntil < toBusinessDate(new Date()) ? input.validUntil : toBusinessDate(new Date());
  const readiness = await getCalculationReadiness({ employeeId: input.employeeId, validFrom: input.validFrom, validUntil });
  if (readiness.recalculableDates.length === 0) {
    return { calculation: { calculationRunId: null, processedDays: 0, failedDays: 0, status: "NOT_REQUESTED" as const }, readiness };
  }
  try {
    const result = await runCalculation({
      trigger: "SCHEDULE_CHANGE",
      employeeId: input.employeeId,
      startedById: input.context.userId,
      affectedDays: readiness.recalculableDates.map((date) => ({ employeeId: input.employeeId, date })),
    });
    return { calculation: { calculationRunId: result.calculationRunId, processedDays: result.processedDays, failedDays: result.failedDays, status: result.status }, readiness };
  } catch (error) {
    await getPrisma().auditLog.create({
      data: {
        userId: input.context.userId,
        action: "CALCULATION_RUN_FAILED",
        entityType: "Employee",
        entityId: input.employeeId,
        newData: { trigger: "SCHEDULE_CHANGE", validFrom: input.validFrom, validUntil, error: error instanceof Error ? error.message : "Erro desconhecido" },
        reason: "Nova tentativa de recálculo após atribuição de jornada.",
      },
    });
    return { calculation: { calculationRunId: null, processedDays: 0, failedDays: readiness.recalculableDates.length, status: "FAILED" as const }, readiness };
  }
}
