"use server";

import { revalidatePath } from "next/cache";
import { redirect as nextRedirect } from "next/navigation";
import type { Route } from "next";
import { newScheduleRoute, scheduleRoute, schedulesRoute } from "@/lib/routes";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { duplicateScheduleTemplate, removeScheduleTemplate, saveScheduleTemplate, setScheduleTemplateActive } from "@/modules/schedules/application/schedule-service";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function redirect(path: Route): never {
  return nextRedirect(path);
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function scheduleValue(formData: FormData) {
  return {
    name: text(formData, "name"),
    description: text(formData, "description"),
    modelType: text(formData, "modelType") ?? "FIXED",
    active: !checked(formData, "inactive"),
    days: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isWorkingDay: checked(formData, `days.${weekday}.isWorkingDay`),
      expectedEntry: text(formData, `days.${weekday}.expectedEntry`),
      expectedBreakStart: text(formData, `days.${weekday}.expectedBreakStart`),
      expectedBreakEnd: text(formData, `days.${weekday}.expectedBreakEnd`),
      expectedExit: text(formData, `days.${weekday}.expectedExit`),
      expectedMinutes: 0,
      expectedBreakMinutes: 0,
      minimumBreakMinutes: text(formData, `days.${weekday}.minimumBreakMinutes`) ? Number(text(formData, `days.${weekday}.minimumBreakMinutes`)) : undefined,
      entryToleranceMinutes: Number(text(formData, `days.${weekday}.entryToleranceMinutes`) ?? 0),
      exitToleranceMinutes: Number(text(formData, `days.${weekday}.exitToleranceMinutes`) ?? 0),
      requiresBreak: checked(formData, `days.${weekday}.requiresBreak`),
      excessRequiresApproval: checked(formData, `days.${weekday}.excessRequiresApproval`),
    })),
  };
}

function redirectError(path: Route, error: unknown): never {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
  const [pathname, currentQuery] = path.split("?", 2);
  const query = new URLSearchParams(currentQuery);
  const message = error instanceof Error ? error.message : "";
  const isValidationError = error && typeof error === "object" && "issues" in error;
  const code = isValidationError ? "jornada-invalida"
    : message.includes("histórico") ? "historico-preservado"
      : message.includes("Informe o motivo") ? "motivo-obrigatorio"
        : "jornada-indisponivel";
  query.set("erro", code);
  redirect(`${pathname}?${query.toString()}` as Route);
}

export async function saveScheduleAction(formData: FormData) {
  const id = text(formData, "id");
  try {
    const context = await requireAuditContext();
    const template = await saveScheduleTemplate({ id, value: scheduleValue(formData), context });
    revalidatePath(schedulesRoute);
    revalidatePath(scheduleRoute(template.id));
    redirect(scheduleRoute(template.id, { sucesso: "Modelo salvo com sucesso." }));
  } catch (error) {
    redirectError(id ? scheduleRoute(id) : newScheduleRoute, error);
  }
}

export async function removeScheduleAction(formData: FormData) {
  const id = text(formData, "id") ?? "";
  try {
    const context = await requireAuditContext();
    await removeScheduleTemplate({ id, context });
    revalidatePath(schedulesRoute);
    revalidatePath("/funcionarios");
    redirect(`${schedulesRoute}?sucesso=${encodeURIComponent("Modelo removido do catálogo. Funcionários vinculados ficaram sem modelo de horário.")}` as Route);
  } catch (error) {
    redirectError(scheduleRoute(id), error);
  }
}

export async function duplicateScheduleAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    const template = await duplicateScheduleTemplate(text(formData, "id") ?? "", context);
    revalidatePath(schedulesRoute);
    redirect(scheduleRoute(template.id, { sucesso: "Jornada duplicada." }));
  } catch (error) {
    redirectError(schedulesRoute, error);
  }
}

export async function toggleScheduleAction(formData: FormData) {
  const id = text(formData, "id") ?? "";
  try {
    const context = await requireAuditContext();
    await setScheduleTemplateActive({ id, active: text(formData, "active") === "true", reason: text(formData, "reason"), context });
    revalidatePath(schedulesRoute);
    revalidatePath(scheduleRoute(id));
    redirect(scheduleRoute(id, { sucesso: "Status da jornada atualizado." }));
  } catch (error) {
    redirectError(scheduleRoute(id), error);
  }
}
