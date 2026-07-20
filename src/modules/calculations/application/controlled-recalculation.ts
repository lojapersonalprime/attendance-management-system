import "server-only";

import { addDays } from "date-fns";
import { businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { recalculateAffectedDays, type AffectedAttendanceDay } from "@/modules/calculations/application/recalculate-persisted-attendance";
import { excludeClosedMonths } from "@/modules/calculations/domain/recalculation-window";
import { periodRecalculationInputSchema } from "@/modules/employees/domain/validation";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextDate(value: string) {
  return toBusinessDate(addDays(dateOnly(value), 1));
}

function referenceMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function inRange(value: string, from: string, until: string) {
  return value >= from && value <= until;
}

function batches<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export interface RecalculationPreview {
  employeeId: string;
  requestedFrom: string;
  requestedUntil: string;
  affectedDays: string[];
  affectedSummaryCount: number;
  closedMonths: string[];
  relatedOpenInconsistencies: number;
}

export async function previewEmployeeRecalculation(input: { employeeId: string; validFrom: string; validUntil: string }): Promise<RecalculationPreview> {
  const parsed = periodRecalculationInputSchema.pick({ validFrom: true, validUntil: true }).parse(input);
  const prisma = getPrisma();
  const rangeStart = businessDateTimeToUtc(`${parsed.validFrom} 00:00:00`);
  const rangeEnd = businessDateTimeToUtc(`${nextDate(parsed.validUntil)} 00:00:00`);
  const [summaries, punches] = await Promise.all([
    prisma.dailySummary.findMany({ where: { employeeId: input.employeeId, date: { gte: dateOnly(parsed.validFrom), lte: dateOnly(parsed.validUntil) } }, select: { date: true } }),
    prisma.rawPunch.findMany({ where: { employeeDeviceLink: { employeeId: input.employeeId }, occurredAt: { gte: rangeStart, lt: rangeEnd } }, select: { occurredAt: true } }),
  ]);
  const dates = [...new Set([...summaries.map((summary) => toBusinessDate(summary.date)), ...punches.map((punch) => toBusinessDate(punch.occurredAt))])]
    .filter((date) => inRange(date, parsed.validFrom, parsed.validUntil))
    .sort();
  const months = [...new Set(dates.map(referenceMonth))];
  const [closedPeriods, relatedOpenInconsistencies] = await Promise.all([
    months.length === 0 ? [] : prisma.closingPeriod.findMany({ where: { referenceMonth: { in: months.map(dateOnly) }, status: "CLOSED" }, select: { referenceMonth: true } }),
    prisma.inconsistency.count({ where: { employeeId: input.employeeId, date: { gte: dateOnly(parsed.validFrom), lte: dateOnly(parsed.validUntil) }, status: { in: ["OPEN", "IN_REVIEW"] } } }),
  ]);
  const closedMonths = closedPeriods.map((period) => toBusinessDate(period.referenceMonth));
  return {
    employeeId: input.employeeId,
    requestedFrom: parsed.validFrom,
    requestedUntil: parsed.validUntil,
    affectedDays: excludeClosedMonths(dates, closedMonths),
    affectedSummaryCount: summaries.filter((summary) => !closedMonths.includes(referenceMonth(toBusinessDate(summary.date)))).length,
    closedMonths,
    relatedOpenInconsistencies,
  };
}

/** Recalculates only discovered open-period days in small transactions. RawPunch is read-only. */
export async function recalculateEmployeePeriod(input: { employeeId: string; validFrom: string; validUntil: string; reason: string; context: AuditContext }) {
  const parsed = periodRecalculationInputSchema.parse(input);
  const preview = await previewEmployeeRecalculation({ employeeId: input.employeeId, validFrom: parsed.validFrom, validUntil: parsed.validUntil });
  const prisma = getPrisma();
  await prisma.$transaction((transaction) => writeAuditLog(transaction, input.context, {
    action: "RECALCULATION_REQUESTED",
    entityType: "Employee",
    entityId: input.employeeId,
    newData: { validFrom: parsed.validFrom, validUntil: parsed.validUntil, affectedDays: preview.affectedDays.length, closedMonths: preview.closedMonths },
    reason: parsed.reason,
  }));
  let recalculatedDays = 0;
  let generatedInconsistencies = 0;
  try {
    for (const batch of batches(preview.affectedDays.map((date) => ({ employeeId: input.employeeId, date } satisfies AffectedAttendanceDay)), 50)) {
      const result = await prisma.$transaction((transaction) => recalculateAffectedDays(transaction, batch), { timeout: 60_000 });
      recalculatedDays += result.recalculatedDays;
      generatedInconsistencies += result.generatedInconsistencies;
    }
    await prisma.$transaction((transaction) => writeAuditLog(transaction, input.context, {
      action: "RECALCULATION_COMPLETED",
      entityType: "Employee",
      entityId: input.employeeId,
      newData: { recalculatedDays, generatedInconsistencies, skippedClosedMonths: preview.closedMonths },
      reason: parsed.reason,
    }));
    return { ...preview, recalculatedDays, generatedInconsistencies };
  } catch (error) {
    await prisma.$transaction((transaction) => writeAuditLog(transaction, input.context, {
      action: "RECALCULATION_FAILED",
      entityType: "Employee",
      entityId: input.employeeId,
      newData: { recalculatedDays, skippedClosedMonths: preview.closedMonths },
      reason: parsed.reason,
    }));
    throw error;
  }
}
