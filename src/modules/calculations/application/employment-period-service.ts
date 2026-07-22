import "server-only";

import { subDays } from "date-fns";
import { businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";
import { assertOpenCalculationMonths } from "@/modules/calculations/application/closed-period-guard";
import { employmentPeriodInputSchema } from "@/modules/calculations/domain/validation";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function isRetroactive(value: string) {
  return value < toBusinessDate(new Date());
}

function rangesOverlap(leftFrom: string, leftUntil: string | null | undefined, rightFrom: string, rightUntil: string | null | undefined) {
  const leftEnd = leftUntil ?? "9999-12-31";
  const rightEnd = rightUntil ?? "9999-12-31";
  return leftFrom <= rightEnd && rightFrom <= leftEnd;
}

/** Adds a dated employment context. It never rewrites the employee's current type into history. */
export async function createEmploymentPeriod(input: { employeeId: string; value: unknown; context: AuditContext }) {
  const value = employmentPeriodInputSchema.parse(input.value);
  if (isRetroactive(value.validFrom) && !value.retroactiveConfirmed) {
    throw new Error("Confirme a alteração retroativa antes de aplicá-la.");
  }
  const prisma = getPrisma();
  const changed = await prisma.$transaction(async (transaction) => {
    await assertOpenCalculationMonths(transaction, {
      validFrom: value.validFrom,
      validUntil: value.validUntil,
      context: input.context,
      entityType: "Employee",
      entityId: input.employeeId,
      action: "EMPLOYMENT_PERIOD_CHANGE",
    });
    const employee = await transaction.employee.findUniqueOrThrow({ where: { id: input.employeeId }, select: { id: true, status: true } });
    if (employee.status === "MERGED") throw new Error("Cadastros mesclados não podem receber novos períodos de vínculo.");
    const policy = await transaction.calculationPolicy.findUniqueOrThrow({ where: { id: value.calculationPolicyId }, select: { id: true, active: true, name: true } });
    if (!policy.active) throw new Error("Reative a política antes de vinculá-la ao funcionário.");
    const existing = await transaction.employeeEmploymentPeriod.findMany({ where: { employeeId: input.employeeId, status: { not: "CANCELLED" } }, orderBy: { validFrom: "asc" } });
    const overlapping = existing.filter((period) => rangesOverlap(dateKey(period.validFrom)!, dateKey(period.validUntil), value.validFrom, value.validUntil));
    if (overlapping.length > 0 && !value.closePrevious) {
      throw new Error("Existe período de vínculo sobreposto. Confirme o encerramento explícito do vínculo anterior.");
    }
    if (overlapping.some((period) => dateKey(period.validFrom)! > value.validFrom)) {
      throw new Error("A nova vigência conflita com um período futuro. Ajuste o período futuro separadamente.");
    }
    const ended = [] as Array<{ id: string; validUntil: Date | null }>;
    for (const period of overlapping) {
      const updated = await transaction.employeeEmploymentPeriod.update({
        where: { id: period.id },
        data: { validUntil: subDays(dateOnly(value.validFrom), 1), status: "ENDED" },
      });
      ended.push({ id: updated.id, validUntil: updated.validUntil });
    }
    const period = await transaction.employeeEmploymentPeriod.create({
      data: { employeeId: input.employeeId, employmentType: value.employmentType, calculationPolicyId: policy.id, validFrom: dateOnly(value.validFrom), validUntil: value.validUntil ? dateOnly(value.validUntil) : null, status: "ACTIVE", reason: value.reason, notes: value.notes ?? null, createdById: input.context.userId },
    });
    await writeAuditLog(transaction, input.context, {
      action: "EMPLOYMENT_PERIOD_CREATED",
      entityType: "EmployeeEmploymentPeriod",
      entityId: period.id,
      oldData: { endedPeriods: ended },
      newData: { employeeId: input.employeeId, employmentType: period.employmentType, calculationPolicyId: policy.id, policyName: policy.name, validFrom: period.validFrom, validUntil: period.validUntil },
      reason: value.reason,
    });
    const start = businessDateTimeToUtc(`${value.validFrom} 00:00:00`);
    const end = value.validUntil ? businessDateTimeToUtc(`${value.validUntil} 23:59:59`) : undefined;
    const [punches, summaries] = await Promise.all([
      transaction.rawPunch.findMany({ where: { employeeDeviceLink: { employeeId: input.employeeId }, occurredAt: { gte: start, ...(end ? { lte: end } : {}) } }, select: { occurredAt: true } }),
      transaction.dailySummary.findMany({ where: { employeeId: input.employeeId, date: { gte: dateOnly(value.validFrom), ...(value.validUntil ? { lte: dateOnly(value.validUntil) } : {}) } }, select: { date: true } }),
    ]);
    const affectedDates = [...new Set([...punches.map((punch) => toBusinessDate(punch.occurredAt)), ...summaries.map((summary) => dateKey(summary.date)!)])];
    return { period, affectedDates };
  });
  const calculation = await runCalculation({ trigger: "EMPLOYMENT_PERIOD_CHANGE", employeeId: input.employeeId, startedById: input.context.userId, affectedDays: changed.affectedDates.map((date) => ({ employeeId: input.employeeId, date })) });
  return { ...changed, calculation };
}
