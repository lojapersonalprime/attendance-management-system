import { z } from "zod";

const optionalText = (maxLength: number) => z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).max(maxLength).optional(),
);

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
  // A hidden id field is present on both create and edit forms. Treat its empty
  // create value as absent instead of failing a valid new-location submission.
  id: optionalText(120),
  unitId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  placeProvider: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.enum(["GOOGLE_PLACES", "OPENSTREETMAP_PHOTON"]).optional(),
  ),
  providerPlaceId: optionalText(255),
  providerSearchQuery: optionalText(160),
  formattedAddress: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(3).max(1_000).optional(),
  ),
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(1).max(20_000),
  maxAccuracyMeters: z.coerce.number().int().min(1).max(5_000),
  exceptionPolicy: z.enum(["ALLOW_AND_REVIEW", "BLOCK"]),
  active: z.boolean(),
  reason: z.string().trim().max(1_000).optional(),
});

export const employeeMobileAccountSchema = z.object({
  employeeId: z.string().trim().min(1),
  email: z.string().trim().email("Informe um e-mail válido para o acesso."),
});

export const employeeMobileAccessPinSchema = z.object({
  employeeId: z.string().trim().min(1),
  pin: z.string().regex(/^\d{6}$/, "O PIN deve ter 6 dígitos."),
  confirmPin: z.string().regex(/^\d{6}$/, "Confirme os 6 dígitos do PIN."),
}).refine((value) => value.pin === value.confirmPin, {
  message: "Os PINs informados não conferem.",
  path: ["confirmPin"],
});

export const employeeMobileAccessLocationSchema = z.object({
  employeeId: z.string().trim().min(1),
  authorizedLocationId: z.string().trim().min(1),
});

export const employeeMobileAccessActivationSchema = z.object({
  employeeId: z.string().trim().min(1),
  active: z.boolean(),
});
