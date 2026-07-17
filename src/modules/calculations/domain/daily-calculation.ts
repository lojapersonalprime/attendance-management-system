import { toBusinessDate } from "@/lib/dates/business";
import type {
  AttendancePunchForCalculation,
  CalculationInconsistency,
  DailyCalculation,
  DailySchedule,
  MinuteAdjustment,
} from "@/modules/calculations/domain/types";

const REGULAR_SEQUENCE = ["S", "E", "A", "F"] as const;

export function groupPunchesByEmployeeAndDay<T extends AttendancePunchForCalculation & { employeeId: string }>(
  punches: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const punch of punches) {
    const key = `${punch.employeeId}|${toBusinessDate(punch.occurredAt)}`;
    const group = groups.get(key) ?? [];
    group.push(punch);
    groups.set(key, group);
  }
  return groups;
}

export function sortPunches(punches: readonly AttendancePunchForCalculation[]): AttendancePunchForCalculation[] {
  return [...punches].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
}

/** One consistent policy: durations are truncated to complete elapsed minutes. */
export function durationInWholeMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

export function hasRegularSequence(punches: readonly AttendancePunchForCalculation[]): boolean {
  return (
    punches.length === REGULAR_SEQUENCE.length &&
    punches.every((punch, index) => punch.punchCode === REGULAR_SEQUENCE[index])
  );
}

export function formPairs(
  punches: readonly AttendancePunchForCalculation[],
): Array<{ start: AttendancePunchForCalculation; end: AttendancePunchForCalculation }> {
  const pairs: Array<{ start: AttendancePunchForCalculation; end: AttendancePunchForCalculation }> = [];
  for (let index = 0; index + 1 < punches.length; index += 2) {
    const start = punches[index];
    const end = punches[index + 1];
    if (start && end) pairs.push({ start, end });
  }
  return pairs;
}

export function detectPossibleDuplicates(
  punches: readonly AttendancePunchForCalculation[],
  thresholdSeconds = 120,
): CalculationInconsistency[] {
  const duplicates: CalculationInconsistency[] = [];
  const sorted = sortPunches(punches);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current || previous.punchCode !== current.punchCode) continue;
    const differenceSeconds = Math.abs(current.occurredAt.getTime() - previous.occurredAt.getTime()) / 1_000;
    if (differenceSeconds <= thresholdSeconds) {
      duplicates.push({
        type: "POSSIBLE_DUPLICATE",
        severity: "WARNING",
        description: "Marcações com o mesmo código ocorreram em intervalo muito próximo e exigem revisão.",
        punchIds: [previous.id, current.id],
      });
    }
  }
  return duplicates;
}

export function validateSequence(punches: readonly AttendancePunchForCalculation[]): CalculationInconsistency[] {
  const issues: CalculationInconsistency[] = [];
  const sorted = sortPunches(punches);
  const codes = sorted.map((punch) => punch.punchCode);
  const ids = sorted.map((punch) => punch.id);
  const count = (code: string) => codes.filter((value) => value === code).length;

  if (sorted.length % 2 !== 0) {
    issues.push({
      type: "ODD_PUNCH_COUNT",
      severity: "CRITICAL",
      description: "A quantidade ímpar de marcações impede o fechamento automático do dia.",
      punchIds: ids,
    });
  }

  if (count("S") === 0) {
    issues.push({ type: "MISSING_ENTRY", severity: "CRITICAL", description: "Entrada inicial ausente.", punchIds: ids });
  }
  if (count("E") === 0) {
    issues.push({ type: "MISSING_BREAK_OUT", severity: "WARNING", description: "Saída para intervalo ausente.", punchIds: ids });
  }
  if (count("A") === 0) {
    issues.push({ type: "MISSING_BREAK_RETURN", severity: "WARNING", description: "Retorno do intervalo ausente.", punchIds: ids });
  }
  if (count("F") === 0) {
    issues.push({ type: "MISSING_EXIT", severity: "CRITICAL", description: "Saída final ausente.", punchIds: ids });
  }
  if (count("S") > 1) {
    issues.push({ type: "MULTIPLE_ENTRIES", severity: "WARNING", description: "Há mais de uma entrada inicial.", punchIds: ids });
  }
  if (count("F") > 1) {
    issues.push({ type: "MULTIPLE_EXITS", severity: "WARNING", description: "Há mais de uma saída final.", punchIds: ids });
  }
  if (!hasRegularSequence(sorted)) {
    issues.push({
      type: "INVALID_SEQUENCE",
      severity: "CRITICAL",
      description: "A sequência esperada para cálculo automático é S → E → A → F.",
      punchIds: ids,
    });
  }
  return issues;
}

function calculateRegularPeriods(punches: readonly AttendancePunchForCalculation[]) {
  const [entry, breakOut, breakReturn, exit] = punches;
  if (!entry || !breakOut || !breakReturn || !exit) return undefined;
  const firstPeriodMinutes = durationInWholeMinutes(entry.occurredAt, breakOut.occurredAt);
  const intervalMinutes = durationInWholeMinutes(breakOut.occurredAt, breakReturn.occurredAt);
  const secondPeriodMinutes = durationInWholeMinutes(breakReturn.occurredAt, exit.occurredAt);
  return {
    intervalMinutes,
    workedMinutes: firstPeriodMinutes + secondPeriodMinutes,
  };
}

export function calculateDailySummary(input: {
  punches: readonly AttendancePunchForCalculation[];
  schedule?: DailySchedule;
  adjustments?: readonly MinuteAdjustment[];
  duplicateThresholdSeconds?: number;
}): DailyCalculation {
  const sortedPunches = sortPunches(input.punches);
  const inconsistencies = [
    ...validateSequence(sortedPunches),
    ...detectPossibleDuplicates(sortedPunches, input.duplicateThresholdSeconds),
  ];
  const regularPeriods = hasRegularSequence(sortedPunches) ? calculateRegularPeriods(sortedPunches) : undefined;
  const rawWorkedMinutes = regularPeriods?.workedMinutes ?? 0;
  const intervalMinutes = regularPeriods?.intervalMinutes ?? 0;
  const activeAdjustments = (input.adjustments ?? []).filter((adjustment) => adjustment.status === "ACTIVE");
  const adjustmentDelta = activeAdjustments.reduce(
    (total, adjustment) => total + adjustment.minutesCredited - adjustment.minutesDebited,
    0,
  );
  const validWorkedMinutes = Math.max(0, rawWorkedMinutes + adjustmentDelta);
  const expectedMinutes = input.schedule?.expectedMinutes ?? 0;

  if (!input.schedule) {
    inconsistencies.push({
      type: "MISSING_SCHEDULE",
      severity: "WARNING",
      description: "Sem jornada cadastrada para esta data; não foi inventada carga horária.",
      punchIds: [],
    });
  } else if (!input.schedule.isWorkingDay && sortedPunches.length > 0) {
    inconsistencies.push({
      type: "PUNCH_ON_DAY_OFF",
      severity: "WARNING",
      description: "Há marcações em um dia de folga configurado.",
      punchIds: sortedPunches.map((punch) => punch.id),
    });
  }

  if (input.schedule?.expectedBreakMinutes !== undefined && regularPeriods) {
    if (intervalMinutes < input.schedule.expectedBreakMinutes) {
      inconsistencies.push({
        type: "INTERVAL_TOO_SHORT",
        severity: "WARNING",
        description: "Intervalo menor que o previsto na jornada.",
        punchIds: sortedPunches.slice(1, 3).map((punch) => punch.id),
      });
    }
    if (intervalMinutes > input.schedule.expectedBreakMinutes) {
      inconsistencies.push({
        type: "INTERVAL_TOO_LONG",
        severity: "WARNING",
        description: "Intervalo maior que o previsto na jornada.",
        punchIds: sortedPunches.slice(1, 3).map((punch) => punch.id),
      });
    }
  }

  const difference = validWorkedMinutes - expectedMinutes;
  const pendingExcessMinutes = input.schedule && difference > 0 ? difference : 0;
  const negativeMinutes = input.schedule && difference < 0 ? Math.abs(difference) : 0;
  if (pendingExcessMinutes > 0) {
    inconsistencies.push({
      type: "EXCESS_TIME_PENDING",
      severity: "INFO",
      description: "Tempo excedente está pendente de validação do RH e não foi aprovado automaticamente.",
      punchIds: sortedPunches.map((punch) => punch.id),
    });
  }

  const hasCriticalIssue = inconsistencies.some((issue) => issue.severity === "CRITICAL");
  return {
    sortedPunches,
    rawWorkedMinutes,
    validWorkedMinutes,
    intervalMinutes,
    expectedMinutes,
    positiveMinutes: 0,
    negativeMinutes,
    pendingExcessMinutes,
    status: hasCriticalIssue || inconsistencies.length > 0 ? "NEEDS_REVIEW" : "REGULAR",
    inconsistencies,
  };
}

/** Explicit domain entry point used by services after import or treatment of one business day. */
export function recalculateDay(input: {
  punches: readonly AttendancePunchForCalculation[];
  schedule?: DailySchedule;
  adjustments?: readonly MinuteAdjustment[];
  duplicateThresholdSeconds?: number;
}): DailyCalculation {
  return calculateDailySummary(input);
}

/** Recalculates an already grouped period without coupling calculation rules to database access. */
export function recalculatePeriod(
  days: ReadonlyArray<{
    key: string;
    punches: readonly AttendancePunchForCalculation[];
    schedule?: DailySchedule;
    adjustments?: readonly MinuteAdjustment[];
  }>,
): Map<string, DailyCalculation> {
  return new Map(days.map((day) => [day.key, recalculateDay(day)]));
}
