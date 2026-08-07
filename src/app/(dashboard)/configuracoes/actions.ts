"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { saveDirectoryEntry, setDirectoryEntryActive, type DirectoryKind } from "@/modules/employees/application/directory-service";
import { ensureDefaultCalculationPolicies, saveCalculationPolicy } from "@/modules/calculations/application/policy-service";
import { getPrisma } from "@/lib/db/prisma";
import { actionErrorCode } from "@/lib/forms/action-result";
import { saveAuthorizedLocation } from "@/modules/mobile-attendance/application/mobile-attendance-service";
import { evaluateLocation } from "@/modules/mobile-attendance/domain/geolocation";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function kind(value: string | undefined): DirectoryKind {
  if (value === "UNIT" || value === "DEPARTMENT" || value === "POSITION" || value === "TAG") return value;
  throw new Error("Tipo de configuração inválido.");
}

type SettingsPath = "/configuracoes" | "/configuracoes/estrutura" | "/configuracoes/regras" | "/configuracoes/locais";

function returnTo(formData: FormData, fallback: SettingsPath = "/configuracoes"): SettingsPath {
  const value = text(formData, "returnTo");
  return value === "/configuracoes" || value === "/configuracoes/estrutura" || value === "/configuracoes/regras" || value === "/configuracoes/locais" ? value : fallback;
}

function redirectError(error: unknown, path = "/configuracoes"): never {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
  redirect(`${path}?erro=${actionErrorCode(error)}` as Route);
}

export async function saveDirectoryAction(formData: FormData) {
  const path = returnTo(formData, "/configuracoes/estrutura");
  try {
    const context = await requireAuditContext();
    await saveDirectoryEntry({ kind: kind(text(formData, "kind")), id: text(formData, "id"), name: text(formData, "name") ?? "", description: text(formData, "description"), active: text(formData, "active") ? text(formData, "active") === "true" : undefined, reason: text(formData, "reason"), context });
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/estrutura");
    revalidatePath("/funcionarios");
    redirect(`${path}?sucesso=${encodeURIComponent("Configuração salva com sucesso.")}` as Route);
  } catch (error) {
    redirectError(error, path);
  }
}

export async function toggleDirectoryAction(formData: FormData) {
  const path = returnTo(formData, "/configuracoes/estrutura");
  try {
    const context = await requireAuditContext();
    await setDirectoryEntryActive({ kind: kind(text(formData, "kind")), id: text(formData, "id") ?? "", active: text(formData, "active") === "true", reason: text(formData, "reason"), context });
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/estrutura");
    revalidatePath("/funcionarios");
    redirect(`${path}?sucesso=${encodeURIComponent("Situação atualizada com sucesso.")}` as Route);
  } catch (error) {
    redirectError(error, path);
  }
}

export async function ensureCalculationPoliciesAction() {
  try {
    const context = await requireAuditContext();
    const policies = await ensureDefaultCalculationPolicies(context);
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/regras");
    redirect(`/configuracoes/regras?sucesso=${encodeURIComponent(`${policies.length} políticas iniciais disponíveis.`)}` as Route);
  } catch (error) {
    redirectError(error, "/configuracoes/regras");
  }
}

export async function updateEntryToleranceModeAction(formData: FormData) {
  const path = returnTo(formData, "/configuracoes/regras");
  try {
    const context = await requireAuditContext();
    const id = text(formData, "policyId");
    const mode = text(formData, "entryToleranceMode");
    const reason = text(formData, "reason");
    if (!id || !mode || !reason) throw new Error("Informe a política, o modo e a justificativa.");
    const policy = await getPrisma().calculationPolicy.findUniqueOrThrow({ where: { id } });
    const saved = await saveCalculationPolicy({ id, value: { ...policy, description: policy.description ?? undefined, entryToleranceMode: mode }, context, reason });
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/regras");
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    revalidatePath("/dashboard");
    redirect(`${path}?sucesso=${encodeURIComponent(`Modo de entrada atualizado; ${saved.calculation.processedDays} dia(s) recalculado(s).`)}` as Route);
  } catch (error) {
    redirectError(error, path);
  }
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function number(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? Number(value) : 0;
}

export async function saveCalculationPolicyAction(formData: FormData) {
  const path = returnTo(formData, "/configuracoes/regras");
  try {
    const context = await requireAuditContext();
    const id = text(formData, "policyId");
    if (!id) throw new Error("Política inválida.");
    const previous = await getPrisma().calculationPolicy.findUniqueOrThrow({ where: { id } });
    const active = checked(formData, "active");
    const reason = text(formData, "reason");
    if (previous.active !== active && !reason?.trim()) throw new Error("Informe a justificativa para alterar uma regra ativa.");
    const saved = await saveCalculationPolicy({
      id,
      value: {
        name: text(formData, "name") ?? "",
        description: text(formData, "description"),
        active,
        requiresSchedule: checked(formData, "requiresSchedule"),
        calculateLateArrival: checked(formData, "calculateLateArrival"),
        calculateEarlyDeparture: checked(formData, "calculateEarlyDeparture"),
        calculateAbsence: checked(formData, "calculateAbsence"),
        calculateNegativeBalance: checked(formData, "calculateNegativeBalance"),
        calculateExcessTime: checked(formData, "calculateExcessTime"),
        excessRequiresApproval: checked(formData, "excessRequiresApproval"),
        requiresBreak: checked(formData, "requiresBreak"),
        shortBreakGeneratesCredit: checked(formData, "shortBreakGeneratesCredit"),
        longBreakGeneratesDebit: checked(formData, "longBreakGeneratesDebit"),
        allowAutomaticPositiveBalance: checked(formData, "allowAutomaticPositiveBalance"),
        attendanceOnly: checked(formData, "attendanceOnly"),
        flexibleSchedule: checked(formData, "flexibleSchedule"),
        duplicateWindowMinutes: number(formData, "duplicateWindowMinutes"),
        entryToleranceMinutes: number(formData, "entryToleranceMinutes"),
        exitToleranceMinutes: number(formData, "exitToleranceMinutes"),
        breakToleranceMinutes: number(formData, "breakToleranceMinutes"),
        toleranceMode: text(formData, "toleranceMode") ?? "FULL_EVENT",
        entryToleranceMode: text(formData, "entryToleranceMode") ?? "FULL_DELAY_AFTER_TOLERANCE",
      },
      context,
      reason,
    });
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/regras");
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    revalidatePath("/dashboard");
    redirect(`${path}?sucesso=${encodeURIComponent(`Regra salva; ${saved.calculation.processedDays} dia(s) foram recalculados.`)}` as Route);
  } catch (error) {
    redirectError(error, path);
  }
}

export async function saveAuthorizedLocationAction(formData: FormData) {
  const path = returnTo(formData, "/configuracoes/locais");
  try {
    const context = await requireAuditContext();
    await saveAuthorizedLocation({
      id: text(formData, "id"),
      unitId: text(formData, "unitId"),
      name: text(formData, "name"),
      latitude: text(formData, "latitude"),
      longitude: text(formData, "longitude"),
      radiusMeters: text(formData, "radiusMeters"),
      maxAccuracyMeters: text(formData, "maxAccuracyMeters"),
      exceptionPolicy: text(formData, "exceptionPolicy"),
      active: checked(formData, "active"),
      reason: text(formData, "reason"),
    }, context);
    revalidatePath("/configuracoes");
    revalidatePath("/configuracoes/locais");
    redirect(`${path}?sucesso=${encodeURIComponent("Local de registro salvo com auditoria.")}` as Route);
  } catch (error) {
    redirectError(error, path);
  }
}

export async function testAuthorizedLocationAction(formData: FormData) {
  const path = returnTo(formData, "/configuracoes/locais");
  try {
    await requireAuditContext();
    const locationId = text(formData, "locationId");
    const latitude = Number(text(formData, "latitude"));
    const longitude = Number(text(formData, "longitude"));
    const accuracyMeters = Number(text(formData, "accuracyMeters"));
    if (!locationId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracyMeters)) throw new Error("Informe coordenadas e precisão válidas para o teste.");
    const location = await getPrisma().authorizedLocation.findUniqueOrThrow({ where: { id: locationId } });
    const result = evaluateLocation({ latitude, longitude, accuracyMeters, authorizedLocation: location });
    const message = result.status === "INSIDE_RADIUS"
      ? `Teste confirmado dentro da área (${Math.round(result.distanceMeters)} m de distância).`
      : result.status === "LOW_ACCURACY"
        ? "Teste recebido, mas a precisão informada não permite confirmação segura."
        : `Teste fora da área (${Math.round(result.distanceMeters)} m de distância).`;
    redirect(`${path}?sucesso=${encodeURIComponent(message)}` as Route);
  } catch (error) {
    redirectError(error, path);
  }
}
