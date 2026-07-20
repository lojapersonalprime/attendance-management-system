import "server-only";

import { addDays } from "date-fns";
import { businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import type { Prisma } from "@/generated/prisma/client";
import { calculateDailySummary } from "@/modules/calculations/domain/daily-calculation";
import type { AttendancePunchForCalculation, DailySchedule, MinuteAdjustment } from "@/modules/calculations/domain/types";

export interface AffectedAttendanceDay {
  employeeId: string;
  date: string;
}

interface RecalculateOptions {
  importFileId?: string;
  allowClosedPeriod?: boolean;
}

interface ScheduleAssignmentWithDays {
  id: string;
  employeeId: string;
  validFrom: Date;
  validUntil: Date | null;
  scheduleTemplate: {
    days: Array<{
      weekday: number;
      isWorkingDay: boolean;
      expectedMinutes: number;
      expectedBreakStart: string | null;
      expectedBreakEnd: string | null;
      expectedBreakMinutes: number;
      requiresBreak: boolean;
    }>;
  };
}

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfBusinessDay(value: string) {
  return businessDateTimeToUtc(`${value} 00:00:00`);
}

function nextBusinessDate(value: string) {
  return toBusinessDate(addDays(toDateOnly(value), 1));
}

function expectedBreakMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return undefined;
  const [startHour = Number.NaN, startMinute = Number.NaN] = start.split(":").map(Number);
  const [endHour = Number.NaN, endMinute = Number.NaN] = end.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((part) => Number.isNaN(part))) return undefined;

  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  return minutes >= 0 ? minutes : undefined;
}

function referenceMonthFor(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function scheduleForDay(assignment: ScheduleAssignmentWithDays | undefined, date: Date): DailySchedule | undefined {
  if (!assignment) return undefined;
  const weekday = date.getUTCDay();
  const scheduleDay = assignment.scheduleTemplate.days.find((day) => day.weekday === weekday);
  if (!scheduleDay) return undefined;

  return {
    expectedMinutes: scheduleDay.expectedMinutes,
    isWorkingDay: scheduleDay.isWorkingDay,
    expectedBreakMinutes: scheduleDay.requiresBreak || scheduleDay.expectedBreakStart || scheduleDay.expectedBreakEnd
      ? scheduleDay.expectedBreakMinutes || expectedBreakMinutes(scheduleDay.expectedBreakStart, scheduleDay.expectedBreakEnd)
      : undefined,
  };
}

function dayKey(employeeId: string, date: string) {
  return `${employeeId}|${date}`;
}

function assignmentForDay(assignments: readonly ScheduleAssignmentWithDays[], date: Date) {
  const dateTime = date.getTime();
  return assignments
    .filter((assignment) => assignment.validFrom.getTime() <= dateTime && (!assignment.validUntil || assignment.validUntil.getTime() >= dateTime))
    .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0];
}

/**
 * Rebuilds only affected days in batches. RawPunch remains immutable; this routine only writes
 * summaries and calculation-origin inconsistencies. One batch avoids thousands of round trips
 * for a cumulative device export.
 */
export async function recalculateAffectedDays(
  transaction: Prisma.TransactionClient,
  affectedDays: readonly AffectedAttendanceDay[],
  options: RecalculateOptions = {},
) {
  const uniqueDays = new Map<string, AffectedAttendanceDay>();
  for (const day of affectedDays) uniqueDays.set(dayKey(day.employeeId, day.date), day);
  const days = [...uniqueDays.values()];
  if (days.length === 0) return { recalculatedDays: 0, generatedInconsistencies: 0 };

  const dates = days.map((day) => toDateOnly(day.date));
  const employeeIds = [...new Set(days.map((day) => day.employeeId))];
  const minimumDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maximumDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  const rangeStart = startOfBusinessDay(toBusinessDate(minimumDate));
  const rangeEnd = startOfBusinessDay(nextBusinessDate(toBusinessDate(maximumDate)));
  const referenceMonths = [...new Map(dates.map((date) => [referenceMonthFor(date).toISOString(), referenceMonthFor(date)])).values()];

  const closedPeriods = await transaction.closingPeriod.findMany({
    where: { referenceMonth: { in: referenceMonths }, status: "CLOSED" },
    select: { referenceMonth: true },
  });
  if (closedPeriods.length > 0 && !options.allowClosedPeriod) {
    throw new Error("A competência está fechada e não pode ser recalculada sem reabertura auditável.");
  }

  const [punches, assignments, adjustments, currentSummaries] = await Promise.all([
    transaction.rawPunch.findMany({
      where: {
        employeeDeviceLink: { employeeId: { in: employeeIds } },
        occurredAt: { gte: rangeStart, lt: rangeEnd },
      },
      select: { id: true, occurredAt: true, punchCode: true, employeeDeviceLink: { select: { employeeId: true } } },
      orderBy: { occurredAt: "asc" },
    }),
    transaction.employeeScheduleAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        validFrom: { lte: maximumDate },
        OR: [{ validUntil: null }, { validUntil: { gte: minimumDate } }],
      },
      include: {
        scheduleTemplate: {
          select: {
            days: {
              select: {
                weekday: true,
                isWorkingDay: true,
                expectedMinutes: true,
                expectedBreakStart: true,
                expectedBreakEnd: true,
                expectedBreakMinutes: true,
                requiresBreak: true,
              },
            },
          },
        },
      },
      orderBy: { validFrom: "desc" },
    }),
    transaction.adjustment.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: minimumDate, lte: maximumDate }, status: "ACTIVE" },
      select: { id: true, employeeId: true, date: true, minutesCredited: true, minutesDebited: true, status: true },
    }),
    transaction.dailySummary.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: minimumDate, lte: maximumDate } },
    }),
  ]);

  const affectedKeys = new Set(uniqueDays.keys());
  const punchesByDay = new Map<string, AttendancePunchForCalculation[]>();
  for (const punch of punches) {
    const employeeId = punch.employeeDeviceLink?.employeeId;
    if (!employeeId) continue;
    const key = dayKey(employeeId, toBusinessDate(punch.occurredAt));
    if (!affectedKeys.has(key)) continue;
    const group = punchesByDay.get(key) ?? [];
    group.push({ id: punch.id, occurredAt: punch.occurredAt, punchCode: punch.punchCode });
    punchesByDay.set(key, group);
  }

  const assignmentsByEmployee = new Map<string, ScheduleAssignmentWithDays[]>();
  for (const assignment of assignments) {
    const group = assignmentsByEmployee.get(assignment.employeeId) ?? [];
    group.push(assignment);
    assignmentsByEmployee.set(assignment.employeeId, group);
  }
  const adjustmentsByDay = new Map<string, MinuteAdjustment[]>();
  for (const adjustment of adjustments) {
    const key = dayKey(adjustment.employeeId, toBusinessDate(adjustment.date));
    const group = adjustmentsByDay.get(key) ?? [];
    group.push(adjustment);
    adjustmentsByDay.set(key, group);
  }
  const summariesByDay = new Map(currentSummaries.map((summary) => [dayKey(summary.employeeId, toBusinessDate(summary.date)), summary]));

  const computed = days.map((day) => {
    const date = toDateOnly(day.date);
    const key = dayKey(day.employeeId, day.date);
    const assignment = assignmentForDay(assignmentsByEmployee.get(day.employeeId) ?? [], date);
    const calculation = calculateDailySummary({
      punches: punchesByDay.get(key) ?? [],
      schedule: scheduleForDay(assignment, date),
      adjustments: adjustmentsByDay.get(key) ?? [],
    });
    return { ...day, key, date, assignment, calculation, currentSummary: summariesByDay.get(key) };
  });

  const now = new Date();
  const creates = computed.filter((item) => !item.currentSummary);
  const createdSummaries = creates.length > 0
    ? await transaction.dailySummary.createManyAndReturn({
        data: creates.map((item) => ({
          employeeId: item.employeeId,
          date: item.date,
          scheduleAssignmentId: item.assignment?.id,
          expectedMinutes: item.calculation.expectedMinutes,
          rawWorkedMinutes: item.calculation.rawWorkedMinutes,
          validWorkedMinutes: item.calculation.validWorkedMinutes,
          intervalMinutes: item.calculation.intervalMinutes,
          positiveMinutes: item.calculation.positiveMinutes,
          negativeMinutes: item.calculation.negativeMinutes,
          pendingExcessMinutes: item.calculation.pendingExcessMinutes,
          status: item.calculation.status,
          calculationVersion: 1,
          calculatedAt: now,
        })),
      })
    : [];
  const summaryIdByDay = new Map(createdSummaries.map((summary) => [dayKey(summary.employeeId, toBusinessDate(summary.date)), summary.id]));

  const updates = computed.filter((item) => item.currentSummary);
  for (const item of updates) {
    const current = item.currentSummary;
    if (!current) continue;
    await transaction.dailySummary.update({
      where: { id: current.id },
      data: {
        scheduleAssignmentId: item.assignment?.id,
        expectedMinutes: item.calculation.expectedMinutes,
        rawWorkedMinutes: item.calculation.rawWorkedMinutes,
        validWorkedMinutes: item.calculation.validWorkedMinutes,
        intervalMinutes: item.calculation.intervalMinutes,
        positiveMinutes: item.calculation.positiveMinutes,
        negativeMinutes: item.calculation.negativeMinutes,
        pendingExcessMinutes: item.calculation.pendingExcessMinutes,
        status: item.calculation.status,
        calculationVersion: current.calculationVersion + 1,
        calculatedAt: now,
      },
    });
    summaryIdByDay.set(item.key, current.id);
  }

  const summaryIds = [...summaryIdByDay.values()];
  if (summaryIds.length > 0) {
    await transaction.inconsistency.updateMany({
      where: { dailySummaryId: { in: summaryIds }, status: "OPEN" },
      data: { status: "DISMISSED", resolvedAt: now, resolutionReason: "Substituída por um recálculo automático mais recente." },
    });
  }

  const inconsistencies = computed.flatMap((item) => {
    const summaryId = summaryIdByDay.get(item.key);
    if (!summaryId) return [];
    const version = (item.currentSummary?.calculationVersion ?? 0) + 1;
    return item.calculation.inconsistencies.map((inconsistency) => ({
      employeeId: item.employeeId,
      dailySummaryId: summaryId,
      importFileId: options.importFileId,
      date: item.date,
      type: inconsistency.type,
      severity: inconsistency.severity,
      status: "OPEN" as const,
      description: inconsistency.description,
      metadata: { source: "CALCULATION", calculationVersion: version, punchIds: inconsistency.punchIds },
    }));
  });
  if (inconsistencies.length > 0) await transaction.inconsistency.createMany({ data: inconsistencies });

  return { recalculatedDays: computed.length, generatedInconsistencies: inconsistencies.length };
}

export async function recalculatePersistedDay(
  transaction: Prisma.TransactionClient,
  affected: AffectedAttendanceDay,
  options: RecalculateOptions = {},
) {
  return recalculateAffectedDays(transaction, [affected], options);
}
