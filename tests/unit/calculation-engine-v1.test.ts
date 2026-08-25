import { describe, expect, it } from "vitest";
import { buildConsideredPunches, calculateDailyWithEngine, CALCULATION_ENGINE_VERSION, ELAPSED_TIME_ROUNDING_POLICY, type EngineCalculationPolicy } from "@/modules/calculations/domain/calculation-engine";
import { selectEmploymentPeriodForDate, segmentMonthlySummaries } from "@/modules/calculations/domain/employment-periods";
import { calculationInconsistencyLogicalKey, reconcileInconsistencyStatus } from "@/modules/calculations/domain/inconsistency-reconciliation";

function policy(overrides: Partial<EngineCalculationPolicy> = {}): EngineCalculationPolicy {
  return { id: "policy", name: "Política sintética", requiresSchedule: true, calculateLateArrival: true, calculateEarlyDeparture: true, calculateAbsence: true, calculateNegativeBalance: true, calculateExcessTime: true, excessRequiresApproval: true, requiresBreak: true, shortBreakGeneratesCredit: false, longBreakGeneratesDebit: true, allowAutomaticPositiveBalance: false, attendanceOnly: false, flexibleSchedule: false, duplicateWindowMinutes: 2, entryToleranceMinutes: 5, exitToleranceMinutes: 5, breakToleranceMinutes: 0, toleranceMode: "FULL_EVENT", entryToleranceMode: "FULL_DELAY_AFTER_TOLERANCE", ...overrides };
}

const period = { id: "period-clt", employmentType: "EMPLOYEE" as const, calculationPolicyId: "policy", validFrom: "2026-07-01", validUntil: null };
const schedule = { id: "schedule", assignmentId: "assignment", name: "Jornada sintética", isWorkingDay: true, expectedEntry: "08:00", expectedBreakStart: "12:00", expectedBreakEnd: "13:00", expectedExit: "17:00", expectedMinutes: 480, expectedBreakMinutes: 60, minimumBreakMinutes: 30, requiresBreak: true };
const coverage = [{ importFileId: "import", coverageFrom: "2026-07-01", coverageTo: "2026-07-31", status: "CONFIRMED" as const }];

function punch(id: string, code: "S" | "E" | "A" | "F", clock: string) {
  return { id, punchCode: code, occurredAt: new Date(`2026-07-10T${clock}-03:00`), importFileId: "import" };
}

function regularPunches() {
  return [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "17:00:00")];
}

function calculate(overrides: Partial<Parameters<typeof calculateDailyWithEngine>[0]> = {}) {
  return calculateDailyWithEngine({ businessDate: "2026-07-10", employeeId: "employee", rawPunches: regularPunches(), employmentPeriod: period, policy: policy(), schedule, coverage, ...overrides });
}

describe("calculation-engine-v1", () => {
  it("apura uma jornada de 9h com S-E-A-F sem alterar as marcações de origem", () => {
    const nineHourSchedule = { ...schedule, expectedExit: "18:00", expectedMinutes: 540 };
    const source = [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "18:00:00")];
    const original = structuredClone(source);
    const result = calculate({ rawPunches: source, schedule: nineHourSchedule });

    expect(source).toEqual(original);
    expect(result.expectedMinutes).toBe(540);
    expect(result.workedMinutes).toBe(540);
    expect(result.breakMinutes).toBe(60);
    expect(result.negativeMinutes).toBe(0);
    expect(result.status).toBe("REGULAR");
    expect(result.memory.sourceRawPunchIds).toEqual(["s", "e", "a", "f"]);
    expect(result.inconsistencies.some((item) => item.severity === "CRITICAL")).toBe(false);
  });

  it("apura dois períodos, tolerância de entrada e excedente pendente sem contar o intervalo", () => {
    const nineHourSchedule = { ...schedule, expectedExit: "18:00", expectedMinutes: 540 };
    const result = calculate({
      rawPunches: [
        punch("s", "S", "08:03:00"),
        punch("e", "E", "12:01:00"),
        punch("a", "A", "13:02:00"),
        punch("f", "F", "18:05:00"),
      ],
      schedule: nineHourSchedule,
    });

    expect(result).toMatchObject({
      expectedMinutes: 540,
      recordedMinutes: 541,
      consideredMinutes: 544,
      breakMinutes: 61,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      pendingExcessMinutes: 4,
    });
    expect(result.memory.periods.filter((period) => period.kind === "WORK")).toHaveLength(2);
  });

  it("mantém uma jornada de 9h incompleta sem saldo definitivo", () => {
    const nineHourSchedule = { ...schedule, expectedExit: "18:00", expectedMinutes: 540 };
    const result = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00")], schedule: nineHourSchedule });

    expect(result.expectedMinutes).toBe(540);
    expect(result.recordedMinutes).toBe(240);
    expect(result.workedMinutes).toBe(240);
    expect(result.negativeMinutes).toBe(0);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.inconsistencies.map((item) => item.type)).toContain("MISSING_EXIT");
    expect(result.inconsistencies.map((item) => item.type)).toContain("INCOMPLETE_DAY");
  });

  it("preserva o primeiro período concluído quando S-E-A não tem saída final", () => {
    const result = calculate({
      rawPunches: [punch("s", "S", "07:59:00"), punch("e", "E", "12:14:00"), punch("a", "A", "13:10:00")],
      schedule: { ...schedule, expectedExit: "18:00", expectedMinutes: 540 },
    });

    expect(result.recordedMinutes).toBe(255);
    expect(result.workedMinutes).toBe(255);
    expect(result.negativeMinutes).toBe(0);
    expect(result.inconsistencies.map((item) => item.type)).toContain("MISSING_EXIT");
    expect(result.inconsistencies.map((item) => item.type)).toContain("INCOMPLETE_DAY");
  });

  it("preserva um par S-E completo mesmo com somente duas marcações", () => {
    const result = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00")] });
    expect(result.recordedMinutes).toBe(240);
    expect(result.inconsistencies.map((item) => item.type)).toContain("INCOMPLETE_DAY");
    expect(result.negativeMinutes).toBe(0);
  });

  it("preserva S-F comprovado mesmo quando falta o intervalo exigido", () => {
    const result = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("f", "F", "17:00:00")] });
    expect(result.recordedMinutes).toBe(540);
    expect(result.inconsistencies.map((item) => item.type)).toContain("INCOMPLETE_DAY");
    expect(result.negativeMinutes).toBe(0);
  });

  it("aceita S-F completo quando o modelo de horário não exige intervalo", () => {
    const result = calculate({
      rawPunches: [punch("s", "S", "08:00:00"), punch("f", "F", "13:00:00")],
      schedule: {
        ...schedule,
        requiresBreak: false,
        expectedBreakStart: null,
        expectedBreakEnd: null,
        expectedBreakMinutes: 0,
        minimumBreakMinutes: null,
        expectedExit: "13:00",
        expectedMinutes: 300,
      },
    });

    expect(result.expectedMinutes).toBe(300);
    expect(result.recordedMinutes).toBe(300);
    expect(result.workedMinutes).toBe(300);
    expect(result.status).toBe("REGULAR");
    expect(result.inconsistencies.map((item) => item.type)).not.toContain("INCOMPLETE_DAY");
  });

  it("não transforma E em saída final em uma jornada sem intervalo", () => {
    const result = calculate({
      rawPunches: [punch("s", "S", "08:02:11"), punch("e", "E", "13:00:01")],
      schedule: { ...schedule, requiresBreak: false, expectedBreakStart: null, expectedBreakEnd: null, expectedBreakMinutes: 0, minimumBreakMinutes: null, expectedExit: "13:00", expectedMinutes: 300 },
    });
    expect(result.recordedMinutes).toBe(298);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.inconsistencies.map((item) => item.type)).toContain("MISSING_EXIT");
  });

  it("mantém horas verificáveis mesmo sem contexto para apurar saldo", () => {
    const result = calculate({ employmentPeriod: null, policy: null, schedule: null });
    expect(result.recordedMinutes).toBe(480);
    expect(result.workedMinutes).toBe(480);
    expect(result.expectedMinutes).toBe(0);
    expect(result.status).toBe("PROVISIONAL");
  });

  it("calcula S-E-A-F regular com o total exato de segundos", () => {
    const result = calculate({
      rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:06:00"), punch("a", "A", "13:06:00"), punch("f", "F", "18:06:00")],
      schedule: { ...schedule, expectedExit: "18:00", expectedMinutes: 540 },
    });

    expect(result.recordedMinutes).toBe(546);
    expect(result.breakMinutes).toBe(60);
    expect(result.memory.rounding.policy).toBe(ELAPSED_TIME_ROUNDING_POLICY);
    expect(result.memory.rounding.workedSeconds).toBe(32_760);
  });

  it("arredonda para cima uma única vez depois de somar períodos com segundos", () => {
    const result = calculate({
      rawPunches: [punch("s", "S", "08:00:50"), punch("e", "E", "12:06:17"), punch("a", "A", "13:06:52"), punch("f", "F", "18:06:38")],
      schedule: { ...schedule, expectedExit: "18:00", expectedMinutes: 540 },
    });

    expect(result.memory.periods.filter((item) => item.kind === "WORK").map((item) => item.minutes)).toEqual([245, 299]);
    expect(result.memory.rounding.workedSeconds).toBe(32_713);
    expect(result.recordedMinutes).toBe(546);
    expect(result.workedMinutes).toBe(546);
    expect(result.breakMinutes).toBe(61);
  });

  it("mantém pares completos em uma sequência inválida sem inventar horas", () => {
    const result = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("f", "F", "17:00:00")] });
    expect(result.recordedMinutes).toBe(240);
    expect(result.inconsistencies.map((item) => item.type)).toContain("INCOMPLETE_DAY");
    expect(result.inconsistencies.map((item) => item.type)).toContain("INVALID_SEQUENCE");
  });

  it("aceita ciclos completos adicionais sem parear cegamente por posição", () => {
    const result = calculate({
      rawPunches: [
        punch("s1", "S", "08:00:00"), punch("e1", "E", "12:00:00"), punch("a1", "A", "13:00:00"), punch("f1", "F", "17:00:00"),
        punch("s2", "S", "18:00:00"), punch("e2", "E", "20:00:00"), punch("a2", "A", "21:00:00"), punch("f2", "F", "23:00:00"),
      ],
    });
    expect(result.recordedMinutes).toBe(720);
    expect(result.inconsistencies.some((item) => item.type === "INCOMPLETE_DAY")).toBe(false);
  });

  it("trata domingo da jornada de segunda a sexta como folga", () => {
    const result = calculate({
      businessDate: "2026-07-12",
      rawPunches: regularPunches(),
      schedule: { ...schedule, isWorkingDay: false, expectedMinutes: 0, expectedEntry: null, expectedBreakStart: null, expectedBreakEnd: null, expectedExit: null },
    });
    expect(result.expectedMinutes).toBe(0);
    expect(result.inconsistencies.map((item) => item.type)).toContain("PUNCH_ON_DAY_OFF");
  });

  it("trata sábado como folga e segunda-feira como dia previsto", () => {
    const saturday = calculate({
      businessDate: "2026-07-11",
      rawPunches: regularPunches(),
      schedule: { ...schedule, isWorkingDay: false, expectedMinutes: 0, expectedEntry: null, expectedBreakStart: null, expectedBreakEnd: null, expectedExit: null },
    });
    const monday = calculate({ businessDate: "2026-07-13", rawPunches: regularPunches(), schedule: { ...schedule, expectedMinutes: 540, expectedExit: "18:00" } });
    expect(saturday.expectedMinutes).toBe(0);
    expect(monday.expectedMinutes).toBe(540);
  });

  it("registra atraso de 10min conforme a política selecionada", () => {
    const nineHourSchedule = { ...schedule, expectedExit: "18:00", expectedMinutes: 540 };
    const result = calculate({
      rawPunches: [punch("s", "S", "08:10:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "18:00:00")],
      schedule: nineHourSchedule,
    });

    expect(result.lateMinutes).toBe(10);
    expect(result.memory.tolerances?.entry).toBe(5);
    expect(result.inconsistencies.map((item) => item.type)).toContain("LATE_ARRIVAL");
  });

  it("mantém a sequência S-E-A-F e memória reproduzível", () => {
    const result = calculate();
    expect(result.workedMinutes).toBe(480);
    expect(result.breakMinutes).toBe(60);
    expect(result.status).toBe("REGULAR");
    expect(result.calculationVersion).toBe(CALCULATION_ENGINE_VERSION);
    expect(result.memory.periods).toHaveLength(3);
    expect(result.memory.sourceImportFileIds).toEqual(["import"]);
    expect(result.memory.sourceRawPunchIds).toEqual(["s", "e", "a", "f"]);
  });

  it("não cria ausência fora da cobertura ou antes de confirmação", () => {
    const unconfirmed = calculate({ rawPunches: [], coverage: [{ importFileId: "import", coverageFrom: "2026-07-01", coverageTo: "2026-07-31", status: "SUGGESTED" }] });
    const outside = calculate({ businessDate: "2026-08-01", rawPunches: [], coverage });
    expect(unconfirmed.absenceMinutes).toBe(0);
    expect(unconfirmed.inconsistencies.some((item) => item.type === "IMPORT_COVERAGE_UNCONFIRMED")).toBe(true);
    expect(outside.absenceMinutes).toBe(0);
  });

  it("cria ausência somente dentro de cobertura confirmada", () => {
    const result = calculate({ rawPunches: [] });
    expect(result.absenceMinutes).toBe(480);
    expect(result.inconsistencies.some((item) => item.type === "NO_PUNCHES_ON_SCHEDULED_DAY")).toBe(true);
  });

  it("não usa o tipo atual do funcionário para escolher vínculo histórico", () => {
    const periods = [
      { id: "clt", employmentType: "EMPLOYEE" as const, calculationPolicyId: "clt-policy", validFrom: "2026-07-01", validUntil: "2026-07-15" },
      { id: "pj", employmentType: "CONTRACTOR" as const, calculationPolicyId: "pj-policy", validFrom: "2026-07-16", validUntil: null },
    ];
    expect(selectEmploymentPeriodForDate(periods, "2026-07-15").period?.id).toBe("clt");
    expect(selectEmploymentPeriodForDate(periods, "2026-07-16").period?.id).toBe("pj");
  });

  it("detecta períodos sobrepostos", () => {
    const result = selectEmploymentPeriodForDate([
      { id: "a", employmentType: "EMPLOYEE" as const, validFrom: "2026-07-01", validUntil: "2026-07-20" },
      { id: "b", employmentType: "CONTRACTOR" as const, validFrom: "2026-07-15", validUntil: null },
    ], "2026-07-16");
    expect(result.overlapping).toHaveLength(2);
  });

  it("mantém apuração pendente sem vínculo ou política", () => {
    const missingPeriod = calculate({ employmentPeriod: null, policy: null });
    expect(missingPeriod.status).toBe("PROVISIONAL");
    expect(missingPeriod.inconsistencies.map((item) => item.type)).toContain("MISSING_EMPLOYMENT_PERIOD");
    expect(missingPeriod.inconsistencies.map((item) => item.type)).toContain("MISSING_CALCULATION_POLICY");
  });

  it("suporta PJ flexível sem saldo negativo", () => {
    const result = calculate({ policy: policy({ requiresSchedule: false, calculateAbsence: false, calculateNegativeBalance: false, calculateExcessTime: false, flexibleSchedule: true, requiresBreak: true }), schedule: undefined });
    expect(result.workedMinutes).toBe(480);
    expect(result.negativeMinutes).toBe(0);
  });

  it("attendanceOnly não gera saldo ou ausência", () => {
    const result = calculate({ rawPunches: [], policy: policy({ attendanceOnly: true, requiresSchedule: false, calculateAbsence: false, calculateNegativeBalance: false, calculateExcessTime: false }) });
    expect(result.absenceMinutes).toBe(0);
    expect(result.negativeMinutes).toBe(0);
    expect(result.pendingExcessMinutes).toBe(0);
  });

  it("o modo explícito de entrada conta todo atraso ou somente o excesso", () => {
    const punches = [punch("s", "S", "08:07:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "17:00:00")];
    expect(calculate({ rawPunches: punches }).lateMinutes).toBe(7);
    expect(calculate({ rawPunches: punches, policy: policy({ entryToleranceMode: "EXCESS_ONLY_AFTER_TOLERANCE" }) }).lateMinutes).toBe(2);
  });

  it("separa tempo registrado e reconhecido para entrada dentro da tolerância", () => {
    const morningSchedule = { ...schedule, requiresBreak: false, expectedBreakStart: null, expectedBreakEnd: null, expectedBreakMinutes: 0, minimumBreakMinutes: null, expectedExit: "13:00", expectedMinutes: 300 };
    const morningPolicy = policy({ requiresBreak: false, entryToleranceMinutes: 10, exitToleranceMinutes: 0 });
    const calculateMorning = (entry: string, exit = "13:00:00", overrides: Partial<EngineCalculationPolicy> = {}) => calculate({
      rawPunches: [punch("s", "S", entry), punch("f", "F", exit)],
      schedule: morningSchedule,
      policy: { ...morningPolicy, ...overrides },
    });

    const onTime = calculateMorning("08:00:00");
    expect(onTime).toMatchObject({ recordedWorkedMinutes: 300, recognizedWorkedMinutes: 300, expectedMinutes: 300, lateMinutes: 0, negativeMinutes: 0, status: "REGULAR" });

    const withinTolerance = calculateMorning("08:03:00");
    expect(withinTolerance).toMatchObject({ recordedWorkedMinutes: 297, recognizedWorkedMinutes: 300, expectedMinutes: 300, lateMinutes: 0, negativeMinutes: 0, status: "REGULAR" });
    expect(withinTolerance.memory.tolerances).toMatchObject({ entry: 10, entryAppliedMinutes: 3 });
    expect(withinTolerance.memory.minutes.toleranceAppliedMinutes).toBe(3);
    expect(withinTolerance.memory.toleranceApplication).toMatchObject({ expectedEntry: "08:00", recordedEntry: "08:03:00", entryToleranceMinutes: 10, result: "ENTRY_WITHIN_TOLERANCE" });

    const atBoundary = calculateMorning("08:10:00");
    expect(atBoundary).toMatchObject({ recordedWorkedMinutes: 290, recognizedWorkedMinutes: 300, lateMinutes: 0, negativeMinutes: 0 });

    const fullDelay = calculateMorning("08:11:00", "13:00:00", { entryToleranceMode: "FULL_DELAY_AFTER_TOLERANCE" });
    expect(fullDelay).toMatchObject({ recordedWorkedMinutes: 289, recognizedWorkedMinutes: 289, lateMinutes: 11, negativeMinutes: 11 });

    const excessOnly = calculateMorning("08:11:00", "13:00:00", { entryToleranceMode: "EXCESS_ONLY_AFTER_TOLERANCE" });
    expect(excessOnly).toMatchObject({ recordedWorkedMinutes: 289, recognizedWorkedMinutes: 299, lateMinutes: 1, negativeMinutes: 1 });

    const earlyExit = calculateMorning("08:03:00", "12:55:00");
    expect(earlyExit).toMatchObject({ recordedWorkedMinutes: 292, recognizedWorkedMinutes: 295, lateMinutes: 0, earlyDepartureMinutes: 5, negativeMinutes: 5 });
    expect(earlyExit.memory.tolerances).toMatchObject({ entryAppliedMinutes: 3, exitAppliedMinutes: 0 });
  });

  it("sinaliza saída antecipada, intervalo curto e longo", () => {
    const early = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "12:50:00"), punch("f", "F", "16:50:00")] });
    const long = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:15:00"), punch("f", "F", "17:00:00")] });
    expect(early.earlyDepartureMinutes).toBe(10);
    expect(early.shortBreakMinutes).toBe(10);
    expect(long.longBreakMinutes).toBe(15);
  });

  it("deixa excedente pendente até aprovação explícita", () => {
    const result = calculate({ rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "17:14:00")] });
    expect(result.rawExcessMinutes).toBe(14);
    expect(result.pendingExcessMinutes).toBe(14);
    expect(result.approvedPositiveMinutes).toBe(0);
  });

  it("aprova excedente sem inventar minutos trabalhados", () => {
    const result = calculate({
      rawPunches: [punch("s", "S", "08:00:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "17:14:00")],
      adjustments: [{ id: "approval", type: "EXCESS_APPROVAL", status: "ACTIVE", minutesCredited: 10, minutesDebited: 0, reason: "Aprovação sintética" }],
    });
    expect(result.workedMinutes).toBe(494);
    expect(result.rawExcessMinutes).toBe(14);
    expect(result.approvedPositiveMinutes).toBe(10);
    expect(result.pendingExcessMinutes).toBe(4);
  });

  it("mantém ausência justificada auditável sem transformar o dia em débito", () => {
    const result = calculate({
      rawPunches: [],
      adjustments: [{ id: "medical", type: "MEDICAL_CERTIFICATE", status: "ACTIVE", minutesCredited: 0, minutesDebited: 0, reason: "Atestado sintético" }],
    });
    expect(result.absenceMinutes).toBe(0);
    expect(result.negativeMinutes).toBe(0);
    expect(result.memory.activeAdjustments[0]?.type).toBe("MEDICAL_CERTIFICATE");
  });

  it("marca dia incompleto sem saldo definitivo", () => {
    const result = calculate({ rawPunches: regularPunches().slice(0, 3) });
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.negativeMinutes).toBe(0);
    expect(result.inconsistencies.some((item) => item.type === "INCOMPLETE_DAY")).toBe(true);
  });

  it("identifica e preserva duplicidade possível", () => {
    const punches = [punch("s1", "S", "08:00:00"), punch("s2", "S", "08:01:00"), punch("e", "E", "12:00:00"), punch("a", "A", "13:00:00"), punch("f", "F", "17:00:00")];
    const result = calculate({ rawPunches: punches });
    expect(result.consideredPunches.original).toHaveLength(5);
    expect(result.inconsistencies.some((item) => item.type === "POSSIBLE_DUPLICATE")).toBe(true);
  });

  it("não infla horas quando há uma entrada duplicada", () => {
    const result = calculate({
      rawPunches: [
        punch("s1", "S", "08:00:00"),
        punch("s2", "S", "08:01:00"),
        punch("e", "E", "12:00:00"),
        punch("a", "A", "13:00:00"),
        punch("f", "F", "17:00:00"),
      ],
    });

    expect(result.recordedMinutes).toBeLessThanOrEqual(480);
    expect(result.inconsistencies.some((item) => item.type === "POSSIBLE_DUPLICATE")).toBe(true);
    expect(result.inconsistencies.some((item) => item.type === "INCOMPLETE_DAY")).toBe(true);
  });

  it("identifica inserção e desconsideração manual sem alterar originais", () => {
    const source = regularPunches();
    const considered = buildConsideredPunches(source, [
      { id: "manual", type: "MISSING_PUNCH", status: "ACTIVE", adjustedOccurredAt: new Date("2026-07-10T07:59:00-03:00"), adjustedPunchCode: "S", minutesCredited: 0, minutesDebited: 0, reason: "Correção sintética" },
      { id: "remove", type: "DUPLICATE_PUNCH", status: "ACTIVE", originalPunchId: "s", minutesCredited: 0, minutesDebited: 0, reason: "Duplicidade sintética" },
    ]);
    expect(source).toHaveLength(4);
    expect(considered.additions[0]?.origin).toBe("MANUAL_ADJUSTMENT");
    expect(considered.disregarded[0]?.id).toBe("s");
  });

  it("é determinístico, idempotente e não depende da ordem de leitura", () => {
    const source = regularPunches();
    const original = structuredClone(source);
    const first = calculate({ rawPunches: source });
    const second = calculate({ rawPunches: [...source].reverse() });
    expect(source).toEqual(original);
    expect(second.memory).toEqual(first.memory);
    expect(second).toMatchObject({ workedMinutes: first.workedMinutes, negativeMinutes: first.negativeMinutes, pendingExcessMinutes: first.pendingExcessMinutes });
  });

  it("reconcilia inconsistência com auto-resolução e reabertura", () => {
    const issue = { type: "MISSING_SCHEDULE" as const, severity: "CRITICAL" as const, description: "Teste", punchIds: [], context: { schedule: null } };
    const key = calculationInconsistencyLogicalKey({ employeeId: "employee", businessDate: "2026-07-10", issue, calculationVersion: CALCULATION_ENGINE_VERSION });
    expect(key).toContain("MISSING_SCHEDULE");
    expect(reconcileInconsistencyStatus({ id: "x", logicalKey: key, status: "OPEN" }, false)).toBe("AUTO_RESOLVED");
    expect(reconcileInconsistencyStatus({ id: "x", logicalKey: key, status: "AUTO_RESOLVED" }, true)).toBe("REOPENED");
  });

  it("segmenta relatório mensal em CLT e PJ sem misturar saldos", () => {
    const segments = segmentMonthlySummaries([
      { businessDate: "2026-07-01", employmentPeriodId: "clt", employmentType: "EMPLOYEE", calculationPolicyId: "clt-policy", policyName: "CLT padrão", expectedMinutes: 480, workedMinutes: 480, lateMinutes: 0, earlyDepartureMinutes: 0, pendingExcessMinutes: 0, negativeMinutes: 0 },
      { businessDate: "2026-07-16", employmentPeriodId: "pj", employmentType: "CONTRACTOR", calculationPolicyId: "pj-policy", policyName: "PJ flexível", expectedMinutes: 0, workedMinutes: 420, lateMinutes: 0, earlyDepartureMinutes: 0, pendingExcessMinutes: 0, negativeMinutes: 0 },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.employmentType).toBe("EMPLOYEE");
    expect(segments[1]?.employmentType).toBe("CONTRACTOR");
  });
});
