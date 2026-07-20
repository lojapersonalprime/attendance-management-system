"use server";

import { revalidatePath } from "next/cache";
import { redirect as nextRedirect } from "next/navigation";
import type { Route } from "next";
import { newScheduleRoute, scheduleRoute, schedulesRoute } from "@/lib/routes";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { duplicateScheduleTemplate, saveScheduleTemplate, setScheduleTemplateActive } from "@/modules/schedules/application/schedule-service";

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
    active: !checked(formData, "inactive"),
    days: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isWorkingDay: checked(formData, `day-${weekday}-working`),
      expectedEntry: text(formData, `day-${weekday}-entry`),
      expectedBreakStart: text(formData, `day-${weekday}-break-start`),
      expectedBreakEnd: text(formData, `day-${weekday}-break-end`),
      expectedExit: text(formData, `day-${weekday}-exit`),
      expectedMinutes: Number(text(formData, `day-${weekday}-minutes`) ?? 0),
      expectedBreakMinutes: Number(text(formData, `day-${weekday}-break-minutes`) ?? 0),
      minimumBreakMinutes: text(formData, `day-${weekday}-minimum-break`) ? Number(text(formData, `day-${weekday}-minimum-break`)) : undefined,
      entryToleranceMinutes: Number(text(formData, `day-${weekday}-entry-tolerance`) ?? 0),
      exitToleranceMinutes: Number(text(formData, `day-${weekday}-exit-tolerance`) ?? 0),
      requiresBreak: checked(formData, `day-${weekday}-requires-break`),
      excessRequiresApproval: !checked(formData, `day-${weekday}-no-excess-approval`),
    })),
  };
}

function redirectError(path: Route, error: unknown): never {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
  const [pathname, currentQuery] = path.split("?", 2);
  const query = new URLSearchParams(currentQuery);
  query.set("erro", error instanceof Error ? error.message : "Não foi possível salvar a jornada.");
  redirect(`${pathname}?${query.toString()}` as Route);
}

export async function saveScheduleAction(formData: FormData) {
  const id = text(formData, "id");
  try {
    const context = await requireAuditContext();
    const template = await saveScheduleTemplate({ id, value: scheduleValue(formData), createVersion: checked(formData, "createVersion"), context });
    revalidatePath(schedulesRoute);
    revalidatePath(scheduleRoute(template.id));
    redirect(scheduleRoute(template.id, { sucesso: "Jornada salva." }));
  } catch (error) {
    redirectError(id ? scheduleRoute(id) : newScheduleRoute, error);
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
