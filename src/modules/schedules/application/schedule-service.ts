import "server-only";

import { subDays } from "date-fns";
import { getPrisma } from "@/lib/db/prisma";
import { toBusinessDate } from "@/lib/dates/business";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { requiresRetroactiveConfirmation } from "@/modules/calculations/domain/recalculation-window";
import { getCalculationReadiness, type CalculationReadiness } from "@/modules/calculations/application/calculation-readiness";
import { assertOpenCalculationMonths } from "@/modules/calculations/application/closed-period-guard";
import { requestAttendanceRecalculation } from "@/modules/calculations/application/request-attendance-recalculation";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";
import { hasOverlappingScheduleAssignment } from "@/modules/schedules/domain/assignments";
import { canReceiveScheduleAssignment } from "@/modules/schedules/domain/schedule-assignment-eligibility";
import { calculateScheduleDayDuration } from "@/modules/schedules/domain/duration";
import { logicalScheduleName } from "@/modules/schedules/domain/logical-template";
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
    expectedBreakStart: day.requiresBreak ? day.expectedBreakStart ?? null : null,
    expectedBreakEnd: day.requiresBreak ? day.expectedBreakEnd ?? null : null,
    expectedExit: day.expectedExit ?? null,
    expectedMinutes: duration.expectedMinutes,
    expectedBreakMinutes: duration.expectedBreakMinutes,
    minimumBreakMinutes: day.requiresBreak ? day.minimumBreakMinutes ?? null : null,
    entryToleranceMinutes: day.entryToleranceMinutes,
    exitToleranceMinutes: day.exitToleranceMinutes,
    requiresBreak: day.isWorkingDay && day.requiresBreak,
    excessRequiresApproval: day.excessRequiresApproval,
    };
  });
}

function historicalVersionName(name: string, id: string) {
  return `${name.slice(0, 90)} — histórico ${toBusinessDate(new Date())} ${id.slice(-6)}`;
}

export async function saveScheduleTemplate(input: { id?: string; value: unknown; context: AuditContext }) {
  const parsed = scheduleTemplateInputSchema.parse(input.value);
  const prisma = getPrisma();
  const saved = await prisma.$transaction(async (transaction) => {
    if (!input.id) {
      const template = await transaction.scheduleTemplate.create({ data: { name: parsed.name, description: parsed.description ?? null, modelType: parsed.modelType, active: parsed.active, days: { createMany: { data: scheduleDaysData(parsed.days) } } }, include: { days: true } });
      await writeAuditLog(transaction, input.context, { action: "SCHEDULE_TEMPLATE_CREATED", entityType: "ScheduleTemplate", entityId: template.id, newData: { id: template.id, name: template.name, active: template.active, days: template.days } });
      return { template, affectedEmployeeIds: [] as string[] };
    }
    const previous = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: input.id }, include: { days: true, _count: { select: { assignments: true } } } });
    if (previous._count.assignments > 0) {
      const effectiveDate = toBusinessDate(new Date());
      const previousDay = subDays(dateOnly(effectiveDate), 1);
      const assignments = await transaction.employeeScheduleAssignment.findMany({
        where: { scheduleTemplateId: previous.id },
        select: { id: true, employeeId: true, validFrom: true, validUntil: true, reason: true, createdById: true },
      });
      // The old template and assignments retain the past. The new template keeps
      // the logical name, so RH continues to see one model rather than dated copies.
      await transaction.scheduleTemplate.update({ where: { id: previous.id }, data: { name: historicalVersionName(previous.name, previous.id), active: false } });
      const template = await transaction.scheduleTemplate.create({ data: { name: parsed.name, description: parsed.description ?? null, modelType: parsed.modelType, active: parsed.active, days: { createMany: { data: scheduleDaysData(parsed.days) } } }, include: { days: true } });
      const affectedEmployeeIds = new Set<string>();
      for (const assignment of assignments) {
        const validFrom = toDateKey(assignment.validFrom)!;
        const validUntil = toDateKey(assignment.validUntil);
        if (validUntil && validUntil < effectiveDate) continue;
        affectedEmployeeIds.add(assignment.employeeId);
        if (validFrom >= effectiveDate) {
          await transaction.employeeScheduleAssignment.update({ where: { id: assignment.id }, data: { scheduleTemplateId: template.id } });
          continue;
        }
        await transaction.employeeScheduleAssignment.update({ where: { id: assignment.id }, data: { validUntil: previousDay } });
        await transaction.employeeScheduleAssignment.create({
          data: {
            employeeId: assignment.employeeId,
            scheduleTemplateId: template.id,
            validFrom: dateOnly(effectiveDate),
            validUntil: assignment.validUntil,
            reason: assignment.reason ?? "Revisão do modelo de horário.",
            createdById: input.context.userId,
          },
        });
      }
      await writeAuditLog(transaction, input.context, { action: "SCHEDULE_TEMPLATE_REVISED", entityType: "ScheduleTemplate", entityId: template.id, oldData: { sourceTemplateId: previous.id, sourceName: previous.name, historicalTemplateName: historicalVersionName(previous.name, previous.id) }, newData: { id: template.id, name: template.name, active: template.active, days: template.days, effectiveDate, affectedEmployees: affectedEmployeeIds.size }, reason: "Revisão preservada internamente a partir da data operacional atual." });
      return { template, affectedEmployeeIds: [...affectedEmployeeIds] };
    }
    await transaction.scheduleTemplateDay.deleteMany({ where: { scheduleTemplateId: input.id } });
    const template = await transaction.scheduleTemplate.update({
      where: { id: input.id },
      data: { name: parsed.name, description: parsed.description ?? null, modelType: parsed.modelType, active: parsed.active, days: { createMany: { data: scheduleDaysData(parsed.days) } } },
      include: { days: true },
    });
    await writeAuditLog(transaction, input.context, { action: "SCHEDULE_TEMPLATE_UPDATED", entityType: "ScheduleTemplate", entityId: template.id, oldData: { id: previous.id, name: previous.name, active: previous.active, days: previous.days }, newData: { id: template.id, name: template.name, active: template.active, days: template.days } });
    return { template, affectedEmployeeIds: [] as string[] };
  });
  if (saved.affectedEmployeeIds.length > 0) {
    await runCalculation({
      trigger: "SCHEDULE_CHANGE",
      startedById: input.context.userId,
      affectedDays: saved.affectedEmployeeIds.map((employeeId) => ({ employeeId, date: toBusinessDate(new Date()) })),
    });
  }
  return saved.template;
}

/**
 * Removes a model from the operational catalogue without breaking foreign keys
 * or erasing the assignments used by historical summaries.
 */
export async function removeScheduleTemplate(input: { id: string; context: AuditContext }) {
  const prisma = getPrisma();
  const effectiveDate = toBusinessDate(new Date());
  const previousDay = subDays(dateOnly(effectiveDate), 1);
  const removed = await prisma.$transaction(async (transaction) => {
    const template = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: input.id }, select: { id: true, name: true, active: true } });
    const activeTemplates = await transaction.scheduleTemplate.findMany({ where: { active: true }, select: { id: true, name: true } });
    const logicalName = logicalScheduleName(template.name).toLocaleLowerCase("pt-BR");
    const templateIds = activeTemplates
      .filter((item) => logicalScheduleName(item.name).toLocaleLowerCase("pt-BR") === logicalName)
      .map((item) => item.id);
    const currentAssignments = await transaction.employeeScheduleAssignment.findMany({
      where: { scheduleTemplateId: { in: templateIds }, validFrom: { lte: dateOnly(effectiveDate) }, OR: [{ validUntil: null }, { validUntil: { gte: dateOnly(effectiveDate) } }] },
      select: { id: true, employeeId: true, validFrom: true, _count: { select: { dailySummaries: true } } },
    });
    await transaction.scheduleTemplate.updateMany({ where: { id: { in: templateIds } }, data: { active: false } });
    await Promise.all(currentAssignments.map((assignment) => {
      if (toDateKey(assignment.validFrom) === effectiveDate && assignment._count.dailySummaries === 0) {
        return transaction.employeeScheduleAssignment.delete({ where: { id: assignment.id } });
      }
      return transaction.employeeScheduleAssignment.update({
        where: { id: assignment.id },
        data: { validUntil: previousDay, reason: "Modelo removido do catálogo operacional." },
      });
    }));
    await writeAuditLog(transaction, input.context, {
      action: "SCHEDULE_TEMPLATE_REMOVED_FROM_CATALOG",
      entityType: "ScheduleTemplate",
      entityId: template.id,
      oldData: { name: logicalScheduleName(template.name), active: template.active, activeAssignments: currentAssignments.length, revisionCount: templateIds.length },
      newData: { active: false, effectiveDate, employeesWithoutSchedule: currentAssignments.length, removedTemplateIds: templateIds },
      reason: "Modelo removido do catálogo; vínculos históricos preservados.",
    });
    return { template, employeeIds: [...new Set(currentAssignments.map((assignment) => assignment.employeeId))] };
  });
  const calculation = removed.employeeIds.length > 0
    ? await runCalculation({ trigger: "SCHEDULE_CHANGE", startedById: input.context.userId, affectedDays: removed.employeeIds.map((employeeId) => ({ employeeId, date: effectiveDate })) })
    : { calculationRunId: null, processedDays: 0, failedDays: 0, generatedInconsistencies: 0, autoResolved: 0, status: "COMPLETED" as const, durationMs: 0 };
  return { ...removed, calculation };
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
        modelType: source.modelType,
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
    const template = await transaction.scheduleTemplate.findUniqueOrThrow({ where: { id: parsed.scheduleTemplateId }, include: { days: true } });
    if (!template.active) throw new Error("Reative a jornada antes de atribuí-la.");
    const employmentPeriod = await transaction.employeeEmploymentPeriod.findFirst({
      where: { employeeId: input.employeeId, validFrom: { lte: dateOnly(parsed.validFrom) }, OR: [{ validUntil: null }, { validUntil: { gte: dateOnly(parsed.validFrom) } }] },
      orderBy: { validFrom: "desc" },
      include: { calculationPolicy: true },
    });
    const policy = employmentPeriod?.calculationPolicy;
    if (template.modelType === "FIXED" && !template.days.some((day) => day.isWorkingDay)) {
      throw new Error("Este modelo fixo não possui dias trabalhados. Configure os dias e horários antes de atribuí-lo.");
    }
    if (template.modelType !== "FIXED" && policy?.requiresSchedule && !policy.flexibleSchedule && !policy.attendanceOnly) {
      throw new Error("A política vigente exige um modelo de horário fixo. Selecione um modelo com dias e horários configurados.");
    }
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
    const sameStart = overlapping.find((assignment) => assignment.validFrom.toISOString().slice(0, 10) === parsed.validFrom);
    if (sameStart && parsed.closePrevious) {
      if (overlapping.length > 1) throw new Error("A nova vigência também conflita com outro modelo. Ajuste a vigência futura antes de substituir este modelo.");
      const updated = await transaction.employeeScheduleAssignment.update({
        where: { id: sameStart.id },
        data: { scheduleTemplateId: parsed.scheduleTemplateId, validUntil: parsed.validUntil ? dateOnly(parsed.validUntil) : null, reason: parsed.reason },
        include: { scheduleTemplate: { select: { name: true } } },
      });
      await writeAuditLog(transaction, input.context, {
        action: "EMPLOYEE_SCHEDULE_ASSIGNMENT_REPLACED",
        entityType: "EmployeeScheduleAssignment",
        entityId: updated.id,
        oldData: { scheduleTemplateId: sameStart.scheduleTemplateId, validFrom: parsed.validFrom, validUntil: toDateKey(sameStart.validUntil) },
        newData: { scheduleTemplateId: updated.scheduleTemplateId, scheduleName: updated.scheduleTemplate.name, validFrom: parsed.validFrom, validUntil: toDateKey(updated.validUntil), replacementAtSameStart: true },
        reason: parsed.reason,
      });
      return updated;
    }
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
  let readiness = await getCalculationReadiness({ employeeId: input.employeeId, ...range });
  let calculation: ScheduleAssignmentCalculation = { calculationRunId: null, processedDays: 0, failedDays: 0, status: "NOT_REQUESTED" };
  if (input.recalculateAffectedDays !== false) {
    try {
      const result = await requestAttendanceRecalculation({
        trigger: "SCHEDULE_CHANGE",
        employeeId: input.employeeId,
        actorId: input.context.userId,
        dateFrom: range.validFrom,
        dateTo: range.validUntil,
        reason: parsed.reason,
      });
      readiness = result.readiness;
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
  try {
    const result = await requestAttendanceRecalculation({
      trigger: "SCHEDULE_CHANGE",
      employeeId: input.employeeId,
      actorId: input.context.userId,
      dateFrom: input.validFrom,
      dateTo: validUntil,
      reason: "Nova tentativa de recálculo após atribuição de jornada.",
    });
    return { calculation: { calculationRunId: result.calculationRunId, processedDays: result.processedDays, failedDays: result.failedDays, status: result.status }, readiness: result.readiness };
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

/**
 * Corrects the end of an existing assignment without creating a second
 * overlapping history record. The contextual change is committed and audited
 * before its bounded recalculation is requested.
 */
export async function updateScheduleAssignmentValidity(input: {
  assignmentId: string;
  validUntil?: string;
  reason: string;
  recalculateFrom: string;
  recalculateUntil: string;
  context: AuditContext;
}) {
  if (!input.reason.trim()) throw new Error("Informe o motivo da alteração da vigência da jornada.");
  if (input.validUntil && input.validUntil < input.recalculateFrom) {
    throw new Error("A data final da jornada não pode ser anterior ao período a recalcular.");
  }
  const prisma = getPrisma();
  const assignment = await prisma.$transaction(async (transaction) => {
    const previous = await transaction.employeeScheduleAssignment.findUniqueOrThrow({
      where: { id: input.assignmentId },
      include: { scheduleTemplate: { select: { name: true } } },
    });
    const validFrom = toDateKey(previous.validFrom)!;
    if (input.validUntil && input.validUntil < validFrom) {
      throw new Error("A data final da jornada não pode ser anterior à data inicial.");
    }
    await assertOpenCalculationMonths(transaction, {
      validFrom: input.recalculateFrom,
      validUntil: input.recalculateUntil,
      context: input.context,
      entityType: "EmployeeScheduleAssignment",
      entityId: previous.id,
      action: "SCHEDULE_CHANGE",
    });
    const overlapping = await transaction.employeeScheduleAssignment.findFirst({
      where: {
        employeeId: previous.employeeId,
        id: { not: previous.id },
        validFrom: { lte: input.validUntil ? dateOnly(input.validUntil) : new Date("9999-12-31T00:00:00.000Z") },
        OR: [{ validUntil: null }, { validUntil: { gte: previous.validFrom } }],
      },
      select: { validFrom: true, validUntil: true },
    });
    if (overlapping) {
      const from = toDateKey(overlapping.validFrom)!;
      const until = toDateKey(overlapping.validUntil) ?? "sem data final";
      throw new Error(`Já existe uma jornada atribuída nesse período (${from} até ${until}).`);
    }
    const updated = await transaction.employeeScheduleAssignment.update({
      where: { id: previous.id },
      data: { validUntil: input.validUntil ? dateOnly(input.validUntil) : null, reason: input.reason },
      include: { scheduleTemplate: { select: { name: true } } },
    });
    await writeAuditLog(transaction, input.context, {
      action: "EMPLOYEE_SCHEDULE_ASSIGNMENT_UPDATED",
      entityType: "EmployeeScheduleAssignment",
      entityId: updated.id,
      oldData: { validFrom, validUntil: toDateKey(previous.validUntil), scheduleName: previous.scheduleTemplate.name },
      newData: { validFrom: toDateKey(updated.validFrom), validUntil: toDateKey(updated.validUntil), scheduleName: updated.scheduleTemplate.name },
      reason: input.reason,
    });
    return updated;
  });
  const calculation = await requestAttendanceRecalculation({
    trigger: "SCHEDULE_CHANGE",
    employeeId: assignment.employeeId,
    actorId: input.context.userId,
    dateFrom: input.recalculateFrom,
    dateTo: input.recalculateUntil,
    reason: input.reason,
  });
  return { assignment, calculation };
}
