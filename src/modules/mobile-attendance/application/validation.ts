import { z } from "zod";

export const mobilePunchRegistrationSchema = z.object({
  requestId: z.uuid(),
  pin: z.string().regex(/^\d{6}$/, "Informe os 6 dígitos do PIN."),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().min(0).max(100_000),
  clientObservedAt: z.string().datetime().optional(),
  privacyAccepted: z.boolean().optional(),
});

export const attendanceCorrectionRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mobilePunchId: z.string().trim().min(1).optional(),
  reason: z.enum(["FORGOT_PUNCH", "TIME_REVIEW", "EXTERNAL_WORK", "LOCATION_PROBLEM", "OTHER"]),
  description: z.string().trim().min(3, "Descreva o problema para o RH.").max(2_000),
});

export const authorizedLocationSchema = z.object({
  id: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(1).max(20_000),
  maxAccuracyMeters: z.coerce.number().int().min(1).max(5_000),
  exceptionPolicy: z.enum(["ALLOW_AND_REVIEW", "BLOCK"]),
  active: z.boolean(),
  reason: z.string().trim().max(1_000).optional(),
});

export const employeeMobileAccessSchema = z.object({
  employeeId: z.string().trim().min(1),
  authUserId: z.string().uuid(),
  allowedUnitId: z.string().trim().min(1),
  pin: z.string().regex(/^\d{6}$/, "O PIN deve ter 6 dígitos."),
  active: z.boolean(),
});
