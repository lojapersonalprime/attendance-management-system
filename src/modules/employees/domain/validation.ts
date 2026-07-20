import { z } from "zod";

export const employmentTypes = ["EMPLOYEE", "INTERN", "APPRENTICE", "CONTRACTOR", "OTHER"] as const;
export const employeeStatuses = ["PENDING", "ACTIVE", "ON_LEAVE", "VACATION", "TERMINATED", "INACTIVE", "MERGED"] as const;
export const manageableEmployeeStatuses = ["ACTIVE", "ON_LEAVE", "VACATION", "TERMINATED", "INACTIVE"] as const;
export const weekdays = [0, 1, 2, 3, 4, 5, 6] as const;

export const employmentTypeLabels: Record<(typeof employmentTypes)[number], string> = {
  EMPLOYEE: "Funcionário",
  INTERN: "Estagiário",
  APPRENTICE: "Jovem aprendiz",
  CONTRACTOR: "Prestador de serviço",
  OTHER: "Outro",
};

export const employeeStatusLabels: Record<(typeof employeeStatuses)[number], string> = {
  PENDING: "Cadastro pendente",
  ACTIVE: "Ativo",
  ON_LEAVE: "Afastado",
  VACATION: "Férias",
  TERMINATED: "Desligado",
  INACTIVE: "Inativo",
  MERGED: "Mesclado",
};

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().transform((value) => value || undefined);

const optionalId = optionalText(64);
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida no formato AAAA-MM-DD.");
const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido no formato HH:mm.");
const optionalDateValue = z.union([dateValue, z.literal("")]).optional().transform((value) => value || undefined);
const optionalTimeValue = z.union([timeValue, z.literal("")]).optional().transform((value) => value || undefined);
const optionalMinutes = z.number().int().min(0).max(1_440).optional();

export const employmentTypeSchema = z.enum(employmentTypes);
export const employeeStatusSchema = z.enum(employeeStatuses);
export const manageableEmployeeStatusSchema = z.enum(manageableEmployeeStatuses);

export function normalizeCpf(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\D/g, "");
  return normalized || undefined;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export const employeeInputSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(160),
  clockNameRaw: optionalText(160),
  registration: optionalText(80),
  cpf: optionalText(32).transform(normalizeCpf).refine((value) => !value || value.length === 11, "CPF deve conter 11 dígitos."),
  employmentType: employmentTypeSchema,
  status: employeeStatusSchema.refine((status) => status !== "MERGED", "O status mesclado é definido somente pela operação de mesclagem."),
  positionId: optionalId,
  departmentId: optionalId,
  unitId: optionalId,
  admissionDate: optionalDateValue,
  terminationDate: optionalDateValue,
  notes: optionalText(2_000),
  tagIds: z.array(z.string().min(1)).max(50).default([]),
}).superRefine((input, context) => {
  if (input.terminationDate && input.admissionDate && input.terminationDate < input.admissionDate) {
    context.addIssue({ code: "custom", path: ["terminationDate"], message: "O desligamento não pode ser anterior à admissão." });
  }
  if (input.status === "TERMINATED" && !input.terminationDate) {
    context.addIssue({ code: "custom", path: ["terminationDate"], message: "Informe a data de desligamento." });
  }
});

export const completeProvisionalEmployeeSchema = employeeInputSchema.safeExtend({
  unitId: z.string().min(1, "Informe a unidade."),
  admissionDate: dateValue,
});

export const directoryEntrySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  description: optionalText(1_000),
});

export const deviceLinkInputSchema = z.object({
  deviceId: z.string().min(1, "Selecione o dispositivo."),
  externalEmployeeNumber: z.string().trim().min(1, "Informe o EnNo.").max(80),
  externalEmployeeName: optionalText(160),
  validFrom: dateValue,
  validUntil: optionalDateValue,
}).superRefine((input, context) => {
  if (input.validUntil && input.validUntil < input.validFrom) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "O fim da vigência não pode ser anterior ao início." });
  }
});

export const scheduleDaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isWorkingDay: z.boolean(),
  expectedEntry: optionalTimeValue,
  expectedBreakStart: optionalTimeValue,
  expectedBreakEnd: optionalTimeValue,
  expectedExit: optionalTimeValue,
  expectedMinutes: z.number().int().min(0).max(1_440).default(0),
  expectedBreakMinutes: z.number().int().min(0).max(1_440).default(0),
  minimumBreakMinutes: optionalMinutes,
  entryToleranceMinutes: z.number().int().min(0).max(240).default(0),
  exitToleranceMinutes: z.number().int().min(0).max(240).default(0),
  requiresBreak: z.boolean().default(false),
  excessRequiresApproval: z.boolean().default(true),
}).superRefine((day, context) => {
  const hasBreakStart = Boolean(day.expectedBreakStart);
  const hasBreakEnd = Boolean(day.expectedBreakEnd);
  const hasAnyTime = Boolean(day.expectedEntry || day.expectedExit || hasBreakStart || hasBreakEnd);

  if (!day.isWorkingDay) {
    if (hasAnyTime || day.expectedMinutes !== 0 || day.expectedBreakMinutes !== 0 || day.minimumBreakMinutes !== undefined || day.requiresBreak || day.entryToleranceMinutes !== 0 || day.exitToleranceMinutes !== 0) {
      context.addIssue({ code: "custom", message: "Dia não trabalhado não pode ter horários, intervalo ou minutos previstos." });
    }
    return;
  }

  if (!day.expectedEntry || !day.expectedExit) {
    context.addIssue({ code: "custom", path: ["expectedEntry"], message: "Dias trabalhados exigem entrada e saída final." });
    return;
  }
  if (timeToMinutes(day.expectedExit) <= timeToMinutes(day.expectedEntry)) {
    context.addIssue({ code: "custom", path: ["expectedExit"], message: "A saída final deve ser posterior à entrada." });
  }
  if (hasBreakStart !== hasBreakEnd) {
    context.addIssue({ code: "custom", path: ["expectedBreakStart"], message: "Informe início e fim do intervalo juntos." });
    return;
  }
  if (day.requiresBreak && !hasBreakStart) {
    context.addIssue({ code: "custom", path: ["requiresBreak"], message: "Esta jornada exige intervalo configurado." });
    return;
  }
  const breakMinutes = hasBreakStart && day.expectedBreakStart && day.expectedBreakEnd
    ? timeToMinutes(day.expectedBreakEnd) - timeToMinutes(day.expectedBreakStart)
    : 0;
  if (hasBreakStart && day.expectedBreakStart && day.expectedBreakEnd) {
    if (timeToMinutes(day.expectedBreakStart) <= timeToMinutes(day.expectedEntry)) {
      context.addIssue({ code: "custom", path: ["expectedBreakStart"], message: "O intervalo deve iniciar após a entrada." });
    }
    if (timeToMinutes(day.expectedBreakEnd) <= timeToMinutes(day.expectedBreakStart)) {
      context.addIssue({ code: "custom", path: ["expectedBreakEnd"], message: "O retorno deve ser posterior à saída do intervalo." });
    }
    if (timeToMinutes(day.expectedExit) <= timeToMinutes(day.expectedBreakEnd)) {
      context.addIssue({ code: "custom", path: ["expectedExit"], message: "A saída final deve ser posterior ao retorno do intervalo." });
    }
    if (day.expectedBreakMinutes !== breakMinutes) {
      context.addIssue({ code: "custom", path: ["expectedBreakMinutes"], message: "Os minutos de intervalo devem corresponder aos horários informados." });
    }
  } else if (day.expectedBreakMinutes !== 0) {
    context.addIssue({ code: "custom", path: ["expectedBreakMinutes"], message: "Jornada sem intervalo deve ter zero minutos de intervalo." });
  } else if (day.minimumBreakMinutes !== undefined) {
    context.addIssue({ code: "custom", path: ["minimumBreakMinutes"], message: "Informe mínimo de intervalo somente quando houver intervalo configurado." });
  }
  const expectedWork = timeToMinutes(day.expectedExit) - timeToMinutes(day.expectedEntry) - Math.max(0, breakMinutes);
  if (expectedWork >= 0 && day.expectedMinutes !== expectedWork) {
    context.addIssue({ code: "custom", path: ["expectedMinutes"], message: "Os minutos previstos devem ser coerentes com os horários da jornada." });
  }
  if (day.minimumBreakMinutes !== undefined && day.minimumBreakMinutes > breakMinutes) {
    context.addIssue({ code: "custom", path: ["minimumBreakMinutes"], message: "O mínimo de intervalo não pode exceder o intervalo previsto." });
  }
});

export const scheduleTemplateInputSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da jornada.").max(120),
  description: optionalText(1_000),
  active: z.boolean().default(true),
  days: z.array(scheduleDaySchema).length(7, "Informe os sete dias da semana."),
}).superRefine((input, context) => {
  const received = new Set(input.days.map((day) => day.weekday));
  if (received.size !== 7 || weekdays.some((weekday) => !received.has(weekday))) {
    context.addIssue({ code: "custom", path: ["days"], message: "Cada dia da semana deve ser informado uma única vez." });
  }
});

export const scheduleAssignmentInputSchema = z.object({
  scheduleTemplateId: z.string().min(1, "Selecione a jornada."),
  validFrom: dateValue,
  validUntil: optionalDateValue,
  reason: z.string().trim().min(3, "Informe o motivo da atribuição.").max(1_000),
  closePrevious: z.boolean().default(false),
  retroactiveConfirmed: z.boolean().default(false),
}).superRefine((input, context) => {
  if (input.validUntil && input.validUntil < input.validFrom) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "O fim da vigência não pode ser anterior ao início." });
  }
});

export const employeeMergeInputSchema = z.object({
  primaryEmployeeId: z.string().min(1),
  secondaryEmployeeId: z.string().min(1),
  reason: z.string().trim().min(5, "Explique a justificativa da mesclagem.").max(1_000),
}).refine((input) => input.primaryEmployeeId !== input.secondaryEmployeeId, "Selecione cadastros diferentes para mesclar.");

export const periodRecalculationInputSchema = z.object({
  validFrom: dateValue,
  validUntil: dateValue,
  reason: z.string().trim().min(3, "Informe o motivo do recálculo.").max(1_000),
}).refine((input) => input.validUntil >= input.validFrom, "A data final não pode ser anterior à inicial.");

export const employeeStatusChangeSchema = z.object({
  status: manageableEmployeeStatusSchema,
  terminationDate: optionalDateValue,
  reason: z.string().trim().min(3, "Informe o motivo da alteração de status.").max(1_000),
}).superRefine((input, context) => {
  if (input.status === "TERMINATED" && !input.terminationDate) {
    context.addIssue({ code: "custom", path: ["terminationDate"], message: "Informe a data de desligamento." });
  }
});

export type EmployeeInput = z.output<typeof employeeInputSchema>;
export type CompleteProvisionalEmployeeInput = z.output<typeof completeProvisionalEmployeeSchema>;
export type DeviceLinkInput = z.output<typeof deviceLinkInputSchema>;
export type ScheduleTemplateInput = z.output<typeof scheduleTemplateInputSchema>;
export type ScheduleAssignmentInput = z.output<typeof scheduleAssignmentInputSchema>;
