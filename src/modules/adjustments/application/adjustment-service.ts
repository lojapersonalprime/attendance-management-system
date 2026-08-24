import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { requestAttendanceRecalculation } from "@/modules/calculations/application/request-attendance-recalculation";
import { assertOpenCalculationMonths } from "@/modules/calculations/application/closed-period-guard";

const adjustmentTypes = ["MISSING_PUNCH", "INVALID_PUNCH", "DUPLICATE_PUNCH", "MEDICAL_CERTIFICATE", "JUSTIFIED_ABSENCE", "UNJUSTIFIED_ABSENCE", "EXTERNAL_WORK", "DAY_OFF", "VACATION", "LEAVE", "HOURS_CREDIT", "HOURS_DEBIT", "EXCESS_APPROVAL", "SCHEDULE_CORRECTION"] as const;
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");

const createAdjustmentSchema = z.object({
  employeeId: z.string().min(1),
  date: dateValue,
  type: z.enum(adjustmentTypes),
  originalPunchId: z.string().min(1).optional(),
  adjustedTime: z.union([timeValue, z.literal("")]).optional(),
  adjustedPunchCode: z.enum(["S", "E", "A", "F"]).optional(),
  minutesCredited: z.coerce.number().int().min(0).max(1_440).default(0),
  minutesDebited: z.coerce.number().int().min(0).max(1_440).default(0),
  reason: z.string().trim().min(3, "Informe a justificativa do ajuste.").max(2_000),
}).superRefine((input, context) => {
  if (input.type === "MISSING_PUNCH" && (!input.adjustedTime || !input.adjustedPunchCode)) {
    context.addIssue({ code: "custom", path: ["adjustedTime"], message: "Uma marcação manual exige horário e código." });
  }
  if (["INVALID_PUNCH", "DUPLICATE_PUNCH"].includes(input.type) && !input.originalPunchId) {
    context.addIssue({ code: "custom", path: ["originalPunchId"], message: "Selecione a marcação original a tratar." });
  }
});

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function createAdjustment(input: { value: unknown; context: AuditContext }) {
  const value = createAdjustmentSchema.parse(input.value);
  const prisma = getPrisma();
  const adjustment = await prisma.$transaction(async (transaction) => {
    await assertOpenCalculationMonths(transaction, {
      validFrom: value.date,
      validUntil: value.date,
      context: input.context,
      entityType: "Employee",
      entityId: value.employeeId,
      action: "ADJUSTMENT",
    });
    const employee = await transaction.employee.findUniqueOrThrow({ where: { id: value.employeeId }, select: { id: true, status: true } });
    if (employee.status === "MERGED") throw new Error("Cadastros mesclados não recebem ajustes novos.");
    const rawPunch = value.originalPunchId
      ? await transaction.rawPunch.findUnique({ where: { id: value.originalPunchId }, select: { id: true, employeeDeviceLink: { select: { employeeId: true } } } })
      : null;
    const mobilePunch = value.originalPunchId && !rawPunch
      ? await transaction.mobilePunch.findUnique({ where: { id: value.originalPunchId }, select: { id: true, employeeId: true } })
      : null;
    if (value.originalPunchId && !rawPunch && !mobilePunch) throw new Error("A marcação selecionada não foi encontrada.");
    if (rawPunch && rawPunch.employeeDeviceLink?.employeeId !== value.employeeId) throw new Error("A marcação selecionada não pertence ao funcionário.");
    if (mobilePunch && mobilePunch.employeeId !== value.employeeId) throw new Error("A marcação selecionada não pertence ao funcionário.");
    const adjustedOccurredAt = value.adjustedTime ? new Date(`${value.date}T${value.adjustedTime}:00-03:00`) : null;
    const adjustment = await transaction.adjustment.create({
      data: { employeeId: value.employeeId, date: dateOnly(value.date), type: value.type, originalPunchId: rawPunch?.id ?? null, originalMobilePunchId: mobilePunch?.id ?? null, adjustedOccurredAt, adjustedPunchCode: value.adjustedPunchCode ?? null, minutesCredited: value.minutesCredited, minutesDebited: value.minutesDebited, reason: value.reason, createdById: input.context.userId, metadata: { origin: value.type === "MISSING_PUNCH" ? "MANUAL_ADJUSTMENT" : "RH_ADJUSTMENT" } },
    });
    await writeAuditLog(transaction, input.context, { action: "ADJUSTMENT_CREATED", entityType: "Adjustment", entityId: adjustment.id, newData: { employeeId: adjustment.employeeId, date: value.date, type: adjustment.type, originalPunchId: adjustment.originalPunchId, originalMobilePunchId: adjustment.originalMobilePunchId, adjustedOccurredAt: adjustment.adjustedOccurredAt, adjustedPunchCode: adjustment.adjustedPunchCode, minutesCredited: adjustment.minutesCredited, minutesDebited: adjustment.minutesDebited }, reason: adjustment.reason });
    return adjustment;
  });
  const calculation = await requestAttendanceRecalculation({ trigger: "ADJUSTMENT", employeeId: adjustment.employeeId, actorId: input.context.userId, dateFrom: value.date, dateTo: value.date, reason: value.reason });
  return { adjustment, calculation };
}

export async function cancelAdjustment(input: { adjustmentId: string; reason: string; context: AuditContext }) {
  if (input.reason.trim().length < 3) throw new Error("Informe o motivo do cancelamento.");
  const prisma = getPrisma();
  const adjustment = await prisma.$transaction(async (transaction) => {
    const previous = await transaction.adjustment.findUniqueOrThrow({ where: { id: input.adjustmentId } });
    if (previous.status === "CANCELLED") throw new Error("Este ajuste já foi cancelado.");
    const date = previous.date.toISOString().slice(0, 10);
    await assertOpenCalculationMonths(transaction, {
      validFrom: date,
      validUntil: date,
      context: input.context,
      entityType: "Adjustment",
      entityId: previous.id,
      action: "ADJUSTMENT_CANCELLATION",
    });
    const adjustment = await transaction.adjustment.update({ where: { id: previous.id }, data: { status: "CANCELLED", cancelledById: input.context.userId, cancelledAt: new Date(), cancellationReason: input.reason } });
    await writeAuditLog(transaction, input.context, { action: "ADJUSTMENT_CANCELLED", entityType: "Adjustment", entityId: adjustment.id, oldData: { status: previous.status }, newData: { status: adjustment.status }, reason: input.reason });
    return adjustment;
  });
  const date = adjustment.date.toISOString().slice(0, 10);
  const calculation = await requestAttendanceRecalculation({ trigger: "ADJUSTMENT", employeeId: adjustment.employeeId, actorId: input.context.userId, dateFrom: date, dateTo: date, reason: input.reason });
  return { adjustment, calculation };
}
