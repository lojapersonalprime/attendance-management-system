import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { addBusinessDateDays, businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { calculateDailyWithEngine, type EngineCalculationPolicy, type EngineInconsistency, type EngineSchedule } from "@/modules/calculations/domain/calculation-engine";
import { buildDailySummaryPersistenceData } from "@/modules/calculations/domain/daily-summary-persistence";
import { resolvePunchEmployeeId } from "@/modules/calculations/domain/clock-link-resolution";
import { selectEmploymentPeriodForDate } from "@/modules/calculations/domain/employment-periods";
import { reconcileCalculationInconsistencies } from "@/modules/calculations/application/reconcile-inconsistencies";
import { selectScheduleDayForBusinessDate } from "@/modules/schedules/domain/schedule-context";

export interface AffectedCalculationDay {
  employeeId: string;
  date: string;
}

interface CalculationRunInput {
  trigger: "IMPORT" | "EMPLOYMENT_PERIOD_CHANGE" | "SCHEDULE_CHANGE" | "POLICY_CHANGE" | "ADJUSTMENT" | "MANUAL_RECALCULATION" | "PERIOD_REOPENED" | "IMPORT_COVERAGE_CONFIRMED";
  affectedDays: readonly AffectedCalculationDay[];
  importFileId?: string;
  employeeId?: string;
  startedById?: string;
  allowClosedPeriod?: boolean;
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dayKey(employeeId: string, date: string) {
  return `${employeeId}|${date}`;
}

function chunks<T>(items: readonly T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push([...items.slice(index, index + size)]);
  return result;
}

/** Calculation memories contain only serialisable primitives before Prisma persists them as JSONB. */
function calculationMemoryJson(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function scheduleForDate(assignment: {
  id: string;
  scheduleTemplate: { id: string; name: string; days: Array<{ weekday: number; isWorkingDay: boolean; expectedEntry: string | null; expectedBreakStart: string | null; expectedBreakEnd: string | null; expectedExit: string | null; expectedMinutes: number; expectedBreakMinutes: number; minimumBreakMinutes: number | null; requiresBreak: boolean }> };
} | undefined, businessDate: string): EngineSchedule | undefined {
  if (!assignment) return undefined;
  const day = selectScheduleDayForBusinessDate(assignment.scheduleTemplate.days, businessDate);
  if (!day) return undefined;
  return {
    id: assignment.scheduleTemplate.id,
    assignmentId: assignment.id,
    name: assignment.scheduleTemplate.name,
    isWorkingDay: day.isWorkingDay,
    expectedEntry: day.expectedEntry,
    expectedBreakStart: day.expectedBreakStart,
    expectedBreakEnd: day.expectedBreakEnd,
    expectedExit: day.expectedExit,
    expectedMinutes: day.expectedMinutes,
    expectedBreakMinutes: day.expectedBreakMinutes,
    minimumBreakMinutes: day.minimumBreakMinutes,
    requiresBreak: day.requiresBreak,
  };
}

function policyForEngine(policy: EngineCalculationPolicy | null): EngineCalculationPolicy | null {
  return policy;
}

async function calculateBatch(
  transaction: Prisma.TransactionClient,
  days: readonly AffectedCalculationDay[],
  options: { importFileId?: string; calculationRunId: string; allowClosedPeriod?: boolean },
) {
  const unique = [...new Map(days.map((day) => [dayKey(day.employeeId, day.date), day])).values()];
  if (unique.length === 0) return { processedDays: 0, generatedInconsistencies: 0, autoResolved: 0 };
  const employeeIds = [...new Set(unique.map((day) => day.employeeId))];
  const dates = unique.map((day) => dateOnly(day.date));
  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  const start = businessDateTimeToUtc(`${dateKey(minDate)} 00:00:00`);
  const end = businessDateTimeToUtc(`${addBusinessDateDays(dateKey(maxDate), 1)} 00:00:00`);
  const months = [...new Map(dates.map((date) => {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    return [month.toISOString(), month] as const;
  })).values()];
  const closed = await transaction.closingPeriod.findMany({ where: { referenceMonth: { in: months }, status: "CLOSED" }, select: { referenceMonth: true } });
  if (closed.length > 0 && !options.allowClosedPeriod) throw new Error("A competência está fechada e não pode ser recalculada sem reabertura auditável.");

  const employeeLinks = await transaction.employeeDeviceLink.findMany({
    where: { employeeId: { in: employeeIds }, validFrom: { lte: maxDate }, OR: [{ validUntil: null }, { validUntil: { gte: minDate } }] },
    select: { id: true, employeeId: true, deviceId: true, externalEmployeeNumber: true, validFrom: true, validUntil: true },
  });
  const legacyIdentity = employeeLinks.map((link) => ({ deviceId: link.deviceId, externalEmployeeNumber: link.externalEmployeeNumber }));
  const normalizedLinks = employeeLinks.map((link) => ({
    ...link,
    validFrom: dateKey(link.validFrom),
    validUntil: link.validUntil ? dateKey(link.validUntil) : null,
  }));

  const [employees, punches, assignments, employmentPeriods, adjustments, summaries, exceptions, rangedCoverage] = await Promise.all([
    transaction.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, provisional: true } }),
    transaction.rawPunch.findMany({
      where: {
        occurredAt: { gte: start, lt: end },
        OR: [
          { employeeDeviceLink: { employeeId: { in: employeeIds } } },
          ...(legacyIdentity.length > 0 ? [{ employeeDeviceLinkId: null, OR: legacyIdentity }] : []),
        ],
      },
      select: { id: true, occurredAt: true, punchCode: true, fingerprint: true, deviceId: true, externalEmployeeNumber: true, employeeDeviceLinkId: true, employeeDeviceLink: { select: { employeeId: true } }, importFile: { select: { id: true, coverageFrom: true, coverageTo: true, coverageStatus: true } } },
      orderBy: { occurredAt: "asc" },
    }),
    transaction.employeeScheduleAssignment.findMany({
      where: { employeeId: { in: employeeIds }, validFrom: { lte: maxDate }, OR: [{ validUntil: null }, { validUntil: { gte: minDate } }] },
      include: {
        scheduleTemplate: {
          select: {
            id: true,
            name: true,
            days: {
              select: {
                weekday: true,
                isWorkingDay: true,
                expectedEntry: true,
                expectedBreakStart: true,
                expectedBreakEnd: true,
                expectedExit: true,
                expectedMinutes: true,
                expectedBreakMinutes: true,
                minimumBreakMinutes: true,
                requiresBreak: true,
              },
            },
          },
        },
      },
      orderBy: { validFrom: "desc" },
    }),
    transaction.employeeEmploymentPeriod.findMany({
      where: { employeeId: { in: employeeIds }, validFrom: { lte: maxDate }, OR: [{ validUntil: null }, { validUntil: { gte: minDate } }] },
      include: { calculationPolicy: true },
      orderBy: { validFrom: "desc" },
    }),
    transaction.adjustment.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: minDate, lte: maxDate }, status: "ACTIVE" },
      select: { id: true, employeeId: true, date: true, type: true, status: true, originalPunchId: true, adjustedOccurredAt: true, adjustedPunchCode: true, minutesCredited: true, minutesDebited: true, reason: true },
    }),
    transaction.dailySummary.findMany({ where: { employeeId: { in: employeeIds }, date: { gte: minDate, lte: maxDate } } }),
    transaction.calendarException.findMany({ where: { date: { gte: minDate, lte: maxDate }, OR: [{ employeeId: { in: employeeIds } }, { employeeId: null }] }, select: { employeeId: true, date: true, type: true } }),
    transaction.importFile.findMany({ where: { coverageStatus: "CONFIRMED", coverageFrom: { lte: maxDate }, coverageTo: { gte: minDate } }, select: { id: true, coverageFrom: true, coverageTo: true, coverageStatus: true } }),
  ]);

  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const assignmentsByEmployee = new Map<string, typeof assignments>();
  for (const assignment of assignments) assignmentsByEmployee.set(assignment.employeeId, [...(assignmentsByEmployee.get(assignment.employeeId) ?? []), assignment]);
  const periodsByEmployee = new Map<string, typeof employmentPeriods>();
  for (const period of employmentPeriods) periodsByEmployee.set(period.employeeId, [...(periodsByEmployee.get(period.employeeId) ?? []), period]);
  const punchesByDay = new Map<string, typeof punches>();
  for (const punch of punches) {
    const businessDate = toBusinessDate(punch.occurredAt);
    const employeeId = punch.employeeDeviceLink?.employeeId ?? resolvePunchEmployeeId({
      deviceId: punch.deviceId,
      externalEmployeeNumber: punch.externalEmployeeNumber,
      employeeDeviceLinkId: punch.employeeDeviceLinkId,
      businessDate,
    }, normalizedLinks);
    if (!employeeId) continue;
    const key = dayKey(employeeId, businessDate);
    punchesByDay.set(key, [...(punchesByDay.get(key) ?? []), punch]);
  }
  const adjustmentsByDay = new Map<string, typeof adjustments>();
  for (const adjustment of adjustments) {
    const key = dayKey(adjustment.employeeId, dateKey(adjustment.date));
    adjustmentsByDay.set(key, [...(adjustmentsByDay.get(key) ?? []), adjustment]);
  }
  const summaryByDay = new Map(summaries.map((summary) => [dayKey(summary.employeeId, dateKey(summary.date)), summary]));
  let generatedInconsistencies = 0;
  let autoResolved = 0;
  for (const affected of unique) {
    const key = dayKey(affected.employeeId, affected.date);
    const date = dateOnly(affected.date);
    const assignmentMatches = (assignmentsByEmployee.get(affected.employeeId) ?? []).filter((assignment) => assignment.validFrom <= date && (!assignment.validUntil || assignment.validUntil >= date));
    const periodSelection = selectEmploymentPeriodForDate((periodsByEmployee.get(affected.employeeId) ?? []).map((period) => ({ id: period.id, employmentType: period.employmentType, calculationPolicyId: period.calculationPolicyId, validFrom: dateKey(period.validFrom), validUntil: period.validUntil ? dateKey(period.validUntil) : null, status: period.status })), affected.date);
    const selectedPeriod = periodSelection.period ? (periodsByEmployee.get(affected.employeeId) ?? []).find((period) => period.id === periodSelection.period?.id) : undefined;
    const dayPunches = punchesByDay.get(key) ?? [];
    const coverage = [
      ...rangedCoverage.map((file) => ({ importFileId: file.id, coverageFrom: file.coverageFrom ? dateKey(file.coverageFrom) : null, coverageTo: file.coverageTo ? dateKey(file.coverageTo) : null, status: file.coverageStatus })),
      ...dayPunches.map((punch) => ({ importFileId: punch.importFile.id, coverageFrom: punch.importFile.coverageFrom ? dateKey(punch.importFile.coverageFrom) : null, coverageTo: punch.importFile.coverageTo ? dateKey(punch.importFile.coverageTo) : null, status: punch.importFile.coverageStatus })),
    ];
    const calculation = calculateDailyWithEngine({
      businessDate: affected.date,
      employeeId: affected.employeeId,
      employeeProvisional: employeeById.get(affected.employeeId)?.provisional,
      rawPunches: dayPunches.map((punch) => ({ id: punch.id, occurredAt: punch.occurredAt, punchCode: punch.punchCode, importFileId: punch.importFile.id, fingerprint: punch.fingerprint })),
      adjustments: (adjustmentsByDay.get(key) ?? []).map((adjustment) => ({ ...adjustment, adjustedPunchCode: adjustment.adjustedPunchCode ?? null })),
      employmentPeriod: selectedPeriod ? { id: selectedPeriod.id, employmentType: selectedPeriod.employmentType, validFrom: dateKey(selectedPeriod.validFrom), validUntil: selectedPeriod.validUntil ? dateKey(selectedPeriod.validUntil) : null, calculationPolicyId: selectedPeriod.calculationPolicyId } : null,
      policy: policyForEngine(selectedPeriod?.calculationPolicy ?? null),
      schedule: scheduleForDate(assignmentMatches[0], affected.date),
      coverage,
      calendarDayOff: exceptions.some((exception) => dateKey(exception.date) === affected.date && (exception.employeeId === null || exception.employeeId === affected.employeeId) && exception.type === "DAY_OFF"),
    });
    const extraIssues: EngineInconsistency[] = [];
    if (assignmentMatches.length > 1) extraIssues.push({ type: "OVERLAPPING_SCHEDULE", severity: "CRITICAL", description: "Há mais de uma jornada vigente para a mesma data.", punchIds: [], context: { assignmentCount: assignmentMatches.length } });
    if (periodSelection.overlapping.length > 1) extraIssues.push({ type: "OVERLAPPING_EMPLOYMENT_PERIOD", severity: "CRITICAL", description: "Há mais de um período de vínculo vigente para a mesma data.", punchIds: [], context: { periodCount: periodSelection.overlapping.length } });
    const issues = [...calculation.inconsistencies, ...extraIssues];
    const current = summaryByDay.get(key);
    const persisted = buildDailySummaryPersistenceData(calculation, {
      scheduleAssignmentId: assignmentMatches[0]?.id ?? null,
      employmentPeriodId: selectedPeriod?.id ?? null,
      calculationPolicyId: selectedPeriod?.calculationPolicyId ?? null,
      calculationRunId: options.calculationRunId,
      issues,
      status: extraIssues.some((item) => item.severity === "CRITICAL") ? "NEEDS_REVIEW" : calculation.status,
    });
    const data = { ...persisted, calculationMemory: calculationMemoryJson(persisted.calculationMemory) };
    const summary = current
      ? await transaction.dailySummary.update({ where: { id: current.id }, data: { ...data, calculationVersion: current.calculationVersion + 1 } })
      : await transaction.dailySummary.create({ data: { employeeId: affected.employeeId, date, calculationVersion: 1, ...data } });
    const reconciliation = await reconcileCalculationInconsistencies(transaction, { employeeId: affected.employeeId, businessDate: date, dailySummaryId: summary.id, importFileId: options.importFileId, calculationVersion: calculation.calculationVersion, issues });
    generatedInconsistencies += reconciliation.created;
    autoResolved += reconciliation.autoResolved;
  }
  return { processedDays: unique.length, generatedInconsistencies, autoResolved };
}

export async function runCalculation(input: CalculationRunInput) {
  const affectedDays = [...new Map(input.affectedDays.map((day) => [dayKey(day.employeeId, day.date), day])).values()];
  if (affectedDays.length === 0) return { calculationRunId: null, processedDays: 0, failedDays: 0, generatedInconsistencies: 0, autoResolved: 0, status: "COMPLETED" as const };
  const sorted = [...affectedDays].sort((left, right) => left.date.localeCompare(right.date));
  const prisma = getPrisma();
  const calculationRun = await prisma.calculationRun.create({
    data: { trigger: input.trigger, importFileId: input.importFileId, employeeId: input.employeeId, dateFrom: dateOnly(sorted[0]!.date), dateTo: dateOnly(sorted.at(-1)!.date), status: "PROCESSING", totalDays: sorted.length, startedById: input.startedById, startedAt: new Date() },
  });
  if (input.startedById) {
    await prisma.auditLog.create({ data: { userId: input.startedById, action: "CALCULATION_RUN_STARTED", entityType: "CalculationRun", entityId: calculationRun.id, newData: { trigger: input.trigger, totalDays: sorted.length, dateFrom: sorted[0]!.date, dateTo: sorted.at(-1)!.date } } });
  }
  let processedDays = 0;
  let failedDays = 0;
  let generatedInconsistencies = 0;
  let autoResolved = 0;
  let errorCode: string | null = null;
  for (const batch of chunks(sorted, 25)) {
    try {
      const result = await prisma.$transaction((transaction) => calculateBatch(transaction, batch, { importFileId: input.importFileId, calculationRunId: calculationRun.id, allowClosedPeriod: input.allowClosedPeriod }), { timeout: 60_000 });
      processedDays += result.processedDays;
      generatedInconsistencies += result.generatedInconsistencies;
      autoResolved += result.autoResolved;
    } catch (error) {
      failedDays += batch.length;
      errorCode = error instanceof Error && error.message.includes("competência está fechada") ? "CLOSED_PERIOD" : "BATCH_FAILURE";
    }
    await prisma.calculationRun.update({ where: { id: calculationRun.id }, data: { processedDays, failedDays } });
  }
  const status: "COMPLETED" | "PARTIAL" | "FAILED" = failedDays === 0 ? "COMPLETED" : processedDays > 0 ? "PARTIAL" : "FAILED";
  await prisma.calculationRun.update({ where: { id: calculationRun.id }, data: { status, processedDays, failedDays, finishedAt: new Date(), errorCode: failedDays > 0 ? errorCode ?? "BATCH_FAILURE" : null } });
  if (input.startedById) {
    await prisma.auditLog.create({ data: { userId: input.startedById, action: "CALCULATION_RUN_COMPLETED", entityType: "CalculationRun", entityId: calculationRun.id, newData: { status, processedDays, failedDays, generatedInconsistencies, autoResolved } } });
  }
  return { calculationRunId: calculationRun.id, processedDays, failedDays, generatedInconsistencies, autoResolved, status };
}
