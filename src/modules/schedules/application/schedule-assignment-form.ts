import { z } from "zod";

import { scheduleAssignmentInputSchema, type ScheduleAssignmentInput } from "@/modules/employees/domain/validation";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function checked(formData: FormData, ...keys: string[]) {
  return keys.some((key) => formData.get(key) === "on" || formData.get(key) === "true");
}

function validCalendarDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * HTML date inputs submit yyyy-mm-dd, but this also accepts the pt-BR value
 * that can be pasted into an action payload. It never delegates dd/mm/yyyy to
 * Date's implementation-dependent parser.
 */
export function normalizeScheduleAssignmentDate(value: string, label: string, required = false) {
  const normalized = value.trim();
  if (!normalized) {
    if (required) throw new Error(`Informe a ${label}.`);
    return undefined;
  }

  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const brazilian = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : brazilian
      ? { year: Number(brazilian[3]), month: Number(brazilian[2]), day: Number(brazilian[1]) }
      : undefined;

  if (!parts || !validCalendarDate(parts.year, parts.month, parts.day)) {
    throw new Error(`Informe uma ${label} válida.`);
  }

  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export interface ScheduleAssignmentFormInput {
  employeeId: string;
  assignment: ScheduleAssignmentInput;
  recalculateAffectedDays: boolean;
  recalculateUntil?: string;
}

export function parseScheduleAssignmentFormData(formData: FormData): ScheduleAssignmentFormInput {
  const employeeId = formText(formData, "employeeId");
  if (!employeeId) throw new Error("Funcionário inválido.");

  const validFrom = normalizeScheduleAssignmentDate(formText(formData, "validFrom"), "data de início", true);
  if (!validFrom) throw new Error("Informe a data de início.");
  const validUntil = normalizeScheduleAssignmentDate(formText(formData, "validUntil"), "data final");
  const recalculateUntil = normalizeScheduleAssignmentDate(formText(formData, "recalculateUntil"), "data limite do recálculo");
  if (validUntil && validUntil < validFrom) throw new Error("A data final não pode ser anterior à data de início.");
  if (recalculateUntil && recalculateUntil < validFrom) throw new Error("A data limite do recálculo não pode ser anterior à data de início.");

  const assignment = scheduleAssignmentInputSchema.parse({
    scheduleTemplateId: formText(formData, "scheduleTemplateId"),
    validFrom,
    validUntil,
    reason: formText(formData, "reason"),
    closePrevious: checked(formData, "closePrevious"),
    // Accept the legacy field while forms progressively use the explicit name.
    retroactiveConfirmed: checked(formData, "confirmRetroactive", "retroactiveConfirmed"),
  });

  return {
    employeeId,
    assignment,
    recalculateAffectedDays: checked(formData, "recalculateAffectedDays", "recalculate"),
    recalculateUntil,
  };
}

export const scheduleAssignmentFormInputSchema = z.object({
  employeeId: z.string().min(1),
  assignment: scheduleAssignmentInputSchema,
  recalculateAffectedDays: z.boolean(),
  recalculateUntil: z.string().optional(),
});
