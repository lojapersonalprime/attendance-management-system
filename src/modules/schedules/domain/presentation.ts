import { formatMinutes } from "@/lib/dates/business";

const weekdayLabels = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export interface SchedulePresentationDay {
  weekday: number;
  isWorkingDay: boolean;
  expectedEntry: string | null;
  expectedExit: string | null;
  expectedMinutes: number;
  requiresBreak: boolean;
}

export function getSchedulePresentation(input: { modelType: "FIXED" | "FLEXIBLE" | "ATTENDANCE_ONLY"; days: readonly SchedulePresentationDay[] }) {
  if (input.modelType === "FLEXIBLE") return { status: "flexible" as const, title: "Horário flexível", detail: "Sem carga semanal fixa", weeklyMinutes: 0, workingDays: 0 };
  if (input.modelType === "ATTENDANCE_ONLY") return { status: "attendance-only" as const, title: "Somente presença", detail: "Registra presença sem jornada prevista", weeklyMinutes: 0, workingDays: 0 };
  const workingDays = input.days.filter((day) => day.isWorkingDay);
  const weeklyMinutes = workingDays.reduce((total, day) => total + day.expectedMinutes, 0);
  if (workingDays.length === 0) return { status: "incomplete" as const, title: "Modelo incompleto", detail: "Configure dias e horários antes de atribuir", weeklyMinutes, workingDays: 0 };
  const first = workingDays[0]!;
  const dayRange = workingDays.length === 5 && workingDays.every((day) => [1, 2, 3, 4, 5].includes(day.weekday))
    ? "Segunda a sexta"
    : workingDays.map((day) => weekdayLabels[day.weekday]).join(", ");
  const hourRange = first.expectedEntry && first.expectedExit ? `${first.expectedEntry} às ${first.expectedExit}` : "Horário a configurar";
  return { status: "fixed" as const, title: dayRange, detail: `${hourRange}${first.requiresBreak ? " · com intervalo" : " · sem intervalo"}`, weeklyMinutes, workingDays: workingDays.length, dailyMinutes: first.expectedMinutes, dailyLabel: formatMinutes(first.expectedMinutes) };
}
