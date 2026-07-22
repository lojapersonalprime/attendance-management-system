import "server-only";

import { businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { selectScheduleRecalculationDates } from "@/modules/schedules/domain/schedule-assignment-pipeline";

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
  const [imports, links, periods, assignments, closedPeriods, punches, summaries] = await Promise.all([
    prisma.importFile.findMany({
      where: { coverageFrom: { lte: rangeEnd }, coverageTo: { gte: rangeStart } },
      select: { coverageStatus: true, coverageFrom: true, coverageTo: true },
    }),
    prisma.employeeDeviceLink.findMany({
      where: { employeeId: input.employeeId, validFrom: { lte: rangeEnd }, OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      select: { id: true },
    }),
    prisma.employeeEmploymentPeriod.findMany({
      where: { employeeId: input.employeeId, validFrom: { lte: rangeEnd }, OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      select: { calculationPolicyId: true },
    }),
    prisma.employeeScheduleAssignment.findMany({
      where: { employeeId: input.employeeId, validFrom: { lte: rangeEnd }, OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      select: { id: true },
    }),
    prisma.closingPeriod.findMany({
      where: { status: "CLOSED", referenceMonth: { gte: new Date(`${input.validFrom.slice(0, 7)}-01T00:00:00.000Z`), lte: new Date(`${input.validUntil.slice(0, 7)}-01T00:00:00.000Z`) } },
      select: { referenceMonth: true },
    }),
    prisma.rawPunch.findMany({
      where: { employeeDeviceLink: { employeeId: input.employeeId }, occurredAt: { gte: punchStart, lt: punchEnd } },
      select: { occurredAt: true },
    }),
    prisma.dailySummary.findMany({
      where: { employeeId: input.employeeId, date: { gte: rangeStart, lte: rangeEnd } },
      select: { date: true },
    }),
  ]);
  const txtImported = imports.length > 0;
  const coverageConfirmed = imports.some((file) => file.coverageStatus === "CONFIRMED");
  const clockLinkFound = links.length > 0;
  const employmentPeriodFound = periods.length > 0;
  const calculationPolicyFound = periods.some((period) => Boolean(period.calculationPolicyId));
  const scheduleFound = assignments.length > 0;
  const closedMonths = new Set(closedPeriods.map((period) => dateKey(period.referenceMonth).slice(0, 7)));
  const confirmedCoverage = imports
    .filter((file) => file.coverageStatus === "CONFIRMED" && file.coverageFrom && file.coverageTo)
    .map((file) => ({ from: dateKey(file.coverageFrom!), until: dateKey(file.coverageTo!) }));
  const candidateDates = [...new Set([
    ...punches.map((punch) => toBusinessDate(punch.occurredAt)),
    ...summaries.map((summary) => dateKey(summary.date)),
  ])].filter((date) => isWithin(date, input.validFrom, input.validUntil));
  const recalculableDates = selectScheduleRecalculationDates({ candidateDates, confirmedCoverage, closedMonths: [...closedMonths] });
  const periodOpen = candidateDates.length === 0 || recalculableDates.length > 0;
  const punchesFound = punches.length > 0;
  const blockers: CalculationReadiness["blockers"] = [];
  if (!txtImported) blockers.push({ code: "TXT_NOT_IMPORTED", message: "Ainda não há arquivo de ponto para este período." });
  if (!coverageConfirmed) blockers.push({ code: "IMPORT_COVERAGE_UNCONFIRMED", message: "Confirme o período do arquivo antes de apurar ausências." });
  if (!clockLinkFound) blockers.push({ code: "MISSING_CLOCK_LINK", message: "Vincule o funcionário ao código usado no relógio." });
  if (!employmentPeriodFound) blockers.push({ code: "MISSING_EMPLOYMENT_PERIOD", message: "Informe o período de vínculo de trabalho." });
  if (!calculationPolicyFound) blockers.push({ code: "MISSING_CALCULATION_POLICY", message: "Selecione uma política de cálculo no vínculo." });
  if (!scheduleFound) blockers.push({ code: "MISSING_SCHEDULE", message: "A jornada ainda não está disponível para o período." });
  if (!periodOpen) blockers.push({ code: "CLOSED_PERIOD", message: "Não há dias abertos para recalcular neste intervalo." });
  if (!punchesFound) blockers.push({ code: "NO_PUNCHES", message: "Não há marcações do relógio no período selecionado." });

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
