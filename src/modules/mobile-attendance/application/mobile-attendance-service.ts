import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { getPrisma } from "@/lib/db/prisma";
import { addBusinessDateDays, businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmployeeInviteRedirectUrl } from "@/lib/env/public-app-url";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { getAuthenticatedUser } from "@/modules/auth/server/session";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";
import { isMobilePunchEnabled, requireMobilePunchReceiptSecret } from "@/modules/mobile-attendance/domain/feature-flag";
import { evaluateLocation } from "@/modules/mobile-attendance/domain/geolocation";
import { hashPin, nextPinFailureState, verifyPin } from "@/modules/mobile-attendance/domain/pin";
import { mobilePunchEligibility } from "@/modules/mobile-attendance/domain/eligibility";
import { resolveMobilePunchRequest } from "@/modules/mobile-attendance/domain/idempotency";
import { serverRegisteredAt } from "@/modules/mobile-attendance/domain/clock";
import { MobileAttendanceError } from "@/modules/mobile-attendance/application/errors";
import { mobileAccessActivationIssue, mobileAccessActivationMessage } from "@/modules/mobile-attendance/domain/access-configuration";
import { getPlaceSearchProviderForPlace } from "@/modules/places/infrastructure/place-search-provider";
import { requiresProviderResolution, resolveAuthorizedLocationSelection } from "@/modules/mobile-attendance/domain/authorized-location";
import {
  attendanceCorrectionRequestSchema,
  authorizedLocationSchema,
  employeeMobileAccessActivationSchema,
  employeeMobileAccessLocationSchema,
  employeeMobileAccessPinSchema,
  employeeMobileAccountSchema,
  mobilePunchRegistrationSchema,
} from "@/modules/mobile-attendance/application/validation";

async function mobileAuditContext(profileId: string): Promise<AuditContext> {
  const requestHeaders = await headers();
  return {
    userId: profileId,
    ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || undefined,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 1_000) || undefined,
  };
}

function supportCode(requestId: string) {
  return `MP-${requestId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function receiptCode() {
  return `MP-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function receiptHash(input: { receiptCode: string; employeeId: string; unitId: string; registeredAt: Date; requestId: string }) {
  try {
    return createHmac("sha256", requireMobilePunchReceiptSecret())
      .update([input.receiptCode, input.employeeId, input.unitId, input.registeredAt.toISOString(), input.requestId].join("|"))
      .digest("hex");
  } catch {
    throw new MobileAttendanceError("RECEIPT_CONFIGURATION");
  }
}

async function currentMobileAccess() {
  const user = await getAuthenticatedUser();
  if (!user) throw new MobileAttendanceError("UNAUTHORIZED");
  const profile = await getPrisma().profile.findUnique({
    where: { authUserId: user.id },
    include: {
      employeeMobileAccess: {
        include: {
          employee: { include: { unit: true } },
          allowedUnit: true,
          authorizedLocation: true,
        },
      },
    },
  });
  if (!profile?.active || profile.role !== "EMPLOYEE" || !profile.employeeMobileAccess?.active) {
    throw new MobileAttendanceError("EMPLOYEE_NOT_ELIGIBLE");
  }
  return { profile, access: profile.employeeMobileAccess };
}

function locationIssue(input: { status: "OUTSIDE_RADIUS" | "LOW_ACCURACY"; distanceMeters: number; accuracyMeters: number }) {
  return input.status === "OUTSIDE_RADIUS"
    ? {
        type: "MOBILE_PUNCH_OUTSIDE_AUTHORIZED_AREA" as const,
        description: `O funcionário registrou o ponto a ${Math.round(input.distanceMeters)} metros da unidade.`,
      }
    : {
        type: "MOBILE_PUNCH_LOW_ACCURACY" as const,
        description: `A localização do celular não permitiu confirmação segura (precisão informada: ${Math.round(input.accuracyMeters)} metros).`,
      };
}

export async function registerMobilePunch(value: unknown) {
  const input = mobilePunchRegistrationSchema.parse(value);
  if (!isMobilePunchEnabled()) throw new MobileAttendanceError("MOBILE_PUNCH_DISABLED", supportCode(input.requestId));
  const { profile, access } = await currentMobileAccess();
  const audit = await mobileAuditContext(profile.id);
  const requestSupportCode = supportCode(input.requestId);
  const now = new Date();

  if (!access.privacyAcceptedAt && !input.privacyAccepted) throw new MobileAttendanceError("PRIVACY_NOT_ACCEPTED", requestSupportCode);

  if (access.pinLockedUntil && access.pinLockedUntil > now) {
    await getPrisma().$transaction((transaction) => writeAuditLog(transaction, audit, {
      action: "MOBILE_PUNCH_PIN_ATTEMPT_LOCKED",
      entityType: "EmployeeMobileAccess",
      entityId: access.id,
      newData: { requestId: input.requestId, result: "LOCKED" },
    }));
    throw new MobileAttendanceError("PIN_LOCKED", requestSupportCode);
  }
  const eligibility = mobilePunchEligibility({ featureEnabled: true, accessActive: access.active, employeeStatus: access.employee.status, employeeProvisional: access.employee.provisional, employeeUnitId: access.employee.unitId, allowedUnitId: access.allowedUnitId, allowedUnitActive: access.allowedUnit.active });
  if (eligibility) throw new MobileAttendanceError(eligibility, requestSupportCode);

  const existing = await getPrisma().mobilePunch.findUnique({ where: { requestId: input.requestId } });
  const existingRequest = resolveMobilePunchRequest(existing, access.employeeId, access.id);
  if (existingRequest.kind === "RETURN_EXISTING") return { punch: existingRequest.punch, duplicate: true, supportCode: requestSupportCode };
  if (existingRequest.kind === "COLLISION") throw new MobileAttendanceError("REQUEST_COLLISION", requestSupportCode);

  if (!access.pinHash || !access.pinConfiguredAt) throw new MobileAttendanceError("EMPLOYEE_NOT_ELIGIBLE", requestSupportCode);
  const pinMatches = await verifyPin(input.pin, access.pinHash);
  if (!pinMatches) {
    const failure = await getPrisma().$transaction(async (transaction) => {
      const latest = await transaction.employeeMobileAccess.findUniqueOrThrow({ where: { id: access.id }, select: { pinFailedAttempts: true } });
      const next = nextPinFailureState(latest.pinFailedAttempts, now);
      await transaction.employeeMobileAccess.update({ where: { id: access.id }, data: next });
      await writeAuditLog(transaction, audit, {
        action: "MOBILE_PUNCH_PIN_FAILED",
        entityType: "EmployeeMobileAccess",
        entityId: access.id,
        newData: { requestId: input.requestId, result: next.pinLockedUntil ? "LOCKED" : "INVALID", attempts: next.pinFailedAttempts },
      });
      return next;
    });
    throw new MobileAttendanceError(failure.pinLockedUntil ? "PIN_LOCKED" : "PIN_INVALID", requestSupportCode);
  }

  const location = access.authorizedLocation;
  if (!location || !location.active || location.unitId !== access.allowedUnitId) {
    throw new MobileAttendanceError("LOCATION_NOT_CONFIGURED", requestSupportCode);
  }
  const evaluated = {
    location,
    evaluation: evaluateLocation({
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      authorizedLocation: location,
    }),
  };
  if (evaluated.evaluation.blocked) {
    await getPrisma().$transaction((transaction) => writeAuditLog(transaction, audit, {
      action: "MOBILE_PUNCH_LOCATION_BLOCKED",
      entityType: "EmployeeMobileAccess",
      entityId: access.id,
      newData: {
        requestId: input.requestId,
        unitId: access.allowedUnitId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        distanceMeters: evaluated.evaluation.distanceMeters,
        locationStatus: evaluated.evaluation.status,
      },
    }));
    throw new MobileAttendanceError("LOCATION_BLOCKED", requestSupportCode);
  }

  const registeredAt = serverRegisteredAt(); // official time always comes from the server.
  const code = receiptCode();
  const clientObservedAt = input.clientObservedAt ? new Date(input.clientObservedAt) : null;
  const data = {
    employeeId: access.employeeId,
    employeeMobileAccessId: access.id,
    registeredById: profile.id,
    unitId: access.allowedUnitId,
    authorizedLocationId: evaluated.location.id,
    registeredAt,
    clientObservedAt,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    distanceFromLocationMeters: evaluated.evaluation.distanceMeters,
    locationStatus: evaluated.evaluation.status,
    reviewRequired: evaluated.evaluation.reviewRequired,
    requestId: input.requestId,
    receiptCode: code,
    receiptHash: receiptHash({ receiptCode: code, employeeId: access.employeeId, unitId: access.allowedUnitId, registeredAt, requestId: input.requestId }),
  };
  let punch;
  try {
    punch = await getPrisma().$transaction(async (transaction) => {
      const created = await transaction.mobilePunch.create({ data });
      await transaction.employeeMobileAccess.update({
        where: { id: access.id },
        data: { pinFailedAttempts: 0, pinLockedUntil: null, privacyAcceptedAt: access.privacyAcceptedAt ?? (input.privacyAccepted ? registeredAt : undefined) },
      });
      await writeAuditLog(transaction, audit, {
        action: "MOBILE_PUNCH_REGISTERED",
        entityType: "MobilePunch",
        entityId: created.id,
        newData: {
          requestId: input.requestId,
          employeeId: access.employeeId,
          unitId: access.allowedUnitId,
          registeredAt,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          distanceMeters: evaluated.evaluation.distanceMeters,
          locationStatus: evaluated.evaluation.status,
          reviewRequired: evaluated.evaluation.reviewRequired,
          receiptCode: code,
        },
      });
      return created;
    });
  } catch (error) {
    const duplicate = await getPrisma().mobilePunch.findUnique({ where: { requestId: input.requestId } });
    if (duplicate && duplicate.employeeId === access.employeeId && duplicate.employeeMobileAccessId === access.id) return { punch: duplicate, duplicate: true, supportCode: requestSupportCode };
    throw error;
  }

  const businessDate = toBusinessDate(punch.registeredAt);
  const calculation = await runCalculation({
    trigger: "MOBILE_PUNCH",
    employeeId: access.employeeId,
    startedById: profile.id,
    affectedDays: [{ employeeId: access.employeeId, date: businessDate }],
  });
  if (punch.locationStatus !== "INSIDE_RADIUS") {
    const issue = locationIssue({ status: punch.locationStatus, distanceMeters: punch.distanceFromLocationMeters ?? 0, accuracyMeters: punch.accuracyMeters });
    const summary = await getPrisma().dailySummary.findUnique({ where: { employeeId_date: { employeeId: access.employeeId, date: new Date(`${businessDate}T00:00:00.000Z`) } }, select: { id: true } });
    await getPrisma().inconsistency.create({
      data: {
        employeeId: access.employeeId,
        dailySummaryId: summary?.id,
        date: new Date(`${businessDate}T00:00:00.000Z`),
        type: issue.type,
        severity: "WARNING",
        status: "OPEN",
        description: issue.description,
        logicalKey: `mobile-location:${punch.id}`,
        calculationEngineVersion: "calculation-engine-v1",
        metadata: { source: "MOBILE_PUNCH", mobilePunchId: punch.id, requestId: input.requestId, distanceMeters: punch.distanceFromLocationMeters, accuracyMeters: punch.accuracyMeters, locationStatus: punch.locationStatus },
      },
    });
  }
  return { punch, duplicate: false, supportCode: requestSupportCode, calculation };
}

export async function createAttendanceCorrectionRequest(value: unknown) {
  const input = attendanceCorrectionRequestSchema.parse(value);
  const { profile, access } = await currentMobileAccess();
  const audit = await mobileAuditContext(profile.id);
  const punch = input.mobilePunchId
    ? await getPrisma().mobilePunch.findFirst({ where: { id: input.mobilePunchId, employeeId: access.employeeId }, select: { id: true } })
    : null;
  if (input.mobilePunchId && !punch) throw new MobileAttendanceError("UNAUTHORIZED");
  const businessDate = new Date(`${input.businessDate}T00:00:00.000Z`);
  const request = await getPrisma().$transaction(async (transaction) => {
    const created = await transaction.attendanceCorrectionRequest.create({
      data: { employeeId: access.employeeId, mobilePunchId: punch?.id, requestedById: profile.id, businessDate, reason: input.reason, description: input.description },
    });
    const summary = await transaction.dailySummary.findUnique({ where: { employeeId_date: { employeeId: access.employeeId, date: businessDate } }, select: { id: true } });
    await transaction.inconsistency.create({
      data: {
        employeeId: access.employeeId,
        dailySummaryId: summary?.id,
        date: businessDate,
        type: "ATTENDANCE_CORRECTION_REQUEST",
        severity: "WARNING",
        status: "OPEN",
        description: "O funcionário solicitou uma correção de ponto para análise do RH.",
        logicalKey: `attendance-correction:${created.id}`,
        metadata: { source: "EMPLOYEE_PORTAL", correctionRequestId: created.id, reason: input.reason, mobilePunchId: punch?.id ?? null },
      },
    });
    await writeAuditLog(transaction, audit, {
      action: "ATTENDANCE_CORRECTION_REQUESTED",
      entityType: "AttendanceCorrectionRequest",
      entityId: created.id,
      newData: { employeeId: access.employeeId, businessDate: input.businessDate, reason: input.reason, mobilePunchId: punch?.id ?? null },
    });
    return created;
  });
  return request;
}

export async function saveAuthorizedLocation(value: unknown, context: AuditContext) {
  const input = authorizedLocationSchema.parse(value);
  const prisma = getPrisma();
  const resolveProvider = requiresProviderResolution(input);
  // A selected provider place is resolved again by the server before the DB
  // transaction. This avoids trusting browser coordinates and avoids holding a
  // transaction open while an external service is contacted.
  const providerDetails = resolveProvider && input.providerPlaceId
    ? await getPlaceSearchProviderForPlace(input.placeProvider!).getPlaceDetails({ placeId: input.providerPlaceId, query: input.providerSearchQuery })
    : undefined;
  const locationSelection = resolveAuthorizedLocationSelection(input, providerDetails);
  return prisma.$transaction(async (transaction) => {
    const unit = await transaction.unit.findUniqueOrThrow({ where: { id: input.unitId }, select: { id: true, active: true } });
    if (!unit.active) throw new Error("Reative a unidade antes de configurar a localização.");
    const previous = input.id ? await transaction.authorizedLocation.findUnique({ where: { id: input.id } }) : null;
    if (previous && previous.unitId !== input.unitId) throw new Error("A localização deve permanecer vinculada à mesma unidade.");
    const data = {
      unitId: input.unitId,
      name: input.name,
      ...locationSelection,
      radiusMeters: input.radiusMeters,
      maxAccuracyMeters: input.maxAccuracyMeters,
      exceptionPolicy: input.exceptionPolicy,
      active: input.active,
    };
    const saved = previous
      ? await transaction.authorizedLocation.update({ where: { id: previous.id }, data })
      : await transaction.authorizedLocation.create({ data });
    await writeAuditLog(transaction, context, {
      action: previous ? "AUTHORIZED_LOCATION_UPDATED" : "AUTHORIZED_LOCATION_CREATED",
      entityType: "AuthorizedLocation",
      entityId: saved.id,
      oldData: previous ?? undefined,
      newData: saved,
      reason: input.reason,
    });
    return saved;
  });
}

function assertEmployeeCanUseMobileAccess(employee: { status: string; provisional: boolean; unitId: string | null; unit?: { active: boolean } | null }) {
  if (employee.status !== "ACTIVE" || employee.provisional) throw new Error("Somente funcionário ativo e com cadastro completo pode usar o ponto pelo celular.");
  if (!employee.unitId || !employee.unit?.active) throw new Error("Configure uma unidade ativa para o funcionário antes de habilitar o ponto pelo celular.");
}

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  for (let page = 1; page <= 100; page += 1) {
    const result = await supabase.auth.admin.listUsers({ page, perPage: 1_000 });
    if (result.error) throw new Error("Não foi possível consultar as contas de acesso. Tente novamente.");
    const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return { supabase, user };
    if (result.data.users.length < 1_000) return { supabase, user: null };
  }
  throw new Error("Não foi possível consultar as contas de acesso. Tente novamente.");
}

export async function createOrLinkEmployeeMobileAccount(value: unknown, context: AuditContext) {
  const input = employeeMobileAccountSchema.parse(value);
  const employee = await getPrisma().employee.findUniqueOrThrow({
    where: { id: input.employeeId },
    include: { unit: true, mobileAccess: { include: { profile: true } } },
  });
  assertEmployeeCanUseMobileAccess(employee);
  if (employee.mobileAccess) throw new Error("A conta de acesso deste funcionário já está configurada.");

  const { supabase, user: foundUser } = await findAuthUserByEmail(input.email);
  let authUser = foundUser;
  let invited = false;
  if (!authUser) {
    const redirectTo = getEmployeeInviteRedirectUrl();
    const result = await supabase.auth.admin.inviteUserByEmail(input.email, {
      data: { full_name: employee.fullName },
      redirectTo,
    });
    if (result.error || !result.data.user) {
      const retry = await findAuthUserByEmail(input.email);
      if (!retry.user) throw new Error("Não foi possível criar ou convidar a conta de acesso. Confira o e-mail e tente novamente.");
      authUser = retry.user;
    } else {
      authUser = result.data.user;
      invited = true;
    }
  }
  const authEmail = authUser.email;
  if (!authEmail) throw new Error("A conta de acesso não possui e-mail válido.");

  return getPrisma().$transaction(async (transaction) => {
    const existing = await transaction.employeeMobileAccess.findUnique({ where: { employeeId: employee.id }, include: { profile: true } });
    if (existing) {
      if (existing.profile.authUserId !== authUser.id) throw new Error("Este funcionário já está vinculado a outra conta de acesso.");
      return existing;
    }
    const existingProfile = await transaction.profile.findUnique({ where: { authUserId: authUser.id } });
    if (existingProfile?.role && existingProfile.role !== "EMPLOYEE") throw new Error("Esta conta possui acesso administrativo e não pode ser vinculada como funcionário.");
    const profile = existingProfile
      ? await transaction.profile.update({ where: { id: existingProfile.id }, data: { active: true, name: existingProfile.name || employee.fullName, email: authEmail } })
      : await transaction.profile.create({ data: { authUserId: authUser.id, name: String(authUser.user_metadata.full_name || employee.fullName).slice(0, 160), email: authEmail, role: "EMPLOYEE", active: true } });
    const linkedAccess = await transaction.employeeMobileAccess.findUnique({ where: { profileId: profile.id } });
    if (linkedAccess && linkedAccess.employeeId !== employee.id) throw new Error("Esta conta já está vinculada a outro funcionário.");
    const access = await transaction.employeeMobileAccess.create({
      data: { employeeId: employee.id, profileId: profile.id, allowedUnitId: employee.unitId!, active: false },
    });
    await writeAuditLog(transaction, context, {
      action: invited ? "EMPLOYEE_MOBILE_ACCOUNT_INVITED" : "EMPLOYEE_MOBILE_ACCOUNT_LINKED",
      entityType: "EmployeeMobileAccess",
      entityId: access.id,
      newData: { employeeId: employee.id, profileId: profile.id, authUserId: authUser.id, allowedUnitId: access.allowedUnitId, active: false },
    });
    return access;
  });
}

export async function setEmployeeMobileAccessPin(value: unknown, context: AuditContext) {
  const input = employeeMobileAccessPinSchema.parse(value);
  const pinHash = await hashPin(input.pin);
  return getPrisma().$transaction(async (transaction) => {
    const access = await transaction.employeeMobileAccess.findUniqueOrThrow({ where: { employeeId: input.employeeId }, include: { employee: { include: { unit: true } } } });
    assertEmployeeCanUseMobileAccess(access.employee);
    const updated = await transaction.employeeMobileAccess.update({
      where: { id: access.id },
      data: { pinHash, pinConfiguredAt: new Date(), pinFailedAttempts: 0, pinLockedUntil: null },
    });
    await writeAuditLog(transaction, context, {
      action: "EMPLOYEE_MOBILE_PIN_RESET",
      entityType: "EmployeeMobileAccess",
      entityId: updated.id,
      oldData: { pinConfigured: Boolean(access.pinConfiguredAt) },
      newData: { employeeId: access.employeeId, pinConfigured: true, pinReset: true },
    });
    return updated;
  });
}

export async function setEmployeeMobileAuthorizedLocation(value: unknown, context: AuditContext) {
  const input = employeeMobileAccessLocationSchema.parse(value);
  return getPrisma().$transaction(async (transaction) => {
    const access = await transaction.employeeMobileAccess.findUniqueOrThrow({ where: { employeeId: input.employeeId }, include: { employee: { include: { unit: true } } } });
    assertEmployeeCanUseMobileAccess(access.employee);
    const location = await transaction.authorizedLocation.findUniqueOrThrow({ where: { id: input.authorizedLocationId } });
    if (!location.active || location.unitId !== access.allowedUnitId || location.unitId !== access.employee.unitId) {
      throw new Error("Selecione um local autorizado ativo da unidade do funcionário.");
    }
    const updated = await transaction.employeeMobileAccess.update({ where: { id: access.id }, data: { authorizedLocationId: location.id } });
    await writeAuditLog(transaction, context, {
      action: "EMPLOYEE_MOBILE_LOCATION_CHANGED",
      entityType: "EmployeeMobileAccess",
      entityId: updated.id,
      oldData: { authorizedLocationId: access.authorizedLocationId },
      newData: { employeeId: access.employeeId, authorizedLocationId: location.id, unitId: location.unitId },
    });
    return updated;
  });
}

export async function setEmployeeMobileAccessActive(value: unknown, context: AuditContext) {
  const input = employeeMobileAccessActivationSchema.parse(value);
  return getPrisma().$transaction(async (transaction) => {
    const access = await transaction.employeeMobileAccess.findUniqueOrThrow({
      where: { employeeId: input.employeeId },
      include: { employee: { include: { unit: true } }, profile: true, allowedUnit: true, authorizedLocation: true },
    });
    if (input.active) {
      const issue = mobileAccessActivationIssue({
        employeeStatus: access.employee.status,
        employeeProvisional: access.employee.provisional,
        employeeUnitId: access.employee.unitId,
        employeeUnitActive: Boolean(access.employee.unit?.active),
        accountActive: access.profile.active,
        accountRole: access.profile.role,
        pinConfigured: Boolean(access.pinHash && access.pinConfiguredAt),
        allowedUnitId: access.allowedUnitId,
        allowedUnitActive: access.allowedUnit.active,
        authorizedLocation: access.authorizedLocation,
      });
      if (issue) throw new Error(mobileAccessActivationMessage(issue));
    }
    const updated = await transaction.employeeMobileAccess.update({ where: { id: access.id }, data: { active: input.active } });
    await writeAuditLog(transaction, context, {
      action: input.active ? "EMPLOYEE_MOBILE_ACCESS_ACTIVATED" : "EMPLOYEE_MOBILE_ACCESS_DEACTIVATED",
      entityType: "EmployeeMobileAccess",
      entityId: updated.id,
      oldData: { active: access.active },
      newData: { employeeId: access.employeeId, active: updated.active },
    });
    return updated;
  });
}

export async function reviewMobileLocationIssue(input: { inconsistencyId: string; action: "APPROVE" | "JUSTIFY" | "KEEP_IN_REVIEW"; reason?: string; context: AuditContext }) {
  if (!["APPROVE", "JUSTIFY", "KEEP_IN_REVIEW"].includes(input.action)) throw new Error("Ação de localização inválida.");
  if ((input.action === "JUSTIFY" || input.action === "KEEP_IN_REVIEW") && !input.reason?.trim()) throw new Error("Informe a justificativa do tratamento.");
  return getPrisma().$transaction(async (transaction) => {
    const issue = await transaction.inconsistency.findUniqueOrThrow({ where: { id: input.inconsistencyId } });
    if (!["MOBILE_PUNCH_OUTSIDE_AUTHORIZED_AREA", "MOBILE_PUNCH_LOW_ACCURACY"].includes(issue.type)) throw new Error("Pendência de localização inválida.");
    const status = input.action === "KEEP_IN_REVIEW" ? "IN_REVIEW" : "RESOLVED" as const;
    const updated = await transaction.inconsistency.update({
      where: { id: issue.id },
      data: { status, resolvedById: status === "RESOLVED" ? input.context.userId : null, resolvedAt: status === "RESOLVED" ? new Date() : null, resolutionReason: input.reason?.trim() || (input.action === "APPROVE" ? "Localização aprovada após análise do RH." : null) },
    });
    await writeAuditLog(transaction, input.context, { action: "MOBILE_PUNCH_LOCATION_REVIEWED", entityType: "Inconsistency", entityId: issue.id, oldData: { status: issue.status }, newData: { status: updated.status, action: input.action }, reason: input.reason });
    return updated;
  });
}

export async function getEmployeeMobilePortalData() {
  const { profile, access } = await currentMobileAccess();
  const today = toBusinessDate(new Date());
  const start = new Date(`${today}T00:00:00.000Z`);
  const rangeStart = businessDateTimeToUtc(`${today} 00:00:00`);
  const rangeEnd = businessDateTimeToUtc(`${addBusinessDateDays(today, 1)} 00:00:00`);
  const [punches, summary, corrections] = await Promise.all([
    getPrisma().mobilePunch.findMany({ where: { employeeId: access.employeeId, registeredAt: { gte: rangeStart, lt: rangeEnd } }, orderBy: { registeredAt: "asc" } }),
    getPrisma().dailySummary.findUnique({ where: { employeeId_date: { employeeId: access.employeeId, date: start } } }),
    getPrisma().attendanceCorrectionRequest.findMany({ where: { employeeId: access.employeeId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { profile, access, today, punches, summary, corrections };
}

export async function getEmployeeMobileRecords() {
  const { profile, access } = await currentMobileAccess();
  const punches = await getPrisma().mobilePunch.findMany({ where: { employeeId: access.employeeId }, orderBy: { registeredAt: "desc" }, take: 180 });
  const dates = [...new Set(punches.map((punch) => toBusinessDate(punch.registeredAt)))].map((date) => new Date(`${date}T00:00:00.000Z`));
  const [summaries, corrections] = await Promise.all([
    dates.length > 0 ? getPrisma().dailySummary.findMany({ where: { employeeId: access.employeeId, date: { in: dates } } }) : [],
    getPrisma().attendanceCorrectionRequest.findMany({ where: { employeeId: access.employeeId }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  return { profile, access, punches, summaries, corrections };
}
