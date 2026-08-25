import "server-only";

import { businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { resolvePunchEmployeeId } from "@/modules/calculations/domain/clock-link-resolution";
import { selectConfirmedCoverageDates, selectScheduleRecalculationDates } from "@/modules/schedules/domain/schedule-assignment-pipeline";
import { selectScheduleDayForBusinessDate } from "@/modules/schedules/domain/schedule-context";

export interface CalculationReadiness {
  ready: boolean;
  txtImported: boolean;
  coverageConfirmed: boolean;
  clockLinkFound: boolean;
  employmentPeriodFound: boolean;
  calculationPolicyFound: boolean;
  scheduleFound: boolean;
  periodOpen: boolean;
  punchesFound: boolean;
  blockers: Array<{ code: string; message: string }>;
  recalculableDates: string[];
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayAfter(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 0) + 1)).toISOString().slice(0, 10);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isWithin(value: string, validFrom: string, validUntil: string) {
  return value >= validFrom && value <= validUntil;
}

/**
 * Checks whether a context is ready to produce a definitive result. Saving a
 * schedule never depends on this result: missing HR context becomes a clear
 * next step instead of an invisible persistence failure.
 */
export async function getCalculationReadiness(input: { employeeId: string; validFrom: string; validUntil: string }): Promise<CalculationReadiness> {
  const prisma = getPrisma();
  const rangeStart = dateOnly(input.validFrom);
  const rangeEnd = dateOnly(input.validUntil);
  const punchStart = businessDateTimeToUtc(`${input.validFrom} 00:00:00`);
  const punchEnd = businessDateTimeToUtc(`${dayAfter(input.validUntil)} 00:00:00`);
  const [imports, links, periods, assignments, closedPeriods, summaries] = await Promise.all([
    prisma.importFile.findMany({
      where: { coverageFrom: { lte: rangeEnd }, coverageTo: { gte: rangeStart } },
      select: { coverageStatus: true, coverageFrom: true, coverageTo: true },
    }),
    prisma.employeeDeviceLink.findMany({
      where: { employeeId: input.employeeId, validFrom: { lte: rangeEnd }, OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      select: { id: true, employeeId: true, deviceId: true, externalEmployeeNumber: true, validFrom: true, validUntil: true },
    }),
    prisma.employeeEmploymentPeriod.findMany({
      where: { employeeId: input.employeeId, validFrom: { lte: rangeEnd }, OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      select: { calculationPolicyId: true, validFrom: true, validUntil: true },
    }),
    prisma.employeeScheduleAssignment.findMany({
      where: { employeeId: input.employeeId, validFrom: { lte: rangeEnd }, OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      select: { id: true, validFrom: true, validUntil: true, scheduleTemplate: { select: { days: { select: { weekday: true, isWorkingDay: true } } } } },
    }),
    prisma.closingPeriod.findMany({
      where: { status: "CLOSED", referenceMonth: { gte: new Date(`${input.validFrom.slice(0, 7)}-01T00:00:00.000Z`), lte: new Date(`${input.validUntil.slice(0, 7)}-01T00:00:00.000Z`) } },
      select: { referenceMonth: true },
    }),
    prisma.dailySummary.findMany({
      where: { employeeId: input.employeeId, date: { gte: rangeStart, lte: rangeEnd } },
      select: { date: true },
    }),
  ]);
  const legacyIdentity = links.map((link) => ({ deviceId: link.deviceId, externalEmployeeNumber: link.externalEmployeeNumber }));
  const punches = await prisma.rawPunch.findMany({
    where: {
      occurredAt: { gte: punchStart, lt: punchEnd },
      OR: [
        { employeeDeviceLink: { employeeId: input.employeeId } },
        ...(legacyIdentity.length > 0 ? [{ employeeDeviceLinkId: null, OR: legacyIdentity }] : []),
      ],
    },
    select: { occurredAt: true, deviceId: true, externalEmployeeNumber: true, employeeDeviceLinkId: true },
  });
  const normalizedLinks = links.flatMap((link) => link.employeeId ? [{
    ...link,
    employeeId: link.employeeId,
    validFrom: dateKey(link.validFrom),
    validUntil: link.validUntil ? dateKey(link.validUntil) : null,
  }] : []);
  const rawDates = new Set(punches.flatMap((punch) => {
    const businessDate = toBusinessDate(punch.occurredAt);
    return resolvePunchEmployeeId({ ...punch, businessDate }, normalizedLinks) === input.employeeId ? [businessDate] : [];
  }));
  const txtImported = imports.length > 0;
  const coverageConfirmed = imports.some((file) => file.coverageStatus === "CONFIRMED");
  const clockLinkFound = links.length > 0;
  const closedMonths = new Set(closedPeriods.map((period) => dateKey(period.referenceMonth).slice(0, 7)));
  const confirmedCoverage = imports
    .filter((file) => file.coverageStatus === "CONFIRMED" && file.coverageFrom && file.coverageTo)
    .map((file) => ({ from: dateKey(file.coverageFrom!), until: dateKey(file.coverageTo!) }));
  const confirmedCoverageDates = selectConfirmedCoverageDates({ validFrom: input.validFrom, validUntil: input.validUntil, confirmedCoverage });
  const candidateDates = [...new Set([
    ...rawDates,
    ...summaries.map((summary) => dateKey(summary.date)),
    ...confirmedCoverageDates,
  ])].filter((date) => isWithin(date, input.validFrom, input.validUntil));
  const contextDates = candidateDates.filter((date) => {
    const assignment = assignments.find((item) => dateKey(item.validFrom) <= date && (!item.validUntil || dateKey(item.validUntil) >= date));
    const scheduleDay = assignment && selectScheduleDayForBusinessDate(assignment.scheduleTemplate.days, date);
    const employmentPeriod = periods.find((item) => dateKey(item.validFrom) <= date && (!item.validUntil || dateKey(item.validUntil) >= date));
    // Existing summaries on a day off also need a recalculation so stale
    // MISSING_SCHEDULE context issues can be reconciled. The engine itself
    // keeps the day off at zero expected minutes and never invents an absence.
    return Boolean(scheduleDay && employmentPeriod);
  });
  const scheduleFound = candidateDates.some((date) => assignments.some((item) => {
    if (dateKey(item.validFrom) > date || (item.validUntil && dateKey(item.validUntil) < date)) return false;
    return Boolean(selectScheduleDayForBusinessDate(item.scheduleTemplate.days, date));
  }));
  const employmentPeriodFound = candidateDates.some((date) => periods.some((item) => dateKey(item.validFrom) <= date && (!item.validUntil || dateKey(item.validUntil) >= date)));
  const calculationPolicyFound = candidateDates.some((date) => periods.some((item) => item.calculationPolicyId && dateKey(item.validFrom) <= date && (!item.validUntil || dateKey(item.validUntil) >= date)));
  const recalculableDates = selectScheduleRecalculationDates({ candidateDates: contextDates, confirmedCoverage, closedMonths: [...closedMonths] });
  const periodOpen = candidateDates.length === 0 || candidateDates.some((date) => !closedMonths.has(date.slice(0, 7)));
  const punchesFound = rawDates.size > 0;
  const blockers: CalculationReadiness["blockers"] = [];
  if (!txtImported) blockers.push({ code: "TXT_NOT_IMPORTED", message: "Ainda não há arquivo de ponto para este período." });
  if (!coverageConfirmed) blockers.push({ code: "IMPORT_COVERAGE_UNCONFIRMED", message: "Confirme o período do arquivo antes de apurar ausências." });
  if (!clockLinkFound) blockers.push({ code: "MISSING_CLOCK_LINK", message: "Vincule o funcionário ao código usado no relógio." });
  if (!employmentPeriodFound) blockers.push({ code: "MISSING_EMPLOYMENT_PERIOD", message: "Informe o período de vínculo de trabalho." });
  if (!calculationPolicyFound) blockers.push({ code: "MISSING_CALCULATION_POLICY", message: "Selecione uma política de cálculo no vínculo." });
  if (!scheduleFound) blockers.push({ code: "MISSING_SCHEDULE", message: "A jornada ainda não está disponível para o período." });
  if (!periodOpen) blockers.push({ code: "CLOSED_PERIOD", message: "Não há dias abertos para recalcular neste intervalo." });
  if (!punchesFound) blockers.push({ code: "NO_PUNCHES", message: "Não há marcações do relógio no período selecionado; ausências só serão avaliadas dentro da cobertura confirmada." });

  return {
    ready: blockers.length === 0,
    txtImported,
    coverageConfirmed,
    clockLinkFound,
    employmentPeriodFound,
    calculationPolicyFound,
    scheduleFound,
    periodOpen,
    punchesFound,
    blockers,
    recalculableDates,
  };
}
