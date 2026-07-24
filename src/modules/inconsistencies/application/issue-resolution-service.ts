import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/db/prisma";
import { createAdjustment } from "@/modules/adjustments/application/adjustment-service";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { requestAttendanceRecalculation } from "@/modules/calculations/application/request-attendance-recalculation";
import { updateInconsistencyStatus } from "@/modules/inconsistencies/application/inconsistency-service";
import { bulkIssueActions, previewBulkIssueAction as deriveBulkIssuePreview, type BulkIssueAction } from "@/modules/inconsistencies/domain/bulk-actions";

const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const dailyIssueResolutionActions = [
  "ADD_MISSING_PUNCH",
  "CORRECT_PUNCH_INTERPRETATION",
  "JUSTIFY_ABSENCE",
  "MEDICAL_CERTIFICATE",
  "EXTERNAL_WORK",
  "APPROVE_EXCESS",
  "APPLY_POLICY_TOLERANCE",
  "DISMISS_WARNING",
  "MARK_IN_REVIEW",
  "RESOLVE_ALREADY_CORRECTED",
] as const;

const dailyIssueResolutionSchema = z.object({
  inconsistencyId: z.string().min(1),
  action: z.enum(dailyIssueResolutionActions),
  reason: z.string().trim().min(3, "Informe a justificativa do tratamento.").max(2_000),
  adjustedTime: z.union([timeValue, z.literal("")]).optional(),
  adjustedPunchCode: z.enum(["S", "E", "A", "F"]).optional(),
  originalPunchId: z.string().min(1).optional(),
  minutesApproved: z.coerce.number().int().min(0).max(1_440).default(0),
}).superRefine((value, context) => {
  if (value.action === "ADD_MISSING_PUNCH" && (!value.adjustedTime || !value.adjustedPunchCode)) {
    context.addIssue({ code: "custom", path: ["adjustedTime"], message: "Informe o horário e o tipo da batida esquecida." });
  }
  if (value.action === "CORRECT_PUNCH_INTERPRETATION" && !value.originalPunchId) {
    context.addIssue({ code: "custom", path: ["originalPunchId"], message: "Selecione a marcação a desconsiderar." });
  }
  if (value.action === "APPROVE_EXCESS" && value.minutesApproved <= 0) {
    context.addIssue({ code: "custom", path: ["minutesApproved"], message: "Informe a quantidade de excedente aprovada." });
  }
});

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function getActionableIssue(inconsistencyId: string) {
  const issue = await getPrisma().inconsistency.findUniqueOrThrow({
    where: { id: inconsistencyId },
    select: { id: true, employeeId: true, date: true, status: true, type: true, dailySummaryId: true },
  });
  if (!issue.employeeId || !issue.date || !issue.dailySummaryId) throw new Error("Esta pendência não está vinculada a um registro diário tratável.");
  if (!["OPEN", "REOPENED", "IN_REVIEW"].includes(issue.status)) throw new Error("Esta pendência já não está aberta para tratamento.");
  return { id: issue.id, employeeId: issue.employeeId, date: dateKey(issue.date), status: issue.status, type: issue.type, dailySummaryId: issue.dailySummaryId };
}

/** Applies a real RH treatment then recalculates only the affected business day. */
export async function resolveDailyIssue(input: { value: unknown; context: AuditContext }) {
  const value = dailyIssueResolutionSchema.parse(input.value);
  const issue = await getActionableIssue(value.inconsistencyId);
  const requestId = randomUUID();

  if (value.action === "MARK_IN_REVIEW") {
    await updateInconsistencyStatus({ value: { inconsistencyId: issue.id, status: "IN_REVIEW", reason: value.reason }, context: input.context });
    return { requestId, outcome: "IN_REVIEW" as const, issueId: issue.id };
  }
  if (value.action === "DISMISS_WARNING") {
    await updateInconsistencyStatus({ value: { inconsistencyId: issue.id, status: "DISMISSED", reason: value.reason }, context: input.context });
    return { requestId, outcome: "DISMISSED" as const, issueId: issue.id };
  }

  if (value.action === "APPLY_POLICY_TOLERANCE" || value.action === "RESOLVE_ALREADY_CORRECTED") {
    const calculation = await requestAttendanceRecalculation({ trigger: "MANUAL_RECALCULATION", employeeId: issue.employeeId, dateFrom: issue.date, dateTo: issue.date, actorId: input.context.userId, reason: value.reason });
    const current = await getPrisma().inconsistency.findUniqueOrThrow({ where: { id: issue.id }, select: { status: true } });
    if (value.action === "RESOLVE_ALREADY_CORRECTED" && ["OPEN", "REOPENED", "IN_REVIEW"].includes(current.status)) {
      throw new Error("A pendência ainda existe após o recálculo; aplique uma correção, justificativa ou dispensa válida.");
    }
    await getPrisma().$transaction((transaction) => writeAuditLog(transaction, input.context, {
      action: value.action === "APPLY_POLICY_TOLERANCE" ? "INCONSISTENCY_POLICY_TOLERANCE_RECALCULATED" : "INCONSISTENCY_RESOLUTION_VERIFIED",
      entityType: "Inconsistency",
      entityId: issue.id,
      newData: { requestId, calculationRunId: calculation.calculationRunId, processedDays: calculation.processedDays, statusAfterRecalculation: current.status },
      reason: value.reason,
    }));
    return { requestId, outcome: "RECALCULATED" as const, issueId: issue.id, calculation };
  }

  const adjustmentType = value.action === "ADD_MISSING_PUNCH" ? "MISSING_PUNCH"
    : value.action === "CORRECT_PUNCH_INTERPRETATION" ? "INVALID_PUNCH"
      : value.action === "JUSTIFY_ABSENCE" ? "JUSTIFIED_ABSENCE"
        : value.action === "MEDICAL_CERTIFICATE" ? "MEDICAL_CERTIFICATE"
          : value.action === "EXTERNAL_WORK" ? "EXTERNAL_WORK"
            : "EXCESS_APPROVAL";
  const adjustment = await createAdjustment({
    value: {
      employeeId: issue.employeeId,
      date: issue.date,
      type: adjustmentType,
      originalPunchId: value.originalPunchId,
      adjustedTime: value.adjustedTime,
      adjustedPunchCode: value.adjustedPunchCode,
      minutesCredited: value.action === "APPROVE_EXCESS" ? value.minutesApproved : 0,
      minutesDebited: 0,
      reason: value.reason,
    },
    context: input.context,
  });
  await getPrisma().$transaction((transaction) => writeAuditLog(transaction, input.context, {
    action: "INCONSISTENCY_TREATED_FROM_DAILY_RECORD",
    entityType: "Inconsistency",
    entityId: issue.id,
    newData: { requestId, action: value.action, adjustmentId: adjustment.adjustment.id, calculationRunId: adjustment.calculation.calculationRunId },
    reason: value.reason,
  }));
  return { requestId, outcome: "ADJUSTED" as const, issueId: issue.id, adjustment };
}

export interface BulkIssueActionPreview {
  requestId: string;
  requested: number;
  compatible: number;
  incompatible: Array<{ id: string; type: string; reason: string }>;
  employeeCount: number;
  dayCount: number;
  recalculationCount: number;
}

const bulkIssueActionSchema = z.object({
  inconsistencyIds: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(bulkIssueActions),
  reason: z.string().trim().min(3).max(2_000),
  minutesApproved: z.coerce.number().int().min(0).max(1_440).default(0),
});

async function previewBulk(value: z.infer<typeof bulkIssueActionSchema>): Promise<{ preview: BulkIssueActionPreview; issues: Array<{ id: string; type: string; employeeId: string | null; date: Date | null }> }> {
  const issues = await getPrisma().inconsistency.findMany({ where: { id: { in: value.inconsistencyIds }, status: { in: ["OPEN", "REOPENED", "IN_REVIEW"] } }, select: { id: true, type: true, employeeId: true, date: true } });
  const source = issues.map((issue) => ({ id: issue.id, type: issue.type, employeeId: issue.employeeId, date: issue.date ? dateKey(issue.date) : null }));
  const derived = deriveBulkIssuePreview(value.action as BulkIssueAction, source);
  const compatible = issues.filter((issue) => derived.compatible.some((item) => item.id === issue.id));
  return {
    issues,
    preview: {
      requestId: randomUUID(),
      requested: value.inconsistencyIds.length,
      compatible: compatible.length,
      incompatible: derived.incompatible,
      employeeCount: derived.employeeCount,
      dayCount: derived.dayCount,
      recalculationCount: derived.recalculationCount,
    },
  };
}

export async function previewBulkIssueAction(input: { value: unknown }) {
  return (await previewBulk(bulkIssueActionSchema.parse(input.value))).preview;
}

/** Executes only compatible records and records one operation event plus individual state events. */
export async function executeBulkIssueAction(input: { value: unknown; context: AuditContext }) {
  const value = bulkIssueActionSchema.parse(input.value);
  const { preview, issues } = await previewBulk(value);
  const requestId = preview.requestId;
  const compatible = issues.filter((issue) => !preview.incompatible.some((item) => item.id === issue.id));
  const completed: string[] = [];
  const failures: Array<{ id: string; reason: string }> = [];

  for (const issue of compatible) {
    try {
      if (value.action === "MARK_IN_REVIEW") await updateInconsistencyStatus({ value: { inconsistencyId: issue.id, status: "IN_REVIEW", reason: value.reason }, context: input.context });
      else if (value.action === "DISMISS_WARNING") await updateInconsistencyStatus({ value: { inconsistencyId: issue.id, status: "DISMISSED", reason: value.reason }, context: input.context });
      else if (value.action === "JUSTIFY_ABSENCE" || value.action === "APPROVE_EXCESS") {
        if (!issue.employeeId || !issue.date) throw new Error("Pendência sem funcionário ou data tratável.");
        await createAdjustment({ value: { employeeId: issue.employeeId, date: dateKey(issue.date), type: value.action === "JUSTIFY_ABSENCE" ? "JUSTIFIED_ABSENCE" : "EXCESS_APPROVAL", minutesCredited: value.action === "APPROVE_EXCESS" ? value.minutesApproved : 0, minutesDebited: 0, reason: value.reason }, context: input.context });
      } else {
        if (!issue.employeeId || !issue.date) throw new Error("Pendência sem funcionário ou data tratável.");
        await requestAttendanceRecalculation({ trigger: "MANUAL_RECALCULATION", employeeId: issue.employeeId, dateFrom: dateKey(issue.date), dateTo: dateKey(issue.date), actorId: input.context.userId, reason: value.reason });
        if (value.action === "RESOLVE_ALREADY_CORRECTED") {
          const current = await getPrisma().inconsistency.findUniqueOrThrow({ where: { id: issue.id }, select: { status: true } });
          if (["OPEN", "REOPENED", "IN_REVIEW"].includes(current.status)) throw new Error("Ainda requer uma correção individual.");
        }
      }
      completed.push(issue.id);
    } catch (error) {
      failures.push({ id: issue.id, reason: error instanceof Error ? error.message : "Falha ao aplicar a ação." });
    }
  }
  await getPrisma().$transaction(async (transaction) => {
    await writeAuditLog(transaction, input.context, {
      action: "INCONSISTENCY_BULK_ACTION_COMPLETED",
      entityType: "InconsistencyBulkAction",
      entityId: requestId,
      newData: { requestId, action: value.action, requested: preview.requested, completed: completed.length, failed: failures.length, incompatible: preview.incompatible.length, inconsistencyIds: value.inconsistencyIds, filters: null },
      reason: value.reason,
    });
    for (const id of completed) {
      await writeAuditLog(transaction, input.context, { action: "INCONSISTENCY_BULK_ACTION_ITEM", entityType: "Inconsistency", entityId: id, newData: { requestId, action: value.action }, reason: value.reason });
    }
  });
  return { requestId, preview, completed, ignored: preview.incompatible, failures };
}
