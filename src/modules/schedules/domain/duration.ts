export interface ScheduleDayDurationInput {
  expectedEntry?: string | null;
  expectedBreakStart?: string | null;
  expectedBreakEnd?: string | null;
  expectedExit?: string | null;
  requiresBreak: boolean;
  isWorkingDay: boolean;
}

export interface ScheduleDayDurationResult {
  firstPeriodMinutes: number;
  secondPeriodMinutes: number;
  expectedMinutes: number;
  expectedBreakMinutes: number;
  formattedExpectedDuration: string;
  formattedBreakDuration: string;
  validationResult: { valid: boolean; message?: string };
}

function minuteOfDay(value: string) {
  const [hoursText = "", minutesText = ""] = value.split(":");
  return Number(hoursText) * 60 + Number(minutesText);
}

function formatDuration(minutes: number) {
  if (minutes === 0) return "0h";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h${remainder.toString().padStart(2, "0")}`;
}

/** Shared client/server calculation for the expected schedule; midnight crossing is deliberately unsupported. */
export function calculateScheduleDayDuration(input: ScheduleDayDurationInput): ScheduleDayDurationResult {
  const empty = (message?: string): ScheduleDayDurationResult => ({ firstPeriodMinutes: 0, secondPeriodMinutes: 0, expectedMinutes: 0, expectedBreakMinutes: 0, formattedExpectedDuration: "0h", formattedBreakDuration: "0h", validationResult: message ? { valid: false, message } : { valid: true } });
  if (!input.isWorkingDay) return empty();
  if (!input.expectedEntry) return empty("Informe o horário de entrada.");
  if (!input.expectedExit) return empty("Informe o horário de saída.");
  const entry = minuteOfDay(input.expectedEntry);
  const exit = minuteOfDay(input.expectedExit);
  if (exit <= entry) return empty("Jornadas que atravessam a meia-noite ainda não são suportadas nesta versão.");
  const hasBreakStart = Boolean(input.expectedBreakStart);
  const hasBreakEnd = Boolean(input.expectedBreakEnd);
  if (hasBreakStart !== hasBreakEnd) return empty("Informe a saída e o retorno do intervalo.");
  if (input.requiresBreak && !hasBreakStart) return empty("Esta jornada exige intervalo configurado.");
  if (!hasBreakStart || !input.expectedBreakStart || !input.expectedBreakEnd) {
    const expectedMinutes = exit - entry;
    return { firstPeriodMinutes: expectedMinutes, secondPeriodMinutes: 0, expectedMinutes, expectedBreakMinutes: 0, formattedExpectedDuration: formatDuration(expectedMinutes), formattedBreakDuration: "0h", validationResult: { valid: true } };
  }
  const breakStart = minuteOfDay(input.expectedBreakStart);
  const breakEnd = minuteOfDay(input.expectedBreakEnd);
  if (breakStart <= entry) return empty("A saída para o intervalo deve ser posterior à entrada.");
  if (breakEnd <= breakStart) return empty("O retorno do intervalo deve ser posterior à saída para o intervalo.");
  if (exit <= breakEnd) return empty("A saída final deve ser posterior ao retorno do intervalo.");
  const firstPeriodMinutes = breakStart - entry;
  const secondPeriodMinutes = exit - breakEnd;
  const expectedBreakMinutes = breakEnd - breakStart;
  const expectedMinutes = firstPeriodMinutes + secondPeriodMinutes;
  return { firstPeriodMinutes, secondPeriodMinutes, expectedMinutes, expectedBreakMinutes, formattedExpectedDuration: formatDuration(expectedMinutes), formattedBreakDuration: formatDuration(expectedBreakMinutes), validationResult: { valid: true } };
}
