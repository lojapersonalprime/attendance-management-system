import { z } from "zod";

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida no formato AAAA-MM-DD.");
const optionalDateValue = z.union([dateValue, z.literal("")]).optional().transform((value) => value || undefined);

export const employmentPeriodInputSchema = z.object({
  employmentType: z.enum(["EMPLOYEE", "INTERN", "APPRENTICE", "CONTRACTOR", "OTHER"]),
  calculationPolicyId: z.string().min(1, "Selecione uma política de cálculo."),
  validFrom: dateValue,
  validUntil: optionalDateValue,
  reason: z.string().trim().min(3, "Informe o motivo da vigência.").max(1_000),
  notes: z.string().trim().max(2_000).optional().transform((value) => value || undefined),
  closePrevious: z.boolean().default(false),
  retroactiveConfirmed: z.boolean().default(false),
}).superRefine((input, context) => {
  if (input.validUntil && input.validUntil < input.validFrom) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "O fim do vínculo não pode ser anterior ao início." });
  }
});

export const calculationPolicyInputSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da política.").max(120),
  description: z.string().trim().max(1_000).optional().transform((value) => value || undefined),
  active: z.boolean().default(true),
  requiresSchedule: z.boolean().default(true),
  calculateLateArrival: z.boolean().default(true),
  calculateEarlyDeparture: z.boolean().default(true),
  calculateAbsence: z.boolean().default(true),
  calculateNegativeBalance: z.boolean().default(true),
  calculateExcessTime: z.boolean().default(true),
  excessRequiresApproval: z.boolean().default(true),
  requiresBreak: z.boolean().default(false),
  shortBreakGeneratesCredit: z.boolean().default(false),
  longBreakGeneratesDebit: z.boolean().default(true),
  allowAutomaticPositiveBalance: z.boolean().default(false),
  attendanceOnly: z.boolean().default(false),
  flexibleSchedule: z.boolean().default(false),
  duplicateWindowMinutes: z.number().int().min(0).max(120).default(2),
  entryToleranceMinutes: z.number().int().min(0).max(240).default(0),
  exitToleranceMinutes: z.number().int().min(0).max(240).default(0),
  breakToleranceMinutes: z.number().int().min(0).max(240).default(0),
  toleranceMode: z.enum(["EXCESS_ONLY", "FULL_EVENT", "IGNORE_WITHIN_TOLERANCE"]).default("FULL_EVENT"),
}).superRefine((policy, context) => {
  if (policy.attendanceOnly && (policy.calculateAbsence || policy.calculateNegativeBalance || policy.calculateExcessTime || policy.allowAutomaticPositiveBalance)) {
    context.addIssue({ code: "custom", message: "Política de somente presença não pode gerar saldo ou ausência automática." });
  }
});

export const importCoverageInputSchema = z.object({
  coverageFrom: dateValue,
  coverageTo: dateValue,
  reason: z.string().trim().min(3, "Informe o motivo da confirmação da cobertura.").max(1_000),
}).refine((input) => input.coverageTo >= input.coverageFrom, {
  message: "O fim da cobertura não pode ser anterior ao início.",
  path: ["coverageTo"],
});

export type EmploymentPeriodInput = z.output<typeof employmentPeriodInputSchema>;
