import { formatInTimeZone } from "date-fns-tz";

export const CALCULATION_ENGINE_VERSION = "calculation-engine-v1" as const;
/** RawPunch remains exact; minutes are truncated only once from total elapsed seconds. */
export const ELAPSED_TIME_ROUNDING_POLICY = "FLOOR_TOTAL_ELAPSED_SECONDS" as const;

export type EnginePunchCode = "S" | "E" | "A" | "F";
export type CalculationInconsistencySeverity = "INFO" | "WARNING" | "CRITICAL";
export type CalculationInconsistencyType =
  | "UNKNOWN_EMPLOYEE"
  | "PROVISIONAL_EMPLOYEE"
  | "MISSING_EMPLOYMENT_PERIOD"
  | "OVERLAPPING_EMPLOYMENT_PERIOD"
  | "MISSING_CALCULATION_POLICY"
  | "MISSING_SCHEDULE"
  | "OVERLAPPING_SCHEDULE"
  | "IMPORT_COVERAGE_UNCONFIRMED"
  | "NO_PUNCHES_ON_SCHEDULED_DAY"
  | "ODD_PUNCH_COUNT"
  | "MISSING_ENTRY"
  | "MISSING_EXIT"
  | "MISSING_BREAK_OUT"
  | "MISSING_BREAK_RETURN"
  | "INVALID_SEQUENCE"
  | "POSSIBLE_DUPLICATE"
  | "MULTIPLE_ENTRIES"
  | "MULTIPLE_EXITS"
  | "UNKNOWN_PUNCH_CODE"
  | "PUNCH_ON_DAY_OFF"
  | "PUNCH_OUTSIDE_SCHEDULE"
  | "LATE_ARRIVAL"
  | "EARLY_DEPARTURE"
  | "INTERVAL_TOO_SHORT"
  | "INTERVAL_TOO_LONG"
  | "EXCESS_TIME_PENDING"
  | "INCOMPLETE_DAY"
  | "ADJUSTMENT_REQUIRED"
  | "CLOSED_PERIOD_CHANGE_ATTEMPT"
  | "CALCULATION_FAILED";

export interface EnginePunch {
  id: string;
  occurredAt: Date;
  punchCode: EnginePunchCode;
  importFileId?: string;
  fingerprint?: string;
  origin: "RAW_PUNCH" | "MANUAL_ADJUSTMENT";
  adjustmentId?: string;
  reason?: string;
}

export interface EngineAdjustment {
  id: string;
  type: string;
  status: "ACTIVE" | "CANCELLED";
  originalPunchId?: string | null;
  adjustedOccurredAt?: Date | null;
  adjustedPunchCode?: EnginePunchCode | null;
  minutesCredited: number;
  minutesDebited: number;
  reason: string;
}

export interface ConsideredPunches {
  original: EnginePunch[];
  additions: EnginePunch[];
  disregarded: Array<EnginePunch & { disregardAdjustmentId: string; disregardReason: string }>;
  considered: EnginePunch[];
}

export interface EngineEmploymentPeriod {
  id: string;
  employmentType: "EMPLOYEE" | "INTERN" | "APPRENTICE" | "CONTRACTOR" | "OTHER";
  validFrom: string;
  validUntil?: string | null;
  calculationPolicyId?: string | null;
}

export interface EngineCalculationPolicy {
  id: string;
  name: string;
  requiresSchedule: boolean;
  calculateLateArrival: boolean;
  calculateEarlyDeparture: boolean;
  calculateAbsence: boolean;
  calculateNegativeBalance: boolean;
  calculateExcessTime: boolean;
  excessRequiresApproval: boolean;
  requiresBreak: boolean;
  shortBreakGeneratesCredit: boolean;
  longBreakGeneratesDebit: boolean;
  allowAutomaticPositiveBalance: boolean;
  attendanceOnly: boolean;
  flexibleSchedule: boolean;
  duplicateWindowMinutes: number;
  entryToleranceMinutes: number;
  exitToleranceMinutes: number;
  breakToleranceMinutes: number;
  toleranceMode: "EXCESS_ONLY" | "FULL_EVENT" | "IGNORE_WITHIN_TOLERANCE";
}

export interface EngineSchedule {
  id: string;
  assignmentId?: string;
  name: string;
  isWorkingDay: boolean;
  expectedEntry?: string | null;
  expectedBreakStart?: string | null;
  expectedBreakEnd?: string | null;
  expectedExit?: string | null;
  expectedMinutes: number;
  expectedBreakMinutes: number;
  minimumBreakMinutes?: number | null;
  requiresBreak: boolean;
}

export interface EngineCoverage {
  importFileId: string;
  coverageFrom?: string | null;
  coverageTo?: string | null;
  status: "SUGGESTED" | "CONFIRMED";
}

export interface EngineInconsistency {
  type: CalculationInconsistencyType;
  severity: CalculationInconsistencySeverity;
  description: string;
  punchIds: string[];
  context: Record<string, string | number | boolean | null>;
}

export interface CalculationMemory {
  calculationVersion: typeof CALCULATION_ENGINE_VERSION;
  businessDate: string;
  employeeId: string;
  sourceImportFileIds: string[];
  sourceRawPunchIds: string[];
  coverage: EngineCoverage[];
  employmentPeriod: EngineEmploymentPeriod | null;
  policy: Pick<EngineCalculationPolicy, "id" | "name" | "attendanceOnly" | "flexibleSchedule" | "toleranceMode"> | null;
  schedule: EngineSchedule | null;
  originalPunches: SerializablePunch[];
  manualPunches: SerializablePunch[];
  disregardedPunches: SerializablePunch[];
  consideredPunches: SerializablePunch[];
  activeAdjustments: Array<{ id: string; type: string; minutesCredited: number; minutesDebited: number; reason: string }>;
  periods: Array<{ startPunchId: string; endPunchId: string; seconds: number; minutes: number; kind: "WORK" | "BREAK" }>;
  minutes: Record<string, number>;
  rounding: {
    policy: typeof ELAPSED_TIME_ROUNDING_POLICY;
    workedSeconds: number;
    workedMinutesBeforeRounding: number;
    workedMinutes: number;
    breakSeconds: number;
    breakMinutesBeforeRounding: number;
    breakMinutes: number;
  };
  tolerances: { entry: number; exit: number; break: number; mode: EngineCalculationPolicy["toleranceMode"] } | null;
  inconsistencies: Array<{ type: CalculationInconsistencyType; severity: CalculationInconsistencySeverity }>;
}

interface SerializablePunch {
  id: string;
  occurredAt: string;
  punchCode: EnginePunchCode;
  origin: EnginePunch["origin"];
  importFileId?: string;
  adjustmentId?: string;
  reason?: string;
}

export interface DailyCalculationEngineInput {
  businessDate: string;
  employeeId: string;
  employeeProvisional?: boolean;
  rawPunches: readonly Omit<EnginePunch, "origin">[];
  adjustments?: readonly EngineAdjustment[];
  employmentPeriod?: EngineEmploymentPeriod | null;
  policy?: EngineCalculationPolicy | null;
  schedule?: EngineSchedule | null;
  coverage?: readonly EngineCoverage[];
  calendarDayOff?: boolean;
}

export interface DailyCalculationEngineOutput {
  expectedMinutes: number;
  recordedMinutes: number;
  consideredMinutes: number;
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  rawExcessMinutes: number;
  pendingExcessMinutes: number;
  approvedPositiveMinutes: number;
  negativeMinutes: number;
  absenceMinutes: number;
  status: "PROVISIONAL" | "NEEDS_REVIEW" | "REGULAR";
  calculationVersion: typeof CALCULATION_ENGINE_VERSION;
  consideredPunches: ConsideredPunches;
  memory: CalculationMemory;
  inconsistencies: EngineInconsistency[];
}

function sortPunches(punches: readonly EnginePunch[]) {
  return [...punches].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id));
}

function serialisePunch(punch: EnginePunch): SerializablePunch {
  return {
    id: punch.id,
    occurredAt: punch.occurredAt.toISOString(),
    punchCode: punch.punchCode,
    origin: punch.origin,
    importFileId: punch.importFileId,
    adjustmentId: punch.adjustmentId,
    reason: punch.reason,
  };
}

export function durationInWholeMinutes(start: Date, end: Date) {
  return Math.floor(durationInWholeSeconds(start, end) / 60);
}

export function durationInWholeSeconds(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1_000));
}

function clockMinutes(value: string | null | undefined) {
  if (!value) return undefined;
  const [hours = Number.NaN, minutes = Number.NaN] = value.split(":").map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : undefined;
}

function minuteOfBusinessDay(value: Date) {
  const [hours = 0, minutes = 0] = formatInTimeZone(value, "America/Fortaleza", "HH:mm").split(":").map(Number);
  return hours * 60 + minutes;
}

function toleranceDifference(difference: number, tolerance: number, mode: EngineCalculationPolicy["toleranceMode"]) {
  if (difference <= tolerance) return 0;
  return mode === "EXCESS_ONLY" ? difference - tolerance : difference;
}

function issue(
  type: CalculationInconsistencyType,
  severity: CalculationInconsistencySeverity,
  description: string,
  punchIds: string[] = [],
  context: EngineInconsistency["context"] = {},
): EngineInconsistency {
  return { type, severity, description, punchIds, context };
}

function isDateCovered(businessDate: string, coverage: readonly EngineCoverage[]) {
  return coverage.some((item) => item.status === "CONFIRMED" && Boolean(item.coverageFrom) && Boolean(item.coverageTo) && item.coverageFrom! <= businessDate && item.coverageTo! >= businessDate);
}

export function buildConsideredPunches(
  rawPunches: readonly Omit<EnginePunch, "origin">[],
  adjustments: readonly EngineAdjustment[] = [],
): ConsideredPunches {
  const original = sortPunches(rawPunches.map((punch) => ({ ...punch, origin: "RAW_PUNCH" as const })));
  const active = adjustments.filter((adjustment) => adjustment.status === "ACTIVE");
  const dismissals = new Map(
    active
      .filter((adjustment) => (adjustment.type === "INVALID_PUNCH" || adjustment.type === "DUPLICATE_PUNCH") && adjustment.originalPunchId)
      .map((adjustment) => [adjustment.originalPunchId!, adjustment]),
  );
  const disregarded = original.flatMap((punch) => {
    const adjustment = dismissals.get(punch.id);
    return adjustment ? [{ ...punch, disregardAdjustmentId: adjustment.id, disregardReason: adjustment.reason }] : [];
  });
  const additions = active.flatMap((adjustment) => {
    if (adjustment.type !== "MISSING_PUNCH" || !adjustment.adjustedOccurredAt || !adjustment.adjustedPunchCode) return [];
    return [{
      id: `manual:${adjustment.id}`,
      occurredAt: adjustment.adjustedOccurredAt,
      punchCode: adjustment.adjustedPunchCode,
      origin: "MANUAL_ADJUSTMENT" as const,
      adjustmentId: adjustment.id,
      reason: adjustment.reason,
    }];
  });
  const considered = sortPunches([...original.filter((punch) => !dismissals.has(punch.id)), ...additions]);
  return { original, additions, disregarded, considered };
}

function expectedCodes(schedule: EngineSchedule | null | undefined, policy: EngineCalculationPolicy | null | undefined) {
  return schedule?.requiresBreak || policy?.requiresBreak || schedule?.expectedBreakStart || schedule?.expectedBreakEnd ? ["S", "E", "A", "F"] as const : ["S", "F"] as const;
}

interface PairingResult {
  periods: CalculationMemory["periods"];
  workedSeconds: number;
  breakSeconds: number;
  workedMinutes: number;
  breakMinutes: number;
  complete: boolean;
  unfinished: boolean;
  invalidTransitions: number;
}

function createPeriod(start: EnginePunch, end: EnginePunch, kind: "WORK" | "BREAK"): CalculationMemory["periods"][number] {
  const seconds = durationInWholeSeconds(start.occurredAt, end.occurredAt);
  return { startPunchId: start.id, endPunchId: end.id, seconds, minutes: Math.floor(seconds / 60), kind };
}

/**
 * Forms verifiable periods from codes rather than punch positions. Complete
 * work pairs remain recorded when a later punch is missing or contradictory.
 */
function calculatePeriods(punches: readonly EnginePunch[], requiresBreak: boolean): PairingResult {
  const periods: CalculationMemory["periods"] = [];
  let completedCycles = 0;
  let invalidTransitions = 0;

  if (!requiresBreak) {
    let entry: EnginePunch | undefined;
    for (const punch of punches) {
      if (!entry) {
        if (punch.punchCode === "S") entry = punch;
        else invalidTransitions += 1;
      } else if (punch.punchCode === "F") {
        periods.push(createPeriod(entry, punch, "WORK"));
        completedCycles += 1;
        entry = undefined;
      } else if (punch.punchCode === "S") {
        invalidTransitions += 1;
        entry = punch;
      } else {
        invalidTransitions += 1;
        entry = undefined;
      }
    }
    const workedSeconds = periods.reduce((total, item) => total + item.seconds, 0);
    return {
      periods,
      workedSeconds,
      breakSeconds: 0,
      workedMinutes: Math.floor(workedSeconds / 60),
      breakMinutes: 0,
      complete: completedCycles > 0 && !entry && invalidTransitions === 0,
      unfinished: Boolean(entry),
      invalidTransitions,
    };
  }

  let state: "EXPECT_S" | "EXPECT_E" | "EXPECT_A" | "EXPECT_F" = "EXPECT_S";
  let entry: EnginePunch | undefined;
  let breakOut: EnginePunch | undefined;
  let breakReturn: EnginePunch | undefined;
  for (const punch of punches) {
    if (state === "EXPECT_S") {
      if (punch.punchCode === "S") {
        entry = punch;
        state = "EXPECT_E";
      } else {
        invalidTransitions += 1;
      }
      continue;
    }
    if (state === "EXPECT_E") {
      if (punch.punchCode === "E" && entry) {
        periods.push(createPeriod(entry, punch, "WORK"));
        breakOut = punch;
        state = "EXPECT_A";
      } else if (punch.punchCode === "F" && entry) {
        // A direct S → F remains a provable work period even when the
        // effective schedule expected a recorded break. It is still marked
        // incomplete below rather than erasing recorded time.
        periods.push(createPeriod(entry, punch, "WORK"));
        completedCycles += 1;
        invalidTransitions += 1;
        entry = undefined;
        state = "EXPECT_S";
      } else if (punch.punchCode === "S") {
        invalidTransitions += 1;
        entry = punch;
      } else {
        invalidTransitions += 1;
        entry = undefined;
        state = "EXPECT_S";
      }
      continue;
    }
    if (state === "EXPECT_A") {
      if (punch.punchCode === "A" && breakOut) {
        periods.push(createPeriod(breakOut, punch, "BREAK"));
        breakReturn = punch;
        state = "EXPECT_F";
      } else if (punch.punchCode === "S") {
        invalidTransitions += 1;
        entry = punch;
        breakOut = undefined;
        state = "EXPECT_E";
      } else {
        invalidTransitions += 1;
        entry = undefined;
        breakOut = undefined;
        state = "EXPECT_S";
      }
      continue;
    }
    if (punch.punchCode === "F" && breakReturn) {
      periods.push(createPeriod(breakReturn, punch, "WORK"));
      completedCycles += 1;
      entry = undefined;
      breakOut = undefined;
      breakReturn = undefined;
      state = "EXPECT_S";
    } else if (punch.punchCode === "S") {
      invalidTransitions += 1;
      entry = punch;
      breakOut = undefined;
      breakReturn = undefined;
      state = "EXPECT_E";
    } else {
      invalidTransitions += 1;
      entry = undefined;
      breakOut = undefined;
      breakReturn = undefined;
      state = "EXPECT_S";
    }
  }
  const workedSeconds = periods.filter((item) => item.kind === "WORK").reduce((total, item) => total + item.seconds, 0);
  const breakSeconds = periods.filter((item) => item.kind === "BREAK").reduce((total, item) => total + item.seconds, 0);
  return {
    periods,
    workedSeconds,
    breakSeconds,
    workedMinutes: Math.floor(workedSeconds / 60),
    breakMinutes: Math.floor(breakSeconds / 60),
    complete: completedCycles > 0 && state === "EXPECT_S" && invalidTransitions === 0,
    unfinished: state !== "EXPECT_S",
    invalidTransitions,
  };
}

function sequenceIssues(punches: readonly EnginePunch[], codes: readonly EnginePunchCode[], pairing: PairingResult) {
  const issues: EngineInconsistency[] = [];
  const punchIds = punches.map((punch) => punch.id);
  if (punches.length % 2 !== 0) issues.push(issue("ODD_PUNCH_COUNT", "CRITICAL", "A quantidade ímpar de marcações impede o fechamento automático do dia.", punchIds));
  const found = new Set(punches.map((punch) => punch.punchCode));
  if (!found.has("S")) issues.push(issue("MISSING_ENTRY", "CRITICAL", "Entrada inicial ausente.", punchIds));
  if (!found.has("F")) issues.push(issue("MISSING_EXIT", "CRITICAL", "Saída final ausente.", punchIds));
  if (codes.includes("E") && !found.has("E")) issues.push(issue("MISSING_BREAK_OUT", "WARNING", "Saída para intervalo ausente.", punchIds));
  if (codes.includes("A") && !found.has("A")) issues.push(issue("MISSING_BREAK_RETURN", "WARNING", "Retorno do intervalo ausente.", punchIds));
  if (punches.filter((punch) => punch.punchCode === "S").length > 1) issues.push(issue("MULTIPLE_ENTRIES", "WARNING", "Há mais de uma entrada inicial.", punchIds));
  if (punches.filter((punch) => punch.punchCode === "F").length > 1) issues.push(issue("MULTIPLE_EXITS", "WARNING", "Há mais de uma saída final.", punchIds));
  if (pairing.invalidTransitions > 0) {
    issues.push(issue("INVALID_SEQUENCE", "CRITICAL", `A sequência esperada para esta jornada é ${codes.join(" → ")}.`, punchIds));
  }
  return issues;
}

function duplicateIssues(punches: readonly EnginePunch[], windowMinutes: number) {
  const issues: EngineInconsistency[] = [];
  for (let index = 1; index < punches.length; index += 1) {
    const previous = punches[index - 1];
    const current = punches[index];
    if (!previous || !current || previous.punchCode !== current.punchCode) continue;
    if (durationInWholeSeconds(previous.occurredAt, current.occurredAt) <= windowMinutes * 60) {
      issues.push(issue("POSSIBLE_DUPLICATE", "WARNING", "Marcações com o mesmo código ocorreram muito próximas e exigem revisão.", [previous.id, current.id], { windowMinutes }));
    }
  }
  return issues;
}

export function calculateDailyWithEngine(input: DailyCalculationEngineInput): DailyCalculationEngineOutput {
  const activeAdjustments = (input.adjustments ?? []).filter((adjustment) => adjustment.status === "ACTIVE");
  const consideredPunches = buildConsideredPunches(input.rawPunches, activeAdjustments);
  const punches = consideredPunches.considered;
  const policy = input.policy ?? null;
  const schedule = input.schedule ?? null;
  const coverage = input.coverage ?? [];
  const inconsistencies: EngineInconsistency[] = [];

  if (input.employeeProvisional) inconsistencies.push(issue("PROVISIONAL_EMPLOYEE", "WARNING", "O cadastro do funcionário ainda é provisório."));
  if (!input.employmentPeriod) inconsistencies.push(issue("MISSING_EMPLOYMENT_PERIOD", "CRITICAL", "Não há período de vínculo vigente para esta data."));
  if (!policy) inconsistencies.push(issue("MISSING_CALCULATION_POLICY", "CRITICAL", "Não há política de cálculo atribuída ao vínculo vigente."));
  if (policy?.requiresSchedule && !schedule) inconsistencies.push(issue("MISSING_SCHEDULE", "CRITICAL", "A política exige uma jornada vigente para esta data."));

  const covered = isDateCovered(input.businessDate, coverage);
  if (policy?.calculateAbsence && schedule?.isWorkingDay && !covered) {
    inconsistencies.push(issue("IMPORT_COVERAGE_UNCONFIRMED", "WARNING", "A cobertura do TXT não foi confirmada para esta data; nenhuma ausência foi criada."));
  }
  if (input.calendarDayOff || (schedule && !schedule.isWorkingDay)) {
    if (punches.length > 0) inconsistencies.push(issue("PUNCH_ON_DAY_OFF", "WARNING", "Há marcações em um dia sem jornada de trabalho.", punches.map((punch) => punch.id)));
  }

  const expectedMinutes = policy?.attendanceOnly || !schedule?.isWorkingDay ? 0 : schedule?.expectedMinutes ?? 0;
  // Raw codes define the provable work periods. A break pair in the file must
  // not disappear merely because the schedule/policy context is unavailable.
  const requiresBreak = Boolean(
    schedule?.requiresBreak
    || policy?.requiresBreak
    || schedule?.expectedBreakStart
    || schedule?.expectedBreakEnd
    || punches.some((punch) => punch.punchCode === "E" || punch.punchCode === "A"),
  );
  const codes = expectedCodes(schedule, policy);
  const hasCalculationContext = Boolean(policy && (!policy.requiresSchedule || schedule));
  const pairing = calculatePeriods(punches, requiresBreak);
  const regularSequence = pairing.complete;
  if (punches.length > 0 && !regularSequence) inconsistencies.push(...sequenceIssues(punches, codes, pairing));
  if (punches.length > 0 && policy) inconsistencies.push(...duplicateIssues(punches, policy.duplicateWindowMinutes));

  let rawWorkedMinutes = 0;
  let breakMinutes = 0;
  let periods: CalculationMemory["periods"] = [];
  rawWorkedMinutes = pairing.workedMinutes;
  breakMinutes = pairing.breakMinutes;
  periods = pairing.periods;

  const absenceExcusedByAdjustment = activeAdjustments.some((adjustment) => [
    "MEDICAL_CERTIFICATE",
    "JUSTIFIED_ABSENCE",
    "EXTERNAL_WORK",
    "DAY_OFF",
    "VACATION",
    "LEAVE",
  ].includes(adjustment.type));
  let absenceMinutes = 0;
  if (policy?.calculateAbsence && !policy.attendanceOnly && schedule?.isWorkingDay && punches.length === 0 && covered) {
    absenceMinutes = absenceExcusedByAdjustment ? 0 : expectedMinutes;
    inconsistencies.push(issue(
      "NO_PUNCHES_ON_SCHEDULED_DAY",
      absenceExcusedByAdjustment ? "INFO" : "WARNING",
      absenceExcusedByAdjustment
        ? "Não há marcações no dia, mas existe ajuste ativo que exige tratamento pelo RH."
        : "Não há marcações em dia de jornada dentro da cobertura confirmada do TXT.",
    ));
  }

  const adjustmentDelta = activeAdjustments
    .filter((adjustment) => adjustment.type === "HOURS_CREDIT" || adjustment.type === "HOURS_DEBIT")
    .reduce((sum, adjustment) => sum + adjustment.minutesCredited - adjustment.minutesDebited, 0);
  const consideredMinutes = Math.max(0, rawWorkedMinutes + adjustmentDelta);
  let lateMinutes = 0;
  let earlyDepartureMinutes = 0;
  let shortBreakMinutes = 0;
  let longBreakMinutes = 0;
  if (regularSequence && schedule && policy) {
    const entry = punches[0];
    const exit = punches.at(-1);
    const expectedEntry = clockMinutes(schedule.expectedEntry);
    const expectedExit = clockMinutes(schedule.expectedExit);
    if (entry && expectedEntry !== undefined && policy.calculateLateArrival) {
      lateMinutes = toleranceDifference(Math.max(0, minuteOfBusinessDay(entry.occurredAt) - expectedEntry), policy.entryToleranceMinutes, policy.toleranceMode);
      if (lateMinutes > 0) inconsistencies.push(issue("LATE_ARRIVAL", "WARNING", "Entrada após o horário previsto, conforme a tolerância da política.", [entry.id], { lateMinutes }));
    }
    if (exit && expectedExit !== undefined && policy.calculateEarlyDeparture) {
      earlyDepartureMinutes = toleranceDifference(Math.max(0, expectedExit - minuteOfBusinessDay(exit.occurredAt)), policy.exitToleranceMinutes, policy.toleranceMode);
      if (earlyDepartureMinutes > 0) inconsistencies.push(issue("EARLY_DEPARTURE", "WARNING", "Saída antes do horário previsto, conforme a tolerância da política.", [exit.id], { earlyDepartureMinutes }));
    }
    if (requiresBreak && schedule.expectedBreakMinutes > 0) {
      const difference = breakMinutes - schedule.expectedBreakMinutes;
      shortBreakMinutes = toleranceDifference(Math.max(0, -difference), policy.breakToleranceMinutes, policy.toleranceMode);
      longBreakMinutes = toleranceDifference(Math.max(0, difference), policy.breakToleranceMinutes, policy.toleranceMode);
      if (shortBreakMinutes > 0) inconsistencies.push(issue("INTERVAL_TOO_SHORT", "WARNING", "Intervalo menor que o previsto na jornada.", punches.slice(1, 3).map((punch) => punch.id), { shortBreakMinutes }));
      if (longBreakMinutes > 0) inconsistencies.push(issue("INTERVAL_TOO_LONG", "WARNING", "Intervalo maior que o previsto na jornada.", punches.slice(1, 3).map((punch) => punch.id), { longBreakMinutes }));
    }
    const first = punches[0];
    const last = punches.at(-1);
    if (first && last && expectedEntry !== undefined && expectedExit !== undefined && (minuteOfBusinessDay(first.occurredAt) < expectedEntry || minuteOfBusinessDay(last.occurredAt) > expectedExit)) {
      inconsistencies.push(issue("PUNCH_OUTSIDE_SCHEDULE", "INFO", "Há marcação fora da faixa prevista; ela não gera crédito automático.", [first.id, last.id]));
    }
  }

  const completed = regularSequence && hasCalculationContext && !inconsistencies.some((entry) => entry.severity === "CRITICAL");
  if (punches.length > 0 && !regularSequence) inconsistencies.push(issue("INCOMPLETE_DAY", "CRITICAL", "A sequência incompleta não gera saldo definitivo.", punches.map((punch) => punch.id)));

  const rawExcessMinutes = completed && policy?.calculateExcessTime && !policy.attendanceOnly ? Math.max(0, consideredMinutes - expectedMinutes) : 0;
  const approvedByAdjustment = activeAdjustments.filter((adjustment) => adjustment.type === "EXCESS_APPROVAL").reduce((sum, adjustment) => sum + adjustment.minutesCredited, 0);
  const approvedPositiveMinutes = policy?.allowAutomaticPositiveBalance && !policy.excessRequiresApproval ? rawExcessMinutes : Math.min(rawExcessMinutes, approvedByAdjustment);
  const pendingExcessMinutes = policy?.excessRequiresApproval ? Math.max(0, rawExcessMinutes - approvedPositiveMinutes) : 0;
  if (pendingExcessMinutes > 0) inconsistencies.push(issue("EXCESS_TIME_PENDING", "INFO", "O tempo excedente está pendente de aprovação explícita do RH.", punches.map((punch) => punch.id), { pendingExcessMinutes }));
  const negativeMinutes = completed && policy?.calculateNegativeBalance && !policy.attendanceOnly ? Math.max(0, expectedMinutes - consideredMinutes) : absenceMinutes;

  const status = !policy || !input.employmentPeriod || (!covered && policy.calculateAbsence && schedule?.isWorkingDay)
    ? "PROVISIONAL"
    : inconsistencies.length > 0
      ? "NEEDS_REVIEW"
      : "REGULAR";
  const sourceImportFileIds = [...new Set(consideredPunches.original.flatMap((punch) => punch.importFileId ? [punch.importFileId] : []))];
  const sourceRawPunchIds = consideredPunches.original.map((punch) => punch.id);
  const memory: CalculationMemory = {
    calculationVersion: CALCULATION_ENGINE_VERSION,
    businessDate: input.businessDate,
    employeeId: input.employeeId,
    sourceImportFileIds,
    sourceRawPunchIds,
    coverage: [...coverage],
    employmentPeriod: input.employmentPeriod ?? null,
    policy: policy ? { id: policy.id, name: policy.name, attendanceOnly: policy.attendanceOnly, flexibleSchedule: policy.flexibleSchedule, toleranceMode: policy.toleranceMode } : null,
    schedule,
    originalPunches: consideredPunches.original.map(serialisePunch),
    manualPunches: consideredPunches.additions.map(serialisePunch),
    disregardedPunches: consideredPunches.disregarded.map(serialisePunch),
    consideredPunches: consideredPunches.considered.map(serialisePunch),
    activeAdjustments: activeAdjustments.map((adjustment) => ({ id: adjustment.id, type: adjustment.type, minutesCredited: adjustment.minutesCredited, minutesDebited: adjustment.minutesDebited, reason: adjustment.reason })),
    periods,
    minutes: { expectedMinutes, recordedMinutes: rawWorkedMinutes, consideredMinutes, workedMinutes: consideredMinutes, breakMinutes, lateMinutes, earlyDepartureMinutes, shortBreakMinutes, longBreakMinutes, rawExcessMinutes, pendingExcessMinutes, approvedPositiveMinutes, negativeMinutes, absenceMinutes },
    rounding: {
      policy: ELAPSED_TIME_ROUNDING_POLICY,
      workedSeconds: pairing.workedSeconds,
      workedMinutesBeforeRounding: pairing.workedSeconds / 60,
      workedMinutes: rawWorkedMinutes,
      breakSeconds: pairing.breakSeconds,
      breakMinutesBeforeRounding: pairing.breakSeconds / 60,
      breakMinutes,
    },
    tolerances: policy ? { entry: policy.entryToleranceMinutes, exit: policy.exitToleranceMinutes, break: policy.breakToleranceMinutes, mode: policy.toleranceMode } : null,
    inconsistencies: inconsistencies.map(({ type, severity }) => ({ type, severity })),
  };
  return { expectedMinutes, recordedMinutes: rawWorkedMinutes, consideredMinutes, workedMinutes: consideredMinutes, breakMinutes, lateMinutes, earlyDepartureMinutes, shortBreakMinutes, longBreakMinutes, rawExcessMinutes, pendingExcessMinutes, approvedPositiveMinutes, negativeMinutes, absenceMinutes, status, calculationVersion: CALCULATION_ENGINE_VERSION, consideredPunches, memory, inconsistencies };
}
